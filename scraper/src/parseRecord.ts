// 단일 경기 record_detail → GameBoxScore 파싱.
// 실제 구현은 koreaBaseball.fetchRecordDetail 에 있다(서버 렌더 HTML 파싱).
//
// 산출물은 data/games/{id}.json 으로 저장되며, accumulate 가 이를 진실의 원천으로
// 삼아 선수 집계/상대전적을 파생한다.
import type { GameBoxScore } from "./types.js";
import { fetchRecordDetail, type GameRef } from "./koreaBaseball.js";

export async function parseRecordDetail(ref: GameRef): Promise<GameBoxScore> {
  return fetchRecordDetail(ref);
}
