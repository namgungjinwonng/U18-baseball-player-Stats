// 매치업 「경기 분석」 — 키가 없으면 기록 기반 분석만, 키가 있으면 저장된 AI 분석 우선 + 분석 방향 선택·다시 분석.
import { useEffect, useRef, useState } from "react";
import type { AnalysisInput, AnalysisLine } from "../analysis/core";
import { AI_SETTINGS_CHANGED, currentModel, loadSettings, modelLabel, providerInfo } from "./config";
import { FOCUS, buildPayload, buildUserPrompt, focusLabel, parseAnswer, InvalidAnswer, SYSTEM_PROMPT, type AiExtra, type FocusId } from "./prompt";
import { AiError, generate } from "./providers";
import { AI_CACHE_CHANGED, entryKey, errorNotice, loadMatchupEntries, saveEntry, shortDate, type AiEntry, type MatchupEntries } from "./store";
import { loadApiKey } from "./vault";
import { AiStorageWarning } from "./AiStorageWarning";

interface Props {
  input: AnalysisInput;
  ruleLines: AnalysisLine[];
  getExtra?: () => AiExtra; // 요청할 때만 만드는 보강 자료(등급·주요 선수·기록 분석 문장)
}

export function AiAnalysisPanel({ input, ruleLines, getExtra }: Props) {
  const key = entryKey(input.aName, input.bName, input.year ?? 0, input.allYears,
    input.reference ? `${input.reference.year}:${input.reference.signature}` : undefined);
  const [settings, setSettings] = useState(loadSettings);
  const provider = providerInfo(settings.provider);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [cache, setCache] = useState<{ key: string; entries: MatchupEntries; ready: boolean }>({ key, entries: {}, ready: false });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [focus, setFocus] = useState<FocusId>("overall");
  const [basic, setBasic] = useState(false); // 「기본 분석」 칩 — 키가 있어도 기록 기반 분석을 본다
  const abort = useRef<AbortController | null>(null);
  const entry = cache.key === key ? cache.entries[focus] : undefined;
  const referenceH2hUnavailable = !!input.reference && focus === "h2h";

  useEffect(() => {
    const sync = () => setSettings(loadSettings());
    window.addEventListener(AI_SETTINGS_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AI_SETTINGS_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    loadApiKey(provider.slot).then((k) => alive && setHasKey(!!k));
    return () => {
      alive = false;
    };
  }, [provider.slot]);
  // 선택한 대진의 네 방향을 따로 읽는다. 탭 이동·만료 확인은 생성 API를 호출하지 않는다.
  useEffect(() => {
    let alive = true, revision = 0;
    const refresh = async () => {
      const requestRevision = ++revision;
      try {
        const entries = await loadMatchupEntries(key);
        if (alive && requestRevision === revision) setCache({ key, entries, ready: true });
      } catch {
        if (alive && requestRevision === revision) {
          setCache((old) => ({ key, entries: old.key === key ? old.entries : {}, ready: true }));
          setNotice("기기 저장소를 읽지 못했습니다. 브라우저 저장공간 설정을 확인해 주세요.");
        }
      }
    };
    const onVisible = () => { if (!document.hidden) void refresh(); };
    setCache({ key, entries: {}, ready: false });
    setFocus("overall");
    setBasic(false);
    setNotice("");
    setLoading(false);
    void refresh();
    const timer = window.setInterval(onVisible, 60_000);
    window.addEventListener(AI_CACHE_CHANGED, refresh);
    window.addEventListener(AI_SETTINGS_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      abort.current?.abort();
      window.clearInterval(timer);
      window.removeEventListener(AI_CACHE_CHANGED, refresh);
      window.removeEventListener(AI_SETTINGS_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key]);

  const request = async () => {
    if (referenceH2hUnavailable) return;
    if (abort.current && !abort.current.signal.aborted) return;
    const ctl = new AbortController();
    abort.current = ctl;
    setLoading(true);
    setNotice("");
    try {
      const apiKey = await loadApiKey(provider.slot);
      if (ctl.signal.aborted) return;
      if (!apiKey) { setHasKey(false); return; }
      const model = currentModel(settings);
      const payload = buildPayload(input, getExtra?.() ?? {}, focus);
      const raw = await generate({
        provider: settings.provider, model: model.id, apiKey, system: SYSTEM_PROMPT,
        user: buildUserPrompt(payload, entry?.lines, focus), signal: ctl.signal,
      });
      if (ctl.signal.aborted) return;
      const { lines } = parseAnswer(raw, payload);
      const next: AiEntry = { lines, provider: settings.provider, model: model.id, at: new Date().toISOString(), focus };
      setCache((old) => ({ key, entries: { ...(old.key === key ? old.entries : {}), [focus]: next }, ready: true }));
      try {
        await saveEntry(key, next);
      } catch {
        if (!ctl.signal.aborted) setNotice("분석은 완료했지만 기기에 저장하지 못했습니다. 이 화면에서만 볼 수 있으니 저장공간을 확인해 주세요.");
      }
    } catch (e) {
      if (ctl.signal.aborted) return;
      const kind = e instanceof AiError ? e.kind : e instanceof InvalidAnswer ? "invalid" : "other";
      setNotice(errorNotice(kind, settings.provider));
    } finally {
      if (abort.current === ctl) {
        abort.current = null;
        if (!ctl.signal.aborted) setLoading(false);
      }
    }
  };

  // 미분석 방향에 다른 방향의 결과나 기본 분석을 섞어 보여 주지 않는다. 기본 분석은 별도 선택한다.
  const showAi = !!hasKey && !!entry && !basic;
  const showBasic = !hasKey || basic;
  return (
    <div className="versus-analysis">
      <h4>
        경기 분석{" "}
        <small>{showAi ? `AI 분석 · ${focusLabel(focus)} · ${input.reference ? `${input.reference.year} 기록 참고 · ` : ""}${modelLabel(entry.model)} · ${shortDate(entry.at)} 생성 · 참고용` : showBasic ? `${input.reference ? `${input.reference.year} 개인 기록 참고 · ` : ""}기록 기반 자동 분석 · 참고용` : `${focusLabel(focus)} · ${referenceH2hUnavailable ? "자료 부족" : cache.ready && cache.key === key ? "분석 전" : "저장 기록 확인 중…"}`}</small>
      </h4>
      <ul>
        {showAi
          ? entry.lines.map((text, i) => <li key={i} className={i === 0 ? "is-head" : undefined}>{text}</li>)
          : showBasic ? ruleLines.map((line) => (
              <li key={line.id} className={line.cat === "overall" ? "is-head" : line.cat === "sample" ? "is-note" : undefined}>
                {line.text}
              </li>
            )) : <li className="is-note">{referenceH2hUnavailable ? "전년도 개인 시즌 합계만으로 현재 엔트리의 맞대결·최근 흐름을 판단할 수 없어 분석을 요청하지 않습니다. 종합·타격·마운드를 선택해 주세요." : loading ? "선택한 항목을 분석하고 있습니다." : "이 매치업의 선택한 항목은 분석 전입니다. 버튼을 누르면 AI 분석을 생성해 이 기기에 저장합니다."}</li>}
      </ul>
      {notice && <p className="versus-analysis__notice" role="status">{notice}</p>}
      {/* 키를 넣은 사용자에게만 — 분석 방향을 고르고 버튼으로 요청(고르기만 해서는 요청하지 않아 무료 횟수를 아낀다) */}
      {hasKey && (
        <div className="versus-analysis__focus" role="radiogroup" aria-label="분석 선택">
          <button type="button" role="radio" aria-checked={basic} disabled={loading}
            className={`versus-analysis__basic ${basic ? "is-on" : ""}`} onClick={() => setBasic(true)}>
            기본 분석
          </button>
          {FOCUS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={!basic && focus === f.id} disabled={loading}
              className={!basic && focus === f.id ? "is-on" : undefined} onClick={() => { setBasic(false); setFocus(f.id); setNotice(""); }}>
              {f.label}{cache.ready && cache.key === key && !cache.entries[f.id] && <small className="versus-analysis__pending">{input.reference && f.id === "h2h" ? "자료 부족" : "분석 전"}</small>}
            </button>
          ))}
        </div>
      )}
      {hasKey && !basic && (
        <div className="versus-analysis__actions">
          <button type="button" className="versus-analysis__btn" onClick={request} disabled={loading || !cache.ready || cache.key !== key || referenceH2hUnavailable}>
            {loading ? "AI가 분석하는 중… (10초 안팎)" : entry ? "다시 분석" : "AI로 분석하기"}
          </button>
          <span className="versus-analysis__model">{currentModel(settings).label}</span>
        </div>
      )}
      <AiStorageWarning />
    </div>
  );
}
