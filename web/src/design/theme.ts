// Nike.md 토큰의 TS 미러 — 컴포넌트에서 타입 안전하게 참조.
// 색/간격/radius 값은 tokens.css 의 CSS 변수와 1:1 대응한다.

export const colors = {
  ink: "var(--color-ink)",
  canvas: "var(--color-canvas)",
  onPrimary: "var(--color-on-primary)",
  softCloud: "var(--color-soft-cloud)",
  hairline: "var(--color-hairline)",
  hairlineSoft: "var(--color-hairline-soft)",
  charcoal: "var(--color-charcoal)",
  mute: "var(--color-mute)",
  stone: "var(--color-stone)",
  sale: "var(--color-sale)",
  success: "var(--color-success)",
  info: "var(--color-info)",
  accentTeal: "var(--color-accent-teal)",
} as const;

export const space = {
  xxs: "var(--space-xxs)",
  xs: "var(--space-xs)",
  sm: "var(--space-sm)",
  md: "var(--space-md)",
  lg: "var(--space-lg)",
  xl: "var(--space-xl)",
  xxl: "var(--space-xxl)",
  section: "var(--space-section)",
} as const;

export const radius = {
  none: "var(--radius-none)",
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  full: "var(--radius-full)",
} as const;
