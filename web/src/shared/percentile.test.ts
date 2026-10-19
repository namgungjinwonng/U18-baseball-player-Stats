// 선수 요약 카드의 백분위와 경기별 누적 타율·OPS 계산을 검증하는 단위 테스트.
import assert from "node:assert/strict";
import { cumulativeBatting, percentileRank } from "./percentile";
import type { GameLogEntry } from "./types";

// 높을수록 좋은 지표: 4명 중 2명보다 좋고 1명과 동률 → (2 + 0.5)/4 = 63
assert.equal(percentileRank([0.2, 0.25, 0.3, 0.35], 0.3), 63);
assert.equal(percentileRank([0.2, 0.25, 0.3, 0.35], 0.4), 100);
// 낮을수록 좋은 지표(ERA): 2.00은 3.00·4.00보다 좋다 → (2 + 0.5)/3 = 83
assert.equal(percentileRank([2, 3, 4], 2, true), 83);
assert.equal(percentileRank([], 1), null);

const g = (date: string, ab: number, h: number, extra: Partial<NonNullable<GameLogEntry["bStat"]>> = {}): GameLogEntry => ({
  gameId: date, date, opponent: "상대고", line: "",
  bStat: { ab, h, b2: 0, b3: 0, hr: 0, rbi: 0, r: 0, bb: 0, hbp: 0, so: 0, sb: 0, ...extra },
});
// 로그 순서가 최신순이어도 날짜순으로 누적한다. 투수 전용 경기(bStat 없음)는 건너뛴다.
const log: GameLogEntry[] = [
  g("2026-03-15", 4, 0),
  { gameId: "p", date: "2026-03-10", opponent: "상대고", line: "", pStat: { outs: 3, h: 0, r: 0, er: 0, bb: 0, so: 1, w: 0, l: 0, sv: 0 } },
  g("2026-03-08", 4, 2, { b2: 1, bb: 1 }),
  g("2026-03-01", 2, 1, { hr: 1 }),
];
const all = cumulativeBatting(log);
assert.deepEqual(all.map((p) => p.date), ["2026-03-01", "2026-03-08", "2026-03-15"]);
assert.equal(all[0].avg, 0.5);
assert.equal(all[0].ops, 0.5 + 2); // 출루 1/2 + 장타 4/2
// 2경기 누적: 3/6 타율, 출루 (3+1)/7, 장타 (1+4+2)/6 — 1루타1·홈런1·2루타1
assert.equal(all[1].avg, 0.5);
assert.ok(Math.abs(all[1].ops - (4 / 7 + 7 / 6)) < 1e-9);
assert.equal(all[2].avg, 0.3);
// 최근 1경기만 누적
assert.deepEqual(cumulativeBatting(log, 1).map((p) => [p.date, p.avg]), [["2026-03-15", 0]]);

console.log("percentile tests passed");
