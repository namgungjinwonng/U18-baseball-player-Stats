// 정적 JSON "DB" 로더 + 검색 인덱스 (디바이스 무관 공통 로직).
import { useEffect, useState, useSyncExternalStore } from "react";
import type {
  LeagueAverages, Matchup, Meta, Player, PlayerIndexEntry, PlayerProfile,
  ScheduleData, ScheduleGame, StrengthData, TeamRosterEntry,
} from "./types";
import { useYear } from "./year";

const BASE = import.meta.env.BASE_URL; // '/' 또는 '/U18-baseball-player/'

// 데이터 URL 리비전 = meta.json 의 lastUpdated|gameCount (autoSync 서명과 같은 형식).
// 데이터가 그대로면 실행할 때마다 같은 URL이라 브라우저 HTTP 캐시·서비스워커 캐시를 재사용하고,
// 수집으로 데이터가 바뀌면 URL도 바뀌어 새로 받는다. (예전에는 실행마다 start-시각을 붙여
// 매번 전량을 다시 받고 서비스워커 캐시에 실행마다 새 항목이 쌓였다.)
// meta 조회에 실패하면 고유값으로 폴백해 최신성을 우선한다.
let dataRevision = "";
const revisionReady: Promise<void> = fetch(`${BASE}data/meta.json?check=${Date.now()}`, { cache: "no-store" })
  .then((r) => (r.ok ? (r.json() as Promise<{ lastUpdated?: string; gameCount?: number }>) : null))
  .then((m) => {
    if (!dataRevision) {
      dataRevision = m?.lastUpdated ? `${m.lastUpdated}|${m.gameCount ?? ""}` : `start-${Date.now()}`;
    }
  })
  .catch(() => {
    if (!dataRevision) dataRevision = `start-${Date.now()}`;
  });
const revisionListeners = new Set<() => void>();

export function setDataRevision(revision: string) {
  if (revision === dataRevision) return;
  dataRevision = revision;
  revisionListeners.forEach((listener) => listener());
}

function useDataRevision() {
  return useSyncExternalStore(
    (listener) => {
      revisionListeners.add(listener);
      return () => revisionListeners.delete(listener);
    },
    () => dataRevision
  );
}

const jsonCache = new Map<string, Promise<unknown>>();

async function getJSON<T>(rel: string): Promise<T> {
  await revisionReady;
  const join = rel.includes("?") ? "&" : "?";
  const url = `${BASE}data/${rel}${join}v=${encodeURIComponent(dataRevision)}`;
  let pending = jsonCache.get(url);
  if (!pending) {
    pending = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`Data load failed: ${rel} (${response.status})`);
      return response.json();
    });
    jsonCache.set(url, pending);
    pending.catch(() => jsonCache.delete(url));
  }
  return pending as Promise<T>;
}

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** 현재 data가 속한 요청 스코프. 연도 전환 중 유지되는 이전 data와 구분할 때 사용한다. */
  scope: string | null;
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[], scope: string | null = null): AsyncState<T> {
  const revision = useDataRevision();
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
    scope: null,
  });
  useEffect(() => {
    let alive = true;
    // 자동 갱신 중에는 기존 화면을 유지하고, 최초 로드일 때만 loading 상태를 표시한다.
    setState((prev) => ({ ...prev, loading: prev.data === null, error: null }));
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null, scope }))
      .catch(
        (e) =>
          alive &&
          setState((prev) => ({
            data: prev.data,
            loading: false,
            error: prev.data === null ? String(e?.message ?? e) : null,
            scope: prev.scope,
          }))
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision]);
  return state;
}

// 모든 로더는 선택된 연도(data/{year}/…) 기준으로 적재.
export const useMeta = () => {
  const { year } = useYear();
  return useAsync<Meta>(() => getJSON(`${year}/meta.json`), [year]);
};

// 시즌 경기 기록 존재 여부 — 새 시즌은 일정·선수현황만 있고 meta.json이 없을 수 있다.
export const seasonHasRecords = (year: number) =>
  getJSON<Meta>(`${year}/meta.json`).then(() => true, () => false);

// 특정 시합/대회의 meta (teamGames 등 — 규정 계산 스코프용). slug 비면 null.
export const useTournamentMeta = (slug: string | "") => {
  const { year } = useYear();
  return useAsync<Meta | null>(
    () =>
      slug
        ? getJSON<Meta>(`${year}/by-tournament/${encodeURIComponent(slug)}/meta.json`).catch(() => null)
        : Promise.resolve(null),
    [year, slug]
  );
};

// 유령 선수(이름이 빈/괄호만/등번호 누락) 행은 모든 화면에서 제외 (스크레이퍼 재집계 전 안전망).
const isRealPlayer = <T extends { name?: string; number?: string }>(p: T) =>
  !!p.name && p.name !== "()" && !!p.number;

export const usePlayerIndex = () => {
  const { year } = useYear();
  return useAsync<PlayerIndexEntry[]>(
    () => getJSON<PlayerIndexEntry[]>(`${year}/players/index.json`).then((rows) => rows.filter(isRealPlayer)),
    [year],
    String(year)
  );
};

export const usePlayer = (id: string | undefined) => {
  const { year } = useYear();
  return useAsync<Player>(
    () => id ? getJSON<Player>(`${year}/players/${id}.json`) : Promise.reject(new Error("선수 없음")),
    [id, year]
  );
};

export type CareerYears = Record<string, string>;
export const useCareerPlayers = (careerYears: CareerYears | undefined) =>
  useAsync<{ year: number; player: Player }[]>(
    async () => {
      if (!careerYears) return [];
      const seasons = Object.entries(careerYears)
        .map(([year, id]) => ({ year: Number(year), id }))
        .sort((a, b) => a.year - b.year);
      return Promise.all(
        seasons.map(async ({ year, id }) => ({
          year,
          player: await getJSON<Player>(`${year}/players/${id}.json`),
        }))
      );
    },
    [careerYears]
  );

// 통산 비교용 연도별 리그 평균. 일부 연도 파일이 없어도 해당 연도만 null로 둔다.
export const useCareerAverages = (years: number[]) => {
  const yearKey = [...new Set(years)].sort((a, b) => a - b).join(",");
  return useAsync<Record<number, LeagueAverages | null>>(
    async () => Object.fromEntries(
      await Promise.all(
        (yearKey ? yearKey.split(",").map(Number) : []).map(async (year) => [
          year,
          await getJSON<LeagueAverages>(`${year}/averages.json`).catch(() => null),
        ] as const)
      )
    ),
    [yearKey]
  );
};

// 선수별 상대전적 샤드(모바일 최적화): 해당 선수가 관여한 매치업만 로드.
export const usePlayerMatchups = (id: string | undefined) => {
  const { year } = useYear();
  return useAsync<Matchup[]>(
    () => id
      ? getJSON<Player>(`${year}/players/${id}.json`).then((player) => player.matchups ?? [])
      : Promise.resolve([]),
    [id, year],
    `${year}:${id ?? ""}`
  );
};

// 기록 테이블/리더보드용: 사전 집계된 단일 파일을 로드(대규모 시즌 대비).
// gameLog 가 빠진 슬림 형태이며, 선수 상세는 usePlayer 로 개별 로드.
export const useAllPlayers = () => {
  const { year } = useYear();
  return useAsync<Player[]>(
    () => getJSON<Player[]>(`${year}/records/players.json`).then((rows) => rows.filter(isRealPlayer)),
    [year]
  );
};

// 시합/대회 목록 (없으면 빈 배열)
export interface TournamentEntry {
  slug: string;
  title: string;
  gameCount: number;
}
export const useTournaments = () => {
  const { year } = useYear();
  return useAsync<TournamentEntry[]>(
    () => getJSON<TournamentEntry[]>(`${year}/tournaments.json`).catch(() => []),
    [year]
  );
};

// 특정 시합의 records (slim Player[]). slug 비면 전체 시즌 records 로 폴백.
export const useTournamentRecords = (slug: string | "") => {
  const { year } = useYear();
  return useAsync<Player[]>(
    () =>
      slug
        ? getJSON<Player[]>(`${year}/by-tournament/${encodeURIComponent(slug)}/records.json`)
            .then((rows) => rows.filter(isRealPlayer))
            .catch(() => [])
        : getJSON<Player[]>(`${year}/records/players.json`).then((rows) => rows.filter(isRealPlayer)),
    [year, slug]
  );
};

// 특정 시합의 매치업 전체 (Matchup[]). slug 비면 빈 배열(시합 미지정 시 호출자는 시즌 매치업 사용).
export const useTournamentMatchups = (slug: string | "") => {
  const { year } = useYear();
  return useAsync<Matchup[]>(
    () =>
      slug
        ? getJSON<Matchup[]>(`${year}/by-tournament/${encodeURIComponent(slug)}/matchups.json`).catch(() => [])
        : Promise.resolve([]),
    [year, slug],
    `${year}:${slug}`
  );
};

// 선수 프로필(출신학교/수상내역 — KBSA player_view 수집본). personNo 없으면 null.
export const usePlayerProfile = (personNo: string | undefined) =>
  useAsync<PlayerProfile | null>(
    () =>
      personNo
        ? getJSON<PlayerProfile>(`profiles/${personNo}.json`).catch(() => null)
        : Promise.resolve(null),
    [personNo]
  );

// 리그 평균 (전체/시합별 — 데이터 갱신 시점마다 재계산). 없으면 null.
export const useLeagueAverages = () => {
  const { year } = useYear();
  return useAsync<LeagueAverages | null>(
    () => getJSON<LeagueAverages>(`${year}/averages.json`).catch(() => null),
    [year]
  );
};

// 상대 강도 지수 (가중치 랭킹용 — 데이터 갱신 시점마다 재계산). 없으면 null.
export const useStrength = () => {
  const { year } = useYear();
  return useAsync<StrengthData | null>(
    () => getJSON<StrengthData>(`${year}/strength.json`).catch(() => null),
    [year]
  );
};

// 경기 일정 (scraper/src/schedule.ts 수집 — 경기일정 페이지용). 없으면 null.
export const useSchedule = () => {
  const { year } = useYear();
  return useAsync<ScheduleData | null>(
    () => getJSON<ScheduleData>(`${year}/schedule.json`).catch(() => null),
    [year]
  );
};

// 여러 시즌 일정을 이어 붙인 경기 목록 — 대전 모드 "통산 맞대결"용. 없는 연도는 건너뛴다.
export const useSchedules = (years: number[]) => {
  const key = [...new Set(years)].sort((a, b) => a - b).join(",");
  return useAsync<ScheduleGame[]>(
    async () => {
      const lists = await Promise.all(
        (key ? key.split(",") : []).map((year) =>
          getJSON<ScheduleData>(`${year}/schedule.json`).then((d) => d.games, () => [] as ScheduleGame[])
        )
      );
      return lists.flat();
    },
    [key],
    key
  );
};

// 여러 선수 상세 파일(선택 연도) — 대전 모드 선수 맞대결표용. 한 팀 선수 파일만 받는다.
// ids 가 비면 요청하지 않는다. 받지 못한 파일은 건너뛴다.
export const usePlayerFiles = (ids: string[]) => {
  const { year } = useYear();
  const key = ids.join(",");
  return useAsync<Player[]>(
    () =>
      Promise.all(ids.map((id) => getJSON<Player>(`${year}/players/${id}.json`).catch(() => null)))
        .then((rows) => rows.filter((row): row is Player => row != null)),
    [year, key],
    `${year}:${key}`
  );
};

// 팀·선수현황 (scraper/src/teams.ts 수집 — 선수현황 페이지용). 없으면 null.
export const useTeams = () => {
  const { year } = useYear();
  return useAsync<TeamRosterEntry[] | null>(
    () => getJSON<TeamRosterEntry[]>(`${year}/teams.json`).catch(() => null),
    [year]
  );
};

// 이름/팀 부분 일치 + 등번호(백넘버) 검색.
// 공백으로 나눈 토큰을 전부 만족(AND) — 예: "충암 45" = 충암고 45번.
// 숫자만인 토큰은 등번호 정확 일치로만 매칭 (부분 일치 시 4 → 14·40·45 등 노이즈 방지).
export function searchPlayers(
  index: PlayerIndexEntry[],
  query: string
): PlayerIndexEntry[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return index.filter((p) =>
    tokens.every((t) =>
      /^\d+$/.test(t)
        ? p.number === t
        : p.name.toLowerCase().includes(t) || p.team.toLowerCase().includes(t)
    )
  );
}
