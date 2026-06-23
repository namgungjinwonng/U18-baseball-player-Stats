// 정적 JSON "DB" 로더 + 검색 인덱스 (디바이스 무관 공통 로직).
import { useEffect, useState } from "react";
import type { Matchup, Meta, Player, PlayerIndexEntry } from "./types";

const BASE = import.meta.env.BASE_URL; // '/' 또는 '/U18-baseball-player/'

async function getJSON<T>(rel: string): Promise<T> {
  const res = await fetch(`${BASE}data/${rel}`);
  if (!res.ok) throw new Error(`데이터 로드 실패: ${rel} (${res.status})`);
  return (await res.json()) as T;
}

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  useEffect(() => {
    let alive = true;
    setState({ data: null, loading: true, error: null });
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch(
        (e) =>
          alive &&
          setState({ data: null, loading: false, error: String(e?.message ?? e) })
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export const useMeta = () => useAsync<Meta>(() => getJSON("meta.json"), []);

export const usePlayerIndex = () =>
  useAsync<PlayerIndexEntry[]>(() => getJSON("players/index.json"), []);

export const usePlayer = (id: string | undefined) =>
  useAsync<Player>(
    () => (id ? getJSON(`players/${id}.json`) : Promise.reject(new Error("선수 없음"))),
    [id]
  );

export const useMatchups = () =>
  useAsync<Matchup[]>(() => getJSON("matchups.json"), []);

// 기록 테이블용: 색인의 전 선수 상세를 한 번에 적재.
// (대규모 시즌에는 사전 집계된 records/*.json 으로 대체 권장)
export const useAllPlayers = () =>
  useAsync<Player[]>(async () => {
    const index = await getJSON<PlayerIndexEntry[]>("players/index.json");
    return Promise.all(index.map((p) => getJSON<Player>(`players/${p.id}.json`)));
  }, []);

// 이름 부분 일치 검색 (초성/대소문자 무시 정도의 단순 매칭).
export function searchPlayers(
  index: PlayerIndexEntry[],
  query: string
): PlayerIndexEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return index.filter(
    (p) =>
      p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
  );
}
