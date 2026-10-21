// 메인 네 개 바로가기의 순서·주소와 매치업 명칭 및 선수 상대전적 분리를 검증한다.
import assert from "node:assert/strict";
import { HOME_LINKS, NAV_GROUPS } from "./navMenu";

assert.deepEqual(HOME_LINKS.map(({ label, to }) => [label, to]), [
  ["경기일정", "/schedule"],
  ["학교정보", "/team"],
  ["매치업", "/versus"],
  ["선수 기록", "/records"],
]);
assert.equal(new Set(HOME_LINKS.map((item) => item.to)).size, 4);
const menu = NAV_GROUPS.flatMap((group) => group.items);
assert.equal(menu.find((item) => item.to === "/versus")?.label, "매치업");
assert.equal(menu.find((item) => item.to === "/matchup")?.label, "상대전적", "선수 상대전적의 이름·기존 경로는 유지한다");
assert.ok(menu.every((item) => item.label !== "학교 대전"));
assert.ok(HOME_LINKS.every((item) => menu.some((entry) => entry.to === item.to && entry.icon === item.icon)));
console.log("메인 4개 바로가기·매치업 명칭·선수 상대전적 경로 분리 검증 통과");
