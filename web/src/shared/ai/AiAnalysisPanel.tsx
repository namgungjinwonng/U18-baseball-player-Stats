// 매치업 「경기 분석」 — 키가 없으면 기록 기반 분석만, 키가 있으면 저장된 AI 분석 우선 + 관점(양팀 비교·AWAY·HOME 기준)·분석 방향 선택·다시 분석.
import { useEffect, useRef, useState } from "react";
import type { AnalysisInput, AnalysisLine } from "../analysis/core";
import type { ScheduleGame } from "../types";
import { AI_SETTINGS_CHANGED, currentModel, loadSettings, modelLabel, providerInfo } from "./config";
import {
  PERSPECTIVES, REFERENCE_UNAVAILABLE, buildPayload, buildUserPrompt, focusLabel, focusList, parseAnswer, perspectiveName, systemPrompt,
  InvalidAnswer, type AiExtra, type FocusId, type Perspective,
} from "./prompt";
import { AiError, generate } from "./providers";
import { AI_CACHE_CHANGED, entryKey, errorNotice, loadMatchupEntries, saveEntry, shortDate, slotId, type AiEntry, type MatchupEntries } from "./store";
import { loadApiKey } from "./vault";
import { AiStorageWarning } from "./AiStorageWarning";
import { AiOptionsBox } from "./AiOptionsBox";
import { perspectiveLabel } from "./edge";
import { teamKey } from "../versus";
import { DEFAULT_OPTIONS, OptionsError, optionsKey, optionsSummary, scopeActive, type AiOptions, type SampleRow } from "./options";

// 「분석 옵션」을 쓰는 화면이 넘기는 것 — 범위 표본 계산과, 옵션을 적용한 분석 입력·보강 자료 만들기.
export interface AiOptionSupport {
  upcoming: ScheduleGame[]; // 공식경기로 고를 두 학교의 남은 경기
  sample: (o: AiOptions) => SampleRow[] | null;
  build: (o: AiOptions, signal: AbortSignal) => Promise<{ input: AnalysisInput; extra: AiExtra }>;
  prefetch?: (o: AiOptions) => void; // 요청 전에 내려받을 자료(날씨·구장·예보)를 미리 받아 둔다 — 실패해도 요청 때 다시 받는다
  gradeNote?: string; // 학년 기준·항상 제외 안내(시즌 초 전년도 참고 분석)
}

interface Props {
  input: AnalysisInput;
  ruleLines: AnalysisLine[];
  getExtra?: () => AiExtra; // 요청할 때만 만드는 보강 자료(등급·주요 선수·기록 분석 문장)
  options?: AiOptionSupport;
  onSwap?: () => void; // 고른 공식경기의 AWAY·HOME이 화면 순서와 반대면 두 학교를 바꾼다
}

// 선수 범위·경기 조건 켜짐 여부는 이 기기에 기억한다(연말엔 매 대진 다시 고르지 않도록). 경기별 입력은 대진마다 새로.
const OPTIONS_STORE = "u18-ai-options";
function loadSavedOptions(): AiOptions {
  try {
    const v = JSON.parse(localStorage.getItem(OPTIONS_STORE) ?? "null") as Partial<AiOptions> | null;
    return {
      ...DEFAULT_OPTIONS,
      excludeMovedOut: v?.excludeMovedOut === true,
      excludeGrades: Array.isArray(v?.excludeGrades) ? v!.excludeGrades.filter((g) => g === "1" || g === "2" || g === "3") : [],
      conditions: v?.conditions === true,
    };
  } catch {
    return DEFAULT_OPTIONS;
  }
}
function saveOptions(o: AiOptions) {
  try {
    localStorage.setItem(OPTIONS_STORE, JSON.stringify({ excludeMovedOut: o.excludeMovedOut, excludeGrades: o.excludeGrades, conditions: o.conditions }));
  } catch {
    // 저장 못 해도 이번 화면에서는 그대로 쓴다
  }
}

export function AiAnalysisPanel({ input, ruleLines, getExtra, options, onSwap }: Props) {
  const reference = input.reference ? `${input.reference.year}:${input.reference.signature}` : undefined;
  const baseKey = entryKey(input.aName, input.bName, input.year ?? 0, input.allYears, reference);
  // AWAY·HOME만 바뀐 같은 대진 — 바꿔도 고른 관점·방향·경기 입력을 유지한다.
  const [n1, n2] = [input.aName, input.bName].sort();
  const pairKey = entryKey(n1, n2, input.year ?? 0, input.allYears, reference);
  const [rawOpts, setRawOpts] = useState<AiOptions>(loadSavedOptions);
  // 공식경기를 아직 고르지 않았으면 가장 가까운 남은 경기를 쓴다.
  const opts: AiOptions = options && rawOpts.conditions && rawOpts.gameKind === "official" && !rawOpts.gameIdx && options.upcoming[0]
    ? { ...rawOpts, gameIdx: options.upcoming[0].game_idx } : rawOpts;
  const changeOpts = (next: AiOptions) => {
    setRawOpts(next);
    saveOptions(next);
  };
  const optKey = options ? optionsKey(opts) : "";
  const key = optKey ? `${baseKey}|opt:${optKey}` : baseKey;
  const optionsOn = !!options && (scopeActive(opts) || opts.conditions);
  const [settings, setSettings] = useState(loadSettings);
  const provider = providerInfo(settings.provider);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [cache, setCache] = useState<{ key: string; entries: MatchupEntries; ready: boolean }>({ key, entries: {}, ready: false });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [perspective, setPerspective] = useState<Perspective>("both");
  const [focus, setFocus] = useState<FocusId>("overall");
  const [basic, setBasic] = useState(true); // 「기본 분석」 칩 — 키가 있어도 처음에는 기록 기반 분석을 보인다
  const abort = useRef<AbortController | null>(null);
  const slot = slotId(perspective, focus);
  const entry = cache.key === key ? cache.entries[slot] : undefined;
  const referenceUnavailable = !!input.reference && REFERENCE_UNAVAILABLE.has(focus);
  const ourName = perspective === "home" ? input.bName : input.aName, oppName = perspective === "home" ? input.aName : input.bName;

  // 대진이 바뀌면 기본 분석·관점·분석 방향과 경기별 입력(공식경기·시작·구장)을 처음으로. 옵션만 바뀔 때는 방향을 유지한다.
  useEffect(() => {
    setPerspective("both");
    setFocus("overall");
    setBasic(true);
    setRawOpts((o) => ({ ...o, gameKind: "official", gameIdx: "", start: "", venue: "" }));
  }, [pairKey]);

  // 공식경기를 골랐으면 AWAY·HOME을 일정의 대진 순서(원정 = AWAY)로 맞춘다.
  const officialGame = options && opts.conditions && opts.gameKind === "official" ? options.upcoming.find((g) => g.game_idx === opts.gameIdx) : undefined;
  const reversed = !!officialGame && teamKey(officialGame.home.name) === teamKey(input.aName);
  const swapRef = useRef(onSwap);
  swapRef.current = onSwap;
  useEffect(() => {
    if (hasKey && !basic && reversed) swapRef.current?.();
  }, [hasKey, basic, reversed]);

  useEffect(() => {
    const sync = () => setSettings(loadSettings());
    window.addEventListener(AI_SETTINGS_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AI_SETTINGS_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // 키가 있으면 「AI로 분석하기」를 누르기 전에 요청에 쓸 자료를 받아 둔다(응답을 조금이라도 빨리 보이게).
  useEffect(() => {
    if (hasKey && options?.prefetch) options.prefetch(opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKey, options, optKey]);

  useEffect(() => {
    let alive = true;
    loadApiKey(provider.slot).then((k) => alive && setHasKey(!!k));
    return () => {
      alive = false;
    };
  }, [provider.slot]);
  // 선택한 대진의 관점·방향별 저장 칸을 함께 읽는다. 탭 이동·만료 확인은 생성 API를 호출하지 않는다.
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
    if (referenceUnavailable) return;
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
      const built = optionsOn ? await options!.build(opts, ctl.signal) : { input, extra: getExtra?.() ?? {} };
      if (ctl.signal.aborted) return;
      const payload = buildPayload(built.input, built.extra, focus, perspective);
      const raw = await generate({
        provider: settings.provider, model: model.id, apiKey, system: systemPrompt(perspective),
        user: buildUserPrompt(payload, entry?.lines, focus, perspective), signal: ctl.signal,
      });
      if (ctl.signal.aborted) return;
      const { lines, edge } = parseAnswer(raw, payload);
      const next: AiEntry = {
        lines, provider: settings.provider, model: model.id, at: new Date().toISOString(), focus,
        ...(perspective !== "both" ? { perspective } : {}), ...(edge ? { edge } : {}),
      };
      setCache((old) => ({ key, entries: { ...(old.key === key ? old.entries : {}), [slot]: next }, ready: true }));
      try {
        await saveEntry(key, next);
      } catch {
        if (!ctl.signal.aborted) setNotice("분석은 완료했지만 기기에 저장하지 못했습니다. 이 화면에서만 볼 수 있으니 저장공간을 확인해 주세요.");
      }
    } catch (e) {
      if (ctl.signal.aborted) return;
      if (e instanceof OptionsError) return setNotice(e.message);
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
  // 양팀 비교는 학교 이름 그대로, AWAY·HOME 기준은 「우리팀 ○○ 우위」
  const edgeText = (label: string) => (perspective === "both" ? label : perspectiveLabel(label, ourName, oppName));
  const pick = (p: Perspective, f: FocusId) => {
    setBasic(false);
    setPerspective(p);
    setFocus(focusList(p).some((x) => x.id === f) ? f : "overall");
    setNotice("");
  };
  return (
    <div className="versus-analysis">
      <h4>
        경기 분석{" "}
        <small>{showAi ? `AI 분석 · ${perspectiveName(perspective)} · ${focusLabel(focus)} · ${optionsOn ? `${optionsSummary(opts)} · ` : ""}${input.reference ? `${input.reference.year} 기록 참고 · ` : ""}${modelLabel(entry.model)} · ${shortDate(entry.at)} 생성 · 참고용` : showBasic ? `${input.reference ? `${input.reference.year} 개인 기록 참고 · ` : ""}기록 기반 자동 분석 · 참고용` : `${perspectiveName(perspective)} · ${focusLabel(focus)} · ${referenceUnavailable ? "자료 부족" : cache.ready && cache.key === key ? "분석 전" : "저장 기록 확인 중…"}`}</small>
      </h4>
      {showAi && entry.edge && (
        <p className="versus-analysis__edge">
          <span><b>기록 기반 예상 우위</b> {edgeText(entry.edge.base)}</span>
          {entry.edge.adjusted && <span><b>AI 판단</b> {edgeText(entry.edge.adjusted)}</span>}
        </p>
      )}
      <ul>
        {showAi
          ? entry.lines.map((text, i) => <li key={i} className={i === 0 ? "is-head" : undefined}>{text}</li>)
          : showBasic ? ruleLines.map((line) => (
              <li key={line.id} className={line.cat === "overall" ? "is-head" : line.cat === "sample" ? "is-note" : undefined}>
                {line.text}
              </li>
            )) : <li className="is-note">{referenceUnavailable ? `전년도 개인 시즌 합계만으로 현재 엔트리의 ${focusLabel(focus)}을(를) 판단할 수 없어 분석을 요청하지 않습니다. 다른 방향을 선택해 주세요.` : loading ? "선택한 항목을 분석하고 있습니다." : "이 매치업의 선택한 항목은 분석 전입니다. 버튼을 누르면 AI 분석을 생성해 이 기기에 저장합니다."}</li>}
      </ul>
      {notice && <p className="versus-analysis__notice" role="status">{notice}</p>}
      {/* 키를 넣은 사용자에게만 — 관점과 분석 방향을 고르고 버튼으로 요청(고르기만 해서는 요청하지 않아 무료 횟수를 아낀다) */}
      {hasKey && (
        <div className="versus-analysis__focus" role="radiogroup" aria-label="분석 관점">
          <button type="button" role="radio" aria-checked={basic} disabled={loading}
            className={`chip versus-analysis__basic ${basic ? "chip--active" : ""}`} onClick={() => setBasic(true)}>
            기본 분석
          </button>
          {PERSPECTIVES.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={!basic && perspective === p.id} disabled={loading}
              className={`chip ${!basic && perspective === p.id ? "chip--active" : ""}`} onClick={() => pick(p.id, focus)}>
              {p.label}<small className="versus-analysis__pending">{p.id === "away" ? input.aName : p.id === "home" ? input.bName : "중립"}</small>
            </button>
          ))}
        </div>
      )}
      {hasKey && (
        <div className="versus-analysis__focus versus-analysis__focus--dir" role="radiogroup" aria-label={`${perspectiveName(perspective)} 분석 방향`}>
          {focusList(perspective).map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={!basic && focus === f.id} disabled={loading}
              className={`chip ${!basic && focus === f.id ? "chip--active" : ""}`} onClick={() => pick(perspective, f.id)}>
              {f.label}{cache.ready && cache.key === key && !cache.entries[slotId(perspective, f.id)] && <small className="versus-analysis__pending">{input.reference && REFERENCE_UNAVAILABLE.has(f.id) ? "자료 부족" : "분석 전"}</small>}
            </button>
          ))}
        </div>
      )}
      {hasKey && !basic && options && (
        <AiOptionsBox opts={opts} onChange={changeOpts} support={options} aName={input.aName} bName={input.bName} disabled={loading} />
      )}
      {hasKey && !basic && (
        <div className="versus-analysis__actions">
          <button type="button" className="chip versus-analysis__btn" onClick={request} disabled={loading || !cache.ready || cache.key !== key || referenceUnavailable}>
            {loading ? "AI가 분석하는 중… (10초 안팎)" : entry ? "다시 분석" : "AI로 분석하기"}
          </button>
          <span className="versus-analysis__model">{currentModel(settings).label}</span>
        </div>
      )}
      <AiStorageWarning />
    </div>
  );
}
