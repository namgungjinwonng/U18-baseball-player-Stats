// 야구장 정확성 2차의 제한된 OSM 검증 대상과 포함 시설 근거를 캐시하고 검토 목록을 만든다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquireFieldLock, getFieldText, requestStats } from "./fieldsHttp.js";
import type { Field } from "./fieldsUtil.js";

acquireFieldLock();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/fields.json"), "utf8")) as { fields: Field[] };
const groups = new Map<string, Field[]>();
for (const f of data.fields) {
  const key = `${f.sido}|${f.sigungu}|${f.name}`;
  groups.set(key, [...(groups.get(key) ?? []), f]);
}
const repeated = [...groups.values()].filter((g) => g.length > 1).flat();
const plain = data.fields.filter((f) => f.name === "야구장");
const review = [...repeated, ...plain];
const points = [...review, ...data.fields.filter((f) => /송도LNG|밀양스포츠|창원NC|대전 한화|함평|장생포|노량진|금강체육|괴산|문수|포항|신월야구|가평.*야구|용상.*야구/.test(f.name))];
const idSelectors = new Set(points.filter((f) => f.id.startsWith("osm:")).map((f) => {
  const [type, id] = f.id.slice(4).split("/");
  return `${type}(${id});`;
}));
// 로컬 좌표나 등록 주소를 전송하지 않는다. 공개 OSM 객체 ID를 읽고 그 주위 시설은 서버의 공개 형상으로 찾는다.
const query = `[out:json][timeout:180];(${[...idSelectors].join("")})->.targets;(.targets;nwr(around.targets:600)["leisure"~"^(park|sports_centre|stadium)$"]["name"];nwr["name"~"라이온즈파크|창원.*NC|LNG.*야구|챌린저스필드|한밭야구장"](33,124,39,132););out center bb geom;`;
const cachePath = path.join(root, "scraper/.cache/fields-evidence-20261030.json");
const cached = fs.existsSync(cachePath);
// 이전 프로세스의 실패 뒤에도 60초 간격을 지킨다. 403·429는 fieldsHttp에서 중단하며 재실행하지 않는다.
const logPath = path.join(root, "scraper/.cache/fields-requests.jsonl");
if (!cached && fs.existsSync(logPath)) {
  const requests = fs.readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).map((s) => JSON.parse(s) as { service: string; at: string });
  const last = requests.filter((r) => r.service === "overpass").at(-1);
  if (last) await new Promise((r) => setTimeout(r, Math.max(0, Date.parse(last.at) + 61_000 - Date.now())));
}
const response = cached ? fs.readFileSync(cachePath, "utf8") : await getFieldText("https://overpass-api.de/api/interpreter", {
  method: "POST", body: new URLSearchParams({ data: query }), headers: { "Content-Type": "application/x-www-form-urlencoded" },
});
const osm = JSON.parse(response) as { elements: { type: string; id: number; tags?: Record<string, string>; center?: {lat:number;lon:number}; bounds?: Record<string, number>; geometry?: {lat:number;lon:number}[] }[] };
if (!cached) fs.writeFileSync(cachePath, response);
fs.writeFileSync(path.join(root, "scraper/.cache/fields-evidence-targets.json"), JSON.stringify({ repeated, plain }, null, 2));
console.log(JSON.stringify({ ...requestStats, cached, targets: review.length, objects: osm.elements.length }));
for (const f of review) {
  const [type, id] = f.id.slice(4).split("/");
  const own = osm.elements.find((e) => e.type === type && String(e.id) === id);
  const enclosing = osm.elements.filter((e) => e.tags?.name && e.bounds &&
    e.bounds.minlat <= f.lat && e.bounds.maxlat >= f.lat && e.bounds.minlon <= f.lon && e.bounds.maxlon >= f.lon);
  console.log(JSON.stringify({ id: f.id, name: f.name, lat: f.lat, lon: f.lon, tags: own?.tags, enclosing: enclosing.map((e) => ({ id: `${e.type}/${e.id}`, name: e.tags?.name, leisure: e.tags?.leisure })) }));
}
