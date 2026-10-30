// 매치업 학교 선택 화면의 진입 판단·선택 전이·확정 주소 계산을 검증하는 단위 테스트.
import assert from "node:assert/strict";
import {
  activate, canConfirm, cancelParams, clearSlot, confirmParams, editParams, filterTeams, initialDraft, missingMessage,
  needsSelect, pickTeam, swapDraft,
} from "./versusSelect";

// 진입 판단: 빈 값·한쪽·중복(U-18 표기 차이 포함)·학교 변경 플래그는 선택 화면, 서로 다른 두 학교는 결과
assert.equal(needsSelect("", "", false), true);
assert.equal(needsSelect("강릉고", "", false), true);
assert.equal(needsSelect("", "원주고", false), true);
assert.equal(needsSelect("강릉고", "원주고", false), false);
assert.equal(needsSelect("명지BC(U-18)", "명지BC", false), true);
assert.equal(needsSelect("강릉고", "원주고", true), true);
assert.equal(needsSelect("  ", "원주고", false), true);

// 시작 상태: 빈 칸 활성, 둘 다 있으면 B 활성, 이름은 정규화
assert.deepEqual(initialDraft("", ""), { a: "", b: "", active: "a" });
assert.deepEqual(initialDraft("강릉고", ""), { a: "강릉고", b: "", active: "b" });
assert.deepEqual(initialDraft("", "원주고"), { a: "", b: "원주고", active: "a" });
assert.deepEqual(initialDraft("명지BC(U-18)", "명지BC"), { a: "명지BC", b: "명지BC", active: "b" });

// A 선택 → B 자동 활성 → B 선택(결과로 넘어가는 것은 화면의 「매치업 보기」만)
let d = initialDraft("", "");
d = pickTeam(d, "강릉고").draft;
assert.deepEqual(d, { a: "강릉고", b: "", active: "b" });
d = pickTeam(d, "원주고").draft;
assert.deepEqual(d, { a: "강릉고", b: "원주고", active: "b" });
assert.equal(canConfirm(d), true);
assert.equal(missingMessage(d), "");

// 활성 칸 교체, 반대 칸 학교 중복 차단(U-18 표기 차이 포함), 같은 학교 재선택은 그대로
d = pickTeam(d, "덕수고").draft;
assert.deepEqual(d, { a: "강릉고", b: "덕수고", active: "b" });
const blocked = pickTeam(d, "강릉고(U-18)");
assert.equal(blocked.blocked, true);
assert.equal(blocked.draft, d);
assert.deepEqual(pickTeam(d, "덕수고"), { draft: d, blocked: false });
d = pickTeam(activate(d, "a"), "충암고").draft;
assert.deepEqual(d, { a: "충암고", b: "덕수고", active: "a" });

// 삭제 → 그 칸 활성, 교환(한쪽만 차 있으면 빈 칸 활성)
d = clearSlot(d, "b");
assert.deepEqual(d, { a: "충암고", b: "", active: "b" });
assert.equal(canConfirm(d), false);
assert.equal(missingMessage(d), "HOME 학교를 선택해 주세요");
assert.deepEqual(swapDraft(d), { a: "", b: "충암고", active: "a" });
assert.deepEqual(swapDraft({ a: "강릉고", b: "원주고", active: "b" }), { a: "원주고", b: "강릉고", active: "b" });
assert.equal(missingMessage({ a: "", b: "", active: "a" }), "AWAY와 HOME 학교를 선택해 주세요");
assert.equal(missingMessage({ a: "", b: "원주고", active: "a" }), "AWAY 학교를 선택해 주세요");
assert.match(missingMessage(initialDraft("명지BC(U-18)", "명지BC")), /같은 학교/);

// 확정 주소: 새 조합이면 조합 전용 상태(g·m·py·t)를 지우고 탭(v)은 유지, select 제거
const cur = new URLSearchParams("a=강릉고&b=원주고&v=player&m=bBat&py=all&g=123&select=1");
const changed = confirmParams(cur, { a: "강릉고", b: "덕수고", active: "b" });
assert.equal(changed.get("a"), "강릉고");
assert.equal(changed.get("b"), "덕수고");
assert.equal(changed.get("v"), "player");
for (const k of ["m", "py", "g", "select"]) assert.equal(changed.has(k), false, k);
// 같은 조합(순서만 바뀐 경우 포함)이면 결과 상태 유지
const same = confirmParams(cur, { a: "원주고", b: "강릉고", active: "b" });
assert.equal(same.get("m"), "bBat");
assert.equal(same.get("py"), "all");
assert.equal(same.get("g"), "123");
assert.equal(same.has("select"), false);
// 빈 화면에서 처음 확정 + 한글 이름 인코딩
const first = confirmParams(new URLSearchParams(""), { a: "강릉고", b: "원주고", active: "b" });
assert.equal(first.toString(), `a=${encodeURIComponent("강릉고")}&b=${encodeURIComponent("원주고")}`);

// 학교 변경 진입·취소는 select만 붙였다 뗀다
const edit = editParams(new URLSearchParams("a=강릉고&b=원주고&v=stat&py=2025"));
assert.equal(edit.get("select"), "1");
assert.equal(edit.get("py"), "2025");
const back = cancelParams(edit);
assert.equal(back.toString(), new URLSearchParams("a=강릉고&b=원주고&v=stat&py=2025").toString());

// 목록 필터: 지역 + 학교명 일부, 앞뒤 공백·U-18 표기 무시, 지역 없는 학교도 검색 대상
const list = [
  { name: "강릉고", region: "강원" },
  { name: "강원고", region: "강원" },
  { name: "명지BC", region: "서울" },
  { name: "일정전용고", region: "" },
];
assert.deepEqual(filterTeams(list, "", "").length, 4);
assert.deepEqual(filterTeams(list, "강원", " 강 ").map((t) => t.name), ["강릉고", "강원고"]);
assert.deepEqual(filterTeams(list, "", "명지BC(U-18)").map((t) => t.name), ["명지BC"]);
assert.deepEqual(filterTeams(list, "", "일정").map((t) => t.name), ["일정전용고"]);
assert.deepEqual(filterTeams(list, "서울", "강"), []);

console.log("versusSelect tests passed");
