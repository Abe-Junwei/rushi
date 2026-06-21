import { useCallback, useSyncExternalStore } from "react";
import { ChevronsLeftRight, Crosshair, type LucideIcon } from "lucide-react";
import { CONTROL_BTN_SECONDARY, CONTROL_SELECT } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  ENV_PANEL_PAGE_CLASS,
  ENV_PANEL_SECTION_CLASS,
  ENV_PANEL_FORM_FIELD_CLASS,
} from "../utils/environmentPanelNav";
import {
  formatWaveformPlaybackRateLabel,
  snapWaveformPlaybackRate,
  WAVEFORM_PLAYBACK_RATE_FASTER_PRESETS,
  WAVEFORM_PLAYBACK_RATE_SLOWER_PRESETS,
} from "../utils/waveformPlaybackRate";
import type { WaveformPlaybackScrollFollowMode } from "../utils/waveformPlaybackScrollFollow";
import {
  clampWaveformHeight,
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

  const setWaveformHeightPx = useCallback((raw: string) => {
    writeStoredWaveformHeightPx(clampWaveformHeight(Number(raw)));
  }, []);

  return (
    <div className={ENV_PANEL_PAGE_CLASS} data-purpose="env-preferences-page">
      <EnvAppearanceSections />

      <section className={ENV_PANEL_SECTION_CLASS} aria-label="转写与波形">
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>转写与波形</h3>
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
          与转写页工具条共用同一偏好；语段字体族、列宽等仍可在编辑器右键或拖拽调整。
        </p>

        <div className="flex flex-col gap-5">
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
            <span className="text-body font-medium text-notion-text">播放滚屏</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="播放滚屏方式">
              {SCROLL_FOLLOW_MODES.map(({ id, label, hint, Icon }) => {
                const active = playbackScrollFollow === id;
                return (
                  <button
                    key={id}
                    type="button"
                    title={hint}
                    aria-pressed={active}
                    className={[
                      "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-label font-medium transition-colors",
                      active
                        ? "border-accent-action bg-notion-sidebar-active text-notion-text"
                        : "border-notion-border bg-notion-bg text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text",
                    ].join(" ")}
                    onClick={() => setPlaybackScrollFollow(id)}
                  >
                    <Icon className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className={ENV_PANEL_FORM_FIELD_CLASS}>
            <span className="text-body font-medium text-notion-text">默认播放速度</span>
            <select
              className={CONTROL_SELECT}
              value={String(snapWaveformPlaybackRate(globalPlaybackRate))}
              onChange={(e) => setGlobalPlaybackRate(e.target.value)}
            >
              {PLAYBACK_RATE_PRESETS.map((rate) => (
                <option key={rate} value={rate}>
                  {formatWaveformPlaybackRateLabel(rate)}
                </option>
              ))}
            </select>
          </label>

          <label className={ENV_PANEL_FORM_FIELD_CLASS}>
            <span className="text-body font-medium text-notion-text">语段正文字号</span>
            <select
              className={CONTROL_SELECT}
              value={String(transcriptFontPx)}
              onChange={(e) => setTranscriptFontPx(e.target.value)}
            >
              {listTranscriptFontPxOptions().map((px) => (
                <option key={px} value={px}>
                  {px}px
                </option>
              ))}
            </select>
          </label>

          <label className={ENV_PANEL_FORM_FIELD_CLASS}>
            <span className="text-body font-medium text-notion-text">波形区域高度</span>
            <input
              className={CONTROL_SELECT}
              type="number"
              min={WAVEFORM_HEIGHT_MIN}
              max={WAVEFORM_HEIGHT_MAX}
              step={1}
              value={waveformHeightPx}
              onChange={(e) => setWaveformHeightPx(e.target.value)}
            />
            <span className="text-label text-notion-text-muted">
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
      </section>
    </div>
  );
}
