import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Matchup, Player, PlayerIndexEntry, PlayerProfile, ScheduleData } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "..", "..", "data");
const years = JSON.parse(fs.readFileSync(path.join(dataDir, "years.json"), "utf8")) as number[];
const career = JSON.parse(
  fs.readFileSync(path.join(dataDir, "career-index.json"), "utf8")
) as Record<string, Record<string, string>>;

if (!years.length || years.some((year, i) => i > 0 && year >= years[i - 1])) {
  throw new Error("years.json must contain unique years in descending order");
}

for (const year of years) {
  const seasonDir = path.join(dataDir, String(year));
  const index = JSON.parse(
    fs.readFileSync(path.join(seasonDir, "players", "index.json"), "utf8")
  ) as PlayerIndexEntry[];
  const ids = new Set(index.map((player) => player.id));
  if (ids.size !== index.length) throw new Error(`${year}: duplicate player IDs`);
  const personNoCount = index.filter((player) => player.personNo).length;
  const personNoCoverage = personNoCount / index.length;
  if (personNoCoverage < 0.99) {
    throw new Error(`${year}: personNo coverage ${(personNoCoverage * 100).toFixed(2)}% is below 99%`);
  }
  for (const required of ["records", "by-tournament"]) {
    if (!fs.existsSync(path.join(seasonDir, required))) throw new Error(`${year}: missing ${required}`);
  }
  for (const required of ["meta.json", "tournaments.json", "teams.json", "schedule.json", "official.json", "averages.json"]) {
    if (!fs.existsSync(path.join(seasonDir, required))) throw new Error(`${year}: missing ${required}`);
  }

  let matchupLinks = 0;
  for (const entry of index) {
    const fp = path.join(seasonDir, "players", `${entry.id}.json`);
    if (!fs.existsSync(fp)) throw new Error(`${year}: missing player file ${entry.id}`);
    const player = JSON.parse(fs.readFileSync(fp, "utf8")) as Player;
    if (!Array.isArray(player.matchups)) throw new Error(`${year}: matchups missing in ${entry.id}`);
    matchupLinks += player.matchups.length;
    for (const matchup of player.matchups as Matchup[]) {
      if (matchup.batterId !== entry.id && matchup.pitcherId !== entry.id) {
        throw new Error(`${year}: unrelated matchup stored in ${entry.id}`);
      }
    }
    if (entry.personNo && career[entry.personNo]?.[String(year)] !== entry.id) {
      throw new Error(`${year}: career index mismatch for ${entry.id}`);
    }
    if (entry.personNo) {
      const profileFp = path.join(dataDir, "profiles", `${entry.personNo}.json`);
      if (!fs.existsSync(profileFp)) throw new Error(`${year}: profile missing for ${entry.id}`);
      const profile = JSON.parse(fs.readFileSync(profileFp, "utf8")) as PlayerProfile;
      if (profile.careerYears?.[String(year)] !== entry.id) {
        throw new Error(`${year}: profile careerYears mismatch for ${entry.id}`);
      }
    }
  }

  if (fs.existsSync(path.join(seasonDir, "matchups"))) {
    throw new Error(`${year}: legacy matchups directory still exists`);
  }

  const scheduleFp = path.join(seasonDir, "schedule.json");
  const schedule = fs.existsSync(scheduleFp)
    ? (JSON.parse(fs.readFileSync(scheduleFp, "utf8")) as ScheduleData)
    : null;
  if (schedule && schedule.year !== year) throw new Error(`${year}: schedule year mismatch`);

  console.log(
    `✓ ${year}: players ${index.length}, personNo ${(personNoCoverage * 100).toFixed(2)}%, matchup links ${matchupLinks}, schedule ${schedule?.games.length ?? 0}`
  );
}

console.log(`✓ years.json: ${years.join(", ")}`);
