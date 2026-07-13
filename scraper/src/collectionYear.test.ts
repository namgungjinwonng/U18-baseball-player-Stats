import assert from "node:assert/strict";
import { collectionYear, collectionYears, kstYear } from "./collectionYear.js";

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
console.log("✓ 실행 시점 KST 연도만 수집 · 과거 시즌 차단 통과");

