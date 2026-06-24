// 데이터 스키마 — scraper/src/types.ts 와 동일하게 유지할 것.

export interface PlayerIndexEntry {
  id: string;
  name: string;
  team: string;
  position: string; // 타자/투수/내야수 등
  number?: string; // 등번호
  grade?: string; // 1/2/3 학년
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
}

export interface GameLogEntry {
  gameId: string;
  date: string; // YYYY-MM-DD
  opponent: string;
  line: string; // 요약 (예: "3타수 2안타 1타점")
}

export interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
  number?: string; // 등번호
  grade?: string; // 1/2/3 학년
  personNo?: string; // KBSA 공식 선수 ID
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
  hr: number;
  bb: number;
  so: number;
  avg: number;
}

export interface Meta {
  season: number;
  lastUpdated: string; // ISO
  gameCount: number;
  source: string;
}
