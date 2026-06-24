// 멱등성/정확성 검증 — 임시 디렉토리에서 합성 경기로 집계를 2회 돌려 동일성 확인.
// 실행: npm test   (tsx)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { aggregate, readGames, writeAggregated, outsToIp } from "./accumulate.js";
import type { GameBoxScore } from "./types.js";

const game = (id: string, date: string): GameBoxScore => ({
  id, date, season: 2026, home: "서울고", away: "덕수고",
  score: { home: 5, away: 3 },
  batters: [
    { playerId: "b1", name: "김타자", team: "서울고", ab: 4, h: 2, b2: 1, b3: 0, hr: 1, rbi: 3, r: 2, bb: 0, hbp: 0, so: 1, sb: 0 },
  ],
  pitchers: [
    { playerId: "p1", name: "이투수", team: "덕수고", outs: 18, h: 5, r: 3, er: 2, bb: 1, so: 7, w: 0, l: 1, sv: 0 },
  ],
  matchups: [
    { batterId: "b1", pitcherId: "p1", ab: 3, h: 1, b2: 0, b3: 0, hr: 0, bb: 0, hbp: 0, so: 1 },
  ],
});

function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "u18-acc-"));
  fs.mkdirSync(path.join(dir, "games"), { recursive: true });

  // 두 경기 적재
  const games = [game("g1", "2026-04-01"), game("g2", "2026-04-08")];
  for (const g of games)
    fs.writeFileSync(path.join(dir, "games", `${g.id}.json`), JSON.stringify(g));

  // 1차 집계
  const agg1 = aggregate(readGames(dir), "test");
  writeAggregated(dir, agg1);
  const snap1 = snapshot(dir);

  // 2차 집계(동일 입력) → 멱등이면 lastUpdated 외 동일해야 함
  const agg2 = aggregate(readGames(dir), "test");
  writeAggregated(dir, agg2);
  const snap2 = snapshot(dir);
  assert.equal(snap1, snap2, "재집계 결과가 1차와 달라짐(멱등성 위반)");

  // 집계 정확성: 2경기 합산
  const batter = agg2.players.find((p) => p.id === "b1")!;
  assert.equal(batter.batting!.h, 4, "안타 합산 오류");
  assert.equal(batter.batting!.hr, 2, "홈런 합산 오류");
  assert.equal(batter.batting!.avg, 0.5, "타율 계산 오류"); // 4/8
  assert.equal(batter.position, "타자");

  const pitcher = agg2.players.find((p) => p.id === "p1")!;
  assert.equal(pitcher.position, "투수");
  assert.equal(pitcher.pitching!.ip, outsToIp(36), "이닝 합산 오류"); // 12.0
  assert.equal(pitcher.pitching!.so, 14, "탈삼진 합산 오류");
  assert.equal(pitcher.pitching!.era, 3.0, "ERA 오류"); // 4ER*9/12IP = 3.00

  const m = agg2.matchups.find((x) => x.batterId === "b1" && x.pitcherId === "p1")!;
  assert.equal(m.ab, 6);
  assert.equal(m.h, 2);
  assert.equal(m.avg, 0.333);
  assert.equal(m.batterName, "김타자");

  fs.rmSync(dir, { recursive: true, force: true });
  console.log("✓ 멱등성 + 집계 정확성 통과");
}

// lastUpdated(시각) 필드를 제외한 스냅샷
function snapshot(dir: string): string {
  const files = [
    "players/index.json", "matchups/b1.json",
    "players/b1.json", "players/p1.json",
  ];
  return files
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
    .join("\n----\n");
}

run();
