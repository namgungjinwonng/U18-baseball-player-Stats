// 학교 야구장 좌표가 실제 학교 부지(OSM 경계) 안에 있는지 검사해 정류장·도로·시군구 중심 같은 엉뚱한 위치를 찾고, --apply 시 보정한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquireFieldLock, getFieldText, requestStats } from "./fieldsHttp.js";
import { distance, type Field, type FieldOverride } from "./fieldsUtil.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const cacheDir = path.join(root, "scraper/.cache");
const schoolSource = "https://www.data.go.kr/data/15021148/standard.do";
// OSM 경계가 없는 학교는 표준데이터 학교 대표점과의 거리로만 판단한다.
const SCHOOL_RADIUS_M = 200;
type Row = Record<string, string>;
type Pt = { lat: number; lon: number };
type OsmEl = { type: string; id: number; tags?: Record<string, string>; geometry?: Pt[]; members?: { role: string; geometry?: Pt[] }[] };
const value = (r: Row, k: string) => r[k] ?? r[k.toLowerCase()] ?? "";
const norm = (s: string) => s.replace(/\s/g, "");
const round6 = (n: number) => +n.toFixed(6);
// OSM 학교 이름은 「건국대학교 서울캠퍼스」「대전버드내중학교」「전주기전대학」처럼 캠퍼스·지역명·「교」가 붙거나 빠진다.
const nameKey = (s: string) => norm(s.replace(/\s+\S*캠퍼스$/, "")).replace(/교$/, "");
// 「동산중고등학교」「상명중,고등학교」「서울디자인고등학교·동도중학교」처럼 한 경계에 여러 학교가 묶인 이름은 각각으로 나눈다.
const schoolNames = (osmName: string) => [osmName, osmName.replace(/중\s*[·,]?\s*고등학교$/, "중학교"), osmName.replace(/중\s*[·,]?\s*고등학교$/, "고등학교"), ...osmName.split(/[·,.]/)];
const sameSchool = (osmName: string, ours: string) => schoolNames(osmName).some((n) => {
  const a = nameKey(n), b = nameKey(ours);
  return b.length >= 4 && (a === b || a.endsWith(b) || b.endsWith(a) && a.length >= 4);
});

async function schoolRows(): Promise<Row[]> {
  const cache = path.join(cacheDir, "fields-schools.json");
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, "utf8"));
  // fieldsSchoolSource.ts 와 같은 공개 전체 다운로드 — 인증키 API 를 반복 호출하지 않는다.
  const h = JSON.parse(await getFieldText("https://www.data.go.kr/download/columList.json?pk=15021148&ext=JSON"));
  if (h.totalCount > 50_000 || !Array.isArray(h.tableVO?.colNmList)) throw new Error("학교 공개 다운로드 형식 확인 필요");
  const rows: Row[] = [];
  for (let page = 1; page <= Math.ceil(h.totalCount / 10000); page++) {
    const q = new URLSearchParams({ publicDataPk: "15021148", totalCount: String(h.totalCount), svcTableNm: h.tableVO.svcTableNm, perPage: "10000", page: String(page) });
    for (const c of h.tableVO.colNmList) q.append("colNmList", c);
    const result = JSON.parse(await getFieldText("https://www.data.go.kr/download/standard.json?" + q));
    if (!Array.isArray(result)) throw new Error("학교 다운로드 결과 형식 확인 필요");
    rows.push(...result);
  }
  if (rows.length !== h.totalCount) throw new Error(`학교 다운로드 행 수 불일치 ${rows.length}/${h.totalCount}`);
  fs.writeFileSync(cache, JSON.stringify(rows));
  return rows;
}

// 관계(multipolygon)의 outer 조각을 끝점끼리 이어 닫힌 고리로 만든다.
function rings(e: OsmEl): Pt[][] {
  if (e.geometry) return [e.geometry];
  const parts = (e.members ?? []).filter((m) => m.role === "outer" && m.geometry?.length).map((m) => [...m.geometry!]);
  const out: Pt[][] = [];
  const same = (a: Pt, b: Pt) => a.lat === b.lat && a.lon === b.lon;
  while (parts.length) {
    const ring = parts.shift()!;
    for (let grew = true; grew && !same(ring[0], ring.at(-1)!);) {
      grew = false;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (same(ring.at(-1)!, p[0])) ring.push(...p.slice(1));
        else if (same(ring.at(-1)!, p.at(-1)!)) ring.push(...p.reverse().slice(1));
        else continue;
        parts.splice(i, 1); grew = true; break;
      }
    }
    out.push(ring);
  }
  return out;
}
function inRing(p: Pt, ring: Pt[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.lat > p.lat) !== (b.lat > p.lat) && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) inside = !inside;
  }
  return inside;
}
const inside = (p: Pt, e: OsmEl) => rings(e).some((r) => r.length > 3 && inRing(p, r));
const center = (e: OsmEl): Pt => { const g = rings(e).flat(); return { lat: round6(g.reduce((s, p) => s + p.lat, 0) / g.length), lon: round6(g.reduce((s, p) => s + p.lon, 0) / g.length) }; };
const osmUrl = (e: OsmEl) => `https://www.openstreetmap.org/${e.type}/${e.id}`;

acquireFieldLock();
const rows = await schoolRows();
const data = read<{ fields: Field[] }>("data/fields.json");
const targets = data.fields.filter((f) => /학교$/.test(f.name) && ["고등학교", "중학교", "대학교"].includes(f.kind)).map((f) => {
  // 동명 학교가 여러 지역에 있으므로 같은 시·군·구 주소의 운영 학교만 대응시킨다.
  const local = rows.filter((r) => norm(value(r, "SCHOOL_NM")) === norm(f.name) && value(r, "OPER_STTUS") === "운영" && (value(r, "RDNMADR") || value(r, "LNMADR")).includes(f.sigungu));
  const r = local.length === 1 ? local[0] : undefined;
  const official = r && Number(value(r, "LATITUDE")) ? { lat: round6(Number(value(r, "LATITUDE"))), lon: round6(Number(value(r, "LONGITUDE"))) } : undefined;
  return { f, official, officialAddress: r ? value(r, "RDNMADR") || value(r, "LNMADR") : undefined };
});

// 학교 부지와 운동장 형상을 한 번에 받는다(공개 좌표만 전송, 결과는 캐시).
const osmCache = path.join(cacheDir, "fields-coord-osm.json");
let osm: { elements: OsmEl[] };
if (fs.existsSync(osmCache)) osm = JSON.parse(fs.readFileSync(osmCache, "utf8"));
else {
  const pts = new Map<string, Pt>();
  for (const t of targets) for (const p of [t.f, t.official]) if (p) pts.set(`${p.lat},${p.lon}`, p);
  const around = (sel: string, r: number) => [...pts.values()].map((p) => `${sel}(around:${r},${p.lat},${p.lon});`).join("");
  const query = `[out:json][timeout:300];(${around('way["amenity"~"^(school|university|college)$"]', 500)}${around('relation["amenity"~"^(school|university|college)$"]', 500)}${around('way["leisure"="pitch"]', 700)});out geom;`;
  const body = await getFieldText("https://overpass-api.de/api/interpreter", { method: "POST", body: new URLSearchParams({ data: query }), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  osm = JSON.parse(body);
  fs.writeFileSync(osmCache, body);
}
const schools = osm.elements.filter((e) => /^(school|university|college)$/.test(e.tags?.amenity ?? ""));
const pitches = osm.elements.filter((e) => e.tags?.leisure === "pitch" && e.type === "way");

type Check = { id: string; name: string; status: "학교 안" | "보정" | "검토" | "학교 경계 없음" | "미확인"; reason: string; ours: [number, number]; to?: [number, number]; distanceM?: number; school?: string; pitch?: string; officialAddress?: string };
const checks: Check[] = [];
for (const { f, official, officialAddress } of targets) {
  const base = { id: f.id, name: f.name, ours: [f.lat, f.lon] as [number, number], officialAddress };
  // 이름이 같은 학교 경계, 없으면 표준데이터 학교 대표점을 품은 학교 경계를 쓴다.
  const named = schools.filter((s) => sameSchool(s.tags?.name ?? "", f.name) && (inside(f, s) || (official && inside(official, s)) || distance(center(s), official ?? f) < 1500));
  const site = named.length ? named : official ? schools.filter((s) => inside(official, s)) : [];
  // KBSA 주소가 학교 주소와 다르면 학교 밖 별도 구장일 수 있어 자동 보정하지 않는다. 시·군·구 중심 추정 좌표는 학교 위치가 항상 낫다.
  const road = (s?: string) => (s ?? "").replace(/\s*\(.*$/, "").replace(/^\S+\s/, "").trim();
  const sameAddress = (!!officialAddress && (!f.addr || road(f.addr) === road(officialAddress))) || /중심\(추정\)/.test(f.note ?? "");
  if (!site.length) {
    if (!official) { checks.push({ ...base, status: "미확인", reason: "OSM 학교 경계와 표준데이터 학교 좌표 모두 없음" }); continue; }
    const d = Math.round(distance(f, official));
    if (d <= SCHOOL_RADIUS_M) { checks.push({ ...base, status: "학교 경계 없음", reason: `OSM 학교 경계 없음 — 표준데이터 학교 대표점과 ${d}m`, distanceM: d }); continue; }
    checks.push({ ...base, status: sameAddress ? "보정" : "검토", distanceM: d, to: [official.lat, official.lon],
      reason: `OSM 학교 경계 없음 — 표준데이터 학교 대표점으로 ${d}m 이동${sameAddress ? "" : officialAddress ? " (등록 주소가 학교 주소와 달라 검토 필요)" : " (학교 공식 주소 자료 없음 — 캠퍼스 밖 구장일 수 있어 검토 필요)"}` });
    continue;
  }
  const school = site[0];
  if (site.some((s) => inside(f, s))) { checks.push({ ...base, status: "학교 안", reason: "현재 좌표가 학교 부지 안", school: osmUrl(school) }); continue; }
  // 학교 안 야구장 형상 → 학교 안 가장 큰 운동장 → 표준데이터 학교 대표점 → 학교 경계 중심 순으로 옮길 곳을 정한다.
  // 대표점이 이름이 다른 이웃 학교 경계(장충고→장원중 등)에 잡혔으면 그 학교 운동장을 쓰지 않고, 대표점 근처면 정상으로 본다.
  const ownSite = named.length > 0 || !school.tags?.name;
  // 대략적으로 그린 OSM 경계가 학교 대표점을 비켜 가는 경우(강원중고 등) — 이미 대표점이면 옮기지 않는다.
  if (official && (distance(f, official) <= 30 || (!ownSite && distance(f, official) <= SCHOOL_RADIUS_M))) {
    const d = Math.round(distance(f, official));
    checks.push({ ...base, status: "학교 경계 없음", reason: `학교 OSM 경계로는 판단 불가 — 표준데이터 학교 대표점과 ${d}m`, distanceM: d });
    continue;
  }
  const inSchool = ownSite ? pitches.filter((p) => site.some((s) => inside(center(p), s))) : [];
  const baseball = inSchool.find((p) => /baseball/.test(p.tags?.sport ?? ""));
  const area = (p: OsmEl) => { const g = p.geometry ?? []; let a = 0; for (let i = 0, j = g.length - 1; i < g.length; j = i++) a += (g[j].lon + g[i].lon) * (g[j].lat - g[i].lat); return Math.abs(a); };
  const field = baseball ?? inSchool.sort((a, b) => area(b) - area(a))[0];
  const to = field ? center(field) : official ?? center(school);
  const d = Math.round(distance(f, to));
  checks.push({ ...base, status: sameAddress ? "보정" : "검토", distanceM: d, to: [to.lat, to.lon], school: ownSite ? osmUrl(school) : undefined, pitch: field ? osmUrl(field) : undefined,
    reason: `현재 좌표가 학교 부지 밖 — ${baseball ? "학교 안 야구장" : field ? "학교 안 운동장" : official ? "표준데이터 학교 대표점" : "학교 경계 중심"}으로 ${d}m 이동${sameAddress ? "" : officialAddress ? " (등록 주소가 학교 주소와 달라 검토 필요)" : " (학교 공식 주소 자료 없음 — 캠퍼스 밖 구장일 수 있어 검토 필요)"}` });
}
const order = ["보정", "검토", "미확인", "학교 경계 없음", "학교 안"];
checks.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || (b.distanceM ?? 0) - (a.distanceM ?? 0));

const apply = process.argv.includes("--apply");
if (apply) {
  const overrides = read<Record<string, FieldOverride>>("data/fields-overrides.json");
  for (const c of checks.filter((c) => c.status === "보정")) {
    const onBaseball = c.reason.includes("학교 안 야구장");
    // 기존 주소 대조 기록과 출처는 남기고 좌표 보정 근거를 덧붙인다.
    const prev = overrides[c.id]?.note?.replace(/[.\s]*기존 좌표 유지$/, "");
    const coordNote = `좌표가 학교 부지 밖(정류장·도로·시군구 중심 등)이라 ${onBaseball ? `학교 안 OSM 야구장(${c.pitch})` : c.pitch ? `학교 안 OSM 운동장(${c.pitch})` : "표준데이터 학교 좌표"}${c.pitch ? "으로" : "로"} 보정(2026-10-30)${c.school ? `. 학교 경계 ${c.school}` : ""}${onBaseball ? "" : ". 야구장 면·출입구는 별도 확인"}`;
    overrides[c.id] = { ...overrides[c.id], lat: c.to![0], lon: c.to![1], approx: !onBaseball, source: overrides[c.id]?.source ?? c.pitch ?? c.school ?? schoolSource,
      note: prev ? `${prev}. ${coordNote}` : coordNote };
  }
  fs.writeFileSync(path.join(root, "data/fields-overrides.json"), JSON.stringify(overrides, null, 2) + "\n");
}
const counts = Object.fromEntries(order.map((s) => [s, checks.filter((c) => c.status === s).length]));
fs.writeFileSync(path.join(root, "data/fields-coord-audit.json"), JSON.stringify({ checkedAt: "2026-10-30", sources: [schoolSource, "https://www.openstreetmap.org/copyright"], counts, checks }, null, 2) + "\n");
console.log(JSON.stringify({ ...requestStats, osmElements: osm.elements.length, checked: checks.length, counts, applied: apply }));
for (const c of checks.filter((c) => c.status === "보정" || c.status === "검토")) console.log(`${c.status}\t${c.distanceM}m\t${c.id}\t${c.name}\t${c.reason}`);
