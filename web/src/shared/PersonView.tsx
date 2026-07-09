// 무기록 선수 폴백 상세 (데스크탑/모바일 공용) — 경기 기록이 없는 등록 선수용.
// 선수현황(teams.json) 항목 + 프로필(profiles/{personNo}.json)로 헤더/출신학교/수상내역을
// 렌더하고, KBSA 선수 페이지 링크 버튼을 제공한다. (기록 보유 선수는 /player/:id 로 감)
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { usePlayerProfile, useTeams } from "./data";
import { KbsaLink } from "./KbsaLink";

export function PersonView({ wrapClass }: { wrapClass: string }) {
  const { personNo } = useParams();
  const { data: teams, loading: teamsLoading } = useTeams();
  const { data: profile, loading: profileLoading } = usePlayerProfile(personNo);

  // 선수현황에서 해당 personNo 항목 탐색 (소속/등번호/포지션/학년/신장·체중/투타)
  const entry = useMemo(() => {
    for (const t of teams ?? []) {
      const p = t.players.find((p) => p.person_no === personNo);
      if (p) return p;
    }
    return null;
  }, [teams, personNo]);

  if (!personNo) return <div className={wrapClass}><div className="state">선수를 찾을 수 없습니다.</div></div>;
  if (teamsLoading || profileLoading) {
    return <div className={wrapClass}><div className="state">불러오는 중…</div></div>;
  }
  if (!entry && !profile) {
    return <div className={wrapClass}><div className="state">선수를 찾을 수 없습니다.</div></div>;
  }

  const name = entry?.name ?? profile?.name ?? "";
  const schools = profile?.schools ?? [];
  const awards = profile?.awards ?? [];

  return (
    <div className={wrapClass}>
      <div className="player-head">
        <h1 className="heading-xl" style={{ marginBottom: 0 }}>{name}</h1>
        <div className="player-meta-line">
          {entry?.team && <span>{entry.team}</span>}
          {entry?.position && <span>{entry.position}</span>}
          {entry?.grade && <span>{entry.grade}학년</span>}
          {entry?.number && <span>{entry.number}번</span>}
          {entry?.throw_bat && <span>{entry.throw_bat}</span>}
          {profile?.birth && <span>{profile.birth}</span>}
          {entry?.height_weight ? (
            <span>{entry.height_weight}</span>
          ) : (
            profile?.height && profile?.weight && <span>{profile.height}cm·{profile.weight}kg</span>
          )}
        </div>
        <KbsaLink personNo={personNo} />
      </div>

      <div className="state muted" style={{ textAlign: "left", padding: "12px 0" }}>
        이번 시즌 경기 기록이 없는 선수입니다.
      </div>

      <section className="player-section">
        <h3>출신학교</h3>
        {schools.length === 0 ? (
          <div className="state muted">출신학교 정보가 없습니다.</div>
        ) : (
          <div className="stat-table__scroll">
            <table className="stat-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>연도</th>
                  <th style={{ textAlign: "left" }}>지역</th>
                  <th style={{ textAlign: "left" }}>소속</th>
                  <th style={{ textAlign: "left" }}>포지션</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s, i) => (
                  <tr key={`${s.year}-${s.school}-${i}`}>
                    <td style={{ textAlign: "left" }}>{s.year}</td>
                    <td style={{ textAlign: "left" }} className="muted">{s.region ?? "-"}</td>
                    <td style={{ textAlign: "left" }}>{s.school}</td>
                    <td style={{ textAlign: "left" }} className="muted">{s.position ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="player-section">
        <h3>수상내역</h3>
        {awards.length === 0 ? (
          <div className="state muted">수상내역이 없습니다.</div>
        ) : (
          <div className="stat-table__scroll">
            <table className="stat-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>연도</th>
                  <th style={{ textAlign: "left" }}>대회명</th>
                  <th style={{ textAlign: "left" }}>수상명</th>
                </tr>
              </thead>
              <tbody>
                {awards.map((a, i) => (
                  <tr key={`${a.year}-${a.award}-${i}`}>
                    <td style={{ textAlign: "left" }}>{a.year}</td>
                    <td style={{ textAlign: "left" }}>{a.tournament}</td>
                    <td style={{ textAlign: "left" }}><b>{a.award}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
