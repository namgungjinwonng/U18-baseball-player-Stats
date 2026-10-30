// 이미 수집한 원본 캐시와 보정·추가 JSON을 외부 요청 없이 다시 병합해 야구장 화면 자료를 갱신한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeFieldData, type ExtraFields, type Field, type FieldOverride } from "./fieldsUtil.js";
import { acquireFieldLock } from "./fieldsHttp.js";
acquireFieldLock();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const current = read<{ updated: string; fields: Field[]; [key: string]: unknown }>("data/fields.json");
const base = read<Field[]>("scraper/.cache/fields-base.json");
const extra = read<ExtraFields>("data/fields-extra.json");
const result = mergeFieldData(base, read<Record<string, FieldOverride>>("data/fields-overrides.json"), extra);
fs.writeFileSync(path.join(root, "data/fields.json"), JSON.stringify({ ...current, updated: new Date().toISOString(), fields: result.fields, sources: extra.sources }));
fs.writeFileSync(path.join(root, "scraper/.cache/fields-merge.json"), JSON.stringify({ ...result, fields: undefined, total: result.fields.length }, null, 2));
console.log("외부 요청 없이 보정 병합 완료", result.fields.length, "곳", result.unmatchedOverrides.length, "개 미일치 보정");
