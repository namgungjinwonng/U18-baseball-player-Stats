// 선수 비교 선택이 시즌을 바꿔도 personNo로 같은 선수를 다시 찾는지 검증하는 단위 테스트.
import assert from "node:assert/strict";
import { compareHref, picksFromQuery, resolvePicks, togglePickRef } from "./comparePicks";

const p = (id: string, personNo?: string) => ({ id, personNo, name: id.split("_")[1] ?? id });
const y2026 = [p("강릉고_김다원_7", "pA"), p("강릉고_전나엘_53", "pB"), p("강릉고_신입_1", "pC")];
const y2025 = [p("배명고_김다원_52", "pA"), p("강릉고_전나엘_20", "pB")]; // 신입(pC)은 2025 기록 없음

// 2026에 세 명을 고른 뒤 2025로 바꾸면 김다원·전나엘은 2025 ID로, 신입은 빠진다
let picks = togglePickRef([], y2026[0], 3);
picks = togglePickRef(picks, y2026[1], 3);
picks = togglePickRef(picks, y2026[2], 3);
assert.deepEqual(resolvePicks(picks, y2026).map((x) => x.id), ["강릉고_김다원_7", "강릉고_전나엘_53", "강릉고_신입_1"]);
assert.deepEqual(resolvePicks(picks, y2025).map((x) => x.id), ["배명고_김다원_52", "강릉고_전나엘_20"]);
assert.deepEqual(resolvePicks(picks, null), []);

// 다른 시즌 ID로 다시 눌러도 같은 선수로 보고 해제한다
assert.deepEqual(togglePickRef(picks, y2025[0], 3).map((x) => x.personNo), ["pB", "pC"]);
// 최대 인원을 넘기면 가장 먼저 고른 선수가 빠진다
assert.deepEqual(togglePickRef(picks.slice(0, 2), p("X_새선수_9", "pD"), 2).map((x) => x.personNo), ["pB", "pD"]);
// personNo 없는 선수는 ID로만 찾는다
assert.deepEqual(resolvePicks([{ id: "강릉고_무번호_3" }], [p("강릉고_무번호_3")]).map((x) => x.id), ["강릉고_무번호_3"]);

// 비교 화면 주소 왕복 — pn이 같은 순서로 실리고, pn 없던 예전 주소도 읽힌다
const href = compareHref("batting", resolvePicks(picks, y2025));
const params = new URLSearchParams(href.split("?")[1]);
assert.deepEqual(picksFromQuery(params, 3), [{ id: "배명고_김다원_52", personNo: "pA" }, { id: "강릉고_전나엘_20", personNo: "pB" }]);
assert.deepEqual(resolvePicks(picksFromQuery(params, 3), y2026).map((x) => x.id), ["강릉고_김다원_7", "강릉고_전나엘_53"]);
assert.deepEqual(picksFromQuery(new URLSearchParams("ids=a,b"), 3), [{ id: "a", personNo: undefined }, { id: "b", personNo: undefined }]);

console.log("comparePicks tests passed");
