// 세이버메트릭스 지표 설명(부록) — 데스크탑/모바일 공용.
import type { LeagueRates } from "./types";

export interface Term {
  abbr: string;
  name: string;
  formula: string;
  desc: string;
  key?: string; // TERM_MAP 조회 키 (WAR 처럼 타자/투수 별도 항목일 때만 지정, 기본 = abbr)
  statKey?: keyof LeagueRates; // 리그평균 표시용 (averages.json 필드)
  statFmt?: "rate" | "dec2" | "pct" | "dec1"; // 리그평균 표기 형식
  avgNote?: string; // 리그평균 대신/함께 보여줄 안내 (wRC+=100 등)
  avgLabel?: string; // 평균 표의 제목 (기본 "리그 평균 (abbr)" — wRC+/WAR 는 "계산 기준값: 리그 wOBA" 처럼 구분)
}

export const BATTING: Term[] = [
  { abbr: "AVG", name: "타율", formula: "안타 ÷ 타수", desc: "타수당 안타 비율. 가장 기본적인 타격 지표.", statKey: "avg", statFmt: "rate" },
  { abbr: "OBP", name: "출루율", formula: "(안타+볼넷+사구) ÷ (타수+볼넷+사구)", desc: "타자가 아웃되지 않고 출루하는 비율.", statKey: "obp", statFmt: "rate" },
  { abbr: "SLG", name: "장타율", formula: "총루타 ÷ 타수", desc: "타수당 루타수. 장타 생산력을 나타냄(단타1·2루타2·3루타3·홈런4).", statKey: "slg", statFmt: "rate" },
  { abbr: "OPS", name: "출루율+장타율", formula: "OBP + SLG", desc: "출루와 장타를 합친 종합 공격 지표. 직관적이라 가장 널리 쓰임.", statKey: "ops", statFmt: "rate" },
  { abbr: "ISO", name: "순수장타율", formula: "SLG − AVG", desc: "단타를 제외한 순수 장타 생산력. 높을수록 거포 성향.", statKey: "iso", statFmt: "rate" },
  { abbr: "BABIP", name: "인플레이타구 타율", formula: "(안타−홈런) ÷ (타수−삼진−홈런+희비)", desc: "그라운드에 들어간 타구의 안타 비율. 운·수비 영향을 가늠.", statKey: "babip", statFmt: "rate" },
  { abbr: "BB%", name: "볼넷 비율", formula: "볼넷 ÷ 타석", desc: "타석당 볼넷 비율. 선구안·인내심을 나타냄.", statKey: "bbPct", statFmt: "pct" },
  { abbr: "K%", name: "삼진 비율", formula: "삼진 ÷ 타석", desc: "타석당 삼진 비율. 낮을수록 컨택 능력이 좋음.", statKey: "kPct", statFmt: "pct" },
  { abbr: "BB/K", name: "볼넷/삼진", formula: "볼넷 ÷ 삼진", desc: "삼진 대비 볼넷 비율. 1 이상이면 매우 우수한 선구안.", statKey: "bbK", statFmt: "dec2" },
  { abbr: "wOBA", name: "가중 출루율", formula: "(0.69·볼넷 + 0.72·사구 + 0.89·단타 + 1.27·2루타 + 1.62·3루타 + 2.10·홈런) ÷ (타수+볼넷+사구+희비)", desc: "출루 사건별 득점 가치를 가중해 합친 타격 종합 지표. OPS 보다 정밀함. (가중치는 MLB 관례값 근사)", statKey: "woba", statFmt: "rate" },
  {
    abbr: "wRAA", name: "평균 대비 득점 기여",
    formula: "(wOBA − 리그wOBA) ÷ 1.15 × 타석",
    desc: "리그 평균 타자와 비교해 몇 점(런)을 더 만들어냈는지. 0이 리그 평균이며, +10이면 평균 타자보다 10점 더 기여, 음수면 평균 이하. wRC+ 와 타자 WAR 계산의 재료가 되는 지표.",
    avgNote: "wRAA 의 리그 평균은 정의상 항상 0 입니다(평균 타자 = 0점 기여). 값이 없는 게 아니라 '평균과의 차이' 자체를 재는 지표이기 때문입니다. 아래 표는 계산의 기준이 되는 리그 wOBA 값입니다 (wOBA 항목의 리그 평균과 동일).",
    avgLabel: "계산 기준값 — 리그 wOBA",
    statKey: "woba", statFmt: "rate",
  },
  {
    abbr: "wRC+", name: "조정 득점 생산력",
    formula: "( wRAA/타석 + 리그득점/타석 ) ÷ (리그득점/타석) × 100",
    desc: "리그 평균 대비 득점 생산력. 100이 리그 평균, 150이면 평균보다 50% 더 생산적. wRAA(평균 대비 득점 기여)를 타석당 비율로 바꿔 100 기준으로 환산한 지표. 리그 평균은 데이터 갱신 시점마다 재계산됨.",
    avgNote: "wRC+ 의 리그 평균은 정의상 항상 100 입니다. 아래 표는 계산의 기준이 되는 리그 wOBA 값입니다 (wOBA 항목의 리그 평균과 동일).",
    avgLabel: "계산 기준값 — 리그 wOBA",
    statKey: "woba", statFmt: "rate",
  },
  {
    abbr: "WAR", key: "WAR_BAT", name: "대체선수 대비 승수 (타자)",
    formula: "( wRAA + 20런 × 타석/600 ) ÷ 10런",
    desc: "대체 수준 선수 대비 몇 승을 더 만들었는지의 간이 추정치. wRAA(평균 대비 득점 기여)에 대체수준 보정(−20런/600타석)을 더해 10런=1승으로 환산. 타격 기여만 반영(수비·주루 제외).",
    avgNote: "WAR 는 대체선수 대비 누적 승수라 '리그 평균 WAR' 는 표시하지 않습니다(0 승 근처가 대체수준, 규모에 따라 달라짐). 아래 표는 계산의 기준이 되는 리그 wOBA 값입니다.",
    avgLabel: "계산 기준값 — 리그 wOBA",
    statKey: "woba", statFmt: "rate",
  },
];

export const PITCHING: Term[] = [
  { abbr: "ERA", name: "평균자책점", formula: "자책점 × 9 ÷ 이닝", desc: "9이닝당 내준 자책점. 투수의 대표 지표.", statKey: "era", statFmt: "dec2" },
  { abbr: "WHIP", name: "이닝당 출루허용", formula: "(피안타+볼넷) ÷ 이닝", desc: "이닝당 출루 허용 수. 낮을수록 주자를 적게 내보냄.", statKey: "whip", statFmt: "dec2" },
  { abbr: "FIP", name: "수비무관 평균자책", formula: "(13·피홈런+3·볼넷−2·탈삼진) ÷ 이닝 + 상수", desc: "수비 영향을 배제하고 투수 본연의 능력(삼진·볼넷·피홈런)만으로 본 ERA 추정. 상수는 리그 보정값(근사 3.10).", statKey: "fip", statFmt: "dec2" },
  { abbr: "K/9", name: "9이닝당 탈삼진", formula: "탈삼진 × 9 ÷ 이닝", desc: "9이닝당 잡아내는 삼진 수. 구위·탈삼진 능력.", statKey: "k9", statFmt: "dec1" },
  { abbr: "BB/9", name: "9이닝당 볼넷", formula: "볼넷 × 9 ÷ 이닝", desc: "9이닝당 내주는 볼넷. 낮을수록 제구가 안정적.", statKey: "bb9", statFmt: "dec1" },
  { abbr: "H/9", name: "9이닝당 피안타", formula: "피안타 × 9 ÷ 이닝", desc: "9이닝당 허용 안타 수.", statKey: "h9", statFmt: "dec1" },
  { abbr: "K/BB", name: "탈삼진/볼넷", formula: "탈삼진 ÷ 볼넷", desc: "볼넷 대비 삼진 비율. 높을수록 제구·구위가 모두 우수.", statKey: "kbb", statFmt: "dec2" },
  {
    abbr: "WAR", key: "WAR_PIT", name: "대체선수 대비 승수 (투수)",
    formula: "( (리그ERA − ERA) + 0.6 ) × 이닝/9 ÷ 10런",
    desc: "대체 수준 투수 대비 몇 승을 더 만들었는지의 간이 추정치(ERA 기반). 대체수준 +0.6런/9이닝, 10런=1승 관례값 사용. 리그 ERA 는 데이터 갱신 시점마다 재계산됨.",
    avgNote: "WAR 는 대체선수 대비 누적 승수라 '리그 평균 WAR' 는 표시하지 않습니다. 아래 표는 계산의 기준이 되는 리그 ERA 값입니다 (ERA 항목의 리그 평균과 동일).",
    avgLabel: "계산 기준값 — 리그 ERA",
    statKey: "era", statFmt: "dec2",
  },
];

// 키(기본 abbr)→설명 즉시 조회용 맵 (선수 상세 페이지의 클릭형 용어 모달이 참조).
export const TERM_MAP: Record<string, Term> = Object.fromEntries(
  [...BATTING, ...PITCHING].map((t) => [t.key ?? t.abbr, t])
);

function Section({ title, terms }: { title: string; terms: Term[] }) {
  return (
    <section style={{ marginBottom: "var(--space-section)" }}>
      <h2 className="heading-lg" style={{ marginBottom: "var(--space-md)" }}>{title}</h2>
      {terms.map((t) => (
        <div className="glossary-row" key={t.abbr}>
          <div className="glossary-line1">
            <span className="glossary-abbr">{t.abbr}</span>
            <span className="glossary-name">{t.name}</span>
            <span className="glossary-formula">{t.formula}</span>
          </div>
          <div className="glossary-desc">{t.desc}</div>
        </div>
      ))}
    </section>
  );
}

export function Glossary() {
  return (
    <>
      <h1 className="heading-xl" style={{ marginBottom: "var(--space-xs)" }}>지표 설명 (부록)</h1>
      <p className="caption" style={{ marginBottom: "var(--space-xl)" }}>
        선수 상세에 표시되는 세이버메트릭스 지표의 정의와 계산식입니다. (MLB 주요 지표 기준)
      </p>
      <Section title="타격 지표" terms={BATTING} />
      <Section title="투구 지표" terms={PITCHING} />
    </>
  );
}
