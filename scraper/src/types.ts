// 스크레이퍼 데이터 스키마 — web/src/shared/types.ts 의 집계 결과와 호환되어야 한다.

// --- 경기 원본(박스스코어): 진실의 원천(source of truth) ---
export interface BatterLine {
  playerId: string;
  name: string;
  team: string;
  ab: number;
  h: number;
  b2: number;
  b3: number;
  hr: number;
  rbi: number;
  r: number;
  bb: number;
  so: number;
  sb: number;
}

export interface PitcherLine {
  playerId: string;
  name: string;
  team: string;
  outs: number; // 아웃카운트(이닝 대신 정수로 보관 → 합산 안전)
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  w: number;
  l: number;
  sv: number;
}

export interface MatchupLine {
  batterId: string;
  pitcherId: string;
  ab: number;
  h: number;
  hr: number;
  bb: number;
  so: number;
}

export interface GameBoxScore {
  id: string; // 경기 고유 ID (멱등 키)
  date: string; // YYYY-MM-DD
  season: number;
  home: string;
  away: string;
  score: { home: number; away: number };
  batters: BatterLine[];
  pitchers: PitcherLine[];
  matchups: MatchupLine[];
}

// --- 집계 결과(파생) ---
export interface BattingStats {
  g: number; pa: number; ab: number; r: number; h: number;
  b2: number; b3: number; hr: number; rbi: number; bb: number;
  so: number; sb: number; avg: number; obp: number; slg: number;
}
export interface PitchingStats {
  g: number; w: number; l: number; sv: number; ip: number;
  h: number; r: number; er: number; bb: number; so: number;
  era: number; whip: number;
}
export interface GameLogEntry {
  gameId: string; date: string; opponent: string; line: string;
}
export interface Player {
  id: string; name: string; team: string; position: string;
  bats?: string; throws?: string; season: number;
  batting?: BattingStats; pitching?: PitchingStats; gameLog: GameLogEntry[];
}
export interface PlayerIndexEntry {
  id: string; name: string; team: string; position: string;
}
export interface Matchup {
  batterId: string; batterName: string; pitcherId: string; pitcherName: string;
  pa: number; ab: number; h: number; hr: number; bb: number; so: number; avg: number;
}
export interface Meta {
  season: number; lastUpdated: string; gameCount: number; source: string;
}
