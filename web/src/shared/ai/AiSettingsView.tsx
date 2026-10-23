// 매치업 AI분석 설정 — 공급자·암호화 키·분석 보관 주기·기기 저장 용량을 관리한다.
import { useEffect, useState } from "react";
import { Ico } from "../navIcons";
import {
  PROVIDERS, RETENTION_OPTIONS, currentModel, geminiResetHourKst, hourText, loadSettings, modelOptions, providerInfo, retentionDays, saveSettings,
  type AiSettings, type KeySlot, type ProviderId,
} from "./config";
import { KeyGuideModal } from "./KeyGuide";
import { AiError, listModels } from "./providers";
import { AI_CACHE_CHANGED, clearEntries, getStorageStats, storageSizeText, type StorageStats } from "./store";
import { AiStorageWarning } from "./AiStorageWarning";
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
  const [stats, setStats] = useState<StorageStats>({ count: 0, bytes: 0, averageBytes: 0, warning: false });
  const [storageError, setStorageError] = useState("");
  const count = stats.count;
  const [guide, setGuide] = useState(false); // 발급 방법 팝업

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void getStorageStats().then((value) => { if (alive) { setStats(value); setStorageError(""); } })
        .catch(() => { if (alive) setStorageError("기기 저장소를 읽지 못했습니다. 브라우저 저장공간 설정을 확인해 주세요."); });
    };
    refresh();
    window.addEventListener(AI_CACHE_CHANGED, refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { alive = false; window.removeEventListener(AI_CACHE_CHANGED, refresh); window.clearInterval(timer); };
  }, []);

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
  const pickRetention = async (days: number) => {
    const old = retentionDays(settings);
    if (days > 0 && (old === 0 || days < old) && count > 0
      && !window.confirm("보관 기간을 줄이면 생성일 기준으로 만료된 분석 기록이 삭제됩니다. API 키는 유지됩니다. 변경할까요?")) return;
    update({ ...settings, retentionDays: days });
    try { setStats(await getStorageStats()); setStorageError(""); }
    catch { setStorageError("보관 주기는 적용했지만 저장공간을 확인하지 못했습니다."); }
  };

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

  const clear = async () => {
    if (!window.confirm(`저장된 AI 분석 ${count}개를 지울까요?`)) return;
    try { await clearEntries(); setStats(await getStorageStats()); setStorageError(""); }
    catch { setStorageError("분석 기록을 지우지 못했습니다. 브라우저 저장공간 설정을 확인해 주세요."); }
  };

  const model = currentModel(settings);
  const reset = hourText(geminiResetHourKst());
  return (
    <div className={wrapClass}>
      <div className="section-head">
        <h2 className="heading-xl"><Ico name="ai" variant="title" />매치업 AI분석 설정</h2>
      </div>

      <div className="ai-settings">
        <p className="ai-settings__lead">
          매치업 「경기 분석」을 AI가 기록을 읽고 다시 써 줍니다. 각자 발급한 API 키를 이 기기에만 넣어 씁니다.
          키가 없으면 지금처럼 기록 기반 자동 분석이 보입니다.
        </p>

        <section>
          <h3>분석 기록 보관</h3>
          <select className="ai-settings__select" aria-label="분석 기록 초기화 주기" value={retentionDays(settings)}
            onChange={(e) => void pickRetention(Number(e.target.value))}>
            {RETENTION_OPTIONS.map((days) => <option key={days} value={days}>{days ? `${days}일 보관` : "자동 초기화 안 함"}</option>)}
          </select>
          <p className="ai-settings__hint">각 분석의 생성일 기준입니다. 기간이 지나면 다음 확인 시 해당 기록만 정리하며, API 키는 삭제하지 않습니다. 다시 분석하면 그 항목의 내용과 보관 시작일이 갱신됩니다.</p>
          <p className="ai-settings__hint">매치업·시즌·분석 항목별로 이 기기의 브라우저에만 저장합니다. 기기 간 동기화나 운영자 서버 저장은 하지 않습니다.</p>
          <p className="ai-settings__storage" role="status">저장 {count.toLocaleString()}개 · 약 {storageSizeText(stats.bytes)} · 1개 평균 {storageSizeText(stats.averageBytes)}</p>
          <p className="ai-settings__hint">1,000개 또는 20MB 이상이면 경고합니다. 용량은 분석 JSON의 UTF-8 크기이며 실제 브라우저 저장공간 사용량과 다를 수 있습니다. 용량 때문에 기록을 임의 삭제하지 않습니다.</p>
          {storageError && <p className="ai-settings__status is-error" role="status">{storageError}</p>}
        </section>

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
            <li>AI 분석은 이 기기에만 저장되며, 같은 매치업의 같은 분석 항목은 저장 결과를 다시 보여줍니다. 탭 선택만으로 API를 호출하지 않습니다.</li>
          </ul>
          <button type="button" className="link-btn ai-settings__clear" onClick={clear} disabled={!count}>
            저장된 AI 분석 지우기 ({count}개)
          </button>
        </section>
      </div>
      <AiStorageWarning />
    </div>
  );
}
