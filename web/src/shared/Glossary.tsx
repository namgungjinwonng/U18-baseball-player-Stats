// 세이버메트릭스 지표 설명(부록) — 데스크탑/모바일 공용.
interface Term {
  abbr: string;
  name: string;
  formula: string;
  desc: string;
}

const BATTING: Term[] = [
  { abbr: "AVG", name: "타율", formula: "안타 ÷ 타수", desc: "타수당 안타 비율. 가장 기본적인 타격 지표." },
  { abbr: "OBP", name: "출루율", formula: "(안타+볼넷+사구) ÷ (타수+볼넷+사구)", desc: "타자가 아웃되지 않고 출루하는 비율." },
  { abbr: "SLG", name: "장타율", formula: "총루타 ÷ 타수", desc: "타수당 루타수. 장타 생산력을 나타냄(단타1·2루타2·3루타3·홈런4)." },
  { abbr: "OPS", name: "출루율+장타율", formula: "OBP + SLG", desc: "출루와 장타를 합친 종합 공격 지표. 직관적이라 가장 널리 쓰임." },
  { abbr: "ISO", name: "순수장타율", formula: "SLG − AVG", desc: "단타를 제외한 순수 장타 생산력. 높을수록 거포 성향." },
  { abbr: "BABIP", name: "인플레이타구 타율", formula: "(안타−홈런) ÷ (타수−삼진−홈런+희비)", desc: "그라운드에 들어간 타구의 안타 비율. 운·수비 영향을 가늠." },
  { abbr: "BB%", name: "볼넷 비율", formula: "볼넷 ÷ 타석", desc: "타석당 볼넷 비율. 선구안·인내심을 나타냄." },
  { abbr: "K%", name: "삼진 비율", formula: "삼진 ÷ 타석", desc: "타석당 삼진 비율. 낮을수록 컨택 능력이 좋음." },
  { abbr: "BB/K", name: "볼넷/삼진", formula: "볼넷 ÷ 삼진", desc: "삼진 대비 볼넷 비율. 1 이상이면 매우 우수한 선구안." },
];

const PITCHING: Term[] = [
  { abbr: "ERA", name: "평균자책점", formula: "자책점 × 9 ÷ 이닝", desc: "9이닝당 내준 자책점. 투수의 대표 지표." },
  { abbr: "WHIP", name: "이닝당 출루허용", formula: "(피안타+볼넷) ÷ 이닝", desc: "이닝당 출루 허용 수. 낮을수록 주자를 적게 내보냄." },
  { abbr: "FIP", name: "수비무관 평균자책", formula: "(13·피홈런+3·볼넷−2·탈삼진) ÷ 이닝 + 상수", desc: "수비 영향을 배제하고 투수 본연의 능력(삼진·볼넷·피홈런)만으로 본 ERA 추정. 상수는 리그 보정값(근사 3.10)." },
  { abbr: "K/9", name: "9이닝당 탈삼진", formula: "탈삼진 × 9 ÷ 이닝", desc: "9이닝당 잡아내는 삼진 수. 구위·탈삼진 능력." },
  { abbr: "BB/9", name: "9이닝당 볼넷", formula: "볼넷 × 9 ÷ 이닝", desc: "9이닝당 내주는 볼넷. 낮을수록 제구가 안정적." },
  { abbr: "H/9", name: "9이닝당 피안타", formula: "피안타 × 9 ÷ 이닝", desc: "9이닝당 허용 안타 수." },
  { abbr: "K/BB", name: "탈삼진/볼넷", formula: "탈삼진 ÷ 볼넷", desc: "볼넷 대비 삼진 비율. 높을수록 제구·구위가 모두 우수." },
];

function Section({ title, terms }: { title: string; terms: Term[] }) {
  return (
    <section style={{ marginBottom: "var(--space-section)" }}>
      <h2 className="heading-lg" style={{ marginBottom: "var(--space-md)" }}>{title}</h2>
      {terms.map((t) => (
        <div className="glossary-row" key={t.abbr}>
          <div className="glossary-head">
            <span className="glossary-abbr">{t.abbr}</span>
            <span className="glossary-name">{t.name}</span>
          </div>
          <div className="glossary-formula">{t.formula}</div>
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
