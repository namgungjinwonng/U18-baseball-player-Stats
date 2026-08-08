// 클럽팀 접미사가 섞인 학교 필터의 정규화 동작을 검증하는 단위 테스트.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const server = await createServer({
  root,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
});
const { applyFilter, emptyFilter } = await server.ssrLoadModule("/src/shared/filters.tsx") as typeof import("./filters");

const rows = [
  { id: "plain", team: "거제BC", region: "경남", grade: "1" },
  { id: "hyphen", team: "거제BC(U-18)", region: "경남", grade: "2" },
  { id: "compact", team: "거제BC(U18)", region: "경남", grade: "3" },
  { id: "other", team: "다른고", region: "경남", grade: "1" },
];

const ids = (team: string) =>
  applyFilter(rows, { ...emptyFilter, team }).map((row) => row.id);

assert.deepEqual(
  ids("거제BC"),
  ["plain", "hyphen", "compact"],
  "정규화된 팀명으로 두 접미사 표기의 선수를 모두 찾아야 함"
);
assert.deepEqual(
  ids("거제BC(U-18)"),
  ["plain", "hyphen", "compact"],
  "기존 원본 팀명 URL도 계속 동작해야 함"
);
assert.deepEqual(
  ids("거제BC(U18)"),
  ["plain", "hyphen", "compact"],
  "하이픈 없는 접미사 URL도 같은 팀으로 필터링해야 함"
);

await server.close();
console.log("✓ 학교 필터 클럽팀 접미사 정규화 검증 통과");
