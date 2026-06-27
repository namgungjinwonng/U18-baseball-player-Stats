// korea-baseball.com (KBSA) 실데이터 어댑터.
// discover 로 확정한 계약(2026-06 기준):
//
//  - 경기 목록: GET /game/calendar?kind_cd=31&month=M
//      → <li date="YYYY:MM:DD:HH:MM"> ... <a href="...game_idx=N"> 원정팀 점수 : 홈팀 (N회) 점수
//  - 경기 박스스코어: GET /game/record_detail?game_idx=N  (서버 렌더 HTML, AJAX 아님)
//      표0 스코어보드 / 표1·표3 타자 이닝별 타석 그리드 / 표2·표4 투수기록
//  - 부(division) kind_cd: 41=대학부, 31=18세 이하부(U18), 51=일반부
//
// 타자 시즌기록 단독 조회(대안 소스):
//  GET /record/record/player_record?kind_cd=31&club_idx=&person_no=&record_type=1|2&begin_year=&end_year=
import type { BatterLine, GameBoxScore, MatchupLine, PitcherLine } from "./types.js";

export const BASE = "https://www.korea-baseball.com";
export const KIND = { U18: 31, COLLEGE: 41, GENERAL: 51 } as const;

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const slug = (team: string, name: string, num: string) =>
  `${team}_${name}_${num}`.replace(/\s+/g, "");

// "3.1" (3과 1/3이닝) → 아웃카운트 10
function ipTextToOuts(ip: string): number {
  const [whole, frac = "0"] = ip.split(".");
  return (parseInt(whole, 10) || 0) * 3 + (parseInt(frac, 10) || 0);
}

// ---- 경기 목록 ----
export interface GameRef {
  id: string;
  date: string; // YYYY-MM-DD
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
}

export async function fetchGameRefs(
  months: number[],
  kindCd: number = KIND.U18
): Promise<GameRef[]> {
  const refs: GameRef[] = [];
  for (const month of months) {
    const html = await get(`${BASE}/game/calendar?kind_cd=${kindCd}&month=${month}`);
    for (const m of html.matchAll(
      /<li date="(\d{4}):(\d{2}):(\d{2})[^"]*">([\s\S]*?)<\/li>/gi
    )) {
      const [, y, mo, d, inner] = m;
      const idMatch = inner.match(/game_idx=(\d+)/);
      if (!idMatch) continue;
      const teams = [...inner.matchAll(/class="name"[^>]*>([^<]+)</gi)].map((x) =>
        x[1].trim()
      );
      const scores = [...inner.matchAll(/class="(?:score|num)[^"]*"[^>]*>\s*(\d+)\s*</gi)].map(
        (x) => parseInt(x[1], 10)
      );
      refs.push({
        id: idMatch[1],
        date: `${y}-${mo}-${d}`,
        away: teams[0] ?? "",
        home: teams[1] ?? "",
        awayScore: scores[0] ?? 0,
        homeScore: scores[1] ?? 0,
      });
    }
  }
  // 중복 game_idx 제거
  const seen = new Set<string>();
  return refs.filter((r) => (seen.has(r.id) ? false : seen.add(r.id)));
}

// ---- 타석 결과 분류 (한글 약어) ----
// 반환 null = 타석 아님(승부주자/공란). 그 외 타석 1.
export interface AtBatResult {
  ab: number; h: number; b2: number; b3: number; hr: number;
  bb: number; hbp: number; so: number;
}
export function classifyAtBat(raw: string): AtBatResult | null {
  const c = raw.replace(/\s/g, "");
  if (!c || c === "승부주자") return null;
  const Z: AtBatResult = { ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0, hbp: 0, so: 0 };
  if (/사구/.test(c)) return { ...Z, hbp: 1 }; // 몸에 맞는 공
  if (/(^|,)(4구|고4|고의4구)/.test(c)) return { ...Z, bb: 1 }; // 볼넷
  const isSac = /^희/.test(c); // 희생타/희생플라이 → 타수 제외
  const isK = /삼진/.test(c);
  const isHR = /홈런|월홈|장외/.test(c); // 우월홈/좌월홈 = 담장 넘는 홈런
  // 2·3루타: 방향 타구(좌/중/우…)의 끝자리 2/3 (예: 좌중2, 우중3, 좌선2, 우중2,도루)
  // ↔ 출구 숫자가 앞에 오는 수비위치(3땅=3루수 땅볼)·내야안타(3내안)와 구분.
  let b2 = 0, b3 = 0;
  if (!isHR && /[좌중우]/.test(c)) {
    const md = c.match(/([23])(?:,|$)/);
    if (md) (md[1] === "2" ? (b2 = 1) : (b3 = 1));
  }
  const isHit = /안/.test(c) || isHR || b2 > 0 || b3 > 0;
  return {
    ...Z, ab: isSac ? 0 : 1, h: isHit ? 1 : 0,
    b2, b3, hr: isHR ? 1 : 0, so: isK ? 1 : 0,
  };
}

interface ParsedPitcher extends PitcherLine {
  order: number;
  starter: boolean;
}

// ---- record_detail 파싱 ----
// 대회명 추출 (참고: U-18 Baseball/fetch_u18_schedule.py — box_score 페이지의 같은 dl.game_name)
function extractTitle(html: string): string | undefined {
  const m = html.match(/<dl[^>]*class="game_name"[^>]*>([\s\S]*?)<\/dl>/i);
  if (!m) return undefined;
  const dt = m[1].match(/<dt[^>]*>([\s\S]*?)<\/dt>/i);
  if (!dt) return undefined;
  const raw = stripTags(dt[1]);
  // "제80회 황금사자기 ... 2026.05.02 09:30 비동야구장" 같이 시간·구장이 붙어 옴 → 날짜 앞까지만.
  const cut = raw.split(/\s+\d{4}\.\d{2}\.\d{2}/)[0].trim();
  return cut || undefined;
}

export async function fetchRecordDetail(ref: GameRef): Promise<GameBoxScore> {
  const html = await get(`${BASE}/game/record_detail?game_idx=${ref.id}`);
  const title = extractTitle(html);
  const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)].map((m) => m[1]);

  // 투수표: 표2(원정), 표4(홈) — 표 인덱스는 타자그리드/투수표가 번갈아 등장
  const pitcherTables = tables.filter((t) => /피안타/.test(t) && /이닝/.test(t));
  const batterTables = tables.filter((t) => /타순/.test(t) && /선수명/.test(t));

  // away=첫 타자그리드, home=둘째 (스코어보드 순서와 동일)
  const awayPitchers = pitcherTables[0] ? parsePitchers(pitcherTables[0], ref.away) : [];
  const homePitchers = pitcherTables[1] ? parsePitchers(pitcherTables[1], ref.home) : [];

  const matchups: MatchupLine[] = [];
  const awayBatters = batterTables[0]
    ? parseBatters(batterTables[0], ref.away, homePitchers, matchups)
    : [];
  const homeBatters = batterTables[1]
    ? parseBatters(batterTables[1], ref.home, awayPitchers, matchups)
    : [];

  return {
    id: ref.id,
    date: ref.date,
    season: parseInt(ref.date.slice(0, 4), 10),
    home: ref.home,
    away: ref.away,
    score: { home: ref.homeScore, away: ref.awayScore },
    title,
    batters: [...awayBatters, ...homeBatters],
    pitchers: [...awayPitchers, ...homePitchers].map(stripPitcherMeta),
    matchups,
  };
}

function parsePitchers(table: string, team: string): ParsedPitcher[] {
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  const out: ParsedPitcher[] = [];
  let order = 0;
  for (const row of rows) {
    const nameCell = row.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    if (!nameCell) continue;
    const nameRaw = stripTags(nameCell[1]);
    if (!nameRaw || nameRaw === "선수명") continue;
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1]));
    if (tds.length < 15) continue;
    // 컬럼: 등판,결과,승,패,이닝,타자,투구수,타수,피안타,피홈런,4사구,삼진,실점,자책,평균자책점
    const [appear, result, w, l, ip, , , , h, , bb, so, r, er] = tds;
    const { name, num } = splitName(nameRaw);
    // 이름·번호가 비면(파싱 누락·합계행 등) 유령 선수로 들어가므로 건너뛴다.
    if (!name || !num) continue;
    order += 1;
    out.push({
      playerId: slug(team, name, num),
      name,
      team,
      outs: ipTextToOuts(ip),
      h: n(h), r: n(r), er: n(er), bb: n(bb), so: n(so),
      w: result.includes("승") ? 1 : n(w), l: result.includes("패") ? 1 : n(l),
      sv: result.includes("세") ? 1 : 0,
      order,
      starter: appear.includes("선발"),
    });
  }
  return out;
}

function stripPitcherMeta(p: ParsedPitcher): PitcherLine {
  const { order: _o, starter: _s, ...rest } = p;
  void _o; void _s;
  return rest;
}

// 투수 등판 순서/이닝으로 이닝→투수 매핑 (상대전적 귀속용)
function pitcherForInning(pitchers: ParsedPitcher[]) {
  let cum = 0;
  const ranges = pitchers.map((p) => {
    const start = Math.floor(cum / 3) + 1;
    cum += p.outs;
    const end = Math.max(start, Math.ceil(cum / 3));
    return { p, start, end };
  });
  return (inning: number): ParsedPitcher | undefined =>
    ranges.find((r) => inning >= r.start && inning <= r.end)?.p ?? ranges.at(-1)?.p;
}

function parseBatters(
  table: string,
  team: string,
  oppPitchers: ParsedPitcher[],
  matchups: MatchupLine[]
): BatterLine[] {
  const forInning = pitcherForInning(oppPitchers);
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  const out: BatterLine[] = [];
  const mAcc = new Map<string, MatchupLine>();

  for (const row of rows) {
    const ths = [...row.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => stripTags(m[1]));
    // 타자 행: [타순, 포지션, 선수명] 형태(3개 th) — 헤더행 제외
    if (ths.length < 3 || ths[0] === "타순" || !/\(\d+\)/.test(ths[2])) continue;
    const { name, num } = splitName(ths[2]);
    const id = slug(team, name, num);
    // 이닝별 타석 셀(= <td><span>결과</span></td>)
    const cells = [
      ...row.matchAll(/<td[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/td>/gi),
    ].map((m) => stripTags(m[1]));
    // 행 끝 요약 합계 셀(span 미포함): [타수, 안타, 타점, 득점, 타율]
    const summary = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((m) => m[1])
      .filter((c) => !/<span/.test(c))
      .map((c) => stripTags(c.replace(/&nbsp;/g, "")))
      .filter((c) => c !== "");

    const line: BatterLine = {
      playerId: id, name, team,
      // 합계 셀에서 직접: 타수/안타/타점/득점 (신뢰도 높음)
      ab: n(summary[0]), h: n(summary[1]), rbi: n(summary[2]), r: n(summary[3]),
      // 2·3루타/홈런/볼넷/사구/삼진/도루는 타석 결과 코드에서 집계(합계 셀에 없음)
      b2: 0, b3: 0, hr: 0, bb: 0, hbp: 0, so: 0, sb: 0,
    };
    cells.forEach((cell, i) => {
      const res = classifyAtBat(cell);
      if (!res) return;
      line.b2 += res.b2; line.b3 += res.b3; line.hr += res.hr;
      line.bb += res.bb; line.hbp += res.hbp; line.so += res.so;
      if (/도루/.test(cell)) line.sb += 1;
      // 상대전적: 해당 이닝(컬럼 i+1) 투수에 귀속
      const pit = forInning(i + 1);
      if (pit && (res.ab > 0 || res.bb > 0 || res.hbp > 0)) {
        const key = `${id}|${pit.playerId}`;
        const cur = mAcc.get(key) ?? {
          batterId: id, pitcherId: pit.playerId,
          ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0, hbp: 0, so: 0,
        };
        cur.ab += res.ab; cur.h += res.h; cur.b2 += res.b2; cur.b3 += res.b3;
        cur.hr += res.hr; cur.bb += res.bb; cur.hbp += res.hbp; cur.so += res.so;
        mAcc.set(key, cur);
      }
    });
    out.push(line);
  }
  matchups.push(...mAcc.values());
  return out;
}

function splitName(raw: string): { name: string; num: string } {
  const m = raw.match(/^(.*?)\((\d+)\)\s*$/);
  return m ? { name: m[1].trim(), num: m[2] } : { name: raw.trim(), num: "" };
}
const n = (s: string | undefined) => parseInt((s ?? "").replace(/[^\d-]/g, ""), 10) || 0;

async function get(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (U18-baseball data sync)" },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}
