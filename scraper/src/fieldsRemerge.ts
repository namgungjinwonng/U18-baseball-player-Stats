// 수집 캐시 없이 게시 자료(data/fields.json)를 원본으로 삼아 보정·추가·동명 중복 정리 규칙을 다시 적용한다.
// 삭제(보정 remove·동명 중복), 보정 파일에 적힌 값(좌표는 lat·lon 보정이 있을 때만), fields-extra.json 에 새로 넣은 항목만 반영된다.
// 실행: npx tsx src/fieldsRemerge.ts        검사만: npx tsx src/fieldsRemerge.ts --dry
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquireFieldLock } from "./fieldsHttp.js";
import { fieldAddressCheck, stripResidentialUnit } from "./fieldsAddressUtil.js";
import { cleanFieldName, mergeFieldData, type ExtraFields, type Field, type FieldOverride } from "./fieldsUtil.js";

const dry = process.argv.includes("--dry");
if (!dry) acquireFieldLock();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const file = (p: string) => path.join(root, p);
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(file(p), "utf8"));
const data = read<{ updated: string; fields: Field[]; [key: string]: unknown }>("data/fields.json");
const overrides = read<Record<string, FieldOverride>>("data/fields-overrides.json");
const extra = read<ExtraFields>("data/fields-extra.json");

// 게시 자료에 이미 적용된 보정은 다시 적용해도 같은 값이고 주소 정제도 멱등이므로, 추가 출처를 뺀 게시 자료를 원본으로 쓴다.
const extraIds = new Set(extra.fields.map((f) => f.id));
const result = mergeFieldData(data.fields.filter((f) => !extraIds.has(f.id)), overrides, extra);
// 이미 게시 자료에서 빠진 삭제 보정과, 앞선 재병합에서 동명 중복으로 정리된 항목의 보정은 미일치로 나오는 것이 정상이다.
// (수집 원본에는 그 항목이 있어 보정 후 중복 정리되므로 실제 수집에서는 미일치가 아니다.) 그 밖의 미일치는 ID 오기다.
const logPath = "data/fields-remerge.json";
const prevLog = fs.existsSync(file(logPath)) ? read<{ dedupedIds?: string[] }>(logPath) : {};
const dedupedIds = new Set([...(prevLog.dedupedIds ?? []), ...result.deduplicated.flatMap((g) => g.removed)]);
const unmatched = result.unmatchedOverrides.filter((id) => !overrides[id]?.remove && !dedupedIds.has(id));
if (unmatched.length) throw new Error(`미일치 보정 ${unmatched.join(", ")}`);

const prev = new Map(data.fields.map((f) => [f.id, f]));
const changes: { id: string; name: string; key: string; before: unknown; after: unknown }[] = [];
const added: { id: string; name: string; kind: string; sido: string; sigungu: string }[] = [];
for (const f of result.fields) {
  const old = prev.get(f.id);
  if (!old && extraIds.has(f.id)) { added.push({ id: f.id, name: f.name, kind: f.kind, sido: f.sido, sigungu: f.sigungu }); continue; }
  if (!old) throw new Error(`새 항목 — ${f.id} (추가는 fields-extra.json 으로만)`);
  const coordFix = overrides[f.id] && ("lat" in overrides[f.id] || "lon" in overrides[f.id]); // 근거 있는 좌표 보정만 허용
  if ((old.lat !== f.lat || old.lon !== f.lon) && !coordFix) throw new Error(`좌표 변경 — ${f.id}`);
  for (const key of new Set([...Object.keys(old), ...Object.keys(f)])) {
    const a = (old as unknown as Record<string, unknown>)[key], b = (f as unknown as Record<string, unknown>)[key];
    if (a === b) continue;
    const ruleRename = key === "name" && cleanFieldName(String(a)) === b; // 병합 규칙의 이름 정리(꼬리 「야구장」 중복)
    const ruleUnit = key === "addrKey" && stripResidentialUnit(String(a)) === b; // 병합 규칙의 동·호수 제거
    if (!(key in (overrides[f.id] ?? {})) && key !== "addr" && !ruleRename && !ruleUnit) throw new Error(`보정에 없는 값 변경 — ${f.id} ${key}`);
    changes.push({ id: f.id, name: f.name, key, before: a, after: b });
  }
}
const kept = new Set(result.fields.map((f) => f.id));
const removed = data.fields.filter((f) => !kept.has(f.id)).map((f) => {
  const dup = result.deduplicated.find((g) => g.removed.includes(f.id));
  return { id: f.id, name: f.name, sido: f.sido, sigungu: f.sigungu,
    why: overrides[f.id]?.remove ? `보정 삭제 — ${overrides[f.id].reason}` : dup ? `동명 중복 — ${dup.kept} 남김` : "알 수 없음" };
});
if (removed.some((r) => r.why === "알 수 없음")) throw new Error("이유 없는 삭제");

const summary = { before: data.fields.length, after: result.fields.length, removedByOverride: removed.filter((r) => r.why.startsWith("보정")).length,
  removedAsDuplicate: removed.filter((r) => r.why.startsWith("동명")).length, valueChanges: changes.length, added: added.length };
console.log(JSON.stringify(summary));
if (dry) {
  for (const a of added) console.log(`  추가 ${a.id} ${a.kind} ${a.name} (${a.sido} ${a.sigungu})`);
  for (const c of changes) console.log(`  변경 ${c.id} ${c.key}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`);
  process.exit(0);
}

const now = new Date().toISOString();
fs.writeFileSync(file("data/fields.json"), JSON.stringify({ ...data, updated: now, fields: result.fields }));
// 기록은 덮어쓰지 않고 이전 실행의 삭제·중복 정리 내역을 이어 붙인다(다음 실행의 미일치 판정에 쓴다).
const prevFull = fs.existsSync(file(logPath)) ? read<{ removed?: typeof removed; deduplicated?: typeof result.deduplicated }>(logPath) : {};
fs.writeFileSync(file(logPath), JSON.stringify({ remergedAt: now, ...summary, newRequests: 0,
  coordinatesChanged: changes.filter((c) => c.key === "lat" || c.key === "lon").length,
  note: "수집 캐시 없이 게시 자료에 보정·동명 중복 규칙을 다시 적용한 누적 기록. 좌표·새 항목 변경 없음.",
  dedupedIds: [...dedupedIds].sort(),
  removed: [...(prevFull.removed ?? []), ...removed], added, changes,
  deduplicated: [...(prevFull.deduplicated ?? []), ...result.deduplicated] }, null, 2) + "\n");

// 인계용 검토 목록의 주소·목록 부분만 새 자료로 갱신한다(요청 통계 등 수집 캐시가 필요한 값은 이전 감사 결과를 유지).
const pendingPath = "data/fields-review-pending.json";
const pending = read<Record<string, unknown> & { summary: Record<string, unknown> }>(pendingPath);
const checks = result.fields.map(fieldAddressCheck);
const slim = (f: Field) => ({ id: f.id, name: f.name, team: f.team, sido: f.sido, sigungu: f.sigungu, note: f.note });
const unnamed = (f: Field) => f.id.startsWith("osm:") && (/이름 없는/.test(f.note ?? "") || /^(?:미상|미확인)/.test(f.name));
const kinds: Record<string, number> = {};
for (const f of result.fields) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
Object.assign(pending.summary, {
  total: result.fields.length,
  kind: kinds,
  overrides: Object.keys(overrides).length,
  removed: Object.values(overrides).filter((o) => o.remove).length,
  corrected: Object.values(overrides).filter((o) => !o.remove).length,
  deduplicated: summary.removedAsDuplicate,
  approximate: result.fields.filter((f) => f.approx).length,
  approximateKbsa: result.fields.filter((f) => f.id.startsWith("kbsa:") && f.approx).length,
  unnamedOsm: result.fields.filter(unnamed).length,
  addressWithoutNumber: checks.filter((c) => !c.hasNumber).length,
  addressMissing: checks.filter((c) => !c.address).length,
  addressOtherIssues: checks.filter((c) => c.flags.some((s) => /사무실|괄호 뒤|자릿수|실외 야구장/.test(s))).length,
  officialSourceAddressChecks: checks.filter((c) => c.evidence === "공식 자료 원문 대조").length,
});
fs.writeFileSync(file(pendingPath), JSON.stringify({
  ...pending,
  generatedAt: now,
  addressChecks: checks,
  addressFlagged: checks.filter((c) => c.flags.some((s) => s !== "번지·건물번호 미확인")),
  approximateKbsa: result.fields.filter((f) => f.id.startsWith("kbsa:") && f.approx).map(slim),
  unnamedOsm: result.fields.filter(unnamed).map(slim),
  addressWithoutNumber: result.fields.filter((f) => !checks.find((c) => c.id === f.id)!.hasNumber).map(slim),
  professionalReview: result.fields.filter((f) => f.kind === "프로야구장").map(slim),
}, null, 2));
console.log("✓ 재병합 완료 — data/fields.json · data/fields-remerge.json · data/fields-review-pending.json");
