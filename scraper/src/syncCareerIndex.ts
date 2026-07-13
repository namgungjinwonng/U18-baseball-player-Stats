import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeYearsIndex } from "./accumulate.js";
import type { Meta } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "..", "..", "data");
const years = JSON.parse(fs.readFileSync(path.join(dataDir, "years.json"), "utf8")) as number[];
if (years.length === 0) throw new Error("years.json is empty");
const latestMeta = JSON.parse(
  fs.readFileSync(path.join(dataDir, String(years[0]), "meta.json"), "utf8")
) as Meta;

writeYearsIndex(dataDir, years, latestMeta);

