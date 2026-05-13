/**
 * Plugin system types for Rushi.
 *
 * Plugins are ES modules that export an `activate(context)` function.
 * They register capabilities into extension points (TTS, export formats, etc.)
 * via the PluginContext provided at load time.
 */

/** Unique identifier for an extension point. */
export type ExtensionPointId =
  | "tts.provider"
  | "export.format"
  | "menu.item"
  | "command.palette"
  | "segment.decorator";

/** Opaque handle returned when registering an extension; used to unregister. */
export type ExtensionHandle = string;

/** Base shape for every extension contribution. */
export interface ExtensionContribution {
  id: string;
  name: string;
  description?: string;
}

// ── TTS extension point ────────────────────────────────────────────────

export interface TtsProvider extends ExtensionContribution {
  type: "tts.provider";
  synthesize(params: TtsSynthesizeParams): Promise<TtsResult>;
  voices(): Promise<TtsVoice[]>;
}

export interface TtsSynthesizeParams {
  text: string;
  voiceId?: string;
  speed?: number;
}

export interface TtsResult {
  audioBlob: Blob;
  durationMs: number;
}

export interface TtsVoice {
  id: string;
  name: string;
  lang: string;
}

// ── Export format extension point ──────────────────────────────────────

export interface ExportFormat extends ExtensionContribution {
  type: "export.format";
  /** File extension without dot, e.g. "md", "srt". */
  ext: string;
  mimeType: string;
  export(params: ExportParams): Promise<string>;
}

export interface ExportParams {
  projectName: string;
  segments: Array<{
    idx: number;
    startSec: number;
    endSec: number;
    text: string;
  }>;
}

// ── Menu item extension point ──────────────────────────────────────────

export interface MenuItem extends ExtensionContribution {
  type: "menu.item";
  /** Where to place the menu item. */
  location: "project" | "segment" | "toolbar";
  icon?: string;
  action(): void | Promise<void>;
}

// ── Command palette extension point ────────────────────────────────────

export interface CommandPaletteItem extends ExtensionContribution {
  type: "command.palette";
  keywords: string[];
  action(): void | Promise<void>;
}

// ── Segment decorator extension point ──────────────────────────────────

export interface SegmentDecorator extends ExtensionContribution {
  type: "segment.decorator";
  decorate(segmentText: string): string;
}

/** Union of all possible extension contributions. */
export type ExtensionContributionUnion =
  | TtsProvider
  | ExportFormat
  | MenuItem
  | CommandPaletteItem
  | SegmentDecorator;

// ── Plugin manifest ────────────────────────────────────────────────────

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  /** Minimum Rushi app version required. */
  minAppVersion?: string;
  /** Absolute or relative URL to the plugin entry module. */
  entry: string;
}

/** Context passed to `activate()` when a plugin is loaded. */
export interface PluginContext {
  /** Register an extension contribution. Returns a handle for later unregister. */
  register(contribution: ExtensionContributionUnion): ExtensionHandle;
  /** Unregister a previously-registered extension. */
  unregister(handle: ExtensionHandle): void;
  /** Read-only access to currently loaded manifest. */
  manifest: PluginManifest;
  /** Emit a custom event that other plugins or the host can listen to. */
  emit(event: string, payload?: unknown): void;
  /** Subscribe to host or plugin events. */
  on(event: string, handler: (payload?: unknown) => void): () => void;
}

/** Every plugin module must default-export an object with at least `activate`. */
export interface PluginModule {
  activate(context: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
