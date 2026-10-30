// 알리는 글 — 서비스 성격·데이터 출처·기록 정확성·저작권 고지 (데스크탑/모바일 공용).
import { KBSA_BASE } from "./kbsa";
import { Ico } from "./navIcons";

// KBSA 외 자료 — 출처 표시가 이용 조건인 자료가 있어 이름·용도·조건을 함께 밝힌다.
const SOURCES = [
  { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright", use: "야구장 위치·이름, 지도 배경", license: "© OpenStreetMap 기여자 · ODbL(출처 표시·동일 조건 공유)" },
  { name: "문화체육관광부 전국 공공체육시설 현황(2025)", url: "https://www.mcst.go.kr/site/s_policy/dept/deptView.jsp?pDataCD=0417000000&pSeq=2107&pType=07", use: "공공 야구장 이름·주소", license: "공공누리 제2유형 · 출처 표시, 상업적 이용 금지" },
  { name: "교육부·한국교육시설안전원 전국초중등학교위치표준데이터", url: "https://www.data.go.kr/data/15021148/standard.do", use: "학교 주소·위치 확인", license: "공공데이터포털 이용정책에 따름" },
  { name: "KBO 구단 안내", url: "https://www.koreabaseball.com/Kbo/League/TeamInfo.aspx", use: "프로야구장 주소", license: "공개된 주소 정보만 인용" },
  { name: "지자체·시설 운영기관 공개 안내", url: "", use: "개별 구장 주소·위치 확인", license: "각 기관 공개 자료의 사실 정보만 인용" },
  { name: "Open-Meteo", url: "https://open-meteo.com/", use: "지난 경기 날씨와 경기 예보", license: "CC BY 4.0 · 비상업적 무료 이용 조건" },
];

export function Notice({ wrapClass }: { wrapClass: string }) {
  return (
    <div className={wrapClass}>
      <div className="section-head">
        <h2 className="heading-xl"><Ico name="notice" variant="title" />알리는 글</h2>
      </div>

      <div className="notice">
        <section>
          <h3>서비스 성격</h3>
          <p>
            본 앱은 고등학교 야구 기록을 보기 쉽게 정리한 비상업적 개인 프로젝트입니다. 광고·결제·회원가입
            없이 무료로 제공되며 어떤 수익도 발생하지 않습니다.
          </p>
        </section>

        <section>
          <h3>데이터 출처</h3>
          <p>
            모든 선수·경기·기록 정보는 대한야구소프트볼협회(KBSA){" "}
            <a href={KBSA_BASE} target="_blank" rel="noreferrer">
              공식 사이트
            </a>
            에서 가져옵니다. 데이터에 대한 모든 권리는 협회에 있으며, 본 앱은 이를 가공해 보여주는 역할만
            합니다.
          </p>
          <p className="notice__meta">하루 1회 이상 자동 갱신</p>
        </section>

        <section>
          <h3>그 밖의 자료 출처와 이용 조건</h3>
          <p>
            야구장 현황·경기 조건(날씨) 분석에는 KBSA 외에 아래 공개 자료를 함께 씁니다. 각 자료의 권리는
            제공기관과 기여자에게 있으며, 본 앱은 각 이용 조건이 정한 출처 표시와 비상업적 이용 범위 안에서만
            사용합니다.
          </p>
          <ul>
            {SOURCES.map((s) => (
              <li key={s.name}>
                {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : s.name} — {s.use}
                <span className="notice__license">{s.license}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>자료 수집 방식</h3>
          <p>
            누구나 볼 수 있게 공개된 페이지와 공개 자료만 사용합니다. 로그인이 필요하거나 접근이 제한된 곳에는
            접속하지 않으며, 접근 제한을 우회하지 않습니다. 제공기관 서버에 부담을 주지 않도록 요청 간격을
            두고, 한 번 받은 결과는 저장해 같은 요청을 반복하지 않습니다.
          </p>
          <p>
            본 앱은 이용자의 개인정보를 수집하지 않습니다. 야구장 자료에는 시설과 팀 등록지의 공개 주소만
            담고, 팀 등록지는 개인 주거지일 수 있어 도로명 주소까지만 싣고 동·호수는 싣지 않습니다.
          </p>
        </section>

        <section>
          <h3>기록은 참고용</h3>
          <p>
            수집 과정에서 일부 기록이 누락되거나 지연될 수 있습니다. 본 앱의 수치는 참고용으로만 사용하시고,
            공식 기록은 선수 상세 화면의 KBSA 버튼을 통해 협회 페이지에서 확인해 주세요.
          </p>
        </section>

        <section>
          <h3>저작권과 문의</h3>
          <p>
            본 앱의 데이터를 상업적으로 이용하거나 무단으로 수집·재배포하는 행위를 금합니다. 본 앱은 정보의
            정확성을 보증하지 않으며, 이용으로 발생한 결과에 대해 책임을 지지 않습니다. 협회와 각 자료
            제공기관 등 권리자의 요청이 있을 경우 해당 내용을 즉시 수정·삭제하거나 서비스를 중단합니다.
          </p>
        </section>
      </div>
    </div>
  );
}
