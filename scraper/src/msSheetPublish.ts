// 판독해 둔 기록지 중 2024·2025 경기에서 검증된 선수 기록만 골라 data/middle-school-records.json을 만드는 로컬 시범 스크립트
import fs from "node:fs";
import path from "node:path";
import { assignRows, battingVerified, cleanLeague, normSchool, pitchingVerified, type Candidate, type Sheet } from "./msSheetUtil.js";

const YEARS = new Set([2024, 2025]);
const DIR = path.resolve(".cache/ms-sheets");
const DATA = path.resolve("../data");
const readings: Record<string, Sheet> = JSON.parse(fs.readFileSync(path.join(DIR, "readings.json"), "utf8"));
const games: any[] = JSON.parse(fs.readFileSync(path.join(DIR, "games.json"), "utf8"));

const rosters = new Map<string, Candidate[]>();
for (const f of fs.readdirSync(path.join(DATA, "profiles"))) {
  const p = JSON.parse(fs.readFileSync(path.join(DATA, "profiles", f), "utf8"));
  const seen = new Set<string>();
  for (const s of p.schools ?? []) {
    const key = `${s.year}|${normSchool(s.school)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (rosters.get(key) ?? rosters.set(key, []).get(key)!).push({ personNo: p.personNo, name: p.name });
  }
}

type Rec = { date: string; [k: string]: unknown };
const players: Record<string, { bat: Rec[]; pit: Rec[] }> = {};
const slot = (no: string) => (players[no] ??= { bat: [], pit: [] });
const stat = { games: 0, sheets: 0, batOk: 0, pitOk: 0, batRows: 0, batLinked: 0, pitRows: 0, pitLinked: 0 };

for (const g of games.filter((x) => YEARS.has(x.year) && readings[`${x.id}_1`] && readings[`${x.id}_2`])) {
  stat.games++;
  const sides = [[readings[`${g.id}_1`], readings[`${g.id}_2`], g.lines[0], g.lines[1], g.scores[0]], [readings[`${g.id}_2`], readings[`${g.id}_1`], g.lines[1], g.lines[0], g.scores[1]]] as const;
  for (const [s, opp, mine, theirs, runs] of sides) {
    stat.sheets++;
    const roster = rosters.get(`${g.year}|${normSchool(s.school)}`) ?? [];
    const base = { date: g.date, game: g.id, school: s.school, opp: opp.school, league: cleanLeague(g.league) };
    if (battingVerified(s, mine.h, runs)) {
      stat.batOk++;
      stat.batRows += s.rows.length;
      for (const { row, personNo } of assignRows(s.rows, roster)) {
        stat.batLinked++;
        slot(personNo).bat.push({ ...base, pa: row[1], ab: row[2], h: row[3] });
      }
    }
    if (pitchingVerified(s, theirs.h, theirs.so)) {
      stat.pitOk++;
      stat.pitRows += s.p.length;
      for (const { row, personNo } of assignRows(s.p, roster)) {
        stat.pitLinked++;
        slot(personNo).pit.push({ ...base, bf: row[1], h: row[2], so: row[3], r: row[4], er: row[5] });
      }
    }
  }
}

for (const p of Object.values(players)) for (const list of [p.bat, p.pit]) list.sort((a, b) => a.date.localeCompare(b.date));
fs.writeFileSync(path.join(DATA, "middle-school-records.json"), JSON.stringify({ updated: new Date().toISOString(), gamesRead: stat.games, players }));
console.log(stat, "선수", Object.keys(players).length);
