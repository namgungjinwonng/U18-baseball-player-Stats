// 퓨처스 누락 구장과 고등부 누락 학교만 공개 이름으로 직렬 조회하고 검증 근거를 캐시한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquireFieldLock, getFieldText, NOMINATIM_BASE, requestStats } from "./fieldsHttp.js";

acquireFieldLock();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const result = [];
for (const q of ["강화 SSG퓨처스필드", "SK 퓨처스 파크", "인천광역시 강화군 길상면 길상로 242-30", "함평 KIA 챌린저스 필드", "순천효천고등학교", "야로고등학교"]) {
  const params = new URLSearchParams({ q, format: "jsonv2", addressdetails: "1", "accept-language": "ko", countrycodes: "kr", limit: "5" });
  const url = `${NOMINATIM_BASE}/search?${params}`;
  result.push({ q, source: url, hits: JSON.parse(await getFieldText(url)) });
}
const p = path.join(root, "scraper/.cache/fields-focused-osm.json");
const cached = fs.existsSync(p);
if (!cached) {
  const log = fs.readFileSync(path.join(root, "scraper/.cache/fields-requests.jsonl"), "utf8").trim().split("\n").map((s) => JSON.parse(s));
  const last = log.filter((r) => r.service === "overpass").at(-1);
  if (last) await new Promise((r) => setTimeout(r, Math.max(0, Date.parse(last.at) + 61_000 - Date.now())));
  const query = '[out:json][timeout:120];way(1053483163)->.g;(nwr(around.g:1800)["sport"="baseball"];nwr["name"~"퓨처스|드림파크|챌린저스.*필드|챌린저스.*파크|야로고등학교|순천효천고등학교"](33,124,39,132););out center tags;';
  const body = await getFieldText("https://overpass-api.de/api/interpreter", { method: "POST", body: new URLSearchParams({ data: query }), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  JSON.parse(body);
  fs.writeFileSync(p, body);
}
fs.writeFileSync(path.join(root, "scraper/.cache/fields-focused-geocode.json"), JSON.stringify({ ...requestStats, result }, null, 2));
console.log(JSON.stringify({ ...requestStats, result, osm: JSON.parse(fs.readFileSync(p, "utf8")) }));
