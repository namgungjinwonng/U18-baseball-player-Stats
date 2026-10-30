// 확인한 문체부 야구장 목록과 OSM 태그를 캐시 기반으로 대조하고 근거 있는 보정·추가 자료를 만든다.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { acquireFieldLock, getFieldText, NOMINATIM_BASE, requestStats } from "./fieldsHttp.js";
import { isFieldName, isOfficeAddress, matchesStreetOrLot, regionOf, shortSido, type ExtraFields, type Field, type FieldOverride, type NomAddress } from "./fieldsUtil.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const cacheDir = path.join(root, "scraper/.cache");
acquireFieldLock();
fs.mkdirSync(cacheDir, { recursive: true });
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const base = read<{ fields: Field[] }>("data/fields.json").fields.filter((f) => !f.id.startsWith("extra:"));
const overrides = read<Record<string, FieldOverride>>("data/fields-overrides.json");
const existing = read<ExtraFields>("data/fields-extra.json");
const publicRows = read<{ row: number; sido: string; sigungu: string; name: string; addr: string }[]>("scraper/.cache/mcst-baseball-rows.json");
const sourceUrl = "https://www.mcst.go.kr/site/s_policy/dept/deptView.jsp?pDataCD=0417000000&pSeq=2107&pType=07";
const source = { id: "mcst2025", title: "문화체육관광부 2025 전국 공공체육시설 현황(2024.12.31. 기준)", url: sourceUrl, license: "공공누리 제2유형 — 출처표시·상업적 이용금지" };
const norm = (s: string) => s.replace(/\(추정\)|[\s·_()\-]/g, "").toLowerCase();
const skipped: { name: string; reason: string; row?: number }[] = [];
const added: Field[] = existing.fields.filter((f) => !f.id.startsWith("extra:mcst2025:"));
const schoolChecks = [
  { id: "kbsa:156", name: "광주진흥고등학교", sido: "광주", sigungu: "광산구", addr: "광주광역시 광산구 왕버들로 307", source: "https://www.gen.go.kr/s_school/index.php?mode=search1&page=1&s_div1=&s_div2=0&s_div3=5&s_div4=3&s_name=" },
  { id: "kbsa:232", name: "광주진흥중학교", sido: "광주", sigungu: "광산구", addr: "광주광역시 광산구 왕버들로 307", source: "https://seobu.jge.go.kr/schList.php?gu=A5&id=135&mode=sv&page=1&sid=131&sno=322&st=3&syp=3" },
  { id: "kbsa:171", name: "대전고등학교", sido: "대전", sigungu: "중구", addr: "대전광역시 중구 대흥로 110 (대흥동 320-2번지)", source: "https://djhs.djsch.kr/" },
  { id: "kbsa:1713", name: "목포과학대학교", sido: "전남", sigungu: "목포시", addr: "전라남도 목포시 영산로 413-1", source: "https://oldipsi.msu.ac.kr/" },
  { id: "kbsa:295", name: "순천효천고등학교", sido: "전남", sigungu: "순천시", addr: "전라남도 순천시 녹색로 1360", source: "https://hyocheon.hs.jne.kr/data/attach_data/goheung/hyocheon_hs/k2board/na/bbs_88276/ntt_1800101083/doc_773dvc1df%3D72va1%3D41vd0%3D8evd2%3D041bv378ev6540_v227.pdf" },
];
interface Nom { lat: string; lon: string; address?: NomAddress; name?: string; category?: string; type?: string }
async function search(q: string): Promise<Nom[]> {
  return JSON.parse(await getFieldText(`${NOMINATIM_BASE}/search?` + new URLSearchParams({ q, countrycodes: "kr", limit: "5", format: "jsonv2", addressdetails: "1", "accept-language": "ko" })));
}
const save = () => {
  fs.writeFileSync(path.join(root, "data/fields-overrides.json"), JSON.stringify(overrides, null, 2) + "\n");
  fs.writeFileSync(path.join(root, "data/fields-extra.json"), JSON.stringify({ fetchedAt: new Date().toISOString(), sources: [...existing.sources.filter((s) => s.id !== source.id), source], fields: added } satisfies ExtraFields, null, 2) + "\n");
  fs.writeFileSync(path.join(cacheDir, "fields-enrich-run.json"), JSON.stringify({ ...requestStats, finished: new Date().toISOString(), skipped, publicRows: publicRows.length, added: added.length, overrides: Object.keys(overrides).length }, null, 2));
};

// 공개 OSM 객체를 한 질의로 확인한다. 이름 없는 항목은 실제 name 태그가 있을 때만 확정한다.
const osmCache = path.join(cacheDir, "fields-osm-tags.json");
if (!fs.existsSync(osmCache)) {
  const sets = ["way", "node", "relation"].map((type) => {
    const ids = base.filter((f) => f.id.startsWith(`osm:${type}/`)).map((f) => f.id.split("/")[1]);
    return ids.length ? `${type}(id:${ids.join(",")});` : "";
  }).join("");
  const result = await getFieldText("https://overpass-api.de/api/interpreter", { method: "POST", body: new URLSearchParams({ data: `[out:json][timeout:90];(${sets});out tags;` }) });
  fs.writeFileSync(osmCache, result);
}
const osm = JSON.parse(fs.readFileSync(osmCache, "utf8")) as { elements: { type: string; id: number; tags?: Record<string, string> }[] };
for (const e of osm.elements) {
  const id = `osm:${e.type}/${e.id}`, f = base.find((f) => f.id === id), t = e.tags ?? {};
  if (!f) continue;
  const url = `https://www.openstreetmap.org/${e.type}/${e.id}`;
  const name = t["name:ko"] ?? t.name;
  if (t.indoor === "yes" || t.shop || (name && !isFieldName(name))) {
    overrides[id] = { remove: true, reason: `OSM 태그상 실외 구장이 아님(${t.shop ? `shop=${t.shop}` : t.indoor === "yes" ? "indoor=yes" : name})`, source: url };
  } else if (name && f.note?.includes("이름 없는")) overrides[id] = { ...overrides[id], name, approx: false, note: "OSM 현재 name 태그로 시설명 확인", source: url };
}
// 주소가 명백한 주거지·호실인 기존 클럽 등록은 실제 야구장 위치로 오인되지 않게 제외한다.
for (const f of base) if (f.id.startsWith("kbsa:") && f.approx && isOfficeAddress(f.addr ?? "") && /BC|SC|클럽|야구단|선발|웨일스|몬스터|타이탄스|퓨처스/.test(f.team ?? f.name)) {
  overrides[f.id] = { remove: true, reason: "KBSA 등록 주소가 주거지·층·호실로 실제 실외 구장 위치를 확인할 수 없음. 클럽 자체 폐쇄를 뜻하지 않음", source: `https://www.korea-baseball.com/info/team/team_schedule?club_idx=${f.id.split(":")[1]}&season=2026` };
}
save();
for (const s of schoolChecks) {
  const rs = await search(s.addr.replace(/\([^)]*\)/g, "").trim());
  const hit = rs.find((r) => { const reg = regionOf(r.address); return reg?.[0] === s.sido && reg[1] === s.sigungu; });
  if (!hit) { skipped.push({ name: s.name, reason: "공식 전체 주소는 확인했으나 검색 좌표 없음" }); continue; }
  overrides[s.id] = { name: s.name, addr: s.addr, sido: s.sido, sigungu: s.sigungu, lat: Number((+hit.lat).toFixed(6)), lon: Number((+hit.lon).toFixed(6)), approx: true,
    note: "학교·교육기관 공개 주소 확인, 주소 지오코딩 위치(교내 구장 중심은 미확인)", source: s.source };
  save();
}
let index = 0;
for (const row of publicRows) {
  index++;
  const sido = shortSido(row.sido), sigungu = sido === "세종" ? "세종" : row.sigungu.replace(/\s+/g, "").replace(/(시|군).*/, "$1");
  const matches = base.filter((f) => f.sido === sido && f.sigungu === sigungu && norm(f.name) === norm(row.name) && !overrides[f.id]?.remove);
  const hasProvince = shortSido(row.addr.split(/\s+/)[0]) === sido;
  const addr = (row.addr && !hasProvince ? `${row.sido} ${row.addr.includes(sigungu) ? "" : sigungu + " "}${row.addr}` : row.addr).replace(/\s+/g, " ").trim();
  if (matches.length === 1 && addr && /\d/.test(addr)) {
    overrides[matches[0].id] = { ...overrides[matches[0].id], addr, source: sourceUrl, note: "문체부 2025 현황의 원문 전체 주소(2024.12.31. 기준)" };
    save(); continue;
  }
  if (matches.length) { skipped.push({ name: row.name, row: row.row, reason: "동일 지역·이름 기존 항목 — 중복 추가 안 함" }); continue; }
  if (!addr || !/\d/.test(addr)) { skipped.push({ name: row.name, row: row.row, reason: "원문 상세 주소/번지 없음 — 위치 추정 추가 안 함" }); continue; }
  const hash = createHash("sha256").update([sido, sigungu, norm(row.name), addr].join("|")).digest("hex").slice(0, 16);
  const id = `extra:mcst2025:${hash}`;
  if (added.some((f) => f.id === id)) continue;
  const rs = await search(addr);
  const hit = rs.find((r) => { const reg = regionOf(r.address); return reg?.[0] === sido && reg[1] === sigungu && matchesStreetOrLot(addr, r.address); });
  if (!hit) { skipped.push({ name: row.name, row: row.row, reason: "공개 주소의 같은 시군구 좌표 확인 실패" }); continue; }
  added.push({ id, name: row.name, kind: "야구장", sido, sigungu, lat: Number((+hit.lat).toFixed(6)), lon: Number((+hit.lon).toFixed(6)), addr, approx: true,
    note: "문체부 2025 현황 원문 전체 주소를 지오코딩한 위치(2024.12.31. 기준, 구장 중심 미확인)", source: sourceUrl });
  if (index % 20 === 0) console.log(`문체부 ${index}/${publicRows.length} · 추가 후보 ${added.length}`);
  save();
}
save();
console.log("자료 보강 완료", { ...requestStats, publicRows: publicRows.length, added: added.length, overrides: Object.keys(overrides).length, skipped: skipped.length });
