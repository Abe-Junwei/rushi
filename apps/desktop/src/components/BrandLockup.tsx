import { BrandMark } from "./BrandMark";

export type BrandLockupSize = "sidebar" | "about";

export type BrandLockupProps = {
  size?: BrandLockupSize;
  className?: string;
};

const LOCKUP_BY_SIZE = {
  sidebar: {
    boxClass: "h-8 w-8",
    markSize: 26,
    gapClass: "gap-3",
    titleClass: "text-heading font-medium leading-[1.4]",
  },
  about: {
    boxClass: "h-12 w-12",
    markSize: 40,
    gapClass: "gap-4",
    titleClass: "text-heading font-medium leading-[1.4]",
  },
} as const;

const WORDMARK = "如是我闻";
const TAGLINE = "本地课录音转写与校对";

export function BrandLockup({ size = "sidebar", className }: BrandLockupProps) {
  const config = LOCKUP_BY_SIZE[size];

  return (
    <div className={["flex items-center", config.gapClass, className].filter(Boolean).join(" ")}>
      <div
        className={[
          "flex shrink-0 items-center justify-center rounded bg-zen-primary-action-bg text-zen-primary-action-fg",
          config.boxClass,
        ].join(" ")}
      >
        <BrandMark size={config.markSize} variant="onPrimary" />
      </div>
      <div>
        {size === "sidebar" ? (
          <h1 className={`m-0 font-serif text-notion-text ${config.titleClass}`}>{WORDMARK}</h1>
        ) : (
          <p className={`m-0 font-serif text-notion-text ${config.titleClass}`}>{WORDMARK}</p>
        )}
        <p className="m-0 mt-0.5 text-label font-medium leading-snug text-notion-text-muted">{TAGLINE}</p>
      </div>
    </div>
  );
}
