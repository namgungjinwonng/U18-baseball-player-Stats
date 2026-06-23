// 단일 경기 record_detail → GameBoxScore 파싱. discover.ts 결과로 구현.
//
// 산출물은 data/games/{id}.json 으로 저장되며, 이후 accumulate 가 이를
// 진실의 원천으로 삼아 선수 집계/상대전적을 파생한다.
import type { GameBoxScore } from "./types.js";
import type { GameRef } from "./fetchGames.js";

export async function parseRecordDetail(_ref: GameRef): Promise<GameBoxScore> {
  // TODO(discover): record_detail JSON(또는 렌더된 DOM)에서 아래를 추출.
  //  - batters[]: 타석 결과 → ab/h/2b/3b/hr/rbi/r/bb/so/sb
  //  - pitchers[]: outs(아웃카운트), h/r/er/bb/so, 승패세
  //  - matchups[]: 타자×투수 대결(타석별 결과 누적)
  // 타자×투수 대결은 record_detail 의 이닝별 타석 로그에서 (타자, 당시 투수)를
  // 짝지어 집계한다.
  throw new Error(
    "parseRecordDetail 미구현 — `npm run discover` 로 record_detail 구조를 먼저 확정하세요."
  );
}
