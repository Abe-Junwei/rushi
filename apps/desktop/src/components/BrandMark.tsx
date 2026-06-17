/** 栏线 + 校订痕占位 mark（mark-v0-placeholder）；定稿后替换 SVG 路径，见 assets/brand/ */
export type BrandMarkVariant = "onPrimary" | "standard";

export type BrandMarkProps = {
  size?: number;
  variant?: BrandMarkVariant;
  className?: string;
};

export function BrandMark({ size = 18, variant = "standard", className }: BrandMarkProps) {
  const columnStroke =
    variant === "onPrimary" ? "var(--zen-primary-action-fg)" : "var(--zen-ink)";
  const accentStroke =
    variant === "onPrimary" ? "var(--zen-primary-action-fg)" : "var(--zen-saffron)";
  const accentOpacity = variant === "onPrimary" ? 0.75 : 1;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <line
        x1="10"
        y1="9"
        x2="10"
        y2="23"
        stroke={columnStroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="9"
        x2="16"
        y2="23"
        stroke={columnStroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="22"
        y1="9"
        x2="22"
        y2="23"
        stroke={columnStroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="14.5"
        y1="16"
        x2="17.5"
        y2="16"
        stroke={accentStroke}
        strokeWidth="2"
        strokeLinecap="round"
        opacity={accentOpacity}
      />
    </svg>
  );
}
