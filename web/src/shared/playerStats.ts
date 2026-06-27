// gameLog 의 per-game raw stats(bStat/pStat) 를 기간/시합 필터로 묶어 재집계.
// 선수 상세에서 "시합 선택" 시 시즌-전체 stats 대신 사용.
import type { BattingStats, GameLogEntry, PitchingStats } from "./types";

const r3 = (n: number) => Number(n.toFixed(3));
const r2 = (n: number) => Number(n.toFixed(2));
const outsToIp = (outs: number) =>
  Number((Math.floor(outs / 3) + (outs % 3) / 10).toFixed(1));

export function aggregateBatting(entries: GameLogEntry[]): BattingStats | undefined {
  const lines = entries.map((e) => e.bStat).filter(Boolean) as NonNullable<GameLogEntry["bStat"]>[];
  if (lines.length === 0) return undefined;
  let ab = 0, h = 0, b2 = 0, b3 = 0, hr = 0, rbi = 0, r = 0, bb = 0, hbp = 0, so = 0, sb = 0;
  for (const l of lines) {
    ab += l.ab; h += l.h; b2 += l.b2; b3 += l.b3; hr += l.hr; rbi += l.rbi;
    r += l.r; bb += l.bb; hbp += l.hbp; so += l.so; sb += l.sb;
  }
  const singles = h - b2 - b3 - hr;
  const tb = singles + 2 * b2 + 3 * b3 + 4 * hr;
  const obDen = ab + bb + hbp;
  return {
    g: lines.length,
    pa: ab + bb + hbp,
    ab, r, h, b2, b3, hr, rbi, bb, hbp, so, sb,
    avg: ab ? r3(h / ab) : 0,
    obp: obDen ? r3((h + bb + hbp) / obDen) : 0,
    slg: ab ? r3(tb / ab) : 0,
  };
}

export function aggregatePitching(entries: GameLogEntry[]): PitchingStats | undefined {
  const lines = entries.map((e) => e.pStat).filter(Boolean) as NonNullable<GameLogEntry["pStat"]>[];
  if (lines.length === 0) return undefined;
  let outs = 0, h = 0, r = 0, er = 0, bb = 0, so = 0, w = 0, l = 0, sv = 0;
  for (const ln of lines) {
    outs += ln.outs; h += ln.h; r += ln.r; er += ln.er; bb += ln.bb; so += ln.so;
    w += ln.w; l += ln.l; sv += ln.sv;
  }
  return {
    g: lines.length, w, l, sv, ip: outsToIp(outs),
    h, r, er, bb, so,
    era: outs ? r2((er * 27) / outs) : 0,
    whip: outs ? r2(((h + bb) * 3) / outs) : 0,
  };
}

// 시즌 전체 + 시합 필터 통합 헬퍼.
// tournament === "" 이면 시즌 전체(player 의 batting/pitching 그대로).
// tournament 가 있으면 gameLog 를 title 로 필터해 재집계.
export function filterPlayerStats(
  player: { batting?: BattingStats; pitching?: PitchingStats; gameLog?: GameLogEntry[] },
  tournament: string
): { batting?: BattingStats; pitching?: PitchingStats; gameLog: GameLogEntry[] } {
  const log = player.gameLog ?? [];
  if (!tournament) {
    return { batting: player.batting, pitching: player.pitching, gameLog: log };
  }
  const filtered = log.filter((g) => g.title === tournament);
  return {
    batting: aggregateBatting(filtered),
    pitching: aggregatePitching(filtered),
    gameLog: filtered,
  };
}
