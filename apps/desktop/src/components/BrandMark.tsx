/** 书法单字 mark「如」；UI 用 PNG（居中可靠），矢量见 mark-master.svg */
import markOnPrimaryUrl from "../assets/brand/mark-ru-on-primary.png";
import markStandardUrl from "../assets/brand/mark-ru-standard.png";

export type BrandMarkVariant = "onPrimary" | "standard";

export type BrandMarkProps = {
  size?: number;
  variant?: BrandMarkVariant;
  className?: string;
};

export function BrandMark({ size = 18, variant = "standard", className }: BrandMarkProps) {
  const src = variant === "onPrimary" ? markOnPrimaryUrl : markStandardUrl;

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={["block shrink-0 object-contain", className].filter(Boolean).join(" ")}
    />
  );
}
