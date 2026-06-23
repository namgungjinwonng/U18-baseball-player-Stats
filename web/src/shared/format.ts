// 야구 기록 포맷 유틸.

// 타율/출루율/장타율: 0.333 -> ".333", 1.000 -> "1.000"
export function rate(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return "-";
  const s = v.toFixed(3);
  return v < 1 ? s.replace(/^0/, "") : s;
}

// 평균자책/WHIP 등 일반 소수 2자리.
export function dec2(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return "-";
  return v.toFixed(2);
}

// 이닝 표기: 6.2 (6과 1/3,2/3) 그대로 노출.
export function inn(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return "-";
  return v.toFixed(1);
}

export function int(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return "-";
  return String(v);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
