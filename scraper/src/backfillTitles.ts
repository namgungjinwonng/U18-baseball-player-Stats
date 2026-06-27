// 기존 data/games/*.json 에 title(시합/대회명) 이 없는 경기들을 record_detail 에서 재수집.
// title 추가 후로는 신규 게임은 자동으로 채워지므로 1회성 마이그레이션 용도.
//
// 실행: npx tsx scraper/src/backfillTitles.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchRecordDetail, type GameRef } from "./koreaBaseball.js";
import type { GameBoxScore } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const GAMES_DIR = path.join(DATA_DIR, "games");

const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? "4", 10);
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;

async function main() {
  const files = fs.existsSync(GAMES_DIR)
    ? fs.readdirSync(GAMES_DIR).filter((f) => f.endsWith(".json"))
    : [];
  const need: { ref: GameRef; fp: string; existing: GameBoxScore }[] = [];
  for (const f of files) {
    const fp = path.join(GAMES_DIR, f);
    const g = JSON.parse(fs.readFileSync(fp, "utf8")) as GameBoxScore;
    if (g.title && g.title.trim().length > 0) continue;
    need.push({
      ref: {
        id: g.id, date: g.date, home: g.home, away: g.away,
        homeScore: g.score?.home ?? 0, awayScore: g.score?.away ?? 0,
      },
      fp,
      existing: g,
    });
    if (need.length >= LIMIT) break;
  }
  console.log(`title 누락 게임 ${need.length}건 / 총 ${files.length}건`);
  if (need.length === 0) return;

  let done = 0, ok = 0, fail = 0;
  const workers: Promise<void>[] = [];
  let i = 0;
  const work = async () => {
    while (i < need.length) {
      const idx = i++;
      const { ref, fp, existing } = need[idx];
      try {
        const fresh = await fetchRecordDetail(ref);
        // title 만 패치 (기존 stats 유지 — record_detail 가 동일하게 파싱되지만 안전하게 title 만 머지).
        const merged: GameBoxScore = { ...existing, title: fresh.title || existing.title };
        fs.writeFileSync(fp, JSON.stringify(merged, null, 2) + "\n");
        ok++;
      } catch (e) {
        fail++;
        if (fail <= 5) console.warn(`  ⚠ ${ref.id} 실패: ${(e as Error).message}`);
      }
      done++;
      if (done % 50 === 0) console.log(`  ${done}/${need.length} (ok ${ok} / fail ${fail})`);
    }
  };
  for (let w = 0; w < CONCURRENCY; w++) workers.push(work());
  await Promise.all(workers);
  console.log(`완료: ok ${ok} / fail ${fail} / 총 ${need.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
