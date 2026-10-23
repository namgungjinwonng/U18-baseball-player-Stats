// AI 경기분석 설정 — 공급자·모델 목록과 사용자가 고른 값(localStorage) 읽기·쓰기.

export type ProviderId = "gemini-free" | "gemini-paid" | "claude" | "openai";
export type KeySlot = "gemini" | "claude" | "openai"; // Gemini 무료·유료는 같은 Google 키 형식이라 한 칸을 같이 쓴다

export interface ModelOption {
  id: string;
  label: string;
  note?: string;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  slot: KeySlot;
  paid: boolean;
  models: ModelOption[]; // 첫 항목이 기본값
}

// 무료 하루 요청 수는 Google이 숫자를 공개하지 않아(AI Studio에서 프로젝트별 확인) 외부 정리 글 기준 '약'으로만 적는다.
const GEMINI_MODELS: ModelOption[] = [
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", note: "기본 · 무료 하루 약 500번" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", note: "문장 품질 좋음 · 무료 하루 약 20번" },
];

export const PROVIDERS: ProviderInfo[] = [
  { id: "gemini-free", label: "Gemini 무료", slot: "gemini", paid: false, models: GEMINI_MODELS },
  { id: "gemini-paid", label: "Gemini 유료 키", slot: "gemini", paid: true, models: GEMINI_MODELS },
  {
    id: "claude",
    label: "Claude (유료)",
    slot: "claude",
    paid: true,
    models: [
      { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "가장 정교함 · 회당 약 75원" },
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "균형 · 회당 약 40원" },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "빠름 · 회당 약 2원" },
    ],
  },
  {
    id: "openai",
    label: "GPT (유료)",
    slot: "openai",
    paid: true,
    // 회당 비용은 입력 약 6천·출력 약 1,500토큰 기준 추정(추론 토큰이 늘면 더 든다)
    models: [
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", note: "균형 · 회당 약 40원" },
      { id: "gpt-6-astra", label: "GPT-6 Astra", note: "가장 정교함 · 회당 약 190원" },
      { id: "gpt-6-luna", label: "GPT-6 Luna", note: "빠름 · 회당 약 2원" },
    ],
  },
];

export const providerInfo = (id: ProviderId) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

export interface AiSettings {
  provider: ProviderId;
  models: Partial<Record<ProviderId, string>>; // 공급자별로 마지막에 고른 모델
  paidModels?: ModelOption[]; // Gemini 유료 키 연결 확인 때 받아 온 모델 목록
  retentionDays?: number; // 분석 생성일 기준 보관 기간. 0은 자동 초기화 안 함.
}

export const RETENTION_OPTIONS = [1, 7, 30, 90, 0] as const;
export const DEFAULT_RETENTION_DAYS = 30;
export const retentionDays = (s: AiSettings) => RETENTION_OPTIONS.some((d) => d === s.retentionDays)
  ? s.retentionDays! : DEFAULT_RETENTION_DAYS;
export const AI_SETTINGS_CHANGED = "u18-ai-settings-changed";

const SETTINGS_KEY = "u18-ai-settings";
const DEFAULT: AiSettings = { provider: "gemini-free", models: {} };

export function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const s = raw ? (JSON.parse(raw) as AiSettings) : null;
    if (s && PROVIDERS.some((p) => p.id === s.provider)) return { ...DEFAULT, ...s, models: s.models ?? {}, retentionDays: retentionDays(s) };
  } catch {
    /* 저장소를 못 쓰면 기본값 */
  }
  return DEFAULT;
}

export function saveSettings(s: AiSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    if (typeof window !== "undefined") window.dispatchEvent(new Event(AI_SETTINGS_CHANGED));
  } catch {
    /* 저장 실패는 이번 접속에만 적용 */
  }
}

// 공급자가 고를 수 있는 모델 — Gemini 유료는 연결 확인에서 받은 목록이 있으면 그것을 쓴다.
export function modelOptions(s: AiSettings, provider: ProviderId = s.provider): ModelOption[] {
  const info = providerInfo(provider);
  if (provider === "gemini-paid" && s.paidModels?.length) return s.paidModels;
  return info.models;
}

// 고른 모델이 목록에 없으면(모델 정리·목록 변경) 기본 모델로 돌아간다.
export function currentModel(s: AiSettings, provider: ProviderId = s.provider): ModelOption {
  const list = modelOptions(s, provider);
  return list.find((m) => m.id === s.models[provider]) ?? list[0];
}

export function modelLabel(id: string) {
  for (const p of PROVIDERS) for (const m of p.models) if (m.id === id) return m.label;
  return id;
}

// Gemini 무료 하루 한도는 미국 서부 자정에 초기화된다 — 지금 기준 한국 시간 몇 시인지 계산한다(서머타임 반영).
export function geminiResetHourKst(now = new Date()): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "shortOffset" })
    .formatToParts(now)
    .find((x) => x.type === "timeZoneName")?.value; // 예: "GMT-7"
  const offset = Number(part?.replace("GMT", "") || -8);
  return (((9 - offset) % 24) + 24) % 24;
}

export const hourText = (h: number) => (h === 0 ? "자정" : h < 12 ? `오전 ${h}시` : h === 12 ? "낮 12시" : `오후 ${h - 12}시`);
