// API 키 발급 방법 팝업 — 고른 AI별 발급 순서와 주의점. 유료는 앱 구독과 API 요금이 별개임을 강조한다.
import { useEffect } from "react";
import { useModalHistory } from "../useModalHistory";
import type { ProviderId } from "./config";

interface Guide {
  title: string;
  tag: string;
  warn?: string; // 유료 — 구독과 별개라는 강조 문구
  steps: string[];
  notes: string[];
  url: string;
  urlLabel: string;
}

const GUIDES: Record<ProviderId, Guide> = {
  "gemini-free": {
    title: "Gemini API 키 발급",
    tag: "무료 · 결제 등록 없이 사용",
    steps: [
      "Google AI Studio에 Google 계정으로 로그인합니다.",
      "왼쪽 메뉴의 「Get API key」(API 키)를 누릅니다.",
      "「Create API key」(API 키 만들기)를 누르고 프로젝트를 고르거나 새로 만듭니다.",
      "만들어진 키(AIza…로 시작)를 복사해 이 화면의 키 입력란에 붙여 넣고 저장합니다.",
    ],
    notes: [
      "결제 정보를 연결하지 않은 프로젝트의 키는 하루 무료 사용량 안에서만 동작하고 요금이 청구되지 않습니다.",
      "무료 등급에서는 보낸 내용(공개된 경기 기록)이 Google 제품 개선에 쓰일 수 있습니다.",
      "Google Cloud 콘솔의 사용자 인증 정보에서 키를 이 웹사이트로 제한해 두면 더 안전합니다.",
    ],
    url: "https://aistudio.google.com/apikey",
    urlLabel: "Google AI Studio 열기",
  },
  "gemini-paid": {
    title: "Gemini 유료 키 발급",
    tag: "유료 · 사용한 만큼 청구",
    warn: "Google AI Pro 같은 Gemini 앱 유료 구독과는 별개입니다. 구독 중이어도 API 사용료는 Google Cloud 결제 계정으로 따로 청구됩니다.",
    steps: [
      "Google AI Studio에 로그인해 API 키를 만듭니다(무료 키와 같은 방법).",
      "AI Studio에서 결제 설정(Set up billing)을 눌러 그 키의 Google Cloud 프로젝트에 결제 계정을 연결합니다.",
      "결제가 연결되면 같은 키가 유료 등급으로 바뀝니다.",
      "키를 이 화면에 저장하면 그 키로 쓸 수 있는 모델 목록을 불러옵니다.",
    ],
    notes: [
      "Google Cloud 콘솔에서 예산과 알림을 설정해 두세요.",
      "유료 등급에서는 보낸 내용이 Google 제품 개선에 쓰이지 않습니다.",
    ],
    url: "https://aistudio.google.com/apikey",
    urlLabel: "Google AI Studio 열기",
  },
  claude: {
    title: "Claude API 키 발급",
    tag: "유료 · 크레딧 선충전",
    warn: "Claude Pro·Max 구독과는 별개입니다. claude.ai 유료 구독이 있어도 API는 개발자 콘솔에서 크레딧을 따로 결제해야 합니다.",
    steps: [
      "Anthropic 개발자 콘솔에 가입하거나 로그인합니다.",
      "Settings → Billing에서 결제 수단을 등록하고 크레딧을 충전합니다.",
      "Settings → API Keys에서 「Create Key」로 키를 만듭니다.",
      "키(sk-ant-…로 시작)는 만들 때 한 번만 보이니 바로 복사해 이 화면에 저장합니다.",
    ],
    notes: [
      "크레딧이 떨어지면 AI 분석이 멈추고 저장된 분석이나 기록 기반 분석이 보입니다.",
      "이 앱 전용 키를 만들고 월 사용 한도를 걸어 두세요.",
    ],
    url: "https://console.anthropic.com/settings/keys",
    urlLabel: "Anthropic 콘솔 열기",
  },
  openai: {
    title: "OpenAI API 키 발급",
    tag: "유료 · 크레딧 선충전",
    warn: "ChatGPT Plus·Pro 구독과는 별개입니다. ChatGPT 유료 구독이 있어도 API 사용료는 OpenAI Platform에서 따로 결제해야 합니다.",
    steps: [
      "OpenAI Platform에 로그인합니다.",
      "Settings → Billing에서 결제 수단을 등록하고 크레딧을 충전합니다.",
      "API keys에서 「Create new secret key」로 키를 만듭니다.",
      "키(sk-…로 시작)는 만들 때 한 번만 보이니 바로 복사해 이 화면에 저장합니다.",
    ],
    notes: [
      "크레딧이 떨어지면 AI 분석이 멈추고 저장된 분석이나 기록 기반 분석이 보입니다.",
      "프로젝트별 사용 한도를 걸어 두세요.",
    ],
    url: "https://platform.openai.com/api-keys",
    urlLabel: "OpenAI Platform 열기",
  },
};

export function KeyGuideModal({ provider, onClose }: { provider: ProviderId; onClose: () => void }) {
  const g = GUIDES[provider];
  // 뒤로가기 = 닫기 (UI 닫기는 close로 히스토리 엔트리를 지운다)
  const close = useModalHistory(true, onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);
  return (
    <div className="modal-backdrop" onClick={close} role="dialog" aria-modal="true" aria-label={g.title}>
      <div className="modal-card key-guide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{g.title}</h3>
          <button className="icon-btn" onClick={close} aria-label="닫기">✕</button>
        </div>
        <p className={`key-guide__tag ${g.warn ? "is-paid" : ""}`}>{g.tag}</p>
        {g.warn && <p className="key-guide__warn"><strong>API 비용은 별도 유료</strong>{g.warn}</p>}
        <ol className="key-guide__steps">
          {g.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <ul className="key-guide__notes">
          {g.notes.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <a className="btn btn--primary btn--sm btn--block" href={g.url} target="_blank" rel="noreferrer">{g.urlLabel}</a>
        <p className="key-guide__foot">메뉴 이름과 위치는 각 회사 화면 개편에 따라 조금 다를 수 있습니다.</p>
      </div>
    </div>
  );
}
