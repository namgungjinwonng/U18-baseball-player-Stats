// 매치업 「경기 분석」 — 키가 없으면 기록 기반 분석만, 키가 있으면 저장된 AI 분석 우선 + 분석 방향 선택·다시 분석.
import { useEffect, useRef, useState } from "react";
import type { AnalysisInput, AnalysisLine } from "../analysis/core";
import { currentModel, loadSettings, modelLabel, providerInfo } from "./config";
import { FOCUS, buildPayload, buildUserPrompt, focusLabel, parseAnswer, InvalidAnswer, SYSTEM_PROMPT, type AiExtra, type FocusId } from "./prompt";
import { AiError, generate } from "./providers";
import { entryKey, errorNotice, loadEntry, saveEntry, shortDate, type AiEntry } from "./store";
import { loadApiKey } from "./vault";

interface Props {
  input: AnalysisInput;
  ruleLines: AnalysisLine[];
  getExtra?: () => AiExtra; // 요청할 때만 만드는 보강 자료(등급·주요 선수·기록 분석 문장)
}

export function AiAnalysisPanel({ input, ruleLines, getExtra }: Props) {
  const key = entryKey(input.aName, input.bName, input.year ?? 0, input.allYears);
  const [settings] = useState(loadSettings);
  const provider = providerInfo(settings.provider);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [entry, setEntry] = useState<AiEntry | null>(() => loadEntry(key));
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [focus, setFocus] = useState<FocusId>(() => loadEntry(key)?.focus ?? "overall");
  const [basic, setBasic] = useState(false); // 「기본 분석」 칩 — 키가 있어도 기록 기반 분석을 본다
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    loadApiKey(provider.slot).then((k) => alive && setHasKey(!!k));
    return () => {
      alive = false;
    };
  }, [provider.slot]);
  // 다른 대진으로 바뀌면 그 대진의 저장 결과로 바꾸고 진행 중 요청은 취소한다.
  useEffect(() => {
    const saved = loadEntry(key);
    setEntry(saved);
    setFocus(saved?.focus ?? "overall");
    setBasic(false);
    setNotice("");
    setLoading(false);
    return () => abort.current?.abort();
  }, [key]);

  const request = async () => {
    const apiKey = await loadApiKey(provider.slot);
    if (!apiKey) {
      setHasKey(false);
      return;
    }
    const model = currentModel(settings);
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setLoading(true);
    setNotice("");
    try {
      const payload = buildPayload(input, getExtra?.() ?? {}, focus);
      const raw = await generate({
        provider: settings.provider, model: model.id, apiKey, system: SYSTEM_PROMPT,
        user: buildUserPrompt(payload, entry?.lines, focus), signal: ctl.signal,
      });
      const { lines } = parseAnswer(raw, payload);
      const next: AiEntry = { lines, provider: settings.provider, model: model.id, at: new Date().toISOString(), focus };
      saveEntry(key, next);
      if (!ctl.signal.aborted) setEntry(next);
    } catch (e) {
      if (ctl.signal.aborted) return;
      const kind = e instanceof AiError ? e.kind : e instanceof InvalidAnswer ? "invalid" : "other";
      setNotice(errorNotice(kind, settings.provider));
    } finally {
      if (!ctl.signal.aborted) setLoading(false);
    }
  };

  // 키가 있고 저장된 AI 분석이 있으면 그것을, 아니면 기록 기반 분석을 보인다(한도 소진·오류여도 같다). 「기본 분석」을 고르면 기록 기반.
  const showAi = !!hasKey && !!entry && !basic;
  return (
    <div className="versus-analysis">
      <h4>
        경기 분석{" "}
        <small>{showAi ? `AI 분석 · ${focusLabel(entry.focus)} · ${modelLabel(entry.model)} · ${shortDate(entry.at)} 생성 · 참고용` : "기록 기반 자동 분석 · 참고용"}</small>
      </h4>
      <ul>
        {showAi
          ? entry.lines.map((text, i) => <li key={i} className={i === 0 ? "is-head" : undefined}>{text}</li>)
          : ruleLines.map((line) => (
              <li key={line.id} className={line.cat === "overall" ? "is-head" : line.cat === "sample" ? "is-note" : undefined}>
                {line.text}
              </li>
            ))}
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
              className={!basic && focus === f.id ? "is-on" : undefined} onClick={() => { setBasic(false); setFocus(f.id); }}>
              {f.label}
            </button>
          ))}
        </div>
      )}
      {hasKey && !basic && (
        <div className="versus-analysis__actions">
          <button type="button" className="versus-analysis__btn" onClick={request} disabled={loading}>
            {loading ? "AI가 분석하는 중… (10초 안팎)" : entry ? (focus === (entry.focus ?? "overall") ? "다시 분석" : `${focusLabel(focus)} 중심으로 분석`) : "AI로 분석하기"}
          </button>
          <span className="versus-analysis__model">{currentModel(settings).label}</span>
        </div>
      )}
    </div>
  );
}
