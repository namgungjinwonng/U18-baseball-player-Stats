// AI 공급자 호출 — Gemini·GPT는 REST(fetch), Claude는 공식 SDK(지연 로딩). 오류는 화면이 쓰는 종류(한도·키·모델·네트워크 등)로 바꾼다.
import type { ModelOption, ProviderId } from "./config";
import { providerInfo } from "./config";
import { GEMINI_SCHEMA, JSON_SCHEMA } from "./prompt";

export type AiErrorKind = "quota" | "auth" | "model" | "network" | "busy" | "blocked" | "invalid" | "other";

export class AiError extends Error {
  constructor(public kind: AiErrorKind, message: string) {
    super(message);
  }
}

export interface AiRequest {
  provider: ProviderId;
  model: string;
  apiKey: string;
  system: string;
  user: string;
  signal?: AbortSignal;
}

const GEMINI = "https://generativelanguage.googleapis.com/v1beta";

// Gemini 오류 응답(상태 코드 + {error:{message,status}}) → 오류 종류
export function geminiErrorKind(status: number, message = ""): AiErrorKind {
  if (status === 429) return "quota";
  if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID/i.test(message)) return "auth";
  if (status === 404) return "model";
  if (status >= 500) return "busy";
  return "other";
}

// 서버 혼잡(5xx)은 잠깐 쉬고 한 번만 다시 보낸다. 한도(429)·키 오류는 다시 보내도 같아 재시도하지 않는다.
export const BUSY_RETRY_MS = 1500;
async function requestJson(url: string, headers: Record<string, string>, init: RequestInit, kindOf: (status: number, message: string) => AiErrorKind) {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...headers } });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      throw new AiError("network", "네트워크에 연결할 수 없습니다.");
    }
    const body = await res.json().catch(() => ({}));
    if (res.ok) return body;
    if (res.status >= 500 && attempt === 0 && !init.signal?.aborted) {
      await new Promise((r) => setTimeout(r, BUSY_RETRY_MS));
      continue;
    }
    const message: string = body?.error?.message ?? `HTTP ${res.status}`;
    throw new AiError(kindOf(res.status, message), message);
  }
}

const geminiFetch = (path: string, apiKey: string, init: RequestInit = {}) =>
  requestJson(`${GEMINI}${path}`, { "x-goog-api-key": apiKey }, init, geminiErrorKind);

// Gemini 3 계열은 생각 수준을 지정한다 — 기본(Flash-Lite는 최저)으로는 숫자 나열에 그쳐 high로 올린다(2026-10-23 비교 실험).
const thinkingFor = (model: string) => (/^gemini-3/.test(model) ? { thinkingConfig: { thinkingLevel: "high" } } : {});

async function geminiGenerate(req: AiRequest): Promise<string> {
  const body = await geminiFetch(`/models/${encodeURIComponent(req.model)}:generateContent`, req.apiKey, {
    method: "POST",
    signal: req.signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      // 생각(thinking) 토큰도 출력 한도에 들어가므로 넉넉히 둔다
      generationConfig: {
        responseMimeType: "application/json", responseSchema: GEMINI_SCHEMA, maxOutputTokens: 8192, ...thinkingFor(req.model),
      },
    }),
  });
  if (body?.promptFeedback?.blockReason) throw new AiError("blocked", `요청이 차단되었습니다 (${body.promptFeedback.blockReason}).`);
  const cand = body?.candidates?.[0];
  if (cand?.finishReason === "MAX_TOKENS") throw new AiError("invalid", "응답이 길어 중간에 끊겼습니다.");
  if (cand?.finishReason && !["STOP", "MAX_TOKENS"].includes(cand.finishReason)) {
    throw new AiError("blocked", `응답이 차단되었습니다 (${cand.finishReason}).`);
  }
  const parts: { text?: string; thought?: boolean }[] = cand?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join("");
  if (!text) throw new AiError("invalid", "빈 응답을 받았습니다.");
  return text;
}

// 연결 확인 겸 모델 목록 — 생성 요청이 아니라 무료 하루 분석 횟수를 쓰지 않는다.
async function geminiModels(apiKey: string): Promise<ModelOption[]> {
  const body = await geminiFetch("/models?pageSize=200", apiKey);
  const known = providerInfo("gemini-free").models;
  const list: ModelOption[] = (body?.models ?? [])
    .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes("generateContent") &&
      /^models\/gemini-/.test(m.name) && !/embed|image|tts|audio|live|robotics|computer/i.test(m.name))
    .map((m: { name: string; displayName?: string }) => {
      const id = m.name.replace(/^models\//, "");
      return known.find((k) => k.id === id) ?? { id, label: m.displayName ?? id };
    });
  // 무료 기본 모델을 먼저, 나머지는 이름순
  return [...known.filter((k) => list.some((m) => m.id === k.id)), ...list.filter((m) => !known.some((k) => k.id === m.id)).sort((x, y) => x.id.localeCompare(y.id))];
}

// 거절 시 서버 측 대체 모델 — Opus·Sonnet 5.5만 지원(Haiku 5.5는 없음)
const CLAUDE_FALLBACK = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

async function claudeClient(apiKey: string) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  // 사용자가 자기 키를 넣는 앱이라 브라우저 직접 호출을 허용한다(키는 이 기기에서만 쓰인다).
  return { Anthropic, client: new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 }) };
}

function claudeError(Anthropic: typeof import("@anthropic-ai/sdk").default, e: unknown): Error {
  if (e instanceof Anthropic.APIUserAbortError) return e;
  if (e instanceof Anthropic.RateLimitError) return new AiError("quota", "요청 한도를 넘었습니다.");
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new AiError("auth", "API 키가 올바르지 않습니다.");
  if (e instanceof Anthropic.NotFoundError) return new AiError("model", "모델을 찾을 수 없습니다.");
  if (e instanceof Anthropic.APIConnectionError) return new AiError("network", "네트워크에 연결할 수 없습니다.");
  if (e instanceof Anthropic.InternalServerError) return new AiError("busy", "AI 서버가 붐빕니다."); // SDK가 이미 1번 재시도한 뒤
  if (e instanceof Anthropic.APIError) {
    const err = (e.error as { error?: { type?: string } } | undefined)?.error;
    if (err?.type === "billing_error" || /credit balance/i.test(e.message)) return new AiError("quota", "크레딧 잔액이 부족합니다.");
    return new AiError("other", e.message);
  }
  return new AiError("other", (e as Error)?.message ?? "알 수 없는 오류");
}

async function claudeGenerate(req: AiRequest): Promise<string> {
  const { Anthropic, client } = await claudeClient(req.apiKey);
  const params = {
    model: req.model,
    max_tokens: 8000,
    system: req.system,
    messages: [{ role: "user" as const, content: req.user }],
    output_config: { format: { type: "json_schema" as const, schema: JSON_SCHEMA } },
  };
  let stop: string | null, blocks: { type: string; text?: string }[];
  try {
    if (CLAUDE_FALLBACK.has(req.model)) {
      const msg = await client.beta.messages.create(
        { ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" },
        { signal: req.signal }
      );
      stop = msg.stop_reason;
      blocks = msg.content;
    } else {
      const msg = await client.messages.create(params, { signal: req.signal });
      stop = msg.stop_reason;
      blocks = msg.content;
    }
  } catch (e) {
    throw claudeError(Anthropic, e);
  }
  if (stop === "refusal") throw new AiError("blocked", "요청이 거절되었습니다.");
  if (stop === "max_tokens") throw new AiError("invalid", "응답이 길어 중간에 끊겼습니다.");
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  if (!text) throw new AiError("invalid", "빈 응답을 받았습니다.");
  return text;
}

async function claudeModels(apiKey: string): Promise<ModelOption[]> {
  const { Anthropic, client } = await claudeClient(apiKey);
  try {
    await client.models.list({ limit: 1 });
  } catch (e) {
    throw claudeError(Anthropic, e);
  }
  return providerInfo("claude").models;
}

const OPENAI = "https://api.openai.com/v1";

// GPT 오류 → 종류. 429는 요청 한도와 크레딧 소진(credit_balance_exhausted 등)을 모두 포함한다.
export function openaiErrorKind(status: number): AiErrorKind {
  if (status === 429) return "quota";
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "model";
  if (status >= 500) return "busy";
  return "other";
}

const openaiFetch = (path: string, apiKey: string, init: RequestInit = {}) =>
  requestJson(`${OPENAI}${path}`, { authorization: `Bearer ${apiKey}` }, init, openaiErrorKind);

async function openaiGenerate(req: AiRequest): Promise<string> {
  const body = await openaiFetch("/responses", req.apiKey, {
    method: "POST",
    signal: req.signal,
    body: JSON.stringify({
      model: req.model,
      instructions: req.system,
      input: req.user,
      text: { format: { type: "json_schema", name: "matchup_analysis", schema: JSON_SCHEMA, strict: true } },
      max_output_tokens: 25000, // 추론 토큰도 이 한도에 들어간다(공식 권장 여유분)
    }),
  });
  if (body?.status === "incomplete") {
    const reason = body?.incomplete_details?.reason;
    throw reason === "max_output_tokens"
      ? new AiError("invalid", "응답이 길어 중간에 끊겼습니다.")
      : new AiError("blocked", `응답이 중단되었습니다 (${reason ?? "incomplete"}).`);
  }
  const parts: { type: string; text?: string; refusal?: string }[] = (body?.output ?? [])
    .filter((o: { type: string }) => o.type === "message")
    .flatMap((o: { content?: unknown[] }) => o.content ?? []);
  if (parts.some((p) => p.type === "refusal")) throw new AiError("blocked", "요청이 거절되었습니다.");
  const text = parts.filter((p) => p.type === "output_text").map((p) => p.text ?? "").join("");
  if (!text) throw new AiError("invalid", "빈 응답을 받았습니다.");
  return text;
}

async function openaiModels(apiKey: string): Promise<ModelOption[]> {
  await openaiFetch("/models", apiKey);
  return providerInfo("openai").models;
}

export function generate(req: AiRequest): Promise<string> {
  if (req.provider === "claude") return claudeGenerate(req);
  if (req.provider === "openai") return openaiGenerate(req);
  return geminiGenerate(req);
}

export function listModels(provider: ProviderId, apiKey: string): Promise<ModelOption[]> {
  if (provider === "claude") return claudeModels(apiKey);
  if (provider === "openai") return openaiModels(apiKey);
  return geminiModels(apiKey);
}
