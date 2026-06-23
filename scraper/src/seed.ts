// 데모/개발용 결정적(seed) 경기 박스스코어 생성기.
// 실제 수집(fetchGames/parseRecord) 구현 전, 파이프라인을 끝까지 돌려보기 위한
// "가짜 원천 데이터"를 만든다. 동일 시드 → 항상 동일 결과.
//
// 실행: npx tsx src/seed.ts   (data/games/*.json 생성 후 `npm run scrape` 로 집계)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BatterLine, GameBoxScore, MatchupLine, PitcherLine } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

// mulberry32 — 작고 결정적인 PRNG
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260424);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

interface Roster {
  id: string; name: string; team: string; role: "batter" | "pitcher";
}
const PLAYERS: Roster[] = [
  { id: "p001", name: "김도윤", team: "서울고", role: "batter" },
  { id: "p006", name: "한선우", team: "서울고", role: "batter" },
  { id: "p002", name: "이준서", team: "덕수고", role: "batter" },
  { id: "p007", name: "강태현", team: "덕수고", role: "pitcher" },
  { id: "p003", name: "박지호", team: "경기고", role: "batter" },
  { id: "p008", name: "윤서준", team: "경기고", role: "batter" },
  { id: "p004", name: "최민재", team: "휘문고", role: "pitcher" },
  { id: "p005", name: "정우진", team: "장충고", role: "pitcher" },
];
const TEAMS = ["서울고", "덕수고", "경기고", "휘문고", "장충고"];
const batters = (t: string) => PLAYERS.filter((p) => p.team === t && p.role === "batter");
const pitchers = (t: string) => PLAYERS.filter((p) => p.team === t && p.role === "pitcher");

function makeBatter(p: Roster): BatterLine {
  const ab = between(3, 5);
  const h = between(0, Math.min(ab, 3));
  const hr = h > 0 && rand() < 0.18 ? 1 : 0;
  const b2 = h - hr > 0 && rand() < 0.3 ? 1 : 0;
  const b3 = h - hr - b2 > 0 && rand() < 0.08 ? 1 : 0;
  return {
    playerId: p.id, name: p.name, team: p.team,
    ab, h, b2, b3, hr,
    rbi: hr ? between(1, 3) : between(0, 2),
    r: between(0, 2), bb: rand() < 0.25 ? 1 : 0,
    so: between(0, 2), sb: rand() < 0.2 ? 1 : 0,
  };
}

function makePitcher(p: Roster): PitcherLine {
  const outs = between(15, 21); // 5~7이닝
  const so = between(4, 10);
  const er = between(0, 4);
  const win = rand() < 0.5;
  return {
    playerId: p.id, name: p.name, team: p.team,
    outs, h: between(3, 8), r: er + (rand() < 0.3 ? 1 : 0), er,
    bb: between(0, 3), so, w: win ? 1 : 0, l: win ? 0 : 1,
    sv: 0,
  };
}

function game(id: string, date: string, home: string, away: string): GameBoxScore {
  const homePitcher = pitchers(home)[0];
  const awayPitcher = pitchers(away)[0];
  const batterLines: BatterLine[] = [];
  const matchups: MatchupLine[] = [];

  for (const team of [home, away]) {
    const oppPitcher = team === home ? awayPitcher : homePitcher;
    for (const b of batters(team)) {
      const line = makeBatter(b);
      batterLines.push(line);
      if (oppPitcher) {
        // 해당 타자의 타석 중 일부를 상대 선발투수와의 대결로 집계
        const ab = Math.min(line.ab, between(2, 3));
        const h = Math.min(line.h, between(0, ab));
        matchups.push({
          batterId: b.id, pitcherId: oppPitcher.id,
          ab, h, hr: h > 0 ? line.hr : 0, bb: line.bb, so: Math.min(line.so, ab),
        });
      }
    }
  }

  const pitcherLines = [homePitcher, awayPitcher]
    .filter((p): p is Roster => Boolean(p))
    .map(makePitcher);

  return {
    id, date, season: 2026, home, away,
    score: { home: between(1, 8), away: between(1, 8) },
    batters: batterLines, pitchers: pitcherLines, matchups,
  };
}

// 4~6월 일정: 투수 보유 팀 위주로 맞붙여 상대전적이 쌓이도록 구성
const SCHEDULE: [string, string, string, string][] = [
  ["g001", "2026-04-05", "서울고", "휘문고"],
  ["g002", "2026-04-12", "덕수고", "장충고"],
  ["g003", "2026-04-19", "경기고", "휘문고"],
  ["g004", "2026-04-26", "서울고", "장충고"],
  ["g005", "2026-05-03", "경기고", "덕수고"],
  ["g006", "2026-05-10", "서울고", "덕수고"],
  ["g007", "2026-05-17", "경기고", "장충고"],
  ["g008", "2026-05-24", "서울고", "경기고"],
  ["g009", "2026-05-31", "덕수고", "휘문고"],
  ["g010", "2026-06-07", "서울고", "덕수고"],
  ["g011", "2026-06-14", "경기고", "휘문고"],
  ["g012", "2026-06-21", "서울고", "덕수고"],
];

function main() {
  const dir = path.join(DATA_DIR, "games");
  // 기존 게임 파일 정리(부분 스키마 데모 파일 포함) 후 재생성
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".json")) fs.rmSync(path.join(dir, f));
  }
  fs.mkdirSync(dir, { recursive: true });
  for (const [id, date, home, away] of SCHEDULE) {
    const g = game(id, date, home, away);
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(g, null, 2) + "\n");
  }
  console.log(`✓ ${SCHEDULE.length}개 경기 생성 → data/games/`);
}

main();
