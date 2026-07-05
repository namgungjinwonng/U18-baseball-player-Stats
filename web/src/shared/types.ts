// 데이터 스키마 — scraper/src/types.ts 와 동일하게 유지할 것.

export interface PlayerIndexEntry {
  id: string;
  name: string;
  team: string;
  position: string; // 타자/투수/내야수 등
  number?: string; // 등번호
  grade?: string; // 1/2/3 학년
  region?: string; // 지역
  bats?: string; // 좌/우/양 — 상대전적 보조 라벨용
  throws?: string; // 좌/우/양
}

export interface BattingStats {
  g: number; // 경기
  pa: number; // 타석
  ab: number; // 타수
  r: number; // 득점
  h: number; // 안타
  b2: number; // 2루타
  b3: number; // 3루타
  hr: number; // 홈런
  rbi: number; // 타점
  bb: number; // 볼넷
  hbp: number; // 사구
  so: number; // 삼진
  sb: number; // 도루
  avg: number; // 타율
  obp: number; // 출루율
  slg: number; // 장타율
  // 공식기록에서만 채워짐(선택)
  sh?: number; // 희생번트
  sf?: number; // 희생플라이
  ibb?: number; // 고의4구
  e?: number; // 실책
}

export interface PitchingStats {
  g: number;
  w: number; // 승
  l: number; // 패
  sv: number; // 세이브
  ip: number; // 이닝 (소수: 6.2 = 6과 2/3)
  h: number;
  r: number;
  er: number; // 자책
  bb: number;
  so: number;
  era: number; // 평균자책
  whip: number;
  // 공식기록에서만 채워짐(선택)
  hr?: number; // 피홈런
  bf?: number; // 상대타자
  np?: number; // 투구수
}

export interface GameLogEntry {
  gameId: string;
  date: string; // YYYY-MM-DD
  opponent: string;
  line: string; // 요약 (예: "3타수 2안타 1타점")
  team?: string; // 그 경기 당시 소속팀(이적 선수 병합 후 구분용)
  title?: string; // 시합/대회명 (예: "황금사자기", "주말리그 전반기(충청권)")
  // 시합 필터 시 재집계용 per-game raw stats (있으면).
  bStat?: { ab: number; h: number; b2: number; b3: number; hr: number; rbi: number; r: number; bb: number; hbp: number; so: number; sb: number };
  pStat?: { outs: number; h: number; r: number; er: number; bb: number; so: number; w: number; l: number; sv: number };
}

export interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
  number?: string; // 등번호
  grade?: string; // 1/2/3 학년
  personNo?: string; // KBSA 공식 선수 ID
  region?: string; // 지역
  bats?: string; // 좌/우/양
  throws?: string;
  season: number;
  batting?: BattingStats;
  pitching?: PitchingStats;
  gameLog?: GameLogEntry[]; // records/players.json 슬림본에는 생략됨
}

export interface Matchup {
  batterId: string;
  batterName: string;
  pitcherId: string;
  pitcherName: string;
  pa: number;
  ab: number;
  h: number;
  b2: number; // 2루타
  b3: number; // 3루타
  hr: number;
  bb: number;
  hbp: number; // 사구
  so: number;
  avg: number;
}

export interface Meta {
  season: number;
  lastUpdated: string; // ISO
  gameCount: number;
  source: string;
  teamGames?: Record<string, number>; // 팀별 경기수(규정타석/이닝 기준)
}

// --- 선수 프로필 (KBSA /info/player/player_view 수집 — data/profiles/{personNo}.json) ---
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

// --- 리그 평균 (데이터 갱신 시점마다 재계산 — data/{year}/averages.json) ---
export interface LeagueRates {
  avg: number; obp: number; slg: number; ops: number; iso: number; babip: number;
  bbPct: number; kPct: number; bbK: number; woba: number;
  rPerPa: number; // 타석당 득점 (wRC+ 기준값)
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

// --- 상대 강도 (scraper/src/strength.ts 산출 — data/{year}/strength.json) ---
export interface TeamStrength { bat: number; pit: number; g: number; region?: string }
// ob = 타자가 상대한 투수진 난이도, op = 투수가 상대한 타선 난이도 (1.0 = 리그 평균)
export interface PlayerOppIdx { ob?: number; op?: number }
export interface StrengthData {
  season: number;
  updatedAt: string;
  params: { shrinkK: number; clamp: [number, number] };
  teams: Record<string, TeamStrength>;
  players: Record<string, PlayerOppIdx>; // 시즌 스코프
  tournaments: Record<string, Record<string, PlayerOppIdx>>; // slug → id → 지수
}
