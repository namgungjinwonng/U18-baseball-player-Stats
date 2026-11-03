// 기록지 판독값을 시트 합계·KBSA 경기 요약·앱 선수 프로필과 대조해 정확도를 계산하는 시험용 스크립트
import fs from "node:fs";
import path from "node:path";

type Row = [string, number, number, number];
type Pit = [string, number, number, number, number, number];
interface Sheet {
  school: string; q: "A" | "B" | "C"; rows: Row[]; p: Pit[];
  t: { pa: number; ab: number; r: number; h: number };
  pt: { bf: number; h: number; bb: number; so: number; r: number; er: number };
}
const DIR = path.resolve(".cache/ms-sheets");
const readings: Record<string, Sheet> = JSON.parse(fs.readFileSync(path.join(DIR, "readings.json"), "utf8"));
const games: any[] = JSON.parse(fs.readFileSync(path.join(DIR, "games.json"), "utf8"));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

const REGION = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s*/;
const norm = (s: string) => s.replace(REGION, "").replace(/중학교$/, "중").replace(/\s/g, "");
const profDir = path.resolve("../data/profiles");
const profiles = fs.readdirSync(profDir).map((f) => JSON.parse(fs.readFileSync(path.join(profDir, f), "utf8")));
const byName = new Map<string, any[]>();
for (const p of profiles) (byName.get(p.name) ?? byName.set(p.name, []).get(p.name)!).push(p);

const tally = { count: 0, ok: 0 };
const check = (t: typeof tally, a: number, b: number) => { t.count++; if (a === b) t.ok++; };
const rowPa = { ...tally }, rowAb = { ...tally }, rowH = { ...tally }, pBf = { ...tally }, pH = { ...tally };
const boxH = { ...tally }, boxSo = { ...tally }, boxBb = { ...tally }, boxR = { ...tally }, cross = { ...tally };
const nameBox = { ...tally };
let rowsTotal = 0, nameHit = 0, nameOther = 0, nameNone = 0, nameMulti = 0;
const problems: string[] = [];
const quality = { A: 0, B: 0, C: 0 };

for (const g of games) {
  const a = readings[`${g.id}_1`], b = readings[`${g.id}_2`];
  if (!a || !b) { problems.push(`${g.id} 판독 없음`); continue; }
  for (const [key, s, year] of [[`${g.id}_1`, a, g.year], [`${g.id}_2`, b, g.year]] as [string, Sheet, number][]) {
    quality[s.q]++;
    check(rowPa, sum(s.rows.map((r) => r[1])), s.t.pa);
    check(rowAb, sum(s.rows.map((r) => r[2])), s.t.ab);
    check(rowH, sum(s.rows.map((r) => r[3])), s.t.h);
    check(pBf, sum(s.p.map((r) => r[1])), s.pt.bf);
    check(pH, sum(s.p.map((r) => r[2])), s.pt.h);
    if (sum(s.rows.map((r) => r[3])) !== s.t.h || sum(s.rows.map((r) => r[2])) !== s.t.ab || sum(s.rows.map((r) => r[1])) !== s.t.pa)
      problems.push(`${key} 타자행 합계 불일치 PA ${sum(s.rows.map((r) => r[1]))}/${s.t.pa} AB ${sum(s.rows.map((r) => r[2]))}/${s.t.ab} H ${sum(s.rows.map((r) => r[3]))}/${s.t.h}`);
    for (const [name] of s.rows) {
      rowsTotal++;
      const same = byName.get(name) ?? [];
      const hit = same.filter((p) => (p.schools ?? []).some((x: any) => x.year === year && norm(x.school) === norm(s.school)));
      if (hit.length === 1) nameHit++;
      else if (hit.length > 1) nameMulti++;
      else if (same.length) nameOther++;
      else nameNone++;
    }
  }
  const [la, lb] = g.lines;
  // KBSA 팀 요약(타격)과 시트 비교: 타격 합계, 상대 투수 합계
  for (const [line, bat, pit, score] of [[la, a, b, g.scores[0]], [lb, b, a, g.scores[1]]] as [any, Sheet, Sheet, number][]) {
    check(boxH, bat.t.h, line.h);
    check(boxR, bat.t.r, score);
    check(boxSo, pit.pt.so, line.so);
    check(boxBb, pit.pt.bb, line.bb);
    check(cross, pit.pt.h, bat.t.h);
    if (bat.t.h !== line.h) problems.push(`${g.id} ${bat.school} 안타 시트 ${bat.t.h} / KBSA ${line.h}`);
    if (pit.pt.so !== line.so) problems.push(`${g.id} ${bat.school} 삼진 시트 ${pit.pt.so} / KBSA ${line.so}`);
    if (pit.pt.bb !== line.bb) problems.push(`${g.id} ${bat.school} 사사구 시트 ${pit.pt.bb} / KBSA ${line.bb}`);
  }
  // KBSA에 이름이 적힌 선수(장타·도루·승패 투수)가 판독 이름에 있는지
  const seen = new Set([...a.rows, ...b.rows].map((r) => r[0]).concat([...a.p, ...b.p].map((r) => r[0])));
  const named = [...g.doubles, ...g.triples, ...g.homers, ...g.steals].map((x: any) => x.name).concat(g.win, g.lose);
  for (const n of new Set<string>(named)) {
    nameBox.count++;
    if (seen.has(n)) nameBox.ok++;
    else problems.push(`${g.id} KBSA 이름 "${n}" 판독 이름에 없음`);
  }
}

const pct = (t: typeof tally) => `${t.ok}/${t.count} (${((t.ok / t.count) * 100).toFixed(1)}%)`;
console.log("시트 품질 A/B/C", quality);
console.log("[행 합 = 시트 합계] PA", pct(rowPa), "AB", pct(rowAb), "H", pct(rowH), "| 투수 BF", pct(pBf), "H", pct(pH));
console.log("[KBSA 대조] 득점", pct(boxR), "안타", pct(boxH), "삼진", pct(boxSo), "사사구", pct(boxBb), "| 타격↔상대투수 안타", pct(cross));
console.log("[KBSA 이름 ↔ 판독 이름]", pct(nameBox));
console.log(`[앱 프로필 연결] 타자행 ${rowsTotal}: 유일 ${nameHit}, 복수 ${nameMulti}, 동명 타학교만 ${nameOther}, 이름 없음 ${nameNone}`);
console.log("--- 불일치 목록");
console.log(problems.join("\n"));
