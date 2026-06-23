// Nike.md 핵심 컴포넌트의 React 래퍼. 스타일은 components.css 가 담당.
import type { ButtonHTMLAttributes, ReactNode } from "react";

type BtnVariant = "primary" | "secondary" | "on-image";

export function Button({
  variant = "primary",
  sm,
  block,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  sm?: boolean;
  block?: boolean;
  children: ReactNode;
}) {
  const cls = [
    "btn",
    `btn--${variant}`,
    sm ? "btn--sm" : "",
    block ? "btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      className={`chip ${active ? "chip--active" : ""}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function SectionHead({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <h2 className="heading-xl">{title}</h2>
      {action}
    </div>
  );
}
