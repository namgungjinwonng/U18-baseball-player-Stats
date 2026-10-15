import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectionYear, collectionYears, kstYear, registerSeasonYear, withSeasonYear,
} from "./collectionYear.js";

const beforeKstNewYear = Date.parse("2026-12-31T14:59:59Z");
const afterKstNewYear = Date.parse("2026-12-31T15:00:00Z");
assert.equal(kstYear(beforeKstNewYear), 2026);
assert.equal(kstYear(afterKstNewYear), 2027);
assert.equal(collectionYear(undefined, afterKstNewYear), 2027, "미지정 시 실행 시점 KST 연도");
assert.equal(collectionYear("2027", afterKstNewYear), 2027, "현재 연도 명시는 허용");
assert.throws(() => collectionYear("2025", afterKstNewYear), /종료 시즌 수집 차단/);
assert.throws(() => collectionYear("invalid", afterKstNewYear), /종료 시즌 수집 차단/);
assert.deepEqual(collectionYears([2024, 2025, 2026, 2027], 2027), [2027]);
assert.deepEqual(collectionYears([2024, 2025, 2026], 2027), []);
assert.deepEqual(withSeasonYear([2026, 2025, 2024], 2027), [2027, 2026, 2025, 2024]);
assert.deepEqual(withSeasonYear([2027, 2026], 2027), [2027, 2026], "이미 있으면 그대로");

// 새 시즌 등록은 years.json에 연도만 더하고, 이미 있으면 파일을 다시 쓰지 않는다.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "u18-years-"));
const yearsFp = path.join(tmp, "years.json");
fs.writeFileSync(yearsFp, JSON.stringify([2026, 2025, 2024], null, 2) + "\n");
assert.equal(registerSeasonYear(tmp, 2027), true);
assert.deepEqual(JSON.parse(fs.readFileSync(yearsFp, "utf8")), [2027, 2026, 2025, 2024]);
const written = fs.readFileSync(yearsFp, "utf8");
assert.equal(registerSeasonYear(tmp, 2027), false);
assert.equal(fs.readFileSync(yearsFp, "utf8"), written);
fs.rmSync(tmp, { recursive: true, force: true });
console.log("✓ 실행 시점 KST 연도만 수집 · 과거 시즌 차단 통과");

