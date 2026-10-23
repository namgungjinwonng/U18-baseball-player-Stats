// 대진별 AI 분석 결과를 이 기기에 저장 — 같은 대진은 저장된 분석을 먼저 보이고, 다시 분석하면 새 결과로 바꾼다.
import type { AiErrorKind } from "./providers";
import { geminiResetHourKst, hourText, type ProviderId } from "./config";
import type { FocusId } from "./prompt";

export interface AiEntry {
  lines: string[];
  provider: ProviderId;
  model: string;
  at: string; // 생성 시각 ISO
  focus?: FocusId; // 분석 방향 (없으면 종합)
}

const STORE_KEY = "u18-ai-analysis-v1";
const MAX_ENTRIES = 200;

// 학교 순서(A/B)와 무관하게 같은 대진은 같은 키 — 시즌과 맞대결 범위(통산/시즌)까지 포함한다.
export const entryKey = (a: string, b: string, year: number, allYears?: boolean) =>
  `${year}|${allYears ? "all" : "season"}|${[a, b].sort().join("|")}`;

function readAll(): Record<string, AiEntry> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function loadEntry(key: string): AiEntry | null {
  return readAll()[key] ?? null;
}

export function saveEntry(key: string, entry: AiEntry) {
  const all = { ...readAll(), [key]: entry };
  // 오래된 것부터 지워 개수를 제한한다
  const keys = Object.keys(all).sort((x, y) => all[y].at.localeCompare(all[x].at));
  for (const k of keys.slice(MAX_ENTRIES)) delete all[k];
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    /* 저장 실패 — 이번 화면에서만 보인다 */
  }
}

export const entryCount = () => Object.keys(readAll()).length;

export function clearEntries() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* 무시 */
  }
}

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
      return "선택한 모델을 쓸 수 없습니다. AI 분석 설정에서 다른 모델을 골라 주세요.";
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
