// KBSA 고등부 등록팀을 게시 구장 ID·제외·병합 기록과 대조하고 누락팀 상세 주소만 조회한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquireFieldLock, getFieldText, requestStats } from "./fieldsHttp.js";
import { teamInfoFromHtml, type Field, type FieldOverride } from "./fieldsUtil.js";

acquireFieldLock();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const { fields } = read<{ fields: Field[] }>("data/fields.json");
const overrides = read<Record<string, FieldOverride>>("data/fields-overrides.json");
const remerge = read<{ deduplicated: { kept: string; removed: string[] }[] }>("data/fields-remerge.json");
const cacheDir = path.join(root, "scraper/.cache");
const cachedGet = async (key: string, url: string) => {
  const p = path.join(cacheDir, `kbsa-audit-${key}.html`);
  if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  const html = await getFieldText(url);
  if (!html.includes("club_idx=") && !html.includes("대한야구소프트볼협회")) throw new Error(`KBSA 응답 확인 필요 — ${url}`);
  fs.writeFileSync(p, html);
  return html;
};
const teams = new Map<string, string>();
let complete = false;
for (let page = 1; page <= 30; page++) {
  const url = `https://www.korea-baseball.com/info/team/team_list?page=${page}&kind_cd=31&season=2026&sido_cd=00`;
  const html = await cachedGet(`list-${page}`, url);
  let added = 0;
  for (const m of html.matchAll(/club_idx=(\d+)[^"]*"[^>]*>([^<]+)</g)) {
    const name = m[2].replace(/&nbsp;/g, " ").trim();
    if (!name || teams.has(m[1])) continue;
    teams.set(m[1], name); added++;
  }
  if (!added) { complete = true; break; }
}
if (!complete || teams.size < 50) throw new Error(`KBSA 고등부 전체 목록 확인 실패 — ${teams.size}팀`);
const checks = [];
for (const [idx, team] of teams) {
  const id = `kbsa:${idx}`, field = fields.find((f) => f.id === id || f.id === `extra:kbsa2026:${idx}`);
  const merged = remerge.deduplicated.find((g) => g.removed.includes(id));
  const detailUrl = `https://www.korea-baseball.com/info/team/team_schedule?club_idx=${idx}&season=2026&kind_cd=31&sports_club=F`;
  const state = field ? "게시됨" : overrides[id]?.remove ? "기존 제외 보정" : merged ? "동명 병합" : "수집 누락";
  const detail = !field ? teamInfoFromHtml(await cachedGet(`team-${idx}`, detailUrl)) : undefined;
  checks.push({ id, team, state, detailUrl, field: field ? { name: field.name, kind: field.kind, addr: field.addr, lat: field.lat, lon: field.lon } : undefined,
    kept: merged?.kept, override: overrides[id], detail });
}
const summary = { registered: teams.size, published: checks.filter((c) => c.state === "게시됨").length,
  missing: checks.filter((c) => c.state === "수집 누락").length, excluded: checks.filter((c) => c.state === "기존 제외 보정").length,
  registrationOnly: checks.filter((c) => c.field?.name.includes("팀 등록지")).length,
  schoolAddressOnly: checks.filter((c) => c.field?.name.includes("학교 주소·야구장 위치 미확인")).length,
  merged: checks.filter((c) => c.state === "동명 병합").length };
fs.writeFileSync(path.join(root, "data/fields-highschool-audit.json"), JSON.stringify({ checkedAt: new Date().toISOString(), source: "https://www.korea-baseball.com/info/team/team_list?kind_cd=31&season=2026&sido_cd=00", ...requestStats, summary, checks }, null, 2) + "\n");
console.log(JSON.stringify(summary));
for (const c of checks.filter((c) => c.state !== "게시됨" || !c.field?.addr)) console.log(JSON.stringify(c));
