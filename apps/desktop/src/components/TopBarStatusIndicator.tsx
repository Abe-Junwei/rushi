import { ENV_STATUS_DOT_CLASS, envStatusToneFromOk, type EnvStatusTone } from "./topBarStatusTone";

type Props = {
  label: string;
  /** @deprecated 优先使用 tone */
  ok?: boolean;
  tone?: EnvStatusTone;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
};

const labelClass = "text-[11px] font-medium text-notion-text-muted";

const rowClass = "flex items-center gap-1.5";

function resolveTone(props: Props): EnvStatusTone {
  if (props.tone) return props.tone;
  return envStatusToneFromOk(props.ok === true);
}

/**
 * 欢迎页 / 编辑器顶栏状态芯片（FFmpeg、ASR 就绪、LLM 就绪共用）。
 */
export function TopBarStatusIndicator(props: Props) {
  const { label, onClick, disabled, title } = props;
  const tone = resolveTone(props);
  const dot = (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${ENV_STATUS_DOT_CLASS[tone]}`}
      aria-hidden
    />
  );
  const text = <span className={labelClass}>{label}</span>;

  if (onClick) {
    return (
      <button
        type="button"
        className={`${rowClass} rounded-md border-0 bg-transparent p-0 outline-none transition-colors hover:bg-notion-sidebar-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/30 disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={disabled}
        onClick={onClick}
        title={title ?? label}
        aria-label={title ?? label}
      >
        {dot}
        {text}
      </button>
    );
  }

  return (
    <div className={rowClass} title={title}>
      {dot}
      {text}
    </div>
  );
}
