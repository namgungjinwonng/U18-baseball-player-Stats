import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_MONTHS, emptyGameMonths, incrementalMonths } from "./fetchGames.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "u18-years-"));
const gamesDir = path.join(dir, "games");
fs.mkdirSync(gamesDir, { recursive: true });

fs.writeFileSync(
  path.join(gamesDir, "2026.json"),
  JSON.stringify({ id: "2026", date: "2026-11-20", batters: [] })
);

assert.deepEqual(incrementalMonths(dir, 2027), DEFAULT_MONTHS);
assert.deepEqual(emptyGameMonths(dir, 2027), []);

fs.writeFileSync(
  path.join(gamesDir, "2027.json"),
  JSON.stringify({ id: "2027", date: "2027-05-03", batters: [] })
);

assert.deepEqual(incrementalMonths(dir, 2027), DEFAULT_MONTHS.filter((month) => month >= 5));
assert.deepEqual(emptyGameMonths(dir, 2027), [5]);

console.log("✓ 연도 전환 월 스캔 격리 통과");
