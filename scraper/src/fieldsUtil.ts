import { hasFieldAddressNumber, refineFieldAddress, stripRegistrationDetail, stripResidentialUnit } from "./fieldsAddressUtil.js";

// 전국 야구장 현황 수집용 순수 함수 — 팀명→학교 정식명, 주소 정리, 지오코딩 결과의 시·도/시·군·구, 시설 분류·이름 거르기·중복 판단
export type FieldKind = "고등학교" | "중학교" | "대학교" | "일반부" | "공식경기 구장" | "프로야구장" | "야구장";
export const KIND_ORDER: FieldKind[] = ["고등학교", "중학교", "대학교", "일반부", "공식경기 구장", "프로야구장", "야구장"];

export interface Field {
  id: string; // kbsa:{club_idx} · osm:{type}/{id} · venue:{이름} · pro:{이름}
  name: string;
  kind: FieldKind;
  sido: string; // 서울·경기… (짧은 표기)
  sigungu: string; // 종로구·성남시·기장군… (세종은 "세종")
  lat: number;
  lon: number;
  addr?: string; // KBSA 등록 주소 또는 지도 주소
  approx?: boolean; // 위치가 정확하지 않을 수 있음(주소·시군구 중심·이름 추정)
  note?: string; // "KBSA 주소 기준" · "시·군·구 중심(추정)" · "이름 없는 야구장(추정)" 등
  team?: string; // KBSA 팀 표기(목록·검색용)
  addrKey?: string; // 위치를 찾은 주소·이름(바뀌면 다시 찾는다)
  source?: string; // 보정·추가 공개 출처
}

// ISO 3166-2 시·도 코드 → 짧은 표기 (Nominatim address["ISO3166-2-lvl4"])
const ISO_SIDO: Record<string, string> = {
  "KR-11": "서울", "KR-26": "부산", "KR-27": "대구", "KR-28": "인천", "KR-29": "광주", "KR-30": "대전", "KR-31": "울산",
  "KR-50": "세종", "KR-41": "경기", "KR-42": "강원", "KR-51": "강원", "KR-43": "충북", "KR-44": "충남", "KR-45": "전북",
  "KR-52": "전북", "KR-46": "전남", "KR-47": "경북", "KR-48": "경남", "KR-49": "제주",
};
export const SIDO_ORDER = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const METRO = new Set(["서울", "부산", "대구", "인천", "광주", "대전", "울산"]);

export type NomAddress = Record<string, string | undefined>;
// 지오코딩 주소 → [시·도, 시·군·구]. 특별·광역시는 구/군, 도는 시/군(성남시 분당구 → 성남시).
export function regionOf(a: NomAddress | undefined): [string, string] | null {
  if (!a) return null;
  const metro = [...METRO].find((s) => [a.city, a.state].some((v) => v === s || v === `${s}광역시` || v === `${s}특별시`));
  const province = [a.state, a.province].map((s) => shortSido(s ?? "")).find((s) => SIDO_ORDER.includes(s));
  const sido = metro ?? ISO_SIDO[a["ISO3166-2-lvl4"] ?? ""] ?? province;
  if (!sido) return null;
  if (sido === "세종") return [sido, "세종"];
  const candidates = METRO.has(sido) ? [a.borough, a.county, a.city_district, a.suburb] : [a.city, a.county, a.municipality];
  const sigungu = candidates.map((s) => s?.match(METRO.has(sido) ? /^[가-힣]+[구군]$/ : /^[가-힣]+?[시군](?=\s|$)/)?.[0]).find(Boolean);
  return sigungu ? [sido, sigungu] : null;
}

// 이름만 같은 버스 정류장·상점은 학교로 채택하지 않는다. building=school도 실제 학교 객체다.
export function isSchoolResult(r: { name?: string; category?: string; type?: string }, school: string): boolean {
  const normalize = (s: string) => s.replace(/\s/g, "");
  return ["amenity", "building"].includes(r.category ?? "") && /^(school|university|college)$/.test(r.type ?? "")
    && !!r.name && normalize(r.name) === normalize(school);
}

export function teamInfoFromHtml(html: string): { sido: string; addr: string } {
  const cell = (label: string) => (html.match(new RegExp(`<th\\b[^>]*>\\s*${label}\\s*</th>\\s*<td\\b[^>]*>([\\s\\S]*?)</td>`, "i"))?.[1] ?? "")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return { sido: shortSido(cell("지역")), addr: cell("주소") };
}

// 주거지·호실·층으로 등록된 클럽 사무실을 실제 실외 구장으로 새로 지오코딩하지 않는다.
export const isOfficeAddress = (addr: string) => /아파트|하이타운|하버빌|래미안|푸르지오|칸타빌|\d+동\s*\d+호|\d+층|\d{3,}호/.test(addr);

// 역지오코딩의 첫 몇 조각만 잘라 저장하지 않는다. 도로·건물번호가 있으면 한국식 전체 주소를 만든다.
export function fullNomAddress(a: NomAddress | undefined, displayName = ""): string | undefined {
  const reg = regionOf(a);
  if (!a || !reg) return displayName || undefined;
  const fullSido: Record<string, string> = { 서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시", 인천: "인천광역시", 광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시", 경기: "경기도", 강원: "강원특별자치도", 충북: "충청북도", 충남: "충청남도", 전북: "전북특별자치도", 전남: "전라남도", 경북: "경상북도", 경남: "경상남도", 제주: "제주특별자치도" };
  const road = a.road ?? a.pedestrian;
  if (!a.house_number) return displayName || undefined;
  const district = a.city_district && a.city_district !== reg[1] ? a.city_district : undefined;
  return [fullSido[reg[0]], reg[0] !== "세종" ? reg[1] : undefined, district, a.town, road ?? a.quarter ?? a.suburb, a.house_number].filter(Boolean).join(" ");
}

// 상세 주소를 조회했는데 구·군 중심만 반환된 결과를 그 번지의 좌표로 오인하지 않는다.
export function matchesStreetOrLot(address: string, a: NomAddress | undefined): boolean {
  if (!a) return false;
  const road = address.match(/([가-힣0-9·]+(?:로|길))\s*\d+/)?.[1];
  if (road) return [a.road, a.pedestrian].some((s) => s?.replace(/\s/g, "") === road.replace(/\s/g, ""));
  const lot = address.match(/([가-힣0-9]+(?:동|리|가))\s*(?:산\s*)?(\d+(?:-\d+)?)/);
  return !!lot && a.house_number === lot[2] && [a.quarter, a.suburb, a.village, a.neighbourhood].includes(lot[1]);
}

// KBSA 지역 표기("강원", "서울특별시")를 짧은 표기로.
export function shortSido(s: string): string {
  const t = (s || "").trim();
  return SIDO_ORDER.find((x) => t.startsWith(x) || (x === "충북" && t.startsWith("충청북")) || (x === "충남" && t.startsWith("충청남"))
    || (x === "전북" && t.startsWith("전라북")) || (x === "전남" && t.startsWith("전라남")) || (x === "경북" && t.startsWith("경상북"))
    || (x === "경남" && t.startsWith("경상남"))) ?? t;
}

const CLUB = /BC|야구단|U-1\d|클럽|리틀|SC|드림|아카데미|베이스볼|유소년/;
// KBSA 팀 표기 → 지도에서 찾을 학교 정식명. 클럽·야구단은 null(주소로 찾는다).
// "강원 경포중" → "경포중학교", "마산용마고" → "마산용마고등학교", "경희대" → "경희대학교"
export function schoolName(team: string): string | null {
  let t = team.replace(/\s+/g, " ").trim();
  if (CLUB.test(t)) return null;
  const first = t.split(" ")[0];
  if (t.includes(" ") && SIDO_ORDER.includes(shortSido(first)) && shortSido(first).length <= 2 && first.length <= 4) t = t.slice(first.length).trim();
  if (/학교$/.test(t)) return t;
  if (/중$/.test(t)) return `${t}학교`;
  if (/고$/.test(t)) return `${t}등학교`;
  if (/대$/.test(t)) return `${t}학교`;
  return null;
}

// KBSA 주소 정리 — 괄호·"신주소"·층·호수를 떼고 검색할 후보를 긴 것부터.
export function addressCandidates(addr: string): string[] {
  const clean = (addr || "")
    .replace(/신주소/g, " ").replace(/\([^)]*\)?/g, " ")
    .replace(/\d+층.*$/, " ").replace(/\d+호.*$/, " ")
    .replace(/([가-힣])(?=\d)/g, "$1 ").replace(/\s+/g, " ").trim();
  const words = clean.split(" ").filter(Boolean);
  const out = [clean, words.slice(0, 4).join(" "), words.slice(0, 3).join(" ")];
  return [...new Set(out.filter((s) => s.split(" ").length >= 2))];
}

// 실내·스크린·당구 등 야구장이 아닌 이름
const NOT_FIELD = /스크린|실내|당구|볼링|탁구|배드민턴|배팅\s?센터|타격장|피칭|게임|PC|노래/;
export const isFieldName = (name: string) => !NOT_FIELD.test(name);
export function isOutdoorBaseballTags(tags: Record<string, string>): boolean {
  if (tags.shop || tags.amenity === "restaurant" || tags.highway || tags.route || tags.public_transport || tags.type === "route" || tags.indoor === "yes" || tags.disused === "yes" || tags.demolished === "yes") return false;
  const name = tags["name:ko"] ?? tags.name ?? "";
  if (tags.building && tags.leisure !== "pitch" && /체육관|아레나/.test(name)) return false;
  return isFieldName(name) && (/baseball|softball/.test(tags.sport ?? "") || /야구장|베이스볼파크|(?:^|[^풋])볼파크/.test(name));
}

const PRO = /잠실|고척|랜더스\s?필드|위즈\s?파크|이글스\s?파크|한화생명\s?볼파크|라이온즈\s?파크|챔피언스\s?필드|사직\s?야구장|NC\s?파크|문학\s?야구장/;
export const isProName = (name: string) => PRO.test(name);
export const PRO_STADIUMS = ["잠실야구장", "고척스카이돔", "인천SSG랜더스필드", "수원KT위즈파크", "대전한화생명볼파크", "대구삼성라이온즈파크", "광주기아챔피언스필드", "사직야구장", "창원NC파크"];

// 두 지점 거리(m)
export function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371e3, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 공원 경계 상자 안에 들어가는 가장 작은 공원 이름(이름 없는 야구장 이름 추정용)
export interface ParkBox { name: string; minlat: number; minlon: number; maxlat: number; maxlon: number }
export function parkOf(p: { lat: number; lon: number }, parks: ParkBox[]): string | null {
  let best: ParkBox | null = null, area = Infinity;
  for (const k of parks) {
    if (p.lat < k.minlat || p.lat > k.maxlat || p.lon < k.minlon || p.lon > k.maxlon) continue;
    const s = (k.maxlat - k.minlat) * (k.maxlon - k.minlon);
    if (s < area) { area = s; best = k; }
  }
  return best?.name ?? null;
}

export type FieldOverride = Partial<Pick<Field, "name" | "kind" | "lat" | "lon" | "sido" | "sigungu" | "addr" | "approx" | "note" | "source">> & { remove?: boolean; reason?: string };
export interface FieldSource { id: string; title: string; url: string; license: string }
export interface ExtraFields { fetchedAt: string; sources: FieldSource[]; fields: Field[] }
const overrideKeys = new Set(["name", "kind", "lat", "lon", "sido", "sigungu", "addr", "approx", "note", "remove", "reason", "source"]);
export function validateField(f: Field): void {
  if (!f.id || !f.name?.trim() || !KIND_ORDER.includes(f.kind) || !SIDO_ORDER.includes(f.sido) || !f.sigungu?.trim()
    || !Number.isFinite(f.lat) || !Number.isFinite(f.lon) || f.lat < 33 || f.lat > 39 || f.lon < 124 || f.lon > 132) {
    throw new Error(`야구장 필수 값·분류·한국 좌표 범위 오류 — ${f.id ?? "ID 없음"}`);
  }
  if (f.sido === "세종" ? f.sigungu !== "세종" : !new RegExp(METRO.has(f.sido) ? "[구군]$" : "[시군]$").test(f.sigungu) || /광역시|특별시|자치시/.test(f.sigungu)) throw new Error(`시·군·구 형식 오류 — ${f.id}`);
}
// 이미 「야구장」 등으로 끝나는 장소명에 꼬리 「야구장」이 한 번 더 붙은 이름을 바로잡는다(예: 청주야구장 야구장 → 청주야구장).
// 이름 없는 구장에 주변 시설명을 붙일 때 생긴 중복이며, 같은 자리의 원래 항목과 이름이 같아져 동명 중복 정리로 합쳐진다.
const DOUBLED_SUFFIX = /(야구장|구장|볼파크|필드|야구공원)\s+야구장$/;
export const cleanFieldName = (name: string) => name.replace(/\s*\(추정\)/g, "").trim().replace(DOUBLED_SUFFIX, "$1");
const cleanField = (f: Field): Field => {
  const unmarked = f.name.replace(/\s*\(추정\)/g, "").trim();
  const name = cleanFieldName(f.name);
  const out = { ...f, name, lat: Number(f.lat.toFixed(6)), lon: Number(f.lon.toFixed(6)), ...(unmarked !== f.name ? { approx: true } : {}) };
  // 주소는 원문(수집·보정 값)을 정제해 싣는다. 보정 파일에는 원문을 두고, 표기 정리는 병합할 때마다 같은 규칙으로 한다.
  // 동·호수는 어느 경로로 들어와도 공개 자료(주소·대조 키)에 남기지 않는다.
  // 팀 등록지는 층·호·건물 이름까지 빼고 도로명·건물번호·법정동만 싣는다.
  if (out.addr !== undefined) out.addr = refineFieldAddress({ ...out, addr: /팀 등록지/.test(out.name) ? stripRegistrationDetail(out.addr) : stripResidentialUnit(out.addr) });
  if (out.addrKey !== undefined) out.addrKey = stripResidentialUnit(out.addrKey);
  validateField(out);
  return out;
};
const sameFieldName = (a: string, b: string) => {
  const normalize = (s: string) => s.replace(/\(추정\)|[\s·_()\-]/g, "").toLowerCase();
  const x = normalize(a), y = normalize(b);
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)));
};

// 같은 시설이 여러 항목으로 잡힌 것(공원 안 다이아몬드 여러 개 등)을 하나로 줄인다.
// 같은 시·도·시·군·구에서 이름이 같고 서로 이 거리 안에 이어지면 같은 시설로 본다.
// 멀리 떨어진 동명(예: 지역명만 붙은 「이천시 야구장」 여러 곳)은 서로 다른 구장이라 남긴다.
export const SAME_FIELD_RADIUS_M = 500;
const SOURCE_RANK = ["pro", "venue", "kbsa", "extra", "osm"];
// 남길 항목: 정확한 위치 > 번지 있는 주소 > 주소 있음 > 출처(프로·공식·KBSA·공개자료·OSM) > ID
const keepOrder = (a: Field, b: Field) =>
  Number(!!a.approx) - Number(!!b.approx)
  || Number(!hasFieldAddressNumber(a.addr)) - Number(!hasFieldAddressNumber(b.addr))
  || Number(!a.addr) - Number(!b.addr)
  || SOURCE_RANK.indexOf(a.id.split(":")[0]) - SOURCE_RANK.indexOf(b.id.split(":")[0])
  || a.id.localeCompare(b.id);
export function dedupeSameNameFields(fields: Field[]): { fields: Field[]; deduplicated: { kept: string; removed: string[] }[] } {
  const key = (f: Field) => `${f.sido}|${f.sigungu}|${f.name.replace(/\(추정\)|[\s·_()\-]/g, "").toLowerCase()}`;
  const groups = new Map<string, Field[]>();
  for (const f of fields) groups.set(key(f), [...(groups.get(key(f)) ?? []), f]);
  const drop = new Set<string>();
  const deduplicated: { kept: string; removed: string[] }[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // 반경 안으로 이어지는 항목끼리 한 묶음(단일 연결)
    const parent = list.map((_, i) => i);
    const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++)
        if (distance(list[i], list[j]) <= SAME_FIELD_RADIUS_M) parent[root(i)] = root(j);
    const clusters = new Map<number, Field[]>();
    list.forEach((f, i) => clusters.set(root(i), [...(clusters.get(root(i)) ?? []), f]));
    for (const c of clusters.values()) {
      if (c.length < 2) continue;
      const [kept, ...rest] = [...c].sort(keepOrder);
      rest.forEach((f) => drop.add(f.id));
      deduplicated.push({ kept: kept.id, removed: rest.map((f) => f.id) });
    }
  }
  return { fields: fields.filter((f) => !drop.has(f.id)), deduplicated };
}

// 원본을 직접 덮어 고치지 않고 근거 있는 보정·삭제를 먼저 적용한 뒤 추가 출처의 근접 동명을 합친다.
export function mergeFieldData(base: Field[], overrides: Record<string, FieldOverride>, extra: ExtraFields) {
  const known = new Set(base.map((f) => f.id));
  const extraIds = new Set<string>();
  for (const f of extra.fields) {
    if (!f.id.startsWith("extra:") || extraIds.has(f.id) || known.has(f.id)) throw new Error(`추가 항목 ID 오류 — ${f.id}`);
    const sourceId = f.id.split(":")[1];
    if (!extra.sources.some((s) => s.id === sourceId && s.url && s.license)) throw new Error(`추가 항목 출처 없음 — ${f.id}`);
    extraIds.add(f.id);
  }
  const removed: string[] = [], corrected: string[] = [], duplicateExtras: string[] = [];
  const apply = (f: Field): Field | null => {
    const patch = overrides[f.id];
    if (patch && (!patch.source && !patch.reason || Object.keys(patch).some((k) => !overrideKeys.has(k)))) throw new Error(`보정 근거·허용 키 오류 — ${f.id}`);
    if (patch?.remove) { removed.push(f.id); return null; }
    const { remove, reason, ...values } = patch ?? {};
    if (patch) corrected.push(f.id);
    return cleanField({ ...f, ...values });
  };
  const fields = base.map(apply).filter((f): f is Field => !!f);
  if (new Set(fields.map((f) => f.id)).size !== fields.length) throw new Error("원본 야구장 ID 중복");
  for (const raw of extra.fields) {
    const f = apply(raw);
    if (!f) continue;
    if (fields.some((b) => b.sido === f.sido && distance(b, f) < 300 && sameFieldName(b.name, f.name))) { duplicateExtras.push(f.id); continue; }
    fields.push(f);
  }
  const { fields: unique, deduplicated } = dedupeSameNameFields(fields);
  unique.sort((a, b) => SIDO_ORDER.indexOf(a.sido) - SIDO_ORDER.indexOf(b.sido) || a.sigungu.localeCompare(b.sigungu, "ko")
    || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name, "ko"));
  return { fields: unique, removed, corrected, duplicateExtras, deduplicated, unmatchedOverrides: Object.keys(overrides).filter((id) => !known.has(id) && !extraIds.has(id)) };
}
