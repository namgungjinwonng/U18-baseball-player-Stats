// 알리는 글 — 서비스 성격·데이터 출처·기록 정확성·저작권 고지 (데스크탑/모바일 공용).
import { KBSA_BASE } from "./kbsa";
import { Ico } from "./navIcons";

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
            정확성을 보증하지 않으며, 이용으로 발생한 결과에 대해 책임을 지지 않습니다. 권리자의 요청이 있을
            경우 해당 내용을 즉시 수정하거나 서비스를 중단합니다.
          </p>
        </section>
      </div>
    </div>
  );
}
