import fs from "node:fs";
import path from "node:path";

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

// 연도 목록에 시즌 하나를 더한다(중복 제거·내림차순). 기존 연도는 빼거나 바꾸지 않는다.
export function withSeasonYear(years: Iterable<number>, year: number): number[] {
  return [...new Set([...years, year])].sort((a, b) => b - a);
}

// 새 시즌 일정·선수현황이 경기 기록보다 먼저 생기면 years.json에 그 연도만 추가한다.
// 아카이브 시즌 파일은 건드리지 않고 연도 목록만 바뀐다. 추가했으면 true.
export function registerSeasonYear(dataDir: string, year: number): boolean {
  const fp = path.join(dataDir, "years.json");
  const years = fs.existsSync(fp) ? (JSON.parse(fs.readFileSync(fp, "utf8")) as number[]) : [];
  if (years.includes(year)) return false;
  fs.writeFileSync(fp, JSON.stringify(withSeasonYear(years, year), null, 2) + "\n");
  console.log(`✓ years.json에 ${year} 시즌 추가 (경기 기록 집계 전)`);
  return true;
}

