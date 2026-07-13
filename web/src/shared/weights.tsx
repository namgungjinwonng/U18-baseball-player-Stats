// 상대 가중치(strength.json) 적용 토글 + 방법 설명 모달 — 리더보드/랭킹 공용.
// 모달은 토글을 켤 때 1회 노출하되 "하루 동안 보지 않기" 선택 시 localStorage 에
// 오늘 날짜를 저장해 자정(날짜 변경) 전까지 새로고침해도 다시 뜨지 않는다.
import { useEffect, useState } from "react";
import { useStrength } from "./data";
import { useModalHistory } from "./useModalHistory";
import type { PlayerOppIdx } from "./types";
import type { RecordFilter } from "./filters";

// 현재 필터 스코프(시합 선택 시 그 시합, 아니면 시즌)의 선수별 지수 맵. 데이터 없으면 null.
export function useStrengthMap(filter: RecordFilter): Record<string, PlayerOppIdx> | null {
  const { data: strength } = useStrength();
  if (!strength) return null;
  if (filter.tournament) return strength.tournaments[filter.tournament] ?? null;
  return strength.players;
}

const HIDE_KEY = "weightInfoHideDate"; // 값 = "하루 보지 않기"를 누른 로컬 날짜(YYYY-MM-DD)

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isModalHiddenToday(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === todayLocal();
  } catch {
    return false;
  }
}
function hideModalForToday() {
  try {
    localStorage.setItem(HIDE_KEY, todayLocal());
  } catch {
    /* storage 불가 환경 — 세션 내 매번 노출 */
  }
}

// 규정 미달 토글과 동일한 형태의 가중치 토글.
// 켜는 순간 설명 모달을 노출(오늘 "보지 않기" 상태면 생략). ⓘ 로 언제든 다시 열람.
export function WeightToggle({
  checked,
  onChange,
  disabled,
  disabledNote,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  disabledNote?: string; // 누적 지표 등 미적용 사유
}) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <label className={`qual-toggle ${disabled ? "qual-toggle--disabled" : ""}`}>
        <input
          type="checkbox"
          checked={checked && !disabled}
          disabled={disabled}
          onChange={(e) => {
            const on = e.target.checked;
            onChange(on);
            if (on && !isModalHiddenToday()) setModalOpen(true);
          }}
        />
        상대 가중치 적용
        {disabled && disabledNote ? <span className="caption-sm"> — {disabledNote}</span> : null}
        <button
          type="button"
          className="wt-info-btn"
          aria-label="가중치 적용 기준 설명"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setModalOpen(true);
          }}
        >
          ⓘ
        </button>
      </label>
      {modalOpen && <WeightInfoModal onClose={() => setModalOpen(false)} />}
    </>
  );
}

export function WeightInfoModal({ onClose }: { onClose: () => void }) {
  const [hideToday, setHideToday] = useState(false);
  // 뒤로가기 = 모달 닫기 — popstate 경로에서도 "오늘 하루 숨김" 저장을 거친다.
  const close = useModalHistory(true, () => {
    if (hideToday) hideModalForToday();
    onClose();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);
  return (
    <div className="modal-backdrop" onClick={close} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            <span className="modal-abbr">가중치</span>
            <span className="modal-name">상대 실력 보정 랭킹</span>
          </h3>
          <button className="icon-btn" onClick={close} aria-label="닫기">
            ✕
          </button>
        </div>
        <p className="modal-desc">
          같은 .300 도 강팀 상대와 약팀 상대는 가치가 다릅니다. 가중치 모드는 각 선수가{" "}
          <b>실제로 상대한 팀들의 실력</b>을 반영해 기록을 보정한 순위를 보여줍니다.
        </p>
        <div className="wt-modal-sec">
          <h4>팀 강도 (1.00 = 리그 평균)</h4>
          <p>
            경기 원본에서 팀별 타격 wOBA(타선 강도)와 피wOBA(투수진 강도)를 계산하고, 상대한
            팀들의 강도로 1회 재조정합니다. 경기 수가 적은 팀은 소속 <b>지역 평균</b> 쪽으로
            축소(shrinkage)하고, 0.85~1.15 를 벗어나는 극단값은 점진 압축해 0.7~1.3 범위로
            제한합니다(팀 간 서열은 유지).
          </p>
        </div>
        <div className="wt-modal-sec">
          <h4>타자 보정</h4>
          <p>
            경기별 타석수로 상대팀 <b>투수진 강도</b>를 가중 평균한 난이도 지수를 구해, 타율·출루율
            ·장타율·OPS·wOBA 는 <b>값 × 지수</b>로, wRAA·wRC+·WAR 는 비교 기준(리그 평균 wOBA)을
            상대 수준으로 치환해 재계산합니다.
          </p>
        </div>
        <div className="wt-modal-sec">
          <h4>투수 보정</h4>
          <p>
            상대타자수로 상대팀 <b>타선 강도</b>를 가중 평균해, 평균자책·WHIP 는 <b>값 ÷ 지수</b>
            (강타선 상대일수록 유리하게)로, WAR 는 기대 실점 기준을 치환해 재계산합니다.
          </p>
        </div>
        <div className="wt-modal-sec">
          <h4>대회 필터 · 누적 지표</h4>
          <p>
            대회 선택 시 <b>그 대회에서 만난 상대</b>만으로 난이도를 계산합니다(팀 강도 자체는 시즌
            전체 기준 — 소표본 왜곡 방지). 홈런·타점·탈삼진 등 <b>누적 지표는 보정하지 않습니다</b>.
          </p>
        </div>
        <p className="caption" style={{ marginTop: 8 }}>
          가중치 순위에서는 보정값과 함께 원값·순위 변동(▲▼)을 나란히 표시해 원 기록과 비교할 수
          있습니다.
        </p>
        <div className="wt-modal-foot">
          <label className="qual-toggle" style={{ margin: 0 }}>
            <input type="checkbox" checked={hideToday} onChange={(e) => setHideToday(e.target.checked)} />
            하루 동안 보지 않기
          </label>
          <button className="btn btn--secondary btn--sm" onClick={close}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
