// 야구장 수집 결과를 오프라인 검증하고 후속 확인 대상과 요청 통계를 인계용 JSON으로 만든다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KIND_ORDER, validateField, type Field, type FieldOverride } from "./fieldsUtil.js";
import { fieldAddressCheck, hasFieldAddressNumber } from "./fieldsAddressUtil.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.resolve(root, p), "utf8"));
const current = read<{ fields: Field[] }>("data/fields.json").fields;
const run = read<{ missing: string[]; diagnostics: { id: string; team: string; found: boolean }[]; started: string; finished: string; nominatim: number; other: number }>("scraper/.cache/fields-run.json");
const enrich = read<{ skipped: unknown[] }>("scraper/.cache/fields-enrich-run.json");
const overrides = read<Record<string, FieldOverride>>("data/fields-overrides.json");
const merge = read<{ removed: string[]; corrected: string[]; duplicateExtras: string[]; unmatchedOverrides: string[] }>("scraper/.cache/fields-merge.json");
const log = fs.readFileSync(path.join(root, "scraper/.cache/fields-requests.jsonl"), "utf8").trim().split(/\r?\n/).map((s) => JSON.parse(s) as { at: string; service: string });
const nomTimes = log.filter((r) => r.service === "nominatim").map((r) => Date.parse(r.at));
for (const f of current) {
  validateField(f);
  if (/\(추정\)/.test(f.name) || f.lat !== Number(f.lat.toFixed(6)) || f.lon !== Number(f.lon.toFixed(6))) throw new Error(`표준화 오류 — ${f.id}`);
}
if (new Set(current.map((f) => f.id)).size !== current.length || merge.unmatchedOverrides.length) throw new Error("ID 중복 또는 미일치 보정");
if (Object.values(overrides).some((f) => !f.source && !f.reason)) throw new Error("보정 근거 누락");
const slim = (f: Field) => ({ id: f.id, name: f.name, team: f.team, sido: f.sido, sigungu: f.sigungu, note: f.note });
const detailed = hasFieldAddressNumber;
const unnamed = (f: Field) => f.id.startsWith("osm:") && (/이름 없는/.test(f.note ?? "") || /^(?:미상|미확인)/.test(f.name));
const addressChecks = current.map(fieldAddressCheck);
const summary = {
  total: current.length,
  kind: Object.fromEntries(KIND_ORDER.map((k) => [k, current.filter((f) => f.kind === k).length])),
  kbsaPublished: current.filter((f) => f.id.startsWith("kbsa:")).length,
  kbsaMissing: run.missing.length,
  approximate: current.filter((f) => f.approx).length,
  approximateKbsa: current.filter((f) => f.id.startsWith("kbsa:") && f.approx).length,
  unnamedOsm: current.filter(unnamed).length,
  extraPublished: current.filter((f) => f.id.startsWith("extra:")).length,
  addressWithoutNumber: current.filter((f) => !detailed(f.addr)).length,
  addressMissing: addressChecks.filter((f) => !f.address).length,
  addressRegionIssues: addressChecks.filter((f) => f.flags.some((s) => /시도|시·도|시군구/.test(s))).length,
  addressOtherIssues: addressChecks.filter((f) => f.flags.some((s) => /사무실|괄호 뒤|자릿수|실외 야구장/.test(s))).length,
  officialSourceAddressChecks: addressChecks.filter((f) => f.evidence === "공식 자료 원문 대조").length,
  overrides: Object.keys(overrides).length,
  removed: merge.removed.length, corrected: merge.corrected.length, duplicateExtras: merge.duplicateExtras.length,
  loggedRequests: Object.fromEntries(["nominatim", "overpass", "other"].map((k) => [k, log.filter((r) => r.service === k).length])),
  minimumLoggedNominatimIntervalMs: nomTimes.length > 1 ? Math.min(...nomTimes.slice(1).map((n, i) => n - nomTimes[i])) : null,
  latestFullRun: { started: run.started, finished: run.finished, nominatim: run.nominatim, other: run.other },
};
const output = {
  generatedAt: new Date().toISOString(),
  note: "후속 검토 목록이며 위치 확정·영업 여부를 보증하지 않는다. 주소 숫자 검사는 형식 점검일 뿐 공식 주소 검증이 아니다. 제외된 등록 주소는 여기에 재노출하지 않는다.",
  summary,
  addressChecks,
  missingKbsa: run.diagnostics.filter((f) => run.missing.includes(f.team)).map(({ id, team }) => ({ id, team })),
  excludedKbsa: Object.entries(overrides).filter(([id, f]) => id.startsWith("kbsa:") && f.remove).map(([id, f]) => ({ id, reason: f.reason, source: f.source })),
  approximateKbsa: current.filter((f) => f.id.startsWith("kbsa:") && f.approx).map(slim),
  unnamedOsm: current.filter(unnamed).map(slim),
  addressWithoutNumber: current.filter((f) => !detailed(f.addr)).map(slim),
  publicSourceSkipped: enrich.skipped,
  professionalReview: current.filter((f) => f.kind === "프로야구장").map(slim),
};
fs.writeFileSync(path.join(root, "data/fields-review-pending.json"), JSON.stringify(output, null, 2));
console.log(JSON.stringify(summary, null, 2));
