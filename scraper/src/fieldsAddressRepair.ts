// 장항 및 전국 주소 누락 후보를 공개 원문과 대조해 이름·주소만 보정하고 위경도 불변을 검증한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquireFieldLock } from "./fieldsHttp.js";
import { completeFieldAddress, hasFieldAddressNumber, osmTagFieldAddress } from "./fieldsAddressUtil.js";
import { isOutdoorBaseballTags, mergeFieldData, type Field, type FieldOverride, type ExtraFields } from "./fieldsUtil.js";

acquireFieldLock();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const data = read<{ fields: Field[]; [key: string]: unknown }>("data/fields.json");
const snapshot = path.join(root, "scraper/.cache/fields-address-before.json");
if (!fs.existsSync(snapshot)) fs.writeFileSync(snapshot, JSON.stringify(data.fields));
const original = JSON.parse(fs.readFileSync(snapshot, "utf8")) as Field[];
const overrides = read<Record<string, FieldOverride>>("data/fields-overrides.json");
const rows = read<{ row: number; name: string; addr: string }[]>("scraper/.cache/mcst-baseball-rows.json");
const osm = read<{ elements: { type: string; id: number; tags?: Record<string, string> }[] }>("scraper/.cache/fields-osm-tags.json");
const changes: { id: string; name: string; before?: string; after: string; source: string }[] = [];
const withheld: { id: string; reason: string }[] = [];
const notFields = osm.elements.filter((e) => original.some((f) => f.id === `osm:${e.type}/${e.id}`) && !isOutdoorBaseballTags(e.tags ?? {})).map((e) => `osm:${e.type}/${e.id}`);
for (const id of notFields) {
  const e = osm.elements.find((e) => `osm:${e.type}/${e.id}` === id);
  if (!e || isOutdoorBaseballTags(e.tags ?? {})) throw new Error(`시설 제외 근거 재확인 필요 — ${id}`);
  overrides[id] = { remove: true, reason: `OSM 현재 태그상 실외 야구장이 아닌 교통·도로·음식점·실내·축구 시설(${e.tags?.highway ?? e.tags?.route ?? e.tags?.amenity ?? e.tags?.name})`, source: `https://www.openstreetmap.org/${e.type}/${e.id}` };
}
const apply = (id: string, raw: string, source: string, name?: string, reason = "동일 시설명·지역 대조") => {
  const f = original.find((x) => x.id === id);
  if (!f) throw new Error(`보정 대상 ID 없음 — ${id}`);
  const addr = completeFieldAddress({ ...f, ...overrides[id] }, raw);
  if (!addr) throw new Error(`상세 주소 형식·지역 불일치 — ${id}`);
  const note = `${reason} · 기존 위경도 유지${f.approx ? " · 위치/개별 구장 대응 미확인은 추정 유지" : ""}`;
  overrides[id] = { ...overrides[id], ...(name ? { name } : {}), addr, source, note };
  if (f.addr !== addr || name && f.name !== name) changes.push({ id, name: name ?? f.name, before: f.addr, after: addr, source });
};

const gys = "https://m.gys.or.kr/page/facilities/s_sports/";
apply("kbsa:169", "인천광역시 제물포구 자유공원로 58-9 (전동 26)", "https://jego.icehs.kr/main.do", undefined, "학교 공식 홈페이지의 현행 전체 주소 확인(이전 KBSA 중구·번지 누락 표기 보완)");
apply("kbsa:1064", "경기도 여주시 세종로 338", "https://iec.yit.ac.kr/ko/cms/CM_CN01_CON/index.do?MENU_SN=345", undefined, "대학 공식 오시는길로 여주군 옛 주소 보완");
for (const id of ["osm:way/1376669138", "osm:way/1376669141"]) {
  overrides[id] = { ...overrides[id], sido: "대구", sigungu: "달성군" };
  apply(id, "대구광역시 달성군 논공읍 위천리 552-1", "https://www.dalseong.daegu.kr/index.do?menu_id=00000064", undefined, "달성군 공공체육시설 원문 주소 확인. 광역시를 도의 하위 시군으로 수집한 오류 보완");
}
for (const [id, sido, sigungu] of [["osm:way/592118427", "서울", "양천구"], ["osm:way/478011641", "부산", "강서구"]]) {
  const f = original.find((x) => x.id === id)!;
  overrides[id] = { ...overrides[id], sido, sigungu, source: `https://www.openstreetmap.org/${id.slice(4)}`, note: "원문에 명시된 광역시·구 관계로 인접 도 ISO 혼입 보완. 동 경계·번지는 미확인, 기존 좌표 유지" };
}
for (const id of ["osm:way/1050656710", "osm:way/1050656711"]) overrides[id] = { ...overrides[id], source: `https://www.openstreetmap.org/${id.slice(4)}`, note: "시설명·주소 추정. 역주소에 구미시·칠곡군이 함께 있어 행정구역 경계와 전체 번지 재확인 필요" };
apply("venue:송도LNG 종합스포츠타운 야구장", "인천광역시 연수구 인천신항대로 916 (송도동 379)", "https://www.icsports.or.kr/fmcs/37", undefined, "인천광역시체육회 시설 안내 원문 주소 확인. 기존 대표 좌표는 실구장 위치와 차이가 있어 재검증 필요");
for (const id of ["osm:way/253471840", "venue:신월 야구공원"]) apply(id, "서울특별시 양천구 남부순환로64길 26 (신월동 149-20)", "https://mas.smc.seoul.kr/attach/record/SEOUL/appendix/a11/A0069477.pdf?time=20260620140159", undefined, "서울시의회 공공체육시설 위치 원문으로 신월야구공원 전체 주소 확인");
for (const id of ["osm:way/652807266", "osm:way/652807379"]) apply(id, "경기도 고양시 일산동구 장항동 660-65번지 일원", gys + "jh_baseball.php", "고양장항야구장", "운영기관의 사회인·리틀 시설 공통 주소 확인. 두 구장 개별 종류는 미지정");
apply("osm:way/279831028", "경기도 고양시 일산서구 중앙로 1601 (대화동)", gys + "baseball.php", undefined, "운영기관 시설 위치 확인");
apply("osm:way/470018503", "경기도 고양시 일산서구 중앙로 1601 일원", gys + "little_baseball.php", undefined, "운영기관 고양리틀야구장 위치 확인");
apply("osm:way/731968870", "경기도 고양시 덕양구 덕은동 520-68", "https://www.goyang.go.kr/www/www03/www03_11/www03_11_7.jsp", undefined, "시청 공공시설 목록의 대덕야구장 주소 확인. 운영기관 페이지의 구 표기 차이는 시청 기준");

// 검토한 명칭·동리·시설군 대응만 명시한다. 이천의 대월·호법 등 동명이장은 포함하지 않는다.
const publicMatches: [number, string[]][] = [
  [19, ["pro:고척스카이돔"]],
  [90, ["venue:울산 문수 야구장", "osm:way/696084610"]],
  [119, ["venue:화성드림파크 여성겸용구장"]],
  [134, ["venue:배나물야구장(안산시야구장)"]],
  [146, ["osm:way/1057556026"]], [147, ["osm:way/700635093"]],
  [156, ["osm:way/497969069"]],
  [160, ["osm:way/694608623", "osm:way/787872279"]],
  [164, ["osm:way/665421765", "osm:way/665421766"]],
  [172, ["osm:way/1558988297", "osm:way/1558988298"]],
  [222, ["osm:way/1550504428", "osm:way/1550504429", "osm:way/1550504430"]],
  [255, ["osm:way/1240702783"]], [269, ["osm:way/94508059"]],
  [277, ["venue:정읍 필연야구장"]], [352, ["osm:way/1414679913"]],
  [360, ["venue:진해공설운동장 야구장(진해야구장)"]], [387, ["venue:창녕스포츠파크"]],
];
const mcst = "https://www.mcst.go.kr/site/s_policy/dept/deptView.jsp?pDataCD=0417000000&pSeq=2107&pType=07";
for (const [rowNumber, ids] of publicMatches) {
  const row = rows.find((r) => r.row === rowNumber);
  if (!row) throw new Error(`공개 자료 행 없음 — ${rowNumber}`);
  for (const id of ids) apply(id, row.addr, mcst, undefined, `문체부 2025 원문 ${rowNumber}행 ${row.name} 주소 대조(2024.12.31. 기준, 시설 공통 주소)`);
}
for (const e of osm.elements) {
  const id = `osm:${e.type}/${e.id}`, f = original.find((f) => f.id === id), tags = e.tags ?? {};
  if (!f || overrides[id]?.remove || hasFieldAddressNumber(f.addr) || changes.some((c) => c.id === id)) continue;
  if (!isOutdoorBaseballTags(tags)) { withheld.push({ id, reason: "현재 OSM 태그가 실외 야구장으로 확인되지 않아 주소 자동 보정 제외" }); continue; }
  const addr = osmTagFieldAddress(f, tags);
  if (addr) apply(id, addr, `https://www.openstreetmap.org/${e.type}/${e.id}`, undefined, "동일 OSM 객체의 addr:street·addr:housenumber로 한국식 주소 순서 복원(별도 공식기관 확인은 아님)");
}
const raw = read<Field[]>("scraper/.cache/fields-base.json"), extra = read<ExtraFields>("data/fields-extra.json");
// 주소 표기 순서·시·도 명칭 정리는 mergeFieldData의 refineFieldAddress가 맡는다(원문 보정 값만 여기서 넣는다).
const result = mergeFieldData(raw, overrides, extra);
if (result.fields.length !== original.length - notFields.length || result.fields.some((f) => { const old = original.find((x) => x.id === f.id); return !old || old.lat !== f.lat || old.lon !== f.lon; })) throw new Error("주소 보정 중 승인 범위 외 항목·좌표 변경 — 저장 중단");
fs.writeFileSync(path.join(root, "data/fields-overrides.json"), JSON.stringify(overrides, null, 2) + "\n");
fs.writeFileSync(path.join(root, "data/fields.json"), JSON.stringify({ ...data, updated: new Date().toISOString(), fields: result.fields }));
fs.writeFileSync(path.join(root, "scraper/.cache/fields-merge.json"), JSON.stringify({ ...result, fields: undefined, total: result.fields.length }, null, 2));
const allChanges = result.fields.flatMap((f) => { const old = original.find((x) => x.id === f.id)!; return old.addr !== f.addr || old.name !== f.name ? [{ id: f.id, name: f.name, before: old.addr, after: f.addr, source: f.source, kind: "출처주소보정" }] : []; });
fs.writeFileSync(path.join(root, "data/fields-address-repairs.json"), JSON.stringify({ checkedAt: new Date().toISOString(), checked: original.length, newGeocodingRequests: 0, coordinatesChanged: 0, changes: allChanges, excludedNonFields: notFields, withheld, note: "수정 로그는 이번 주소 보정 시작 스냅샷 기준. 주소 순서 정리와 원문 번지 보정을 구분하며 미확인 전체 목록은 fields-review-pending.json에 둔다." }, null, 2));
console.log(JSON.stringify({ checked: original.length, corrected: allChanges.length, coordinateChanges: 0, missingBefore: original.filter((f) => !hasFieldAddressNumber(f.addr)).length, missingAfter: result.fields.filter((f) => !hasFieldAddressNumber(f.addr)).length, excluded: notFields.length }));
