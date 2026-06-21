import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronsLeftRight, Crosshair, type LucideIcon } from "lucide-react";
import {
  CONTROL_BTN_SECONDARY,
  CONTROL_TEXT_INPUT,
} from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  ENV_PANEL_FORM_FIELD_CLASS,
  ENV_PANEL_FORM_FIELDS_CLASS,
  ENV_PANEL_PAGE_CLASS,
} from "../utils/environmentPanelNav";
import {
  formatWaveformPlaybackRateLabel,
  snapWaveformPlaybackRate,
  WAVEFORM_PLAYBACK_RATE_FASTER_PRESETS,
  WAVEFORM_PLAYBACK_RATE_SLOWER_PRESETS,
} from "../utils/waveformPlaybackRate";
import type { WaveformPlaybackScrollFollowMode } from "../utils/waveformPlaybackScrollFollow";
import {
  clampTranscriptFontPx,
  listTranscriptFontPxOptions,
  readStoredTabAdvanceLoopsSegment,
  readStoredWaveformGlobalPlaybackRate,
  readStoredWaveformMinimapEnabled,
  readStoredWaveformPlaybackScrollFollowMode,
  resetStoredEditorLayoutDefaults,
  resolveStoredTranscriptFontPx,
  resolveStoredWaveformHeightPx,
  subscribeWaveformPrefs,
  WAVEFORM_HEIGHT_DEFAULT,
  WAVEFORM_HEIGHT_MAX,
  WAVEFORM_HEIGHT_MIN,
  writeStoredP1TranscriptFontPx,
  writeStoredTabAdvanceLoopsSegment,
  writeStoredWaveformGlobalPlaybackRate,
  writeStoredWaveformHeightPx,
  writeStoredWaveformMinimapEnabled,
  writeStoredWaveformPlaybackScrollFollowMode,
} from "../utils/waveformPrefs";
import { EnvAppearanceSections } from "./EnvAppearanceSections";
import { EnvPanelSelect } from "./EnvPanelSelect";
import { EnvPrefGroupShell } from "./EnvPrefGroupShell";
import { EnvPrefSwitchRow } from "./EnvPrefSwitchRow";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const SCROLL_FOLLOW_MODES: Array<{
  id: WaveformPlaybackScrollFollowMode;
  label: string;
  hint: string;
  Icon: LucideIcon;
}> = [
  {
    id: "edge",
    label: "跟随",
    hint: "播放头在视口内移动，接近左右边缘时自动滚屏",
    Icon: ChevronsLeftRight,
  },
  {
    id: "center",
    label: "居中",
    hint: "播放头固定在视口中央，波形随播放平移",
    Icon: Crosshair,
  },
];

const PLAYBACK_RATE_PRESETS = [
  ...[...WAVEFORM_PLAYBACK_RATE_SLOWER_PRESETS].reverse(),
  1,
  ...WAVEFORM_PLAYBACK_RATE_FASTER_PRESETS,
];

export function EnvPreferencesPanel() {
  const tabAdvanceLoops = useSyncExternalStore(
    subscribeWaveformPrefs,
    readStoredTabAdvanceLoopsSegment,
    readStoredTabAdvanceLoopsSegment,
  );
  const minimapEnabled = useSyncExternalStore(
    subscribeWaveformPrefs,
    readStoredWaveformMinimapEnabled,
    readStoredWaveformMinimapEnabled,
  );
  const playbackScrollFollow = useSyncExternalStore(
    subscribeWaveformPrefs,
    readStoredWaveformPlaybackScrollFollowMode,
    readStoredWaveformPlaybackScrollFollowMode,
  );
  const globalPlaybackRate = useSyncExternalStore(
    subscribeWaveformPrefs,
    readStoredWaveformGlobalPlaybackRate,
    readStoredWaveformGlobalPlaybackRate,
  );
  const transcriptFontPx = useSyncExternalStore(
    subscribeWaveformPrefs,
    resolveStoredTranscriptFontPx,
    resolveStoredTranscriptFontPx,
  );
  const waveformHeightPx = useSyncExternalStore(
    subscribeWaveformPrefs,
    resolveStoredWaveformHeightPx,
    resolveStoredWaveformHeightPx,
  );

  const playbackRateOptions = useMemo(
    () =>
      PLAYBACK_RATE_PRESETS.map((rate) => ({
        id: String(rate),
        label: formatWaveformPlaybackRateLabel(rate),
      })),
    [],
  );
  const transcriptFontOptions = useMemo(
    () =>
      listTranscriptFontPxOptions().map((px) => ({
        id: String(px),
        label: `${px}px`,
      })),
    [],
  );
  const snappedPlaybackRate = String(snapWaveformPlaybackRate(globalPlaybackRate));
  const [waveformHeightDraft, setWaveformHeightDraft] = useState<string | null>(null);
  const waveformHeightInputValue = waveformHeightDraft ?? String(waveformHeightPx);

  useEffect(() => {
    setWaveformHeightDraft(null);
  }, [waveformHeightPx]);

  const commitWaveformHeightInput = useCallback((raw: string) => {
    setWaveformHeightDraft(null);
    const trimmed = raw.trim();
    if (trimmed === "") return;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return;
    writeStoredWaveformHeightPx(n);
  }, []);

  const setTabAdvanceLoops = useCallback((enabled: boolean) => {
    writeStoredTabAdvanceLoopsSegment(enabled);
  }, []);

  const setMinimapEnabled = useCallback((enabled: boolean) => {
    writeStoredWaveformMinimapEnabled(enabled);
  }, []);

  const setPlaybackScrollFollow = useCallback((mode: WaveformPlaybackScrollFollowMode) => {
    writeStoredWaveformPlaybackScrollFollowMode(mode);
  }, []);

  const setGlobalPlaybackRate = useCallback((raw: string) => {
    const rate = snapWaveformPlaybackRate(Number(raw));
    writeStoredWaveformGlobalPlaybackRate(rate);
  }, []);

  const setTranscriptFontPx = useCallback((raw: string) => {
    writeStoredP1TranscriptFontPx(clampTranscriptFontPx(Number(raw)));
  }, []);

  return (
    <div className={ENV_PANEL_PAGE_CLASS} data-purpose="env-preferences-page">
      <EnvPrefGroupShell title="外观" description="界面主题与强调色；变更后立即生效。">
        <EnvAppearanceSections />
      </EnvPrefGroupShell>

      <EnvPrefGroupShell
        title="转写与波形"
        description="与转写页工具条共用同一偏好；语段字体族、列宽等仍可在编辑器右键或拖拽调整。"
      >
        <div className={ENV_PANEL_FORM_FIELDS_CLASS}>
          <EnvPrefSwitchRow
            id="pref-tab-advance-loop"
            label="Tab 定稿后 loop 播下一段"
            hint="在语段正文按 Tab 确认并跳下一段时，自动 loop 播放新语段（听打默认开）。"
            checked={tabAdvanceLoops}
            onChange={setTabAdvanceLoops}
          />

          <EnvPrefSwitchRow
            id="pref-minimap"
            label="显示波形总览条"
            hint="主波形下方的 minimap 缩略导航。"
            checked={minimapEnabled}
            onChange={setMinimapEnabled}
          />

          <div className={ENV_PANEL_FORM_FIELD_CLASS}>
            <span className={PANEL_TYPOGRAPHY.fieldLabel}>播放滚屏</span>
            <div
              className="grid max-w-md grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="播放滚屏方式"
            >
              {SCROLL_FOLLOW_MODES.map(({ id, label, hint, Icon }) => {
                const active = playbackScrollFollow === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={hint}
                    className={[
                      "flex flex-col items-start gap-1 rounded-md px-3 py-2.5 text-left shadow-none transition-colors",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-action/30",
                      active
                        ? "bg-notion-sidebar-active text-notion-text ring-1 ring-accent-action/35"
                        : "bg-notion-sidebar text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text",
                    ].join(" ")}
                    onClick={() => setPlaybackScrollFollow(id)}
                  >
                    <span className="inline-flex items-center gap-1.5 text-body font-medium text-inherit">
                      <Icon className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                      {label}
                    </span>
                    <span className="text-label leading-snug text-notion-text-muted">{hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={ENV_PANEL_FORM_FIELD_CLASS}>
            <span className={PANEL_TYPOGRAPHY.fieldLabel}>默认播放速度</span>
            <div className="max-w-[12rem]">
              <EnvPanelSelect
                id="pref-playback-rate"
                aria-label="默认播放速度"
                value={snappedPlaybackRate}
                options={playbackRateOptions}
                onChange={setGlobalPlaybackRate}
              />
            </div>
          </div>

          <div className={ENV_PANEL_FORM_FIELD_CLASS}>
            <span className={PANEL_TYPOGRAPHY.fieldLabel}>语段正文字号</span>
            <div className="max-w-[12rem]">
              <EnvPanelSelect
                id="pref-transcript-font"
                aria-label="语段正文字号"
                value={String(transcriptFontPx)}
                options={transcriptFontOptions}
                onChange={setTranscriptFontPx}
              />
            </div>
          </div>

          <label htmlFor="pref-waveform-height" className={ENV_PANEL_FORM_FIELD_CLASS}>
            <span className={PANEL_TYPOGRAPHY.fieldLabel}>波形区域高度</span>
            <input
              id="pref-waveform-height"
              className={`${CONTROL_TEXT_INPUT} max-w-[12rem]`}
              type="number"
              inputMode="numeric"
              min={WAVEFORM_HEIGHT_MIN}
              max={WAVEFORM_HEIGHT_MAX}
              step={1}
              value={waveformHeightInputValue}
              onChange={(e) => setWaveformHeightDraft(e.target.value)}
              onBlur={(e) => commitWaveformHeightInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                commitWaveformHeightInput(e.currentTarget.value);
                e.currentTarget.blur();
              }}
            />
            <span className={PANEL_TYPOGRAPHY.meta}>
              {WAVEFORM_HEIGHT_MIN}–{WAVEFORM_HEIGHT_MAX}px；默认 {WAVEFORM_HEIGHT_DEFAULT}px
            </span>
          </label>

          <div>
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              onClick={() => resetStoredEditorLayoutDefaults()}
            >
              恢复字号与波形高度默认
            </button>
          </div>
        </div>
      </EnvPrefGroupShell>
    </div>
  );
}
