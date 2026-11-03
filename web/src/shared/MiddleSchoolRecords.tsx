// 선수 상세의 중학교 기록 영역 — KBSA 기록지를 판독해 검증된 경기만 보여 주는 로컬 시범 화면
import { useMiddleSchoolRecords } from "./data";

const avg = (h: number, ab: number) => (ab ? (h / ab).toFixed(3).replace(/^0/, "") : "-");
const left = { textAlign: "left" } as const;

export function MiddleSchoolRecords({ personNo }: { personNo: string | undefined }) {
  const { data } = useMiddleSchoolRecords();
  const rec = personNo ? data?.players[personNo] : undefined;
  if (!rec || (!rec.bat.length && !rec.pit.length)) return null;
  const pa = rec.bat.reduce((n, g) => n + g.pa, 0);
  const ab = rec.bat.reduce((n, g) => n + g.ab, 0);
  const h = rec.bat.reduce((n, g) => n + g.h, 0);

  return (
    <section className="player-section">
      <h3>중학교 기록</h3>
      <p className="ms-note">KBSA 기록지를 판독한 비공식 자료입니다. 확인된 일부 경기만 있어 시즌 전체 기록이 아닙니다.</p>
      {!!rec.bat.length && (
        <>
          <p className="ms-sum">타격 {rec.bat.length}경기 · {pa}타석 {ab}타수 {h}안타 · 타율 {avg(h, ab)}</p>
          <div className="stat-table__scroll">
            <table className="stat-table ms-table">
              <thead><tr><th style={left}>경기</th><th>타석</th><th>타수</th><th>안타</th></tr></thead>
              <tbody>
                {rec.bat.map((g) => (
                  <tr key={g.game}>
                    <td style={left}>{g.school} vs {g.opp}<div className="ms-league">{g.date} · {g.league}</div></td>
                    <td>{g.pa}</td><td>{g.ab}</td><td>{g.h}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!!rec.pit.length && (
        <>
          <p className="ms-sum">투구 {rec.pit.length}경기</p>
          <div className="stat-table__scroll">
            <table className="stat-table ms-table">
              <thead><tr><th style={left}>경기</th><th>타자</th><th>피안타</th><th>삼진</th><th>실점</th><th>자책</th></tr></thead>
              <tbody>
                {rec.pit.map((g) => (
                  <tr key={g.game}>
                    <td style={left}>{g.school} vs {g.opp}<div className="ms-league">{g.date} · {g.league}</div></td>
                    <td>{g.bf}</td><td>{g.h}</td><td>{g.so}</td><td>{g.r}</td><td>{g.er}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
