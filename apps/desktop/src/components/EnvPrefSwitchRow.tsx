type EnvPrefSwitchRowProps = {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function EnvPrefSwitchRow({
  id,
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: EnvPrefSwitchRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-body font-medium text-notion-text">
          {label}
        </label>
        {hint ? <p className="m-0 mt-1 text-label leading-snug text-notion-text-muted">{hint}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className="waveform-minimap-switch shrink-0"
        onClick={() => onChange(!checked)}
      >
        <span className="waveform-minimap-switch-thumb" aria-hidden />
      </button>
    </div>
  );
}
