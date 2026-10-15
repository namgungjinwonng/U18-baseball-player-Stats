// KBSA가 없는 시즌 요청에 최신 시즌으로 대신 응답할 때의 판별 함수 테스트.
import assert from "node:assert/strict";
import { calendarYears, servedSeason } from "./koreaBaseball.js";

// 2026-10 실제 응답 형태: season=2030 요청에도 2026이 선택돼 돌아온다(전적표는 selected가 다음 줄).
const teamList = `<select name="season">
  <option value="0">년도전체</option>
  <option value="2026" selected>2026</option>
  <option value="2025" >2025</option>
</select>`;
const matchTable = `<select name="season">
  <option value="2026"
      selected>2026</option>
  <option value="2025">2025</option>
</select>`;
assert.equal(servedSeason(teamList), 2026);
assert.equal(servedSeason(matchTable), 2026);
assert.equal(servedSeason("<select name=\"season\"><option value=\"2026\">2026</option></select>"), null);
assert.equal(servedSeason("<html></html>"), null);

const calendar = `<li date="2026:05:02:09:30"><a href="/game/box_score?game_idx=1"></a></li>
<li date="2026:05:03:12:00"><a href="/game/box_score?game_idx=2"></a></li>`;
assert.deepEqual(calendarYears(calendar), [2026]);
assert.deepEqual(calendarYears("<ul></ul>"), []);

console.log("✓ KBSA 대체 시즌 응답 판별 통과");
