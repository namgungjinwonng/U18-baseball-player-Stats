// 「AI 분석 설정」 화면 — AI 선택(기본 Gemini 무료), 모델, API 키 저장(기기 안 암호화)·연결 확인·삭제, 저장된 분석 지우기.
import { useEffect, useState } from "react";
import { Ico } from "../navIcons";
import {
  PROVIDERS, currentModel, geminiResetHourKst, hourText, loadSettings, modelOptions, providerInfo, saveSettings,
  type AiSettings, type KeySlot, type ProviderId,
} from "./config";
import { KeyGuideModal } from "./KeyGuide";
import { AiError, listModels } from "./providers";
import { clearEntries, entryCount } from "./store";
import { deleteApiKey, loadApiKey, maskKey, saveApiKey } from "./vault";

type Status = { tone: "ok" | "warn" | "error"; text: string } | null;

// 키 칸별 화면 문구 — 제목·입력 안내·발급 링크
const SLOT_TEXT: Record<KeySlot, { title: string; placeholder: string; issuer: string; url: string }> = {
  gemini: { title: "Google Gemini API 키", placeholder: "AIza로 시작하는 키", issuer: "Google AI Studio", url: "https://aistudio.google.com/apikey" },
  claude: { title: "Anthropic API 키", placeholder: "sk-ant-로 시작하는 키", issuer: "Anthropic Console", url: "https://console.anthropic.com/settings/keys" },
  openai: { title: "OpenAI API 키", placeholder: "sk-로 시작하는 키", issuer: "OpenAI Platform", url: "https://platform.openai.com/api-keys" },
};
const PROVIDER_SUB: Record<ProviderId, string> = {
  "gemini-free": "기본 · 하루 무료 사용량 안에서",
  "gemini-paid": "결제 연결한 Google 키",
  claude: "Anthropic 유료 키",
  openai: "OpenAI 유료 키",
};

export function AiSettingsView({ wrapClass }: { wrapClass: string }) {
  const [settings, setSettings] = useState<AiSettings>(loadSettings);
  const info = providerInfo(settings.provider);
  const slotText = SLOT_TEXT[info.slot];
  const [saved, setSaved] = useState<string | null>(null); // 저장된 키(가린 표기용)
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [count, setCount] = useState(entryCount);
  const [guide, setGuide] = useState(false); // 발급 방법 팝업

  useEffect(() => {
    let alive = true;
    setSaved(null);
    setDraft("");
    setStatus(null);
    loadApiKey(info.slot).then((k) => alive && setSaved(k));
    return () => {
      alive = false;
    };
  }, [info.slot]);

  const update = (next: AiSettings) => {
    setSettings(next);
    saveSettings(next);
  };
  const pickProvider = (id: ProviderId) => update({ ...settings, provider: id });
  const pickModel = (id: string) => update({ ...settings, models: { ...settings.models, [settings.provider]: id } });

  // 저장 = 연결 확인 후 저장. 키가 틀리면 저장하지 않고, 네트워크 문제면 저장은 하되 알린다.
  const save = async () => {
    const key = draft.trim();
    if (!key) return;
    setBusy(true);
    setStatus(null);
    try {
      const models = await listModels(settings.provider, key);
      await saveApiKey(info.slot, key);
      setSaved(key);
      setDraft("");
      if (info.slot === "gemini") update({ ...settings, paidModels: models });
      setStatus({ tone: "ok", text: "연결을 확인하고 이 기기에 암호화해 저장했습니다." });
    } catch (e) {
      const kind = e instanceof AiError ? e.kind : "other";
      if (kind === "auth") setStatus({ tone: "error", text: "API 키가 올바르지 않아 저장하지 않았습니다." });
      else {
        await saveApiKey(info.slot, key);
        setSaved(key);
        setDraft("");
        setStatus({ tone: "warn", text: `저장했지만 연결 확인은 실패했습니다 (${(e as Error).message}).` });
      }
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (!saved) return;
    setBusy(true);
    setStatus(null);
    try {
      const models = await listModels(settings.provider, saved);
      if (info.slot === "gemini") update({ ...settings, paidModels: models });
      setStatus({ tone: "ok", text: "연결이 정상입니다." });
    } catch (e) {
      setStatus({ tone: "error", text: `연결 확인 실패: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("이 기기에 저장된 API 키를 삭제할까요?")) return;
    await deleteApiKey(info.slot);
    setSaved(null);
    setStatus({ tone: "ok", text: "API 키를 삭제했습니다. 경기 분석은 기록 기반 자동 분석으로 보입니다." });
  };

  const clear = () => {
    if (!window.confirm(`저장된 AI 분석 ${count}개를 지울까요?`)) return;
    clearEntries();
    setCount(0);
  };

  const model = currentModel(settings);
  const reset = hourText(geminiResetHourKst());
  return (
    <div className={wrapClass}>
      <div className="section-head">
        <h2 className="heading-xl"><Ico name="ai" variant="title" />AI 분석 설정</h2>
      </div>

      <div className="ai-settings">
        <p className="ai-settings__lead">
          매치업 「경기 분석」을 AI가 기록을 읽고 다시 써 줍니다. 각자 발급한 API 키를 이 기기에만 넣어 씁니다.
          키가 없으면 지금처럼 기록 기반 자동 분석이 보입니다.
        </p>

        <section>
          <h3>AI 선택</h3>
          <div className="ai-settings__providers" role="radiogroup" aria-label="AI 선택">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={settings.provider === p.id}
                className={`ai-settings__provider ${settings.provider === p.id ? "is-on" : ""}`}
                onClick={() => pickProvider(p.id)}
              >
                <strong>{p.label}</strong>
                <small>{PROVIDER_SUB[p.id]}</small>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>모델</h3>
          <select className="ai-settings__select" value={model.id} onChange={(e) => pickModel(e.target.value)} aria-label="모델">
            {modelOptions(settings).map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          {model.note && <p className="ai-settings__hint">{model.note}</p>}
          {settings.provider === "gemini-paid" && !settings.paidModels?.length && (
            <p className="ai-settings__hint">키를 저장하면 이 키로 쓸 수 있는 모델 목록을 불러옵니다.</p>
          )}
        </section>

        <section>
          <div className="ai-settings__keyhead">
            <h3>{slotText.title}</h3>
            <button type="button" className="ai-settings__guide-btn" onClick={() => setGuide(true)}>
              발급 방법{info.paid && <span className="ai-settings__paid">유료</span>}
            </button>
          </div>
          {guide && <KeyGuideModal provider={settings.provider} onClose={() => setGuide(false)} />}
          {saved && (
            <p className="ai-settings__saved">
              저장된 키 <code>{maskKey(saved)}</code>
              {info.slot === "gemini" && <small> · Gemini 무료·유료가 같은 키 칸을 씁니다</small>}
            </p>
          )}
          <div className="ai-settings__key">
            <input
              type={show ? "text" : "password"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={saved ? "새 키로 바꾸려면 입력" : slotText.placeholder}
              autoComplete="off"
              spellCheck={false}
              aria-label="API 키"
            />
            <button type="button" className="ai-settings__eye" onClick={() => setShow((v) => !v)}>{show ? "가리기" : "보기"}</button>
          </div>
          <div className="ai-settings__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={save} disabled={busy || !draft.trim()}>
              {busy ? "확인 중…" : "저장"}
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={test} disabled={busy || !saved}>연결 확인</button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={remove} disabled={busy || !saved}>삭제</button>
          </div>
          {status && <p className={`ai-settings__status is-${status.tone}`} role="status">{status.text}</p>}
          <p className="ai-settings__hint">
            키 발급: <a href={slotText.url} target="_blank" rel="noreferrer">{slotText.issuer}</a>
          </p>
        </section>

        <section>
          <h3>알아 두세요</h3>
          <ul className="ai-settings__notes">
            {settings.provider === "gemini-free" && (
              <>
                <li>
                  무료 하루 요청 수는 Flash-Lite 약 500번, Flash 약 20번입니다(Google 프로젝트마다 다르며{" "}
                  <a href="https://aistudio.google.com/rate-limit" target="_blank" rel="noreferrer">AI Studio</a>에서 확인). 분석 1번이 요청 1번입니다.
                </li>
                <li>무료 사용량은 매일 한국 시간 {reset}에 초기화됩니다. 다 쓰면 저장된 AI 분석이나 기록 기반 분석이 보입니다.</li>
                <li>무료 등급에서는 보낸 내용(공개된 경기 기록)이 Google 제품 개선에 쓰일 수 있습니다.</li>
              </>
            )}
            {info.paid && <li>사용료는 키를 발급한 본인 계정에 청구됩니다. 이 앱 전용 키를 만들고 사용 한도를 걸어 두세요.</li>}
            {info.slot === "gemini" && (
              <li>Google Cloud 콘솔에서 이 키를 웹사이트 <code>{window.location.host}</code>로 제한하면, 키가 새도 다른 곳에서는 쓸 수 없습니다.</li>
            )}
            <li>키는 이 기기 안에서 암호화해 보관하고, 분석을 요청할 때만 고른 AI 회사로 보냅니다. 앱 운영자 서버에는 보관하지 않습니다.</li>
            <li>기기 암호화는 저장 파일을 들여다보는 것은 막지만 모든 위험을 막지는 못합니다. 공용 기기에서는 쓰고 나서 키를 삭제하세요.</li>
            <li>AI 분석은 이 기기에만 저장되며, 같은 대진은 저장된 분석이 먼저 보입니다.</li>
          </ul>
          <button type="button" className="link-btn ai-settings__clear" onClick={clear} disabled={!count}>
            저장된 AI 분석 지우기 ({count}개)
          </button>
        </section>
      </div>
    </div>
  );
}
