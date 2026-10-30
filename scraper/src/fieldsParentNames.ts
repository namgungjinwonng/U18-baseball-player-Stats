// 검증 캐시의 공원·체육시설 폴리곤 안에 실제로 포함된 임시 이름 구장만 이름 보정한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquireFieldLock } from "./fieldsHttp.js";
import { cleanFieldName, type Field, type FieldOverride } from "./fieldsUtil.js";

acquireFieldLock();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
type Point = { lat: number; lon: number };
type Element = { type: string; id: number; tags?: Record<string, string>; geometry?: Point[]; members?: { role: string; geometry?: Point[] }[] };
const { elements } = read<{ elements: Element[] }>("scraper/.cache/fields-evidence-20261030.json");
const targets = read<{ repeated: Field[]; plain: Field[] }>("scraper/.cache/fields-evidence-targets.json");
const overrides = read<Record<string, FieldOverride>>("data/fields-overrides.json");
const contains = (point: Point, ring: Point[] = []) => {
  if (ring.length < 4 || ring[0].lat !== ring.at(-1)!.lat || ring[0].lon !== ring.at(-1)!.lon) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.lat > point.lat) !== (b.lat > point.lat) && point.lon < (b.lon - a.lon) * (point.lat - a.lat) / (b.lat - a.lat) + a.lon) inside = !inside;
  }
  return inside;
};
const within = (f: Field, e: Element) => e.geometry ? contains(f, e.geometry)
  : !!e.members?.some((m) => m.role === "outer" && contains(f, m.geometry)) && !e.members?.some((m) => m.role === "inner" && contains(f, m.geometry));
const checks = [];
for (const f of [...targets.repeated, ...targets.plain]) {
  const own = elements.find((e) => `osm:${e.type}/${e.id}` === f.id);
  const parents = elements.filter((e) => e.tags?.name && /^(park|sports_centre|stadium)$/.test(e.tags.leisure ?? "") && e.tags.name !== "야구장" && within(f, e));
  const parent = parents.length === 1 ? parents[0] : undefined;
  const old = overrides[f.id];
  if (old?.remove) { checks.push({ id: f.id, name: f.name, status: "제외", reason: old.reason }); continue; }
  if (!parent) { checks.push({ id: f.id, name: f.name, status: "보류", reason: parents.length ? "포함 시설이 여러 개라 개별 대조 필요" : "확정 가능한 상위 시설명 없음", objectTags: own?.tags }); continue; }
  const name = cleanFieldName(`${parent.tags!.name} 야구장`);
  const source = `https://www.openstreetmap.org/${parent.type}/${parent.id}`;
  // 근접 시설의 bbox만 겹치는 경우는 사용하지 않는다. 실제 닫힌 폴리곤 포함을 검사한 결과다.
  overrides[f.id] = { ...old, name, source,
    note: `OSM의 상위 ${parent.tags!.leisure === "park" ? "공원" : "체육시설"} 「${parent.tags!.name}」 형상 안의 야구장으로 이름 확인(2026-10-30). 기존 좌표·주소 유지, 개별 면 번호 미확인.` };
  checks.push({ id: f.id, before: f.name, name, status: name === f.name ? "기존명 확인" : "이름 확인", source, pitchSource: `https://www.openstreetmap.org/${f.id.slice(4)}` });
}
if (process.argv.includes("--apply")) fs.writeFileSync(path.join(root, "data/fields-overrides.json"), JSON.stringify(overrides, null, 2) + "\n");
fs.writeFileSync(path.join(root, "data/fields-name-review.json"), JSON.stringify({ checkedAt: new Date().toISOString(), targets: checks.length, checks }, null, 2) + "\n");
console.log(JSON.stringify({ targets: checks.length, renamed: checks.filter((c) => c.status === "이름 확인").length, confirmed: checks.filter((c) => c.status === "기존명 확인").length, pending: checks.filter((c) => c.status === "보류").length }));
for (const c of checks.filter((c) => c.status !== "보류")) console.log(JSON.stringify(c));
