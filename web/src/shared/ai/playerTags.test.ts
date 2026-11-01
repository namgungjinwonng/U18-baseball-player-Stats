// 분석 문장 선수 이름표(학년·투타) 만들기·붙이기 테스트
import assert from "node:assert/strict";
import { playerTags, tagPlayers } from "./playerTags";

const tags = playerTags([
  { name: "신지호", team: "충암고", grade: "2", throws: "우", bats: "좌" },
  { name: "박상민", team: "세광고", grade: "3", throws: "좌", bats: "좌" },
  { name: "이현", team: "충암고", grade: "1" },
  { name: "이현준", team: "충암고", grade: "2", throws: "우", bats: "우" },
  { name: "김민수", team: "충암고", grade: "2" },
  { name: "김민수", team: "세광고", grade: "3" }, // 동명이인 — 누구인지 몰라 붙이지 않는다
  { name: "다른팀", team: "덕수고", grade: "2" }, // 두 학교 밖 선수
  { name: "정보없음", team: "충암고" },
], ["충암고", "세광고"]);

assert.equal(tags.get("신지호"), "2학년, 우투좌타");
assert.equal(tags.get("이현"), "1학년", "투타가 없으면 학년만");
assert.ok(!tags.has("김민수") && !tags.has("다른팀") && !tags.has("정보없음"));

// 첫 언급에만, 조사가 붙어도 이름 뒤에 붙인다.
assert.deepEqual(tagPlayers("충암고 신지호는 타율 .343의 타격으로 세광고 박상민의 평균자책점을 노린다. 신지호가 열쇠다.", tags), [
  "충암고 ", { name: "신지호", tag: "2학년, 우투좌타" }, "는 타율 .343의 타격으로 세광고 ",
  { name: "박상민", tag: "3학년, 좌투좌타" }, "의 평균자책점을 노린다. 신지호가 열쇠다.",
]);
// 긴 이름부터 — 「이현준」 안의 「이현」에 붙이지 않는다.
assert.deepEqual(tagPlayers("이현준과 이현이 출루한다.", tags), [
  { name: "이현준", tag: "2학년, 우투우타" }, "과 ", { name: "이현", tag: "1학년" }, "이 출루한다.",
]);
// 앞 글자가 한글이면 다른 낱말의 일부, 이미 괄호가 붙어 있으면 그대로 둔다.
assert.deepEqual(tagPlayers("최신지호 타자", tags), ["최신지호 타자"]);
assert.deepEqual(tagPlayers("신지호(2학년)가 친다.", tags), ["신지호(2학년)가 친다."]);
assert.deepEqual(tagPlayers("선수 이름이 없는 문장", tags), ["선수 이름이 없는 문장"]);

console.log("분석 문장 선수 이름표 테스트 통과");
