import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  WAVEFORM_PLAYBACK_SCROLL_FOLLOW_GROUP_LABEL,
  WAVEFORM_PLAYBACK_SCROLL_FOLLOW_UI_MODES,
} from "../utils/waveformPlaybackScrollFollowUi";
import {
  clampTranscriptFontPx,
  listTranscriptFontPxOptions,
  readStoredTabAdvanceLoopsSegment,
  readStoredWaveformGlobalPlaybackRate,
  readStoredWaveformMinimapEnabled,
  readStoredWaveformPlaybackScrollFollowMode,
  readStoredTranscriptPlaybackFollow,
  resetStoredEditorLayoutDefaults,
  resolveStoredTranscriptFontPx,
  resolveStoredWaveformHeightPx,
  subscribeWaveformPrefs,
  WAVEFORM_HEIGHT_MAX,
  WAVEFORM_HEIGHT_MIN,
  writeStoredP1TranscriptFontPx,
  writeStoredTabAdvanceLoopsSegment,
  writeStoredWaveformGlobalPlaybackRate,
  writeStoredWaveformHeightPx,
  writeStoredWaveformMinimapEnabled,
  writeStoredWaveformPlaybackScrollFollowMode,
  writeStoredTranscriptPlaybackFollow,
} from "../utils/waveformPrefs";
import { EnvAppearanceSections } from "./EnvAppearanceSections";
import { EnvLibraryLocationSection } from "./EnvLibraryLocationSection";
import { EnvPanelSelect } from "./EnvPanelSelect";
import { EnvPrefGroupShell } from "./EnvPrefGroupShell";
import { EnvPrefSwitchRow } from "./EnvPrefSwitchRow";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

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
  const transcriptPlaybackFollow = useSyncExternalStore(
    subscribeWaveformPrefs,
    readStoredTranscriptPlaybackFollow,
    readStoredTranscriptPlaybackFollow,
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

  const setTranscriptPlaybackFollow = useCallback((enabled: boolean) => {
    writeStoredTranscriptPlaybackFollow(enabled);
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
      <EnvPrefGroupShell title="外观" description="界面主题、强调色与界面缩放；变更后立即生效。">
        <EnvAppearanceSections />
      </EnvPrefGroupShell>

      <EnvPrefGroupShell
        title="转写与波形"
        description="与转写页工具条共用同一偏好；语段字体族等仍可在编辑器右键调整，语段高度可在悬停语段行底缘拖拽。"
      >
        <div className={ENV_PANEL_FORM_FIELDS_CLASS}>
          <EnvPrefSwitchRow
            id="pref-tab-advance-loop"
            label="跳段后 loop 播新语段"
            hint="在语段正文按 Enter 一校、Ctrl/⌘+Enter 定稿或 Tab 跳到下一段后，自动 loop 播放新语段（默认关）。"
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

          <EnvPrefSwitchRow
            id="pref-transcript-playback-follow"
            label="文稿跟随播放"
            hint="播放时弱高亮当前播出语段并自动滚入视口；不改变选中。正在编辑或点选其他语段时暂停跟滚。"
            checked={transcriptPlaybackFollow}
            onChange={setTranscriptPlaybackFollow}
          />

          <div className={ENV_PANEL_FORM_FIELD_CLASS}>
            <span className={PANEL_TYPOGRAPHY.fieldLabel}>播放头滚屏</span>
            <div
              className="grid max-w-md grid-cols-2 gap-2"
              role="radiogroup"
              aria-label={WAVEFORM_PLAYBACK_SCROLL_FOLLOW_GROUP_LABEL}
            >
              {WAVEFORM_PLAYBACK_SCROLL_FOLLOW_UI_MODES.map(({ id, label, title, hint, Icon }) => {
                const active = playbackScrollFollow === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={title}
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
                      <Icon className={LUCIDE_ICON_SIZE_MD} stroke={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                      {label}
                    </span>
                    <span className="text-label leading-snug text-notion-text-muted">{hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className={ENV_PANEL_FORM_FIELD_CLASS}>
              <span className={PANEL_TYPOGRAPHY.fieldLabel}>默认播放速度</span>
              <EnvPanelSelect
                id="pref-playback-rate"
                aria-label="默认播放速度"
                value={snappedPlaybackRate}
                options={playbackRateOptions}
                onChange={setGlobalPlaybackRate}
              />
            </div>

            <div className={ENV_PANEL_FORM_FIELD_CLASS}>
              <span className={PANEL_TYPOGRAPHY.fieldLabel}>语段正文字号</span>
              <EnvPanelSelect
                id="pref-transcript-font"
                aria-label="语段正文字号"
                value={String(transcriptFontPx)}
                options={transcriptFontOptions}
                onChange={setTranscriptFontPx}
              />
            </div>

            <label htmlFor="pref-waveform-height" className={ENV_PANEL_FORM_FIELD_CLASS}>
              <span className={PANEL_TYPOGRAPHY.fieldLabel}>
                波形高度
                <span className="ml-1 font-normal text-notion-text-muted">
                  ({WAVEFORM_HEIGHT_MIN}–{WAVEFORM_HEIGHT_MAX})
                </span>
              </span>
              <input
                id="pref-waveform-height"
                className={CONTROL_TEXT_INPUT}
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
            </label>
          </div>

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

      <EnvLibraryLocationSection />
    </div>
  );
}
