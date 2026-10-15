import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeYearsIndex } from "./accumulate.js";
import type { Meta } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "..", "..", "data");
const years = JSON.parse(fs.readFileSync(path.join(dataDir, "years.json"), "utf8")) as number[];
// 새 시즌은 일정·선수현황만 있고 meta.json이 없을 수 있어 기록이 있는 최신 시즌을 쓴다.
const latestYear = years.find((year) => fs.existsSync(path.join(dataDir, String(year), "meta.json")));
if (latestYear == null) throw new Error("years.json has no season with meta.json");
const latestMeta = JSON.parse(
  fs.readFileSync(path.join(dataDir, String(latestYear), "meta.json"), "utf8")
) as Meta;

writeYearsIndex(dataDir, years, latestMeta);

