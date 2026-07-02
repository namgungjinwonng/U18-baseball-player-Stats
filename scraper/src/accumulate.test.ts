// 멱등성/정확성 검증 — 임시 디렉토리에서 합성 경기로 집계를 2회 돌려 동일성 확인.
// + 이적 선수 병합(기록 합산·현재 소속 표시) 검증.
// 실행: npm test   (tsx)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { aggregate, readGames, writeAggregated, outsToIp, type Roster } from "./accumulate.js";
import type { GameBoxScore } from "./types.js";

// 실데이터 슬러그 형식: `${team}_${name}_${number}` (accumulate 가 정규팀으로 재슬러그하므로 동일해야 함).
const B = "서울고_김타자_7";
const P = "덕수고_이투수_1";
const game = (id: string, date: string): GameBoxScore => ({
  id, date, season: 2026, home: "서울고", away: "덕수고",
  score: { home: 5, away: 3 },
  batters: [
    { playerId: B, name: "김타자", team: "서울고", ab: 4, h: 2, b2: 1, b3: 0, hr: 1, rbi: 3, r: 2, bb: 0, hbp: 0, so: 1, sb: 0 },
  ],
  pitchers: [
    { playerId: P, name: "이투수", team: "덕수고", outs: 18, h: 5, r: 3, er: 2, bb: 1, so: 7, w: 0, l: 1, sv: 0 },
  ],
  matchups: [
    { batterId: B, pitcherId: P, ab: 3, h: 1, b2: 0, b3: 0, hr: 0, bb: 0, hbp: 0, so: 1 },
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
  const batter = agg2.players.find((p) => p.id === B)!;
  assert.equal(batter.batting!.h, 4, "안타 합산 오류");
  assert.equal(batter.batting!.hr, 2, "홈런 합산 오류");
  assert.equal(batter.batting!.avg, 0.5, "타율 계산 오류"); // 4/8
  assert.equal(batter.position, "타자");

  const pitcher = agg2.players.find((p) => p.id === P)!;
  assert.equal(pitcher.position, "투수");
  assert.equal(pitcher.pitching!.ip, outsToIp(36), "이닝 합산 오류"); // 12.0
  assert.equal(pitcher.pitching!.so, 14, "탈삼진 합산 오류");
  assert.equal(pitcher.pitching!.era, 3.0, "ERA 오류"); // 4ER*9/12IP = 3.00

  const m = agg2.matchups.find((x) => x.batterId === B && x.pitcherId === P)!;
  assert.equal(m.ab, 6);
  assert.equal(m.h, 2);
  assert.equal(m.avg, 0.333);
  assert.equal(m.batterName, "김타자");

  fs.rmSync(dir, { recursive: true, force: true });
  console.log("✓ 멱등성 + 집계 정확성 통과");
}

// 이적 선수: 옛 소속(한밭고) 경기 + 새 소속(세종고) 경기가
// ① 한 선수로 합산되고 ② 현재 소속(세종고) 기준으로 표시되고
// ③ 상대전적 id 도 현재 슬러그로 재매핑되고 ④ 팀별 경기수는 경기 당시 소속으로 귀속되는지 검증.
// (CI 증분/전체 수집 모두 이 aggregate 경로를 지나므로 두 워크플로 공통의 회귀 방지 테스트)
function runTransferMerge() {
  const mk = (id: string, date: string, myTeam: string): GameBoxScore => ({
    id, date, season: 2026, home: myTeam, away: "상대고",
    score: { home: 4, away: 2 },
    batters: [
      { playerId: `${myTeam}_박이적_10`, name: "박이적", team: myTeam, ab: 4, h: 2, b2: 0, b3: 0, hr: 1, rbi: 2, r: 1, bb: 0, hbp: 0, so: 1, sb: 0 },
    ],
    pitchers: [
      { playerId: "상대고_최선발_21", name: "최선발", team: "상대고", outs: 18, h: 6, r: 4, er: 4, bb: 2, so: 5, w: 0, l: 1, sv: 0 },
    ],
    matchups: [
      { batterId: `${myTeam}_박이적_10`, pitcherId: "상대고_최선발_21", ab: 4, h: 2, b2: 0, b3: 0, hr: 1, bb: 0, hbp: 0, so: 1 },
    ],
  });
  // 시즌 중 이적: 4/1 한밭고 소속 → 5/1 세종고 소속.
  const games = [mk("t1", "2026-04-01", "한밭고"), mk("t2", "2026-05-01", "세종고")];

  // 현행 로스터: 이적 후 세종고에만 등재 (KBSA team_player 스냅샷).
  const roster: Roster = {
    "박이적|10": [{ team: "세종고", personNo: "900001", grade: "2", position: "내야수", throws: "우", bats: "좌" }],
    "최선발|21": [{ team: "상대고", personNo: "900002", grade: "3", position: "투수", throws: "우", bats: "우" }],
  };
  // 이력: 옛 소속 매핑 보존 (roster.ts 스냅샷 누적 + playerProfiles 출신학교 병합이 만드는 것).
  const history: Roster = {
    "박이적|10": [{ team: "한밭고", personNo: "900001" }],
  };

  const agg = aggregate(games, "test", roster, {}, history);

  // ① 중복 없이 한 명으로 병합 + 기록 합산
  const merged = agg.players.filter((p) => p.name === "박이적");
  assert.equal(merged.length, 1, "이적 선수가 병합되지 않고 중복됨");
  const p = merged[0];
  assert.equal(p.batting!.g, 2, "이적 전후 경기수 합산 오류");
  assert.equal(p.batting!.h, 4, "이적 전후 안타 합산 오류");
  assert.equal(p.batting!.hr, 2, "이적 전후 홈런 합산 오류");
  // ② 현재 소속 기준 표시 (팀·학년·투타)
  assert.equal(p.team, "세종고", "현재 소속(세종고) 표시 오류");
  assert.equal(p.id, "세종고_박이적_10", "현재 소속 기준 슬러그 오류");
  assert.equal(p.grade, "2");
  assert.equal(p.bats, "좌");
  assert.equal(p.personNo, "900001");
  // ③ 상대전적 id 재매핑 + 병합 (옛 슬러그 잔존 없음)
  const ms = agg.matchups.filter((m) => m.batterName === "박이적");
  assert.equal(ms.length, 1, "이적 선수 상대전적이 병합되지 않음");
  assert.equal(ms[0].batterId, "세종고_박이적_10", "상대전적 id 가 옛 슬러그로 남음");
  assert.equal(ms[0].ab, 8, "상대전적 합산 오류");
  // index 에도 옛 슬러그가 없어야 함
  assert.ok(!agg.index.some((x) => x.id.startsWith("한밭고_박이적")), "index 에 옛 슬러그 잔존");
  // ④ 팀별 경기수: 경기 당시 소속으로 귀속 (병합 후에도 한밭고 1·세종고 1)
  assert.equal(agg.meta.teamGames!["한밭고"], 1, "옛 소속 팀 경기수 오류");
  assert.equal(agg.meta.teamGames!["세종고"], 1, "새 소속 팀 경기수 오류");

  console.log("✓ 이적 선수 병합(기록 합산 + 현재 소속 표시 + 상대전적 재매핑) 통과");
}

// lastUpdated(시각) 필드를 제외한 스냅샷
function snapshot(dir: string): string {
  const files = [
    "players/index.json", `matchups/${B}.json`,
    `players/${B}.json`, `players/${P}.json`,
  ];
  return files
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
    .join("\n----\n");
}

run();
runTransferMerge();
