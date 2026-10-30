// 프로구장 주소 대체 검색·지역 검증·누락 반환과 게시된 9개 홈구장의 완전성을 검증한다.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PRO_STADIUMS, type Field } from "./fieldsUtil.js";
import { PRO_STADIUM_DETAILS, resolveProStadium } from "./fieldsPro.js";
import { unifyProvinceName } from "./fieldsAddressUtil.js";

assert.deepEqual(PRO_STADIUM_DETAILS.map((s) => s.name), PRO_STADIUMS);
const daegu = PRO_STADIUM_DETAILS.find((s) => s.sido === "대구")!;
const calls: string[] = [];
const hit = await resolveProStadium(daegu, undefined, async (q) => {
  calls.push(q);
  return q === daegu.addr ? { lat: 35.841, lon: 128.681, sido: "대구", sigungu: "수성구" } : null;
});
assert.deepEqual(calls, [daegu.name, daegu.addr]);
assert.equal(hit?.addr, daegu.addr);
assert.ok(hit?.source);
assert.equal(hit?.approx, true, "주소 지오코딩만으로 구장 중심을 확정하지 않는다");
assert.equal(await resolveProStadium(daegu, undefined, async () => null), null, "호출자가 missing에 기록할 수 있도록 실패를 반환한다");
assert.equal(await resolveProStadium(daegu, undefined, async () => ({ lat: 37, lon: 127, sido: "경기", sigungu: "수원시" })), null);
assert.equal(await resolveProStadium(daegu, undefined, async () => ({ lat: 35.84, lon: 128.68, sido: "대구", sigungu: "수성구", type: "administrative" })), null);
const reused = await resolveProStadium(daegu, hit!, async () => { throw new Error("기존 좌표 재검색 금지"); });
assert.equal(reused?.lat, hit?.lat);

// 수집 전에도 단위 테스트를 실행할 수 있고, 게시 자료 검사는 명시 옵션으로 실행한다.
if (process.argv.includes("--published")) {
  const { fields } = JSON.parse(fs.readFileSync(new URL("../../data/fields.json", import.meta.url), "utf8")) as { fields: Field[] };
  const pros = fields.filter((f) => f.kind === "프로야구장");
  assert.equal(pros.length, 9);
  assert.deepEqual(pros.map((f) => f.name).sort(), [...PRO_STADIUMS].sort());
  for (const s of PRO_STADIUM_DETAILS) {
    const matches = pros.filter((f) => f.name === s.name);
    assert.equal(matches.length, 1, `${s.name} 정확히 1항목`);
    assert.equal(matches[0].addr, unifyProvinceName(s.addr), "KBO 원문 주소(옛 시·도 이름은 게시 때 전남광주통합특별시로)");
    assert.ok(matches[0].source?.startsWith("https://"));
  }
  assert.equal(new Set(fields.map((f) => f.id)).size, fields.length, "게시 ID 중복 없음");
  const yulgok = fields.find((f) => f.id === "extra:kbsa2026:556")!;
  assert.equal(yulgok.addr, "경기도 파주시 파평면 청송로446번길 37-55", "등록지는 층 정보 없이 도로명·건물번호까지");
  assert.match(yulgok.name, /팀 등록지·야구장 아님/);
  assert.match(yulgok.note!, /야구장 아님/);
  for (const f of fields.filter((f) => f.id.startsWith("extra:kbsa2026:"))) {
    assert.equal(f.approx, true, "등록 주소를 실제 야구장 위치로 단정하지 않는다");
    assert.match(f.name, /야구장 아님|야구장 위치 미확인/);
    assert.ok(f.source?.startsWith("https://"));
  }
  const songdo = fields.find((f) => f.id === "venue:송도LNG 종합스포츠타운 야구장")!;
  assert.deepEqual([songdo.lat, songdo.lon], [37.35229, 126.616828]);
  assert.equal(songdo.approx, true, "시설 대표 좌표이지 확인된 출입구가 아니다");
  const miryang = fields.filter((f) => /밀양스포츠파크/.test(f.name));
  assert.equal(miryang.length, 1, "사용자 승인에 따라 밀양 시설 대표 1개만 게시한다");
  assert.equal(miryang[0].id, "venue:선샤인밀양스포츠파크 야구장");
  assert.equal(miryang[0].name, "선샤인 밀양스포츠파크 야구장");
  assert.deepEqual([miryang[0].lat, miryang[0].lon], [35.493, 128.749]);
  assert.equal(miryang[0].approx, true);
  assert.match(miryang[0].note!, /개별 구장.*미확인/);
}
console.log("프로구장 공식 주소 대체 검색·누락·지역·기존 좌표 재사용 검증 통과");
