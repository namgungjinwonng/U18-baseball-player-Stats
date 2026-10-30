// 야구장 수집의 공개 HTTP 요청을 직렬화·캐시하고 Nominatim/Overpass 이용 제한과 요청 수를 기록한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FIELD_UA = "U18-baseball-stats/1.0 (+https://github.com/namgungjinwonng/U18-baseball-player-Stats)";
export const NOMINATIM_BASE = (process.env.FIELDS_NOMINATIM_URL ?? "https://nominatim.openstreetmap.org").replace(/\/$/, "");
const cacheDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.cache");
const cachePath = path.join(cacheDir, "fields-geocode.json");
const cache: Record<string, string> = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf8")) : {};
export const requestStats = { nominatim: 0, overpass: 0, other: 0, cacheHits: 0, started: new Date().toISOString() };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let chain = Promise.resolve(), lastNom = 0;

export function acquireFieldLock() {
  const lock = path.join(cacheDir, "fields.lock");
  fs.mkdirSync(cacheDir, { recursive: true });
  try { fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }), { flag: "wx" }); }
  catch { throw new Error("다른 야구장 수집·보강 작업이 실행 중이거나 이전 잠금이 남아 있습니다. fields.ts/fieldsEnrich.ts 프로세스를 확인하세요."); }
  process.on("exit", () => { if (fs.existsSync(lock)) fs.unlinkSync(lock); });
}

export function getFieldText(url: string, init?: RequestInit): Promise<string> {
  const job = chain.then(async () => {
    const nom = new URL(url).origin === new URL(NOMINATIM_BASE).origin;
    const overpass = new URL(url).hostname.includes("overpass");
    if (nom && cache[url] !== undefined) { requestStats.cacheHits++; return cache[url]; }
    let last: unknown;
    for (let i = 0; i < 4; i++) {
      if (i) await wait(overpass ? 60_000 : Math.max(4000 * 2 ** i, 1100));
      if (nom) {
        // 타이머의 밀리초 반올림 오차에도 로그상 1.1초 아래로 내려가지 않도록 여유를 둔다.
        const interval = process.env.CI ? 15_100 : 1110;
        await wait(Math.max(0, lastNom + interval - Date.now()));
        lastNom = Date.now();
      }
      requestStats[nom ? "nominatim" : overpass ? "overpass" : "other"]++;
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.appendFileSync(path.join(cacheDir, "fields-requests.jsonl"), JSON.stringify({ at: new Date().toISOString(), service: nom ? "nominatim" : overpass ? "overpass" : "other", url }) + "\n");
      try {
        const response = await fetch(url, { ...init, signal: AbortSignal.timeout(210_000), headers: { "User-Agent": FIELD_UA, ...(init?.headers ?? {}) } });
        if (!response.ok) {
          if (response.status === 403 || response.status === 429) throw Object.assign(new Error(`요청을 중단합니다 — ${response.status} ${url}`), { permanent: true });
          throw Object.assign(new Error(`${response.status} ${url}`), { permanent: response.status < 500 });
        }
        const body = await response.text();
        if (nom) {
          JSON.parse(body); // 잘못된 응답은 캐시에 남기지 않는다. 빈 검색 결과는 캐시한다.
          cache[url] = body;
          fs.mkdirSync(cacheDir, { recursive: true });
          fs.writeFileSync(cachePath, JSON.stringify(cache));
        }
        return body;
      } catch (error) {
        if ((error as { permanent?: boolean }).permanent) throw error;
        last = error;
      }
    }
    throw last;
  });
  chain = job.then(() => {}, () => {});
  return job;
}
