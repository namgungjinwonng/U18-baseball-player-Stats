// 대진·시즌·관점·분석 방향별 결과를 기기 IndexedDB에 보관하고 생성일 기준 만료·기존 기록 이관·용량 경고를 관리한다.
import type { AiErrorKind } from "./providers";
import { geminiResetHourKst, hourText, loadSettings, retentionDays, type ProviderId } from "./config";
import { cacheTransaction, dbRequest } from "./cacheDb";
import { FOCUS_IDS, type AnswerEdge, type FocusId, type Perspective } from "./prompt";

export interface AiEntry {
  lines: string[];
  provider: ProviderId;
  model: string;
  at: string; // 생성 시각 ISO
  focus?: FocusId; // 분석 방향 (없으면 종합)
  perspective?: Perspective; // 관점 (없으면 양팀 비교 — 관점을 나누기 전에 저장한 분석)
  edge?: AnswerEdge; // 기록 기반 예상 우위(코드 계산)와 AI가 한 구간 안에서 조정한 비율
}

const LEGACY_KEY = "u18-ai-analysis-v1";
export const AI_CACHE_CHANGED = "u18-ai-cache-changed";
export const WARNING_COUNT = 3000; // 대진당 저장 칸이 관점 3개 × 방향(4·6·6) = 16칸으로 늘어 1,000에서 올렸다
export const WARNING_BYTES = 20 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const PERSPECTIVE_IDS: Perspective[] = ["both", "away", "home"];
interface StoredEntry extends AiEntry { id: string; matchup: string; focus: FocusId }
// 대진 안의 저장 칸 — 양팀 비교는 방향 이름 그대로(관점을 나누기 전 저장 ID와 같다), AWAY·HOME 기준은 「away:종합」처럼
export const slotId = (perspective: Perspective = "both", focus: FocusId = "overall") => (perspective === "both" ? focus : `${perspective}:${focus}`);
export type MatchupEntries = Partial<Record<string, AiEntry>>;
export interface StorageStats { count: number; bytes: number; averageBytes: number; warning: boolean }

// A = AWAY(선공)·B = HOME(후공)이라 순서가 바뀌면 다른 분석이다 — 시즌과 맞대결 범위(통산/시즌)까지 포함한다.
export const entryKey = (a: string, b: string, year: number, allYears?: boolean, reference?: string) =>
  `${year}|${allYears ? "all" : "season"}|${a}|${b}${reference ? `|reference:${reference}` : ""}`;

const changed = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AI_CACHE_CHANGED));
};
const validEntry = (v: unknown): v is AiEntry => {
  if (!v || typeof v !== "object") return false;
  const e = v as AiEntry;
  return Array.isArray(e.lines) && e.lines.length > 0 && e.lines.every((l) => typeof l === "string")
    && ["gemini-free", "gemini-paid", "claude", "openai"].includes(e.provider)
    && typeof e.model === "string" && Number.isFinite(Date.parse(e.at))
    && (e.focus === undefined || FOCUS_IDS.includes(e.focus))
    && (e.perspective === undefined || PERSPECTIVE_IDS.includes(e.perspective));
};
const stored = (key: string, entry: AiEntry): StoredEntry => {
  const focus = entry.focus ?? "overall";
  return { ...entry, focus, matchup: key, id: `${key}|${slotId(entry.perspective, focus)}` };
};
const toEntry = ({ lines, provider, model, at, focus, perspective, edge }: StoredEntry): AiEntry =>
  ({ lines, provider, model, at, focus, ...(perspective && perspective !== "both" ? { perspective } : {}), ...(edge ? { edge } : {}) });
export const entryBytes = (entry: AiEntry) => new TextEncoder().encode(JSON.stringify(entry)).byteLength;
export const isExpired = (entry: AiEntry, days: number, now = Date.now()) =>
  !Number.isFinite(Date.parse(entry.at)) || (days > 0 && now - Date.parse(entry.at) >= days * DAY_MS);
export function storageStats(entries: AiEntry[]): StorageStats {
  const bytes = entries.reduce((sum, e) => sum + entryBytes(e), 0), count = entries.length;
  return { count, bytes, averageBytes: count ? bytes / count : 0, warning: count >= WARNING_COUNT || bytes >= WARNING_BYTES };
}
// 개수 경고를 확인했더라도 이후 용량 경고 기준을 넘으면 다시 안내한다.
export const storageWarningLevel = (stats: StorageStats) => (stats.count >= WARNING_COUNT ? 1 : 0) | (stats.bytes >= WARNING_BYTES ? 2 : 0);

// 기존 대진당 마지막 결과 한 개를 원래 방향으로 이관한다. 트랜잭션 성공 전에는 원본을 지우지 않는다.
let migration: Promise<void> | null = null;
async function migrateLegacy() {
  let raw: string | null;
  try { raw = localStorage.getItem(LEGACY_KEY); } catch { return; }
  if (!raw) return;
  if (migration) return migration;
  migration = (async () => {
    let legacy: unknown;
    try { legacy = JSON.parse(raw); } catch { return; }
    if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) return;
    await cacheTransaction("readwrite", async (tx) => {
      const store = tx.objectStore("entries");
      for (const [key, value] of Object.entries(legacy)) {
        if (!validEntry(value)) continue;
        const next = stored(key, value);
        const previous = await dbRequest<StoredEntry | undefined>(store.get(next.id));
        if (!previous || Date.parse(previous.at) < Date.parse(next.at)) await dbRequest(store.put(next));
      }
    });
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* 이관은 완료됐으므로 중복 이관돼도 최신 결과를 유지한다. */ }
  })().finally(() => { migration = null; });
  return migration;
}

async function activeEntries(now = Date.now()): Promise<StoredEntry[]> {
  await migrateLegacy();
  const days = retentionDays(loadSettings());
  // 만료 검사와 삭제를 한 트랜잭션에서 처리해 동시에 갱신된 새 결과가 지워지지 않도록 한다.
  return cacheTransaction("readwrite", async (tx) => {
    const store = tx.objectStore("entries");
    const all = await dbRequest<StoredEntry[]>(store.getAll());
    const active: StoredEntry[] = [];
    for (const e of all) {
      if (!validEntry(e) || isExpired(e, days, now)) await dbRequest(store.delete(e.id));
      else active.push(e);
    }
    const meta = tx.objectStore("meta"), level = storageWarningLevel(storageStats(active));
    const acknowledged = Number(await dbRequest(meta.get("warning-ack"))) || 0;
    if (!level) await dbRequest(meta.delete("warning-ack"));
    else if ((acknowledged & level) !== acknowledged) await dbRequest(meta.put(acknowledged & level, "warning-ack"));
    return active;
  });
}

export async function loadMatchupEntries(key: string, now = Date.now()): Promise<MatchupEntries> {
  const rows = await activeEntries(now);
  return Object.fromEntries(rows.filter((e) => e.matchup === key).map((e) => [slotId(e.perspective, e.focus), toEntry(e)]));
}
export async function loadEntry(key: string, focus: FocusId = "overall", now = Date.now(), perspective: Perspective = "both"): Promise<AiEntry | null> {
  return (await loadMatchupEntries(key, now))[slotId(perspective, focus)] ?? null;
}
export async function saveEntry(key: string, entry: AiEntry): Promise<void> {
  if (!validEntry(entry)) throw new Error("저장할 분석 형식이 올바르지 않습니다.");
  await migrateLegacy();
  await cacheTransaction("readwrite", async (tx) => { await dbRequest(tx.objectStore("entries").put(stored(key, entry))); });
  changed();
}
export async function getStorageStats(now = Date.now()): Promise<StorageStats> {
  return storageStats((await activeEntries(now)).map(toEntry));
}
export async function entryCount() { return (await getStorageStats()).count; }
export async function pendingStorageWarning(): Promise<StorageStats | null> {
  const stats = await getStorageStats();
  if (!stats.warning) return null;
  const acknowledged = await cacheTransaction("readonly", (tx) => dbRequest(tx.objectStore("meta").get("warning-ack")));
  return (storageWarningLevel(stats) & ~(Number(acknowledged) || 0)) ? stats : null;
}
export async function acknowledgeStorageWarning() {
  const level = storageWarningLevel(await getStorageStats());
  await cacheTransaction("readwrite", async (tx) => { await dbRequest(tx.objectStore("meta").put(level, "warning-ack")); });
  changed();
}

export async function clearEntries() {
  await migrateLegacy();
  await cacheTransaction("readwrite", async (tx) => {
    await dbRequest(tx.objectStore("entries").clear());
    await dbRequest(tx.objectStore("meta").clear());
  });
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* API 키 DB는 변경하지 않는다. */ }
  changed();
}

export const storageSizeText = (bytes: number) => bytes >= 1024 * 1024
  ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`;

// 경기 분석 영역에 보일 안내 문구
export function errorNotice(kind: AiErrorKind, provider: ProviderId, now = new Date()): string {
  switch (kind) {
    case "quota":
      return provider === "gemini-free"
        ? `오늘 무료 사용량을 다 썼습니다. 한국 시간 ${hourText(geminiResetHourKst(now))}에 다시 쓸 수 있습니다.`
        : "사용 한도나 잔액이 부족합니다. 공급자 콘솔에서 확인해 주세요.";
    case "auth":
      return "API 키를 확인해 주세요.";
    case "model":
      return "선택한 모델을 쓸 수 없습니다. 매치업 AI분석 설정에서 다른 모델을 골라 주세요.";
    case "network":
      return "네트워크에 연결할 수 없어 AI 분석을 받지 못했습니다.";
    case "busy":
      return "AI 서버가 붐빕니다. 잠시 후 다시 시도해 주세요.";
    case "blocked":
      return "AI가 이 요청에 답하지 않았습니다. 잠시 후 다시 시도해 주세요.";
    case "invalid":
      return "AI 응답이 기록과 맞지 않아 쓰지 않았습니다. 다시 시도해 주세요.";
    default:
      return "AI 분석을 받지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
