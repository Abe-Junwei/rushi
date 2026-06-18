import type { WelcomeSearchScope } from "../services/welcome/welcomeSearch";

type Props = {
  scope: WelcomeSearchScope;
  disabled?: boolean;
  onChange: (scope: WelcomeSearchScope) => void;
};

/** Scope filter chips inside the search panel (全部 / 仅文件 / 仅正文). */
export function WelcomeSearchScopeChips({ scope, disabled, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1 px-2.5 py-1.5" role="group" aria-label="结果筛选">
      {(
        [
          ["all", "全部"],
          ["file", "仅文件"],
          ["content", "仅正文"],
        ] as const
      ).map(([value, label]) => {
        const active = scope === value;
        return (
          <button
            key={value}
            type="button"
            className={[
              "rounded-full border px-2.5 py-0.5 text-label font-medium transition-colors",
              active
                ? "border-accent-action/40 bg-accent-action/10 text-notion-text"
                : "border-notion-border bg-notion-bg text-notion-text-muted hover:border-notion-text-light hover:text-notion-text",
            ].join(" ")}
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(value)}
          >
            {label}
          </button>
        );
      })}
      <span className="ml-auto text-label text-notion-text-light">Tab 切换筛选</span>
    </div>
  );
}
