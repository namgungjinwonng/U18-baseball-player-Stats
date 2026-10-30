// 사용자가 승인한 고등부 팀 등록지를 실제 야구장과 구분해 공개 주소 검색 결과로 추가한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquireFieldLock, getFieldText, NOMINATIM_BASE, requestStats } from "./fieldsHttp.js";
import { regionOf, type ExtraFields, type Field } from "./fieldsUtil.js";

acquireFieldLock();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const audit = read<{ checks: { id: string; team: string; state: string; detailUrl: string; detail?: { sido: string; addr: string } }[] }>("data/fields-highschool-audit.json");
const data = read<{ fields: Field[] }>("data/fields.json");
const extra = read<ExtraFields>("data/fields-extra.json");
const corrections = new Map<string, string>([["kbsa:556", "경기도 파주시 파평면 청송로446번길 37-55, 1층"]]);
const sourceId = "kbsa2026";
const results = [];
for (const c of audit.checks.filter((c) => ["근거 있는 제외", "기존 제외 보정", "수집 누락"].includes(c.state) && c.detail?.addr && /층|호|아파트|하이타운/.test(c.detail.addr))) {
  const id = `extra:${sourceId}:${c.id.split(":")[1]}`;
  if (extra.fields.some((f) => f.id === id)) continue;
  const addr = corrections.get(c.id) ?? c.detail!.addr;
  // 외부 검색에는 층·호·아파트 세대·팀명 없이 공개 도로/건물 주소까지만 보낸다.
  // 도로 번호와 층수가 붙어 경계가 모호한 값은 숫자를 추측해 분리하지 않고 보류한다.
  const beforeParen = addr.split("(")[0].trim();
  const query = beforeParen.split(",")[0].trim();
  if (/층|호/.test(query)) { results.push({ id: c.id, team: c.team, status: "보류", reason: "건물번호와 층수 경계 미확인" }); continue; }
  let hit: { lat: string; lon: string; type: string; address?: Record<string, string> } | undefined;
  let url = "", locationQuery = query;
  const road = query.replace(/((?:로|길))\s*\d+(?:-\d+)?$/, "$1");
  for (const candidate of [...new Set([query, road])]) {
    const params = new URLSearchParams({ q: candidate, format: "jsonv2", addressdetails: "1", "accept-language": "ko", countrycodes: "kr", limit: "5" });
    url = `${NOMINATIM_BASE}/search?${params}`;
    const hits = JSON.parse(await getFieldText(url)) as NonNullable<typeof hit>[];
    hit = hits.find((h) => regionOf(h.address)?.[0] === c.detail!.sido && !/^(administrative|city|town|village|suburb|county)$/.test(h.type));
    if (hit) { locationQuery = candidate; break; }
  }
  if (!hit) { results.push({ id: c.id, team: c.team, status: "보류", reason: "도로/건물 주소의 위치 검색 실패", query }); continue; }
  const region = regionOf(hit.address)!;
  const field: Field = { id, name: `${c.team} (팀 등록지·야구장 아님)`, team: c.team, kind: "고등학교", sido: region[0], sigungu: region[1],
    lat: +hit.lat, lon: +hit.lon, addr, approx: true, source: c.detailUrl,
    note: `야구장 아님 — KBSA 팀 등록 주소(건물·사무실/주거지). 실외 훈련 구장 주소가 아니며 지도는 ${locationQuery === query ? "주소 검색 위치(추정)" : "도로 대표 위치(추정), 건물 위치 미확인"}. 사용자 승인 2026-10-30.` };
  extra.fields.push(field);
  results.push({ id: c.id, extraId: id, team: c.team, status: "추가 후보", query: locationQuery, locationSource: url, lat: field.lat, lon: field.lon });
}
if (extra.fields.some((f) => f.id.startsWith(`extra:${sourceId}:`)) && !extra.sources.some((s) => s.id === sourceId)) {
  extra.sources.push({ id: sourceId, title: "KBSA 2026 고등부 공개 팀 등록 주소(야구장 아님)", url: "https://www.korea-baseball.com/info/team/team_list?kind_cd=31&season=2026&sido_cd=00",
    license: "별도 공개 라이선스 확인 안 됨 — 팀명·등록 주소 사실정보만 인용, 사진·로고 제외" });
}
fs.writeFileSync(path.join(root, "data/fields-extra.json"), JSON.stringify(extra, null, 2) + "\n");
// 재실행해도 앞서 추가한 등록지의 검토 기록이 사라지지 않도록 현재 extra 항목을 함께 남긴다.
const registered = extra.fields.filter((f) => f.id.startsWith(`extra:${sourceId}:`)).map((f) => ({
  id: `kbsa:${f.id.split(":").at(-1)}`, extraId: f.id, team: f.team, name: f.name,
  addr: f.addr, lat: f.lat, lon: f.lon, source: f.source, note: f.note,
}));
fs.writeFileSync(path.join(root, "data/fields-registration-review.json"), JSON.stringify({ checkedAt: new Date().toISOString(), ...requestStats, registered, results }, null, 2) + "\n");
console.log(JSON.stringify({ ...requestStats, results }));
console.log(`기존 게시 등록지 ${data.fields.filter((f) => f.name.includes("팀 등록지")).length}곳 · 아직 게시하지 않음(fieldsRemerge 필요)`);
