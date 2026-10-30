// 공공데이터포털의 공개 학교 위치 전체 다운로드로 학교 주소를 대조하되 기존 구장 좌표는 유지한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquireFieldLock, getFieldText, requestStats } from "./fieldsHttp.js";
import { distance, mergeFieldData, type Field, type FieldOverride, type ExtraFields } from "./fieldsUtil.js";

acquireFieldLock();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const cache = path.join(root, "scraper/.cache/fields-schools.json");
type Row = Record<string, string>;
const source = "https://www.data.go.kr/data/15021148/standard.do";
let rows: Row[];
if (fs.existsSync(cache)) rows = JSON.parse(fs.readFileSync(cache, "utf8"));
else {
  // 포털 공식 std-download-manager.js와 동일한 공개 다운로드 요청이다. 인증키 샘플 API를 반복 호출하지 않는다.
  const h = JSON.parse(await getFieldText("https://www.data.go.kr/download/columList.json?pk=15021148&ext=JSON"));
  if (h.totalCount > 50_000 || !Array.isArray(h.tableVO?.colNmList)) throw new Error("학교 공개 다운로드 형식 확인 필요");
  rows = [];
  for (let page = 1; page <= Math.ceil(h.totalCount / 10000); page++) {
    const q = new URLSearchParams({ publicDataPk: "15021148", totalCount: String(h.totalCount), svcTableNm: h.tableVO.svcTableNm, perPage: "10000", page: String(page) });
    for (const c of h.tableVO.colNmList) q.append("colNmList", c);
    const result = JSON.parse(await getFieldText("https://www.data.go.kr/download/standard.json?" + q));
    if (!Array.isArray(result)) throw new Error("학교 다운로드 결과 형식 확인 필요");
    rows.push(...result);
  }
  if (rows.length !== h.totalCount) throw new Error(`학교 다운로드 행 수 불일치 ${rows.length}/${h.totalCount}`);
  fs.writeFileSync(cache, JSON.stringify(rows));
}
const value = (r: Row, k: string) => r[k] ?? r[k.toLowerCase()] ?? "";
const data = read<{ fields: Field[]; sources?: ExtraFields["sources"]; [key: string]: unknown }>("data/fields.json");
const overrides = read<Record<string, FieldOverride>>("data/fields-overrides.json");
const extra = read<ExtraFields>("data/fields-extra.json");
const checks: { id: string; name: string; status: string; officialAddress?: string; distanceM?: number; reason?: string }[] = [];
for (const f of data.fields.filter((f) => ["고등학교", "중학교"].includes(f.kind) && /학교$/.test(f.name))) {
  const names = rows.filter((r) => value(r, "SCHOOL_NM").replace(/\s/g, "") === f.name.replace(/\s/g, "") && value(r, "OPER_STTUS") === "운영");
  const matches = names.map((r) => ({ r, d: distance(f, { lat: Number(value(r, "LATITUDE")), lon: Number(value(r, "LONGITUDE")) }) })).filter((r) => Number.isFinite(r.d) && r.d < 2000);
  if (matches.length !== 1) { checks.push({ id: f.id, name: f.name, status: "미확인", reason: names.length ? "동명 학교 위치·이전 여부 추가 확인 필요" : "공개 자료에 정확히 일치하는 운영 학교명 없음" }); continue; }
  const { r, d } = matches[0];
  const road = value(r, "RDNMADR"), lot = value(r, "LNMADR");
  if (!road) { checks.push({ id: f.id, name: f.name, status: "미확인", reason: "공식 도로명주소 없음" }); continue; }
  const addr = `${road}${lot ? ` (${lot})` : ""}`;
  checks.push({ id: f.id, name: f.name, status: "공식원문대조", officialAddress: addr, distanceM: Math.round(d) });
  // 이번에 개별 학교 홈페이지로 확인한 주소는 전체 자료보다 우선한다.
  if (overrides[f.id]?.source && /icehs\.kr|gen\.go\.kr|jge\.go\.kr/.test(overrides[f.id].source!)) continue;
  const district = road.split(/\s+/)[1];
  const sigungu = district && /(?:시|군|구)$/.test(district) ? district : f.sigungu;
  overrides[f.id] = { ...overrides[f.id], addr, sigungu, source, note: `교육부 소관·한국교육시설안전원 학교 위치 표준데이터 주소·시군구 대조(${value(r, "REFERENCE_DATE")}). 학교 대표 주소이며 야구장 출입구는 별도 확인. 기존 좌표 유지` };
}
const result = mergeFieldData(read<Field[]>("scraper/.cache/fields-base.json"), overrides, extra);
for (const f of result.fields) { const old = data.fields.find((x) => x.id === f.id); if (!old || f.lat !== old.lat || f.lon !== old.lon) throw new Error("학교 주소 보정 중 좌표·항목 변경"); }
if (!extra.sources.some((s) => s.id === "schools202610")) extra.sources.push({ id: "schools202610", title: "교육부 소관·한국교육시설안전원 전국초중등학교위치표준데이터(2026-10-01)", url: source, license: "공공데이터포털 이용정책 적용(원문 정책 확인)" });
fs.writeFileSync(path.join(root, "data/fields-overrides.json"), JSON.stringify(overrides, null, 2) + "\n");
fs.writeFileSync(path.join(root, "data/fields-extra.json"), JSON.stringify(extra, null, 2) + "\n");
fs.writeFileSync(path.join(root, "data/fields.json"), JSON.stringify({ ...data, updated: new Date().toISOString(), sources: extra.sources, fields: result.fields }));
fs.writeFileSync(path.join(root, "scraper/.cache/fields-schools-review.json"), JSON.stringify({ source, downloaded: rows.length, ...requestStats, checks }, null, 2));
console.log(JSON.stringify({ downloaded: rows.length, checked: checks.length, matched: checks.filter((c) => c.status === "공식원문대조").length, sample: rows[0] }, null, 2));
