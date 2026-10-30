// 2026-10-29 주소 순서 정리(normalizeFieldAddressOrder) 결과를 걷어내고, 보정 전 원문에서 refineFieldAddress로 다시 정제한다.
// 외부 요청·수집 캐시 없이 data/ 의 체크인 자료만으로 실행한다. 좌표·항목·이름이 바뀌면 저장하지 않는다.
// 실행: npx tsx src/fieldsAddressRefine.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquireFieldLock } from "./fieldsHttp.js";
import { fieldAddressCheck } from "./fieldsAddressUtil.js";
import { mergeFieldData, type ExtraFields, type Field, type FieldOverride } from "./fieldsUtil.js";

acquireFieldLock();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const file = (p: string) => path.join(root, p);
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(file(p), "utf8"));
const data = read<{ updated: string; fields: Field[]; [key: string]: unknown }>("data/fields.json");
const overrides = read<Record<string, FieldOverride>>("data/fields-overrides.json");
const extra = read<ExtraFields>("data/fields-extra.json");
const repairs = read<{ changes: { id: string; before?: string; after?: string }[] }>("data/fields-address-repairs.json");
const before = new Map(repairs.changes.map((c) => [c.id, c.before]));

// 순서 정리 단계가 만든 보정 — 원문 주소를 덮어쓴 addr 와 그 단계가 붙인 출처·메모만 들어 있다.
const ORDER_NOTE = "주소 표시 순서만 한국식으로 정규화(새 번지 추가·공식 검증 아님)";
const ORDER_ADDR_ONLY = ["osm:way/592118427", "osm:way/478011641"]; // 시·도 보정과 함께 순서 정리 주소가 들어간 항목
const raw = new Map<string, { addr?: string; note?: string }>();
if (!Object.values(overrides).some((o) => o.note?.includes("주소 표시 순서만 한국식으로 정규화"))) {
  console.log("이미 정리됨 — 순서 정리 보정이 없습니다. 이후 표기 정리는 mergeFieldData가 병합할 때 합니다.");
  process.exit(0);
}
for (const [id, o] of Object.entries(overrides)) {
  if (!o.note?.includes(ORDER_NOTE)) continue;
  const extraKeys = Object.keys(o).filter((k) => !["addr", "source", "note"].includes(k));
  if (extraKeys.length || !before.has(id)) throw new Error(`순서 정리 보정에 다른 값이 있거나 원문 기록 없음 — ${id}`);
  const note = o.note.replace(` · ${ORDER_NOTE}`, "").replace(ORDER_NOTE, "").trim();
  raw.set(id, { addr: before.get(id), note: note || undefined });
  delete overrides[id];
}
for (const id of ORDER_ADDR_ONLY) {
  if (!overrides[id]?.addr || !before.has(id)) throw new Error(`시·도 보정 항목 확인 필요 — ${id}`);
  raw.set(id, { addr: before.get(id), note: overrides[id].note });
  delete overrides[id].addr;
}

// 현재 게시 자료에 이미 적용된 보정은 다시 적용해도 같은 값이므로, 순서 정리 항목만 원문으로 되돌린 자료를 원본으로 쓴다.
const extraIds = new Set(extra.fields.map((f) => f.id));
const base = data.fields.filter((f) => !extraIds.has(f.id)).map((f) => {
  const r = raw.get(f.id);
  if (!r || f.id.startsWith("extra:")) return f;
  const { source, note, ...rest } = f;
  return { ...rest, addr: r.addr, ...(r.note ? { note: r.note } : {}), ...(ORDER_ADDR_ONLY.includes(f.id) ? { source } : {}) } as Field;
});
const result = mergeFieldData(base, overrides, extra);
// 삭제 보정은 대상이 이미 게시 자료에서 빠져 있으므로 미일치로 나오는 것이 정상이다.
const unmatched = result.unmatchedOverrides.filter((id) => !overrides[id]?.remove);
if (unmatched.length) throw new Error(`미일치 보정 ${unmatched.join(", ")}`);

// 바뀌어도 되는 값은 주소와, 순서 정리 항목의 메모·출처뿐이다.
const prev = new Map(data.fields.map((f) => [f.id, f]));
if (result.fields.length !== data.fields.length) throw new Error(`항목 수 변경 ${data.fields.length} → ${result.fields.length}`);
const changes: { id: string; name: string; before?: string; after?: string; raw?: string }[] = [];
for (const f of result.fields) {
  const old = prev.get(f.id);
  if (!old) throw new Error(`새 항목 — ${f.id}`);
  const keys = new Set([...Object.keys(old), ...Object.keys(f)]);
  for (const k of keys) {
    const a = (old as unknown as Record<string, unknown>)[k], b = (f as unknown as Record<string, unknown>)[k];
    if (a === b || k === "addr" || raw.has(f.id) && (k === "note" || k === "source")) continue;
    throw new Error(`주소 외 값 변경 — ${f.id} ${k}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  }
  if (old.addr !== f.addr) changes.push({ id: f.id, name: f.name, before: old.addr, after: f.addr, ...(raw.has(f.id) ? { raw: raw.get(f.id)!.addr } : {}) });
}

const checks = result.fields.map(fieldAddressCheck);
const flagged = checks.filter((c) => c.flags.some((s) => s !== "번지·건물번호 미확인"));
const now = new Date().toISOString();
fs.writeFileSync(file("data/fields-overrides.json"), JSON.stringify(overrides, null, 2) + "\n");
fs.writeFileSync(file("data/fields.json"), JSON.stringify({ ...data, updated: now, fields: result.fields }));
fs.writeFileSync(file("data/fields-address-refine.json"), JSON.stringify({
  refinedAt: now,
  checked: result.fields.length,
  newRequests: 0,
  coordinatesChanged: 0,
  removedOrderOverrides: raw.size - ORDER_ADDR_ONLY.length,
  changed: changes.length,
  note: "주소 순서 정리 보정을 걷어내고 원문에서 다시 정제했다. 원문에 없는 번지·도로명을 만들지 않았고, 시설명·하천·자전거길·고속도로·아파트·영문·우편번호 조각을 주소에서 뺐다. 형식 정리이며 공식 주소 검증이 아니다.",
  changes,
}, null, 2) + "\n");

// 인계용 검토 목록의 주소 부분만 새 자료로 갱신한다(요청 통계 등 수집 캐시가 필요한 값은 이전 감사 결과를 유지).
const pendingPath = "data/fields-review-pending.json";
const pending = read<Record<string, unknown> & { summary: Record<string, unknown> }>(pendingPath);
const slim = (f: Field) => ({ id: f.id, name: f.name, team: f.team, sido: f.sido, sigungu: f.sigungu, note: f.note });
const unnamed = (f: Field) => f.id.startsWith("osm:") && (/이름 없는/.test(f.note ?? "") || /^(?:미상|미확인)/.test(f.name));
Object.assign(pending.summary, {
  total: result.fields.length,
  overrides: Object.keys(overrides).length,
  corrected: Object.values(overrides).filter((o) => !o.remove).length,
  addressWithoutNumber: checks.filter((c) => !c.hasNumber).length,
  addressMissing: checks.filter((c) => !c.address).length,
  addressRegionIssues: checks.filter((c) => c.flags.some((s) => /시도|시·도|시군구/.test(s))).length,
  addressOtherIssues: checks.filter((c) => c.flags.some((s) => /사무실|괄호 뒤|자릿수|실외 야구장/.test(s))).length,
  officialSourceAddressChecks: checks.filter((c) => c.evidence === "공식 자료 원문 대조").length,
});
fs.writeFileSync(file(pendingPath), JSON.stringify({
  ...pending,
  generatedAt: now,
  addressRefinedAt: now,
  addressChecks: checks,
  addressFlagged: flagged,
  approximateKbsa: result.fields.filter((f) => f.id.startsWith("kbsa:") && f.approx).map(slim),
  unnamedOsm: result.fields.filter(unnamed).map(slim),
  addressWithoutNumber: result.fields.filter((f) => !checks.find((c) => c.id === f.id)!.hasNumber).map(slim),
}, null, 2));
console.log(JSON.stringify({ checked: result.fields.length, changed: changes.length, removedOrderOverrides: raw.size - ORDER_ADDR_ONLY.length, overrides: Object.keys(overrides).length, flagged: flagged.length, withoutNumber: checks.filter((c) => !c.hasNumber).length }));
