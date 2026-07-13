// 운영 수집은 실행 시점의 KST 연도만 허용한다.
// 2024·2025 같은 종료 시즌은 불변 아카이브이므로 YEAR 오지정으로 재수집하지 않는다.
export const kstYear = (now: number = Date.now()): number =>
  new Date(now + 9 * 3600 * 1000).getUTCFullYear();

export function collectionYear(
  requested: string | undefined = process.env.YEAR,
  now: number = Date.now()
): number {
  const current = kstYear(now);
  if (requested == null || requested.trim() === "") return current;
  const parsed = Number.parseInt(requested, 10);
  if (!Number.isInteger(parsed) || parsed !== current) {
    throw new Error(
      `종료 시즌 수집 차단: YEAR=${requested}. 운영 수집은 실행 시점 KST 연도(${current})만 허용됩니다.`
    );
  }
  return current;
}

// data/games에 여러 시즌이 있어도 수집 실행에서는 현재 시즌 하나만 갱신한다.
export function collectionYears(availableYears: Iterable<number>, currentYear: number): number[] {
  return new Set(availableYears).has(currentYear) ? [currentYear] : [];
}

