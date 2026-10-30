// 좌표를 바꾸지 않고 출처에 실제로 있는 번지·건물번호와 한국식 전체 주소만 복원한다.
import type { Field } from "./fieldsUtil.js";

const PROVINCES: Record<string, string> = { 서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시", 인천: "인천광역시", 광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시", 경기: "경기도", 강원: "강원특별자치도", 충북: "충청북도", 충남: "충청남도", 전북: "전북특별자치도", 전남: "전라남도", 경북: "경상북도", 경남: "경상남도", 제주: "제주특별자치도" };
// 도로명 뒤 건물번호 또는 동·리·가 뒤 지번. 구로2동·북문로3가·대학로291번라길처럼 행정구역·도로명 안의 숫자는 번지가 아니다.
export const hasFieldAddressNumber = (s = "") => /(?:로|길)\s*\d+(?:-\d+)?(?![\d-]|번[가-힣]?길|로|길|(?:동|가|리)(?![가-힣]))|(?:동|리|가)\s*(?:산\s*)?\d+(?:-\d+)?(?![\d-]|(?:동|가|리)(?![가-힣])|번[가-힣]?길|로|길)/.test(s);

// 팀 등록지가 개인 집일 수 있어 공개 주소에서 동·호수와 아파트 등 건물 이름을 뺀다(도로명·건물번호·법정동까지만).
// 호수가 없는 주소(사무실 층, 학교·구장 주소)는 그대로 둔다. 예: 예시로 10 (○○동, ○○아파트)101동 1001호 → 예시로 10 (○○동)
// 「101동 1001호」 또는 세 자리 이상 「104호」만 — 「랜드마크시티 1호 체육공원」「제22호 근린공원」 같은 시설 이름은 건드리지 않는다(isOfficeAddress 와 같은 기준).
const UNIT = /,?\s*(?:\d+동\s*\d+호|(?:\d+-)?\d{3,}호)(?!\d)/g;
export function stripResidentialUnit(addr: string): string {
  if (!addr.match(UNIT)) return addr;
  return addr.replace(UNIT, "")
    .replace(/\s*\(([^)]*)\)/g, (_, inner: string) => {
      const keep = inner.split(",").map((s) => s.trim()).filter((s) => /^[가-힣0-9]+(?:동|가|리|읍|면)$/.test(s));
      return keep.length ? ` (${keep.join(", ")})` : "";
    })
    .replace(/\s+/g, " ").trim();
}

// 팀 등록지(사무실·주거지)는 도로명·건물번호와 법정동까지만 싣는다 — 층·호·건물 이름 같은 사무실·주거 정보는 뺀다.
// 예: 동일로207길 23, H호 (중계동) → 동일로207길 23 (중계동). 도로명 주소가 아니면 동·호수만 뺀다.
export function stripRegistrationDetail(addr: string): string {
  const m = addr.match(/^(.*?(?:로|길)\s*\d+(?:-\d+)?)(?![\d-]|번[가-힣]?길|로|길)[^(]*(?:\(([^)]*)\))?/);
  if (!m) return stripResidentialUnit(addr);
  const dong = (m[2] ?? "").split(",").map((s) => s.trim()).filter((s) => /^[가-힣0-9]+(?:동|가|리|읍|면)$/.test(s));
  return `${m[1].trim()}${dong.length ? ` (${dong.join(", ")})` : ""}`;
}

// 2026-07-01 전남광주통합특별시 출범 — 옛 광주광역시·전라남도 주소는 맨 앞 시·도 이름만 바뀌었다(시·군·구·도로명·번지는 그대로).
// 지역 판단은 옛 이름으로 하고, 싣는 주소의 맨 앞만 새 이름으로 통일한다.
export const unifyProvinceName = (addr: string) => addr.replace(/^(?:광주광역시|전라남도)(?=\s)/, "전남광주통합특별시");

export function completeFieldAddress(f: Pick<Field, "sido" | "sigungu">, raw: string): string | null {
  let tail = raw.replace(/\s+/g, " ").trim();
  if (!hasFieldAddressNumber(tail) || !PROVINCES[f.sido]) return null;
  for (const province of [...Object.values(PROVINCES), ...Object.keys(PROVINCES)]) {
    if (tail.startsWith(province + " ")) { tail = tail.slice(province.length).trim(); break; }
  }
  // 다른 시·군의 자료를 단지 이름이 비슷하다는 이유로 붙이지 않는다.
  const city = tail.match(/^([가-힣]+(?:시|군))(?=\s)/)?.[1];
  if (city && city !== f.sigungu) return null;
  if (f.sido === "세종") return `${PROVINCES[f.sido]} ${tail.replace(/^세종\s*/, "")}`;
  return `${PROVINCES[f.sido]} ${tail.startsWith(f.sigungu) ? tail : f.sigungu + " " + tail}`;
}

export function osmTagFieldAddress(f: Pick<Field, "sido" | "sigungu">, tags: Record<string, string>): string | null {
  const street = tags["addr:street"], number = tags["addr:housenumber"];
  // 지번처럼 보이는 addr:street나 주변 도로의 번호는 실제 건물번호로 만들어 내지 않는다.
  if (!street || !/(?:로|길)$/.test(street) || !number || !/^\d+(?:-\d+)?$/.test(number)) return null;
  const city = tags["addr:city"];
  if (city && /(?:시|군)$/.test(city) && !/(?:특별시|광역시|자치시)$/.test(city) && city !== f.sigungu) return null;
  const district = tags["addr:district"];
  const town = tags["addr:town"];
  const raw = [district && district !== f.sigungu && /구$/.test(district) ? district : undefined, town && /(?:읍|면)$/.test(town) ? town : undefined, street, number].filter(Boolean).join(" ");
  return completeFieldAddress(f, raw);
}

// ── 주소 표기 정제 ─────────────────────────────────────────────────────────
// 원문에 있는 행정구역·도로명·번지만 남겨 한국식 순서로 정리한다. 새 번지·도로를 만들지 않고, 숫자를 다른 자리로 옮기지 않는다.
// 한국식 원문(KBSA·공공 자료)은 시·도 전체 명칭, 띄어쓰기, 괄호 참고항목만 다듬고, 지도 역주소(작은 단위→큰 단위)는
// 시설명·하천·자전거길·고속도로·아파트·우편번호·영문 등 주소가 아닌 조각을 빼고 행정구역+도로명으로 다시 쓴다.
const PROVINCE_ALIASES: Record<string, string> = {
  서울시: "서울", 부산시: "부산", 대구시: "대구", 인천시: "인천", 광주시: "광주", 대전시: "대전", 울산시: "울산", 세종시: "세종",
  강원도: "강원", 전라북도: "전북", 충청북도: "충북", 충청남도: "충남", 전라남도: "전남", 경상북도: "경북", 경상남도: "경남", 제주도: "제주",
};
// 2026 학교 위치 표준데이터가 쓰는 통합 광역 명칭. 광주·전남 항목의 원문 표기로만 인정하고 다른 표기로 바꾸지 않는다.
const MERGED_PROVINCE = "전남광주통합특별시";
const provinceOf = (token: string): string | undefined => {
  if (token === MERGED_PROVINCE) return MERGED_PROVINCE;
  if (PROVINCES[token]) return token;
  const full = Object.entries(PROVINCES).find(([, v]) => v === token)?.[0];
  if (full) return full;
  const alias = PROVINCE_ALIASES[token];
  // "광주시"는 경기도 광주시와 겹쳐 시·도 별칭으로 쓰지 않는다.
  return alias && token !== "광주시" ? alias : undefined;
};
// 행정구역 개편 — 옛 구·군 표기를 메타데이터의 현재 시·군·구로 바꾼다(같은 시·도 안의 알려진 개편만).
const RENAMED: Record<string, Record<string, string[]>> = {
  인천: { 미추홀구: ["남구"], 제물포구: ["중구", "동구"], 영종구: ["중구"], 서해구: ["서구"], 검단구: ["서구"] },
};
// 시·도 이관 — 원문의 옛 시·도를 메타데이터 시·도로 바꾼다.
const MOVED: Record<string, { from: string; sigungu: string }[]> = { 대구: [{ from: "경북", sigungu: "군위군" }] };

const ROAD = /^[가-힣0-9·]+(?:로|길)$/;
const NOT_ROAD = /^(?:도로|차도|자전거)$|자전거(?:길|도로)$|고속도로$|지하차도$|산책로$|등산로$|둘[레랫]길$|올레길$|누리길|코스$|^(?:자유로|제2자유로|강변북로|올림픽대로|내부순환로|북부간선도로|동부간선도로|서부간선도로)$/;
const DONG = /^(?:[가-힣]{1,6}\d*동(?:\d+가)?|[가-힣]{1,6}동?\d*가\d*동|[가-힣]{1,6}\d*가|[가-힣]{1,5}\d?리)$/;
// 당거리처럼 짧은 리 이름은 받고, ○○문화의거리·먹자골목 같은 거리 이름은 받지 않는다.
const isDong = (t: string) => DONG.test(t) && !/^\d/.test(t) && !(/거리$/.test(t) && t.length >= 5) && !/(?:아파트|마을|단지|공원)/.test(t);
const isAdminDong = (t: string) => /\d+(?:가\d*)?동$/.test(t); // 고덕2동·성수1가2동처럼 행정동
// 일반구가 있는 시 — 지도 역주소의 "평구"(마을 이름)처럼 구로 끝나는 다른 낱말을 구로 오인하지 않는다.
const GENERAL_GU: Record<string, string[]> = {
  수원시: ["장안구", "권선구", "팔달구", "영통구"], 성남시: ["수정구", "중원구", "분당구"], 고양시: ["덕양구", "일산동구", "일산서구"],
  용인시: ["처인구", "기흥구", "수지구"], 안양시: ["만안구", "동안구"], 안산시: ["상록구", "단원구"], 부천시: ["원미구", "소사구", "오정구"],
  화성시: ["만세구", "효행구", "병점구", "동탄구"], 청주시: ["상당구", "서원구", "흥덕구", "청원구"], 천안시: ["동남구", "서북구"],
  전주시: ["완산구", "덕진구"], 포항시: ["남구", "북구"], 창원시: ["의창구", "성산구", "마산합포구", "마산회원구", "진해구"],
};
const LEVEL = (t: string, f: Pick<Field, "sido" | "sigungu">): number => {
  if (provinceOf(t)) return 0;
  if (t === f.sigungu || /^[가-힣]+(?:시|군)$/.test(t) && !/(?:특별|광역|자치)시$/.test(t)) return 1;
  if (/^[가-힣]{1,5}구$/.test(t) && !/지구$/.test(t)) return 2;
  if (/^[가-힣]+(?:읍|면)$/.test(t)) return 3;
  if (isDong(t)) return 4;
  return -1;
};

const tidyParen = (inner: string, f: Pick<Field, "sido" | "sigungu">, head: string): string => {
  // 학교 위치 자료처럼 괄호 안에 시·도·시·군·구를 다시 적은 지번은 동·번지만 남긴다.
  const parts = inner.split(/\s+/).filter(Boolean);
  while (parts.length > 1 && (provinceOf(parts[0]) || parts[0] === f.sigungu || /^[가-힣]+(?:시|군|구|읍|면)$/.test(parts[0]) && head.includes(parts[0]))) parts.shift();
  // 붙여 쓴 지번만 띄운다(대연동918 → 대연동 918). 삼선동3가·중앙로3가 같은 법정동 이름은 그대로 둔다.
  return parts.join(" ").replace(/\s*,\s*/g, ", ").replace(/([동리가])(산?\d+(?:-\d+)?)(?=$|[\s,])/g, "$1 $2");
};

function refineKoreanOrder(f: Pick<Field, "name" | "sido" | "sigungu" | "team">, text: string): string {
  let s = text;
  // 붙여 쓴 행정구역·번지를 띄운다: 진월동406번지 → 진월동 406번지, 장학리산36번지 → 장학리 산36번지, 자양1동자양로 → 자양1동 자양로
  s = s.replace(/([가-힣]{1,6}\d*(?:동\d*가|동|가|리))(산?\d+(?:-\d+)?(?:번지)?)(?=\s|$|\()/g, "$1 $2");
  s = s.replace(/(\d+동|[가-힣]+\d+가)(?=[가-힣]+(?:로|길)\s*\d)/g, "$1 ");
  const tokens = s.split(" ");
  const first = provinceOf(tokens[0]);
  const rest = first ? tokens.slice(1) : tokens;
  let province = PROVINCES[f.sido];
  if (first === MERGED_PROVINCE && (f.sido === "광주" || f.sido === "전남")) province = MERGED_PROVINCE;
  else if (first && first !== f.sido && !MOVED[f.sido]?.some((m) => m.from === first && rest.includes(m.sigungu))) {
    // 시·도가 메타데이터와 다르면 원문 시·도를 지우지 않는다(행정구역 대조는 검토 목록에서 따로 본다).
    return [PROVINCES[first] ?? tokens[0], ...rest].join(" ");
  }
  const renamedFrom = RENAMED[f.sido]?.[f.sigungu] ?? [];
  if (rest[0] && renamedFrom.includes(rest[0])) rest[0] = f.sigungu;
  // 시·군·구가 빠진 원문만 메타데이터 시·군·구를 넣는다. 다른 구·군이 적혀 있으면 지우지 않고 검토 목록에서 대조한다.
  if (f.sido !== "세종" && rest[0] !== f.sigungu && ![1, 2].includes(LEVEL(rest[0] ?? "", f))) rest.unshift(f.sigungu);
  if (f.sido === "세종" && rest[0] === "세종") rest.shift();
  s = [province, ...rest].join(" ");

  // 도로명 + 건물번호가 있으면 뒤쪽을 상세주소(쉼표 뒤)와 참고항목(괄호)으로 나눈다.
  const m = s.match(/^(.*?[가-힣0-9·]+(?:로|길)\s?\d+(?:-\d+)?)(?![\d-]|번[가-힣]?길|로|길|(?:동|가|리)(?![가-힣])|번지)(.*)$/);
  if (!m) return dropTrailingName(f, s);
  let head = m[1].replace(/([가-힣0-9·]+(?:로|길))(\d+(?:-\d+)?)$/, "$1 $2");
  // 괄호 뒤에 띄어 쓴 숫자(호현로 387(소사본동) 41)는 지번인지 건물번호인지 알 수 없어 원문 그대로 둔다.
  const loose = m[2].match(/^\s*\(([^)]*)\)\s+(\d+(?:-\d+)?)$/);
  if (loose) return `${head} (${tidyParen(loose[1], f, head)}) ${loose[2]}`;
  let tail = m[2].trim();
  const parens: string[] = [];
  const details: string[] = [];
  let suffix = "";
  // 도로명 앞에 놓인 동은 참고항목으로 옮긴다(경기도 수원시 조원동 경수대로 893 → 경수대로 893 (조원동)).
  const lead = head.match(/\s([가-힣]{1,6}\d*(?:동\d*가|동|가))\s([가-힣0-9·]+(?:로|길)\s\d+(?:-\d+)?)$/);
  if (lead && isDong(lead[1])) { head = head.replace(` ${lead[1]} ${lead[2]}`, ` ${lead[2]}`); parens.push(lead[1]); }
  // 이미 정리된 "도로명 번호, 상세 (참고)" 형태는 그대로 다시 읽는다.
  const detail = tail.match(/^,\s*([^()]*?)\s*(?=\(|$)/);
  if (detail) { details.push(detail[1]); tail = tail.slice(detail[0].length).trim(); }
  const paren = tail.match(/^\(([^)]*)\)\s*(.*)$/);
  if (paren) { parens.splice(0, parens.length, tidyParen(paren[1], f, head)); tail = paren[2].trim(); }
  if (/^일원$/.test(tail)) { suffix = " 일원"; tail = ""; }
  for (const piece of tail.split(/\s*,\s*/).filter(Boolean)) {
    const p = piece.replace(/([동리가])(산?\d+(?:-\d+)?)(?=$|\s)/g, "$1 $2").trim();
    const compact = p.replace(/\s/g, "");
    const own = [f.name, f.team ?? ""].filter(Boolean).map((n) => n.replace(/\s/g, ""));
    const nameLike = own.some((n) => compact.includes(n) || compact.length >= 3 && n.includes(compact))
      || /(?:대학교|학교)(?:체육부|야구부)?$/.test(compact) && own.some((n) => compact.includes(n.replace(/(등학교|학교|대학교|대)$/, "")));
    if (nameLike) continue;
    if (/^\d+(?:-\d+)?$/.test(p) && parens.length === 1 && /^[가-힣]+(?:동\d*가|동|가|리)$/.test(parens[0])) { parens[0] = `${parens[0]} ${p}`; continue; }
    const lot = p.match(/^(?:[가-힣]+(?:읍|면)\s)?([가-힣]{1,6}\d*(?:동\d*가|동|가|리))\s(산?\d+(?:-\d+)?(?:번지)?)$/);
    if (lot) { const i = parens.indexOf(lot[1]); if (i >= 0) parens[i] = `${lot[1]} ${lot[2]}`; else parens.push(`${lot[1]} ${lot[2]}`); continue; }
    // 층·호·게이트, 가동·나동·상가동 같은 동(棟) 표시는 상세주소다.
    if (/층|호$|호\s|게이트/.test(p) || /^(?:[가나다라마바사아자차카타파하]|상가|본|별|신|구)동$/.test(p)) { details.push(p); continue; }
    parens.push(p);
  }
  const ref = parens.filter(Boolean);
  return `${head}${details.length ? `, ${details.join(" ")}` : ""}${suffix}${ref.length ? ` (${ref.join(", ")})` : ""}`;
}
// 끝에 붙은 시설·학교 이름(그 항목 자신)은 주소가 아니므로 뗀다. 다른 학교·시설 이름은 참고항목으로 남긴다.
function dropTrailingName(f: Pick<Field, "name" | "team">, s: string): string {
  const tokens = s.split(" ");
  const own = [f.name, f.team ?? ""].filter(Boolean).map((n) => n.replace(/\s/g, ""));
  while (tokens.length > 2) {
    const last = tokens[tokens.length - 1].replace(/\s/g, "");
    if (/\d/.test(last) && !/[가-힣]{2,}(?:학교|대학교)/.test(last) || /(?:로|길|동|리|가|읍|면|구|군|시)$/.test(last) && !/(?:학교|대학교|체육부)$/.test(last)) break;
    const isOwn = own.some((n) => last.includes(n) || n.includes(last) && last.length >= 3 || last.includes(n.replace(/(등학교|학교|대학교)$/, "")) && /(?:학교|대학교|체육부)$/.test(last));
    if (isOwn) { tokens.pop(); continue; }
    if (/(?:학교|대학교)$/.test(last)) { tokens[tokens.length - 1] = `(${last})`; }
    break;
  }
  return tokens.join(" ");
}

function refineReversed(f: Pick<Field, "name" | "sido" | "sigungu">, text: string): string {
  const parts = (text.includes(",") ? text.split(/\s*,\s*/) : text.split(" ")).map((p) => p.trim()).filter(Boolean);
  let gu: string | undefined, town: string | undefined, dong: string | undefined;
  let conflict = false;
  const firstAdmin = parts.findIndex((p) => LEVEL(p, f) >= 0);
  parts.forEach((p) => {
    const level = LEVEL(p, f);
    if (level === 0) return;
    if (level === 1) { if (p !== f.sigungu && !(f.sido === "세종" && p === "세종")) conflict = true; return; }
    if (level === 2) {
      if (p === f.sigungu) return;
      if (GENERAL_GU[f.sigungu]?.includes(p)) gu ??= p;
      else if (/^(?:서울|부산|대구|인천|광주|대전|울산)$/.test(f.sido)) conflict = true;
      return;
    }
    if (level === 3) { town ??= p; return; }
    // 법정동(고덕동·안암동2가·○○리)을 행정동(고덕2동)보다 우선한다. 작은 단위(원문 앞쪽)를 먼저 고른다.
    if (level === 4 && (!dong || isAdminDong(dong) && !isAdminDong(p))) dong = p;
  });
  // 역주소의 도로는 행정구역 바로 앞 조각이다. 그 앞의 상호·시설명(두배로 등)은 도로로 보지 않는다.
  const before = firstAdmin < 0 ? parts : parts.slice(0, firstAdmin);
  const roadAt = before.map((p, i) => (ROAD.test(p) && !NOT_ROAD.test(p) ? i : -1)).filter((i) => i >= 0).pop();
  const road = roadAt != null ? before[roadAt] : undefined;
  // 건물번호는 그 번호가 원문 맨 앞(시설 자신의 주소)일 때만 쓴다. 다른 상호 뒤의 번호는 그 상호의 주소다.
  const own = (p: string) => f.name.replace(/\s/g, "").includes(p.replace(/\s/g, ""));
  const number = roadAt != null && roadAt >= 1 && /^\d{1,4}(?:-\d+)?$/.test(before[roadAt - 1]) && before.slice(0, roadAt - 1).every(own) ? before[roadAt - 1] : undefined;
  const head = [PROVINCES[f.sido], f.sido === "세종" ? undefined : f.sigungu];
  // 다른 시·군·구 이름이 섞이면 경계가 불확실하므로 시·군·구까지만 쓴다.
  if (conflict) return head.filter(Boolean).join(" ");
  // 동과 읍·면이 함께 나오면 역주소가 경계를 섞은 것이므로 더 작은 단위(원문 앞쪽인 동)만 쓴다. 리는 읍·면 아래 단위라 함께 쓴다.
  if (dong && town && !/리$/.test(dong)) town = undefined;
  if (road && number) return [...head, gu, town, `${road} ${number}`].filter(Boolean).join(" ") + (dong && !/리$/.test(dong) ? ` (${dong})` : "");
  return [...head, gu, town, dong, road].filter(Boolean).join(" ");
}

export function refineFieldAddress(f: Pick<Field, "name" | "sido" | "sigungu" | "addr" | "team">): string | undefined {
  let text = (f.addr ?? "").replace(/[\u3000\s]+/g, " ").replace(/,\s*대한민국$|\s대한민국$/, "").trim();
  if (!text || !PROVINCES[f.sido]) return text || undefined;
  // 지도 역주소 앞의 시설 자신의 이름은 주소가 아니다(광주시 G-스타디움 야구장 …처럼 시·군 이름으로 시작하는 이름 포함).
  if (!provinceOf(text.split(/[\s,]/)[0]) && (text.startsWith(f.name + " ") || text.startsWith(f.name + ","))) text = text.slice(f.name.length).replace(/^[\s,]+/, "");
  text = text.replace(/\s*\(\s*/g, " (").replace(/\s*\)/g, ")").trim();
  // 큰 단위(시·도·시·군·구)부터 적은 한국식 원문인지, 작은 단위부터 적은 지도 역주소인지 행정구역 순서로 판단한다.
  // 한국식 원문은 시·도나 시·군·구로 시작한다. 지도 역주소는 도로·시설 이름으로 시작해 큰 단위로 끝난다.
  const firstLevel = LEVEL(text.split(/[\s,]/)[0], f);
  const korean = firstLevel === 0 || (firstLevel === 1 || firstLevel === 2) && !text.includes(",");
  return unifyProvinceName((korean ? refineKoreanOrder(f, text) : refineReversed(f, text)).replace(/\s+/g, " ").replace(/\s\)/g, ")").trim());
}

// ── 주소 후속 확인 표시 ─────────────────────────────────────────────────────
// 형식 점검일 뿐 공식 주소 검증이 아니다. 화면에는 쓰지 않고 data/fields-review-pending.json 에만 싣는다.
const REVIEW_OFFICE = /아파트|하이타운|하버빌|래미안|푸르지오|칸타빌|\d+동\s*\d+호|\d+층|지하층|\d{3,}호|\d+-\d+호/;
export function fieldAddressFlags(f: Pick<Field, "id" | "name" | "sido" | "sigungu" | "addr">): string[] {
  const address = f.addr?.trim() ?? "";
  if (!address) return ["주소 없음"];
  const flags: string[] = [];
  if (!hasFieldAddressNumber(address)) flags.push("번지·건물번호 미확인");
  const first = provinceOf(address.split(" ")[0]);
  const sameProvince = first === f.sido || first === MERGED_PROVINCE && (f.sido === "광주" || f.sido === "전남");
  if (!first) flags.push("시도 앞 표기 확인 필요");
  else if (!sameProvince) flags.push("원문 시·도와 메타데이터 시·도 다름");
  if (f.sido !== "세종" && !address.split(/[\s(),]+/).includes(f.sigungu)) flags.push("주소와 메타데이터 시군구 대조 필요");
  if (address === [PROVINCES[f.sido], f.sido === "세종" ? undefined : f.sigungu].filter(Boolean).join(" ")) flags.push("시·군·구까지만 확인(동·도로 미확인 또는 경계 혼재)");
  if (REVIEW_OFFICE.test(address)) flags.push("등록 주소가 사무실·주거지일 수 있음");
  if (/\)\s\d+(?:-\d+)?$/.test(address)) flags.push("괄호 뒤 숫자 용도 미확인(지번·건물번호 혼재)");
  if (/(?:로|길)\s\d{5,}(?![\d-])/.test(address)) flags.push("건물번호 자릿수 확인 필요");
  if (/연습장|실내|게이트볼|배팅|스크린/.test(f.name)) flags.push("실외 야구장이 아닐 수 있는 시설명");
  return flags;
}

const OFFICIAL_SOURCE = /data\.go\.kr|mcst\.go\.kr|gys\.or\.kr|goyang\.go\.kr|icsports\.or\.kr|icehs\.kr|gen\.go\.kr|jge\.go\.kr|smc\.seoul\.kr|yit\.ac\.kr|dalseong\.daegu\.kr/;
export function fieldAddressCheck(f: Pick<Field, "id" | "name" | "kind" | "sido" | "sigungu" | "addr" | "source">) {
  const address = f.addr?.trim() ?? "";
  const evidence = OFFICIAL_SOURCE.test(f.source ?? "") ? "공식 자료 원문 대조" : f.id.startsWith("osm:") ? "OSM 원문(역주소 정제)" : "기존 등록·수집 자료";
  return { id: f.id, name: f.name, kind: f.kind, sido: f.sido, sigungu: f.sigungu, address, evidence, source: f.source, hasNumber: hasFieldAddressNumber(address), flags: fieldAddressFlags(f) };
}
