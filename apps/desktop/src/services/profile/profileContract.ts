import {
  getLlmProviderDefinition,
  persistLlmRuntimeConfig,
  persistLlmPromptOverrides,
  buildProfilePromptSection,
  profilePromptSectionToOverrides,
  readLlmPromptOverridesFromStorage,
  readLlmRuntimeConfigFromStorage,
  type LlmProviderId,
  type SettingsProfilePromptSection,
} from "../postprocess/postprocessRuntimeContract";
import {
  getSttOnlineProviderDefinition,
  persistExternalSttOnlineRuntimeConfig,
  readExternalSttOnlineRuntimeConfigFromStorage,
} from "../stt/sttOnlineProviderContract";
import { readStoredLocalAsrHubModelId, resolveLocalAsrHubModelId, writeStoredLocalAsrHubModelId } from "../asr/localAsrModelCatalog";
import {
  readStoredLocalAsrRecognitionLanguage,
  writeStoredLocalAsrRecognitionLanguage,
  normalizeLocalAsrRecognitionLanguage,
} from "../asr/localAsrRecognitionLanguage";
import {
  applyOfficeAccentColor,
  readStoredOfficeAccentColor,
} from "../ui/officeAccentTheme";
import { applyOfficeShellTheme, readStoredOfficeShellThemeId } from "../ui/officeShellTheme";
import { isOfficeAccentThemeId, resolveAccentHexFromLegacyId } from "../../config/officeAccentThemes";
import { isOfficeShellThemeId, type OfficeShellThemeId } from "../../config/officeShellThemes";
import { normalizeAccentHex } from "../../utils/deriveAccentRamp";
import type { WaveformPlaybackScrollFollowMode } from "../../utils/waveformPlaybackScrollFollow";
import {
  clampTranscriptFontPx,
  clampWaveformHeight,
  notifyWaveformPrefsChanged,
  readStoredTabAdvanceLoopsSegment,
  readStoredWaveformGlobalPlaybackRate,
  readStoredWaveformMinimapEnabled,
  readStoredWaveformPlaybackScrollFollowMode,
  readStoredTranscriptPlaybackFollow,
  resolveStoredTranscriptFontPx,
  resolveStoredWaveformHeightPx,
  writeStoredP1TranscriptFontPx,
  writeStoredTabAdvanceLoopsSegment,
  writeStoredWaveformGlobalPlaybackRate,
  writeStoredWaveformHeightPx,
  writeStoredWaveformMinimapEnabled,
  writeStoredWaveformPlaybackScrollFollowMode,
  writeStoredTranscriptPlaybackFollow,
} from "../../utils/waveformPrefs";

export type SettingsProfileEditorSection = {
  tab_advance_loops_segment?: boolean;
  waveform_minimap?: boolean;
  playback_scroll_follow?: WaveformPlaybackScrollFollowMode;
  transcript_playback_follow?: boolean;
  global_playback_rate?: number;
  transcript_font_px?: number;
  waveform_height_px?: number;
  shell_theme?: OfficeShellThemeId;
  /** Free accent `#RRGGBB` (Obsidian-style). */
  accent_color?: string;
  /** @deprecated Prefer {@link accent_color}; legacy Fluent preset id. */
  accent_theme?: string;
};

export type SettingsProfileLocalAsrSection = {
  hub_model_id?: string;
  recognition_language?: string;
};

/** @deprecated 使用 {@link SettingsProfile} version 2 */
export type SettingsProfileV1 = {
  version: 1;
  llm?: {
    provider_id: LlmProviderId;
    base_url: string;
    model: string;
    api_key_id?: string;
    prompt?: SettingsProfilePromptSection;
  };
  online_stt?: {
    enabled: boolean;
    provider_id: string;
    endpoint?: string;
    app_key?: string;
    api_key_id?: string;
    timeout_ms: number;
  };
};

export type SettingsProfile = {
  version: 2;
  llm?: SettingsProfileV1["llm"];
  online_stt?: SettingsProfileV1["online_stt"];
  editor?: SettingsProfileEditorSection;
  local_asr?: SettingsProfileLocalAsrSection;
};

function buildProfileEditorSection(): SettingsProfileEditorSection {
  return {
    tab_advance_loops_segment: readStoredTabAdvanceLoopsSegment(),
    waveform_minimap: readStoredWaveformMinimapEnabled(),
    playback_scroll_follow: readStoredWaveformPlaybackScrollFollowMode(),
    transcript_playback_follow: readStoredTranscriptPlaybackFollow(),
    global_playback_rate: readStoredWaveformGlobalPlaybackRate(),
    transcript_font_px: resolveStoredTranscriptFontPx(),
    waveform_height_px: resolveStoredWaveformHeightPx(),
    shell_theme: readStoredOfficeShellThemeId(),
    accent_color: readStoredOfficeAccentColor(),
  };
}

function buildProfileLocalAsrSection(): SettingsProfileLocalAsrSection {
  return {
    hub_model_id: readStoredLocalAsrHubModelId(),
    recognition_language: readStoredLocalAsrRecognitionLanguage(),
  };
}

/** @deprecated 别名；导出为 version 2 profile */
export function buildSettingsProfileV1(): SettingsProfile {
  const llm = readLlmRuntimeConfigFromStorage();
  const promptOverrides = readLlmPromptOverridesFromStorage();
  const stt = readExternalSttOnlineRuntimeConfigFromStorage();
  const prompt = buildProfilePromptSection(promptOverrides);
  return {
    version: 2,
    llm: {
      provider_id: llm.providerId,
      base_url: llm.baseUrl,
      model: llm.model,
      ...(llm.apiKeyId ? { api_key_id: llm.apiKeyId } : {}),
      ...(prompt ? { prompt } : {}),
    },
    online_stt: {
      enabled: stt.enabled,
      provider_id: stt.selectedProviderId,
      ...(stt.endpoint ? { endpoint: stt.endpoint } : {}),
      ...(stt.appKey ? { app_key: stt.appKey } : {}),
      ...(stt.apiKeyId ? { api_key_id: stt.apiKeyId } : {}),
      timeout_ms: stt.timeoutMs,
    },
    editor: buildProfileEditorSection(),
    local_asr: buildProfileLocalAsrSection(),
  };
}

function applyProfileEditorSection(editor: SettingsProfileEditorSection | undefined): void {
  if (!editor) return;
  if (editor.tab_advance_loops_segment != null) {
    writeStoredTabAdvanceLoopsSegment(editor.tab_advance_loops_segment);
  }
  if (editor.waveform_minimap != null) {
    writeStoredWaveformMinimapEnabled(editor.waveform_minimap);
  }
  if (editor.playback_scroll_follow != null) {
    writeStoredWaveformPlaybackScrollFollowMode(editor.playback_scroll_follow);
  }
  if (editor.transcript_playback_follow != null) {
    writeStoredTranscriptPlaybackFollow(editor.transcript_playback_follow);
  }
  if (editor.global_playback_rate != null) {
    writeStoredWaveformGlobalPlaybackRate(editor.global_playback_rate);
  }
  if (editor.transcript_font_px != null) {
    writeStoredP1TranscriptFontPx(clampTranscriptFontPx(editor.transcript_font_px));
  }
  if (editor.waveform_height_px != null) {
    writeStoredWaveformHeightPx(clampWaveformHeight(editor.waveform_height_px));
  }
  if (editor.shell_theme && isOfficeShellThemeId(editor.shell_theme)) {
    applyOfficeShellTheme(editor.shell_theme);
  }
  const accentFromColor = normalizeAccentHex(editor.accent_color);
  if (accentFromColor) {
    applyOfficeAccentColor(accentFromColor);
  } else if (editor.accent_theme && isOfficeAccentThemeId(editor.accent_theme)) {
    applyOfficeAccentColor(resolveAccentHexFromLegacyId(editor.accent_theme));
  }
  notifyWaveformPrefsChanged();
}

function applyProfileLocalAsrSection(localAsr: SettingsProfileLocalAsrSection | undefined): void {
  if (!localAsr) return;
  if (localAsr.hub_model_id) {
    writeStoredLocalAsrHubModelId(resolveLocalAsrHubModelId(localAsr.hub_model_id));
  }
  if (localAsr.recognition_language) {
    writeStoredLocalAsrRecognitionLanguage(
      normalizeLocalAsrRecognitionLanguage(localAsr.recognition_language),
    );
  }
}

function applyProfileV1Sections(profile: SettingsProfileV1 | SettingsProfile): void {
  if (profile.llm) {
    if (!getLlmProviderDefinition(profile.llm.provider_id)) {
      throw new Error(`不支持的 LLM provider：${profile.llm.provider_id}`);
    }
    persistLlmRuntimeConfig({
      providerId: profile.llm.provider_id,
      baseUrl: profile.llm.base_url,
      model: profile.llm.model,
      ...(profile.llm.api_key_id ? { apiKeyId: profile.llm.api_key_id } : {}),
    });
    if (profile.llm.prompt !== undefined) {
      persistLlmPromptOverrides(profilePromptSectionToOverrides(profile.llm.prompt));
    }
  }

  if (profile.online_stt) {
    if (!getSttOnlineProviderDefinition(profile.online_stt.provider_id)) {
      throw new Error(`不支持的在线 STT provider：${profile.online_stt.provider_id}`);
    }
    persistExternalSttOnlineRuntimeConfig({
      enabled: profile.online_stt.enabled,
      selectedProviderId: profile.online_stt.provider_id,
      endpoint: profile.online_stt.endpoint,
      appKey: profile.online_stt.app_key,
      timeoutMs: profile.online_stt.timeout_ms,
      ...(profile.online_stt.api_key_id ? { apiKeyId: profile.online_stt.api_key_id } : {}),
    });
  }
}

export function applySettingsProfileV1(profile: SettingsProfileV1 | SettingsProfile): void {
  const { version } = profile;
  if (version !== 1 && version !== 2) {
    throw new Error(`仅支持导入 version=1 或 2 的 profile，当前为 ${String(version)}。`);
  }

  applyProfileV1Sections(profile);

  if (version === 2) {
    applyProfileEditorSection(profile.editor);
    applyProfileLocalAsrSection(profile.local_asr);
  }
}
