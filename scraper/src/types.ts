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
  hbp: number; // 사구(몸에 맞는 공)
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
  b2: number;
  b3: number;
  hr: number;
  bb: number;
  hbp: number;
  so: number;
}

export interface GameBoxScore {
  id: string; // 경기 고유 ID (멱등 키)
  date: string; // YYYY-MM-DD
  season: number;
  home: string;
  away: string;
  score: { home: number; away: number };
  title?: string; // 시합/대회명 (예: "주말리그 후반기(서울권B)", "황금사자기") — record_detail.dl.game_name
  batters: BatterLine[];
  pitchers: PitcherLine[];
  matchups: MatchupLine[];
}

// --- 집계 결과(파생) ---
export interface BattingStats {
  g: number; pa: number; ab: number; r: number; h: number;
  b2: number; b3: number; hr: number; rbi: number; bb: number;
  hbp: number; so: number; sb: number; avg: number; obp: number; slg: number;
  // 공식기록에서만 채워지는 항목(선택)
  sh?: number; sf?: number; ibb?: number; e?: number;
}
export interface PitchingStats {
  g: number; w: number; l: number; sv: number; ip: number;
  h: number; r: number; er: number; bb: number; so: number;
  era: number; whip: number;
  // 공식기록에서만 채워지는 항목(선택)
  hr?: number; bf?: number; np?: number;
}
export interface GameLogEntry {
  gameId: string; date: string; opponent: string; line: string;
  team?: string; // 그 경기 당시 소속팀(박스스코어 원문) — 이적 선수 병합 후 팀별 경기수 계산용
  title?: string; // 시합/대회명 (이 경기가 속한 대회)
  // 선수 상세에서 시합 필터링 시 재집계용 per-game raw stats (있으면).
  bStat?: { ab: number; h: number; b2: number; b3: number; hr: number; rbi: number; r: number; bb: number; hbp: number; so: number; sb: number };
  pStat?: { outs: number; h: number; r: number; er: number; bb: number; so: number; w: number; l: number; sv: number };
}
export interface Player {
  id: string; name: string; team: string; position: string;
  number?: string; grade?: string; personNo?: string; region?: string;
  bats?: string; throws?: string; season: number;
  batting?: BattingStats; pitching?: PitchingStats; gameLog: GameLogEntry[];
}
export interface PlayerIndexEntry {
  id: string; name: string; team: string; position: string;
  number?: string; grade?: string; region?: string;
  bats?: string; throws?: string; // 상대전적 보조 라벨용
}
export interface Matchup {
  batterId: string; batterName: string; pitcherId: string; pitcherName: string;
  pa: number; ab: number; h: number; b2: number; b3: number; hr: number;
  bb: number; hbp: number; so: number; avg: number;
}
export interface Meta {
  season: number; lastUpdated: string; gameCount: number; source: string;
  teamGames?: Record<string, number>; // 팀별 경기수(규정타석/이닝 기준)
}

// --- 선수 프로필 (KBSA /info/player/player_view 수집) ---
export interface SchoolHistoryEntry {
  year: number;    // 연도
  region?: string; // 지역
  school: string;  // 소속(초·중·고 학교명)
  position?: string;
}
export interface AwardEntry {
  year: number;       // 수상 연도
  tournament: string; // 대회명
  award: string;      // 수상명
}
export interface PlayerProfile {
  personNo: string;    // KBSA 선수 고유번호
  name?: string;
  number?: string;     // 백넘버
  birth?: string;      // 생년월일 (예: 2008.01.19)
  height?: string;     // 키(cm)
  weight?: string;     // 몸무게(kg)
  position?: string;
  bats?: string; throws?: string;
  schools: SchoolHistoryEntry[]; // 출신학교(연도별, 최신순)
  awards: AwardEntry[];          // 수상내역
  updatedAt: string;   // ISO
}

// --- 리그 평균 (데이터 갱신 시점마다 리그 합산으로 재계산 — 세이버 용어 모달용) ---
export interface LeagueRates {
  // 타격(리그 합산 기반)
  avg: number; obp: number; slg: number; ops: number; iso: number; babip: number;
  bbPct: number; kPct: number; bbK: number; woba: number;
  rPerPa: number; // 타석당 득점 (wRC+ 기준값)
  // 투구(리그 합산 기반)
  era: number; whip: number; fip?: number; // fip 는 피홈런 데이터(공식기록) 있을 때만
  k9: number; bb9: number; h9: number; kbb: number;
  pa: number; outs: number; // 표본 크기(참고)
}
export interface LeagueAverages {
  season: number;
  updatedAt: string; // ISO — 데이터 갱신 시점
  overall: LeagueRates; // 시즌 전체
  grades?: Record<string, LeagueRates>; // 학년("1"/"2"/"3") → 학년별 (시즌 기준)
  tournaments: Record<string, { title: string; rates: LeagueRates }>; // slug → 시합별
}
