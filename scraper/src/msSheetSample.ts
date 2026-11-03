// KBSA 15세 이하부 경기 20개를 연도별로 고르고 기록지 이미지와 경기 요약을 내려받는 판독 시험용 스크립트
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.korea-baseball.com";
const UA = "U18-baseball-stats/1.0 (+https://github.com/namgungjinwonng/U18-baseball-player-Stats)";
const OUT = path.resolve(".cache/ms-sheets");
// 인자 없으면 첫 시험 계획, "2024=48 2025=52"처럼 주면 그만큼 더 고른다.
const ARGS = process.argv.slice(2).map((a) => a.split("=").map(Number));
const PLAN: Record<number, number> = ARGS.length ? Object.fromEntries(ARGS) : { 2019: 3, 2021: 2, 2023: 3, 2024: 4, 2025: 4, 2026: 4 };
const MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function get(url: string) {
  await sleep(1200);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}
const clean = (s: string) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// 같은 입력이면 같은 경기를 고르도록 시드를 둔 난수
function seeded(seed: number) {
  return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

function parseBox(html: string) {
  const teams = [...html.matchAll(/<div class="team[12]">[\s\S]*?<dd class="score">\s*(\d+)/g)].map((m) => Number(m[1]));
  const text = clean(html);
  const title = (text.match(/Box Score .*?--?>? ?([^/]+?) (\d{4}\.\d{2}\.\d{2})/) || [])[1] ?? "";
  const lines = [...text.matchAll(/안타 (\d+) 홈런 (\d+) 도루 (\d+) 삼진 (\d+) 실책 (\d+) 사사구 (\d+)/g)].map((m) => ({
    h: +m[1], hr: +m[2], sb: +m[3], so: +m[4], e: +m[5], bb: +m[6],
  }));
  const named = (label: string) => {
    const m = text.match(new RegExp(`\\[${label}\\] (.*?)(?= \\[|스폰서)`));
    return m ? [...m[1].matchAll(/([가-힣]{2,5})(?:\((\d+)개\))?/g)].map((x) => ({ name: x[1], n: Number(x[2] ?? 1) })) : [];
  };
  const papers = [...html.matchAll(/paper_each_download\?boxfile_seq=(\d+)">([^<]+)</g)].map((m) => ({ seq: m[1], file: m[2].trim() })).filter((p) => /\.(jpe?g|png)$/i.test(p.file));
  const date = (text.match(/(\d{4}\.\d{2}\.\d{2}) \d{2}:\d{2}/) || [])[1] ?? "";
  const league = (text.match(/15세 이하부 Box Score.*?(?:-->)? ?(제?[^/]*?) \d{4}\.\d{2}\.\d{2}/) || [])[1] ?? title;
  return {
    scores: teams, lines, date, league, papers,
    doubles: named("2루타"), triples: named("3루타"), homers: named("홈런"), steals: named("도루"),
    win: named("승리투수").map((x) => x.name), lose: named("패전투수").map((x) => x.name),
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const rand = seeded(20261103 + ARGS.length);
  const gamesPath = path.join(OUT, "games.json");
  // 이미 고른 경기는 유지하고 다시 받지 않으며, 끊겨도 이어서 할 수 있게 경기마다 저장한다.
  const picked: any[] = fs.existsSync(gamesPath) ? JSON.parse(fs.readFileSync(gamesPath, "utf8")) : [];
  const done = new Set(picked.map((g) => g.id));
  for (const [year, want] of Object.entries(PLAN)) {
    const ids = new Set<string>();
    for (const m of MONTHS) {
      const html = await (await get(`${BASE}/game/calendar?kind_cd=21&month=${m}&year=${year}`)).text();
      for (const x of html.matchAll(/game_idx=(\d+)/g)) ids.add(x[1]);
    }
    const pool = [...ids].filter((id) => !done.has(id)).sort((a, b) => Number(a) - Number(b));
    let got = 0, tried = 0, noPaper = 0;
    while (got < want && pool.length) {
      const id = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      tried++;
      const box = parseBox(await (await get(`${BASE}/game/box_score?game_idx=${id}`)).text());
      if (box.papers.length < 2 || box.lines.length < 2) { noPaper++; continue; }
      for (const [i, p] of box.papers.slice(0, 2).entries()) {
        const res = await get(`${BASE}/game/exec/paper_each_download?boxfile_seq=${p.seq}`);
        const ext = path.extname(p.file).toLowerCase() || ".jpg";
        fs.writeFileSync(path.join(OUT, `${id}_${i + 1}${ext}`), Buffer.from(await res.arrayBuffer()));
      }
      picked.push({ id, year: Number(year), ...box });
      fs.writeFileSync(gamesPath, JSON.stringify(picked, null, 1));
      got++;
      console.log(year, id, box.date, box.scores.join(":"), box.papers.map((p) => p.file).join(" | "));
    }
    console.log(`${year}: 후보 ${ids.size}경기, 시도 ${tried}, 기록지/요약 없음 ${noPaper}`);
  }
}

main();
