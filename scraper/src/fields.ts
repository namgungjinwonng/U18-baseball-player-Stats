// 전국 야구장 현황 수집기 — KBSA 중·고·대·일반부 팀(학교 위치/주소), 공식경기 구장, 프로야구장, OpenStreetMap 야구장을 data/fields.json 으로
// 실행: npm run fields  (FIELDS_FULL=1 이면 KBSA 팀 주소를 모두 다시 확인, OSM_REFRESH=1 이면 OSM 즉시 갱신)
// 위치를 이미 찾은 항목은 다시 찾지 않는다 — 평소에는 KBSA 신생팀만 찾고, OSM 은 7일마다 갱신한다.
// Nominatim(OpenStreetMap) 이용 규칙: 1초 1회, 식별 가능한 User-Agent, 결과 캐시 — fields.json 이 캐시다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE } from "./koreaBaseball.js";
import { acquireFieldLock, getFieldText as getText, NOMINATIM_BASE, requestStats } from "./fieldsHttp.js";
import { collectionYear } from "./collectionYear.js";
import { PRO_STADIUM_DETAILS, resolveProStadium } from "./fieldsPro.js";
import { stripResidentialUnit } from "./fieldsAddressUtil.js";
import {
  KIND_ORDER, SIDO_ORDER, addressCandidates, distance, fullNomAddress, isFieldName, isOutdoorBaseballTags, isProName, isSchoolResult, isOfficeAddress, mergeFieldData, parkOf, regionOf, schoolName, teamInfoFromHtml,
  type ExtraFields, type FieldOverride, type Field, type FieldKind, type NomAddress, type ParkBox,
} from "./fieldsUtil.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const DAY = 864e5;

interface FieldsFile { updated: string; kbsaFullAt?: string; osmAt?: string; fields: Field[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Nominatim (1.1초 간격) ──
interface NomResult { lat: string; lon: string; name?: string; category?: string; type?: string; address?: NomAddress; display_name?: string }
async function nominatim(pathname: "search" | "reverse", q: Record<string, string>): Promise<NomResult[]> {
  const params = new URLSearchParams({ ...q, format: "jsonv2", addressdetails: "1", "accept-language": "ko" });
  const body = JSON.parse(await getText(`${NOMINATIM_BASE}/${pathname}?${params}`));
  return Array.isArray(body) ? body : body && !body.error ? [body] : [];
}
const search = (text: string) => nominatim("search", { q: text, countrycodes: "kr", limit: "5" });
const reverse = (lat: number, lon: number) => nominatim("reverse", { lat: String(lat), lon: String(lon), zoom: "18" }).then((r) => r[0] ?? null);

// ── KBSA 팀 ──
const KINDS: { cd: number; kind: FieldKind }[] = [
  { cd: 31, kind: "고등학교" }, { cd: 21, kind: "중학교" }, { cd: 41, kind: "대학교" }, { cd: 51, kind: "일반부" },
];
const strip = (s: string) => s.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

async function listTeams(cd: number, season: number): Promise<{ idx: string; name: string }[]> {
  const seen = new Map<string, string>();
  for (let page = 1; page <= 30; page++) {
    const html = await getText(`${BASE}/info/team/team_list?page=${page}&kind_cd=${cd}&season=${season}&sido_cd=00`);
    let added = 0;
    for (const m of html.matchAll(/club_idx=(\d+)[^"]*"[^>]*>([^<]+)</g)) {
      const name = strip(m[2]);
      if (!name || seen.has(m[1])) continue;
      seen.set(m[1], name);
      added++;
    }
    if (!added) break;
    await sleep(400);
  }
  return [...seen].map(([idx, name]) => ({ idx, name }));
}
async function teamInfo(cd: number, idx: string, season: number): Promise<{ sido: string; addr: string }> {
  const html = await getText(`${BASE}/info/team/team_schedule?club_idx=${idx}&season=${season}&kind_cd=${cd}&sports_club=F`);
  await sleep(400);
  return teamInfoFromHtml(html);
}

// 학교 이름 → 주소 후보 순으로 찾는다. 학교 이름 결과는 시·도가 KBSA 지역과 같고 학교 유형일 때만 쓴다.
async function locateTeam(team: string, sido: string, addr: string): Promise<Omit<Field, "id" | "name" | "kind" | "team"> | null> {
  const school = schoolName(team);
  if (!school && isOfficeAddress(addr)) return null;
  if (school) {
    for (const r of await search(school)) {
      const reg = regionOf(r.address);
      const schoolLike = isSchoolResult(r, school);
      if (reg && schoolLike && (!sido || reg[0] === sido)) {
        return { sido: reg[0], sigungu: reg[1], lat: +r.lat, lon: +r.lon, addr: addr || undefined, addrKey: `${school}|${addr}` };
      }
    }
  }
  const cands = addressCandidates(addr);
  for (let i = 0; i < cands.length; i++) {
    const r = (await search(cands[i])).find((x) => { const reg = regionOf(x.address); return reg && (!sido || reg[0] === sido); });
    if (!r) continue;
    const reg = regionOf(r.address)!;
    const exact = i === 0;
    return {
      sido: reg[0], sigungu: reg[1], lat: +r.lat, lon: +r.lon, addr, approx: true, addrKey: `${school ?? ""}|${addr}`,
      note: exact ? (school ? "KBSA 주소 기준" : "KBSA 등록 주소 기준(사무실일 수 있음)") : "시·군·구 중심(추정)",
    };
  }
  return null;
}

// ── OpenStreetMap ──
interface OsmEl { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number }; tags?: Record<string, string> }
async function overpass(query: string): Promise<OsmEl[]> {
  const body = await getText("https://overpass-api.de/api/interpreter", {
    method: "POST", body: new URLSearchParams({ data: query }), headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return (JSON.parse(body) as { elements: OsmEl[] }).elements;
}
const AREA = 'area["ISO3166-1"="KR"][admin_level=2]->.kr;';

async function collectOsm(prev: Map<string, Field>): Promise<Field[]> {
  const els = await overpass(`[out:json][timeout:180];${AREA}(nwr["sport"~"baseball|softball"](area.kr);nwr["name"~"야구장|볼파크|베이스볼파크"](area.kr););out center tags;`);
  const parksRaw = await overpass(`[out:json][timeout:180];${AREA}(way["leisure"="park"]["name"](area.kr);relation["leisure"="park"]["name"](area.kr););out bb tags;`);
  const parks: ParkBox[] = parksRaw.filter((p) => p.bounds && p.tags?.name).map((p) => ({ name: p.tags!.name, ...p.bounds! }));
  console.log(`  OSM 야구 시설 ${els.length}곳 · 공원 ${parks.length}곳`);
  const out: Field[] = [];
  let looked = 0;
  for (const e of els) {
    if (!isOutdoorBaseballTags(e.tags ?? {})) continue;
    const id = `osm:${e.type}/${e.id}`;
    const c = e.center ?? (e.lat != null && e.lon != null ? { lat: e.lat, lon: e.lon } : null);
    if (!c) continue;
    const raw = e.tags?.["name:ko"] ?? e.tags?.name ?? "";
    if (raw && !isFieldName(raw)) continue;
    const kind: FieldKind = raw && isProName(raw) ? "프로야구장" : "야구장";
    const old = prev.get(id);
    if (old) { out.push({ ...old, lat: c.lat, lon: c.lon, kind, ...(raw ? { name: raw, approx: false, note: undefined } : {}) }); continue; }
    const r = await reverse(c.lat, c.lon);
    looked++;
    const reg = regionOf(r?.address);
    if (!reg) continue;
    let name = raw, note: string | undefined, approx = false;
    if (!name) {
      approx = true;
      note = "이름 없는 야구장(추정)";
      const inside = r?.name && r.category && /amenity|leisure/.test(r.category) ? r.name : null;
      const park = parkOf(c, parks);
      const place = inside ?? park ?? r?.address?.quarter ?? r?.address?.suburb ?? r?.address?.city_district ?? reg[1];
      name = `${place} 야구장`;
    }
    // 주소 표기 정리는 병합 단계(mergeFieldData)에서 한다.
    out.push({ id, name, kind, sido: reg[0], sigungu: reg[1], lat: c.lat, lon: c.lon, addr: fullNomAddress(r?.address, r?.display_name), approx, note });
    if (looked % 50 === 0) console.log(`  …OSM 위치 확인 ${looked}곳`);
  }
  return out;
}

// ── 공식경기 구장(일정)·프로야구장 ──
async function locateNamed(name: string, near?: { lat: number; lon: number }): Promise<NomResult | null> {
  const rs = (await search(name)).filter((r) => regionOf(r.address));
  return rs.find((r) => !near || distance(near, { lat: +r.lat, lon: +r.lon }) < 30000) ?? null;
}

export async function collectFields(dataDir: string) {
  const fp = path.join(dataDir, "fields.json");
  const overridesPath = path.join(dataDir, "fields-overrides.json"), extraPath = path.join(dataDir, "fields-extra.json");
  const overrides: Record<string, FieldOverride> = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, "utf8")) : {};
  const prevFile: FieldsFile | null = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf8")) : null;
  const baseCache = path.resolve(__dirname, "../.cache/fields-base.json");
  const rawPrevious: Field[] = fs.existsSync(baseCache) ? JSON.parse(fs.readFileSync(baseCache, "utf8")) : [];
  const prev = new Map([...(prevFile?.fields ?? []).filter((f) => !f.id.startsWith("extra:")), ...rawPrevious].map((f) => [f.id, f]));
  const remergePath = path.join(dataDir, "fields-remerge.json");
  const alreadyMerged = new Set<string>(fs.existsSync(remergePath) ? JSON.parse(fs.readFileSync(remergePath, "utf8")).dedupedIds ?? [] : []);
  const now = Date.now();
  const season = collectionYear();
  const full = !!process.env.FIELDS_FULL || !prevFile?.kbsaFullAt || now - Date.parse(prevFile.kbsaFullAt) > 30 * DAY;

  // 1) KBSA 팀 — 목록은 매번, 팀 페이지·위치는 새 팀(또는 30일마다 전체 주소 확인)만
  const kbsa: Field[] = [];
  const diagnostics: { id: string; team: string; kind: FieldKind; sido: string; addr: string; found: boolean }[] = [];
  let found = 0, missing: string[] = [];
  for (const { cd, kind } of KINDS) {
    const teams = await listTeams(cd, season);
    console.log(`  KBSA ${kind} ${teams.length}팀`);
    for (const t of teams) {
      const id = `kbsa:${t.idx}`, old = prev.get(id);
      if (overrides[id]?.remove) continue; // 등록지 복구는 승인된 extra 항목으로 관리하며 제외 원본을 재검색하지 않는다.
      if (old && !full) { kbsa.push({ ...old, kind, team: t.name }); continue; }
      const info = await teamInfo(cd, t.idx, season);
      const correction = overrides[id];
      if (correction?.addr) info.addr = correction.addr;
      const diagnostic = { id, team: t.name, kind, ...info, found: false };
      diagnostics.push(diagnostic);
      // 대조 키는 게시 자료와 같은 규칙으로 동·호수를 뺀다(개인 집 주소일 수 있음). 사무실·주거지 판단은 원문으로 한다.
      const key = `${schoolName(t.name) ?? ""}|${stripResidentialUnit(info.addr)}`;
      if (correction?.lat != null && correction.lon != null && correction.sido && correction.sigungu && (correction.source || correction.reason)) {
        kbsa.push({ id, name: schoolName(t.name) ?? t.name, kind, team: t.name, sido: correction.sido, sigungu: correction.sigungu,
          lat: correction.lat, lon: correction.lon, addr: info.addr, approx: correction.approx ?? true, addrKey: key });
        diagnostic.found = true;
        continue;
      }
      if (old && old.addrKey === key) { diagnostic.found = true; kbsa.push({ ...old, kind, team: t.name }); continue; }
      const loc = await locateTeam(t.name, info.sido, info.addr);
      if (!loc) { missing.push(t.name); continue; }
      diagnostic.found = true;
      found++;
      kbsa.push({ id, name: schoolName(t.name) ?? t.name, kind, team: t.name, ...loc });
    }
  }
  console.log(`  KBSA 위치 새로 찾음 ${found}팀 · 못 찾음 ${missing.length}팀${missing.length ? ` (${missing.slice(0, 10).join(", ")}${missing.length > 10 ? " …" : ""})` : ""}`);

  // 2) 공식경기 구장(data/venues.json 의 이름) — 이름으로 정확한 위치, 못 찾으면 시·군 좌표(추정)
  const venues = JSON.parse(fs.readFileSync(path.join(dataDir, "venues.json"), "utf8")) as Record<string, { lat: number; lon: number; place: string }>;
  const official: Field[] = [];
  for (const [name, v] of Object.entries(venues)) {
    const id = `venue:${name}`, old = prev.get(id);
    if (overrides[id]?.remove || alreadyMerged.has(id)) continue; // 이미 제외·병합한 별칭을 다시 검색하지 않는다.
    if (old) { official.push(old); continue; }
    const hit = await locateNamed(name.replace(/\([^)]*\)/g, " ").trim(), v);
    const at = hit ? { lat: +hit.lat, lon: +hit.lon } : v;
    const reg = regionOf(hit?.address) ?? regionOf((await reverse(v.lat, v.lon))?.address);
    if (!reg) continue;
    official.push({ id, name, kind: isProName(name) ? "프로야구장" : "공식경기 구장", sido: reg[0], sigungu: reg[1], ...at,
      ...(hit ? {} : { approx: true, note: "시·군 중심(추정)" }) });
  }
  const pro: Field[] = [];
  for (const stadium of PRO_STADIUM_DETAILS) {
    const field = await resolveProStadium(stadium, prev.get(`pro:${stadium.name}`), async (query) => {
      const hit = await locateNamed(query);
      const reg = regionOf(hit?.address);
      return hit && reg ? { lat: +hit.lat, lon: +hit.lon, sido: reg[0], sigungu: reg[1], type: hit.type } : null;
    });
    if (field) pro.push(field);
    else {
      missing.push(`pro:${stadium.name}`);
      console.warn(`  프로구장 위치 미확인: ${stadium.name} (${stadium.addr})`);
      diagnostics.push({ id: `pro:${stadium.name}`, team: stadium.name, kind: "프로야구장", sido: stadium.sido, addr: stadium.addr, found: false });
    }
  }

  // 3) OSM — 7일마다(또는 OSM_REFRESH=1) 새로 받는다
  const osmFresh = prevFile?.osmAt && now - Date.parse(prevFile.osmAt) < 7 * DAY && !process.env.OSM_REFRESH;
  const osm = osmFresh ? [...prev.values()].filter((f) => f.id.startsWith("osm:")) : await collectOsm(prev);

  // 4) 중복 정리 — 공식·프로 구장 400m 안의 OSM, 학교 위치 350m 안의 이름 없거나 그 학교 이름이 든 OSM 은 뺀다
  const anchors = [...official, ...pro];
  const schools = kbsa.filter((f) => !f.approx);
  const osmKept = osm.filter((o) => {
    if (prev.has(o.id)) return !overrides[o.id]?.remove; // 게시된 별개 시설을 거리만으로 다시 삭제하지 않는다.
    if (anchors.some((a) => distance(a, o) < 400)) return false;
    return !schools.some((s) => distance(s, o) < 350 && (o.note || o.name.includes(s.name.replace(/(등)?학교$/, ""))));
  });
  // 옛 한밭·무등과 새 홈구장처럼 400m 안의 다른 시설까지 프로구장 누락으로 만들지 않는다.
  // 실제 동명 중복은 기존 mergeFieldData 규칙과 근거 있는 remove 보정으로 처리한다.
  const proKept = pro;

  const baseFields = [...kbsa, ...official, ...proKept, ...osmKept].sort((a, b) =>
    SIDO_ORDER.indexOf(a.sido) - SIDO_ORDER.indexOf(b.sido) || a.sigungu.localeCompare(b.sigungu, "ko")
    || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name, "ko"));
  const extra: ExtraFields = fs.existsSync(extraPath) ? JSON.parse(fs.readFileSync(extraPath, "utf8")) : { fetchedAt: "", sources: [], fields: [] };
  const merged = mergeFieldData(baseFields, overrides, extra);
  const fields = merged.fields;
  const cacheDir = path.resolve(__dirname, "../.cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, "fields-base.json"), JSON.stringify(baseFields));
  fs.writeFileSync(path.join(cacheDir, "fields-run.json"), JSON.stringify({ ...requestStats, finished: new Date().toISOString(), missing, diagnostics, removed: merged.removed, corrected: merged.corrected, duplicateExtras: merged.duplicateExtras, unmatchedOverrides: merged.unmatchedOverrides }, null, 2));
  const file: FieldsFile & { sources: ExtraFields["sources"] } = {
    updated: new Date().toISOString(),
    kbsaFullAt: full ? new Date().toISOString() : prevFile?.kbsaFullAt,
    osmAt: osmFresh ? prevFile!.osmAt : new Date().toISOString(),
    fields, sources: extra.sources,
  };
  fs.writeFileSync(fp, JSON.stringify(file));
  const count = (k: FieldKind) => fields.filter((f) => f.kind === k).length;
  console.log(`✓ 야구장 현황 ${fields.length}곳 (${KIND_ORDER.map((k) => `${k} ${count(k)}`).join(" · ")}) → data/fields.json`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("fields.ts")) {
  acquireFieldLock();
  collectFields(DATA_DIR).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
