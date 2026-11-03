// 기록지 시트 검증과 명단 이름 확인 규칙(정확 일치·동명이인·중복 연결 제외)을 검증한다.
import assert from "node:assert/strict";
import { assignRows, battingVerified, cleanLeague, confirmName, normSchool, pitchingVerified, type BatRow, type Sheet } from "./msSheetUtil.js";

const sheet: Sheet = {
  school: "대치중", q: "A",
  rows: [["정시우", 4, 3, 2], ["이휘영", 4, 4, 1]],
  p: [["이휘영", 7, 1, 4, 0, 0]],
  t: { pa: 8, ab: 7, r: 3, h: 3 },
  pt: { bf: 7, h: 1, bb: 0, so: 4, r: 0, er: 0 },
};
assert.ok(battingVerified(sheet, 3, 3));
assert.ok(!battingVerified(sheet, 4, 3), "KBSA 안타가 다르면 제외");
assert.ok(!battingVerified(sheet, 3, 2), "KBSA 득점이 다르면 제외");
assert.ok(!battingVerified({ ...sheet, t: { ...sheet.t, ab: 8 } }, 3, 3), "행 합과 합계가 다르면 제외");
assert.ok(!battingVerified({ ...sheet, q: "C" }, 3, 3), "판독 품질이 낮으면 제외");
assert.ok(!battingVerified({ ...sheet, adj: true }, 3, 3), "합계를 참고해 읽은 시트는 제외");
assert.ok(battingVerified({ ...sheet, t: { ...sheet.t, r: -1 } }, 3, 3), "득점 합계 칸이 비면 득점 대조만 건너뜀");
assert.ok(pitchingVerified(sheet, 1, 4));
assert.ok(!pitchingVerified(sheet, 1, 5), "상대 KBSA 삼진이 다르면 제외");

const roster = [{ personNo: "1", name: "김정환" }, { personNo: "2", name: "박태완" }, { personNo: "3", name: "이민수" }, { personNo: "4", name: "이민수" }];
assert.equal(confirmName("박태완", roster), "2");
assert.equal(confirmName("김정한", roster), null, "한 글자 달라도 교정하지 않음");
assert.equal(confirmName("이민수", roster), null, "같은 학교 동명이인 제외");
assert.equal(confirmName("최강민", roster), null, "명단에 없으면 제외");

const rows: BatRow[] = [["박태완", 3, 3, 1], ["박태완", 3, 2, 0], ["김정환", 2, 2, 0], ["없는이름", 1, 1, 0]];
assert.deepEqual(assignRows(rows, roster).map((x) => x.row[0]), ["김정환"], "같은 선수 두 행은 모두 제외, 명단에 없으면 제외");

assert.equal(normSchool("서울 양천중"), "양천중");
assert.equal(normSchool("경기 부천중학교"), "부천중");
assert.equal(normSchool("부산 경남중"), "경남중");
assert.equal(normSchool("경남중"), "경남중", "지역명으로 시작하는 학교 이름은 유지");
assert.equal(normSchool("경남 밀양DMBC(U-15)"), "밀양DMBC");
assert.equal(normSchool("HBC(U13)"), "HBC(U13)", "다른 연령 팀은 합치지 않음");
assert.equal(cleanLeague("대학부 18세 이하부 일반부 생활체육 제54회 대통령기 전국중학야구대회"), "제54회 대통령기 전국중학야구대회");
console.log("기록지 시트 검증·이름 확인 규칙 테스트 통과");
