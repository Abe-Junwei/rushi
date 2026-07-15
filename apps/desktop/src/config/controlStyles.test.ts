import { describe, expect, it } from "vitest";
import {
  CONTROL_BTN_BREADCRUMB,
  CONTROL_BTN_COMPACT_SECONDARY,
  CONTROL_BTN_DANGER,
  CONTROL_BTN_DANGER_COMPACT,
  CONTROL_BTN_GHOST,
  CONTROL_BTN_ICON_GHOST,
  CONTROL_BTN_LINK,
  CONTROL_BTN_PRIMARY,
  CONTROL_BTN_STATUS_CHIP,
  CONTROL_BTN_TOOLBAR_GHOST,
  CONTROL_BTN_WELCOME_ICON,
  CONTROL_BTN_WORKSPACE_IMPORT,
  CONTROL_TEXTAREA,
  ENV_COMPACT_BTN,
  ENV_MONO_FIELD,
  ENV_LLM_MODE_TOGGLE_TRACK,
  ENV_SEGMENTED_ROW,
  ENV_SEGMENTED_TOGGLE_TRACK_COMPACT,
  envLlmModeToggleBtnClass,
  envSegmentedToggleBtnClass,
  envSegmentedToggleTrackClass,
  CONTROL_BTN_PRIMARY_PROMINENT,
  CONTROL_BTN_SECONDARY,
  CONTROL_BTN_SECONDARY_PROMINENT,
  CONTROL_SELECT,
  CONTROL_TEXT_INPUT,
} from "./controlStyles";

describe("controlStyles", () => {
  it("uses Notion Zen 4px radius (rounded-sm)", () => {
    expect(CONTROL_BTN_PRIMARY).toContain("rounded-sm");
    expect(CONTROL_BTN_SECONDARY).toContain("rounded-sm");
    expect(CONTROL_TEXT_INPUT).toContain("rounded-sm");
    expect(CONTROL_SELECT).toContain("rounded-sm");
  });

  it("uses rem-scalable 32px control height at 100% scale", () => {
    expect(CONTROL_BTN_PRIMARY).toContain("h-8");
    expect(CONTROL_BTN_PRIMARY).toContain("min-h-8");
    expect(CONTROL_TEXT_INPUT).toContain("min-h-8");
  });

  it("uses shadow-none on text inputs", () => {
    expect(CONTROL_TEXT_INPUT).toContain("shadow-none");
    expect(CONTROL_SELECT).toContain("shadow-none");
  });

  it("ghost and link buttons flatten UA gray fill", () => {
    expect(CONTROL_BTN_GHOST).toContain("bg-transparent");
    expect(CONTROL_BTN_LINK).toContain("bg-transparent");
    expect(CONTROL_BTN_LINK).toContain("border-0");
  });

  it("exposes env panel compact control token", () => {
    expect(ENV_COMPACT_BTN).toContain("rounded-sm");
    expect(ENV_COMPACT_BTN).toContain("border-notion-border");
    expect(ENV_MONO_FIELD).toContain("font-mono");
  });

  it("matches Stitch LLM mode state toggle control", () => {
    expect(ENV_SEGMENTED_ROW).toContain("justify-center");
    expect(ENV_LLM_MODE_TOGGLE_TRACK).toContain("bg-secondary-container");
    expect(ENV_LLM_MODE_TOGGLE_TRACK).toContain("inline-flex");
    expect(envLlmModeToggleBtnClass(false)).toContain("text-notion-text-variant");
    expect(envLlmModeToggleBtnClass(false)).toContain("bg-transparent");
    expect(envLlmModeToggleBtnClass(true)).toContain("text-accent-action-strong");
    expect(envLlmModeToggleBtnClass(true)).toContain("bg-notion-bg");
  });

  it("uses box-border on text controls (portal dialogs outside .workspace)", () => {
    expect(CONTROL_TEXT_INPUT).toContain("box-border");
    expect(CONTROL_TEXTAREA).toContain("box-border");
    expect(CONTROL_SELECT).toContain("box-border");
  });

  it("uses sidebar + hairline for secondary and canvas for inputs", () => {
    expect(CONTROL_BTN_SECONDARY).toContain("bg-notion-sidebar");
    expect(CONTROL_BTN_SECONDARY).toContain("border-notion-border");
    expect(CONTROL_TEXT_INPUT).toContain("bg-notion-bg");
  });

  it("uses outline danger (cinnabar border/text, fill on hover)", () => {
    expect(CONTROL_BTN_DANGER).toContain("border-zen-cinnabar");
    expect(CONTROL_BTN_DANGER).toContain("text-zen-cinnabar");
    expect(CONTROL_BTN_DANGER).toContain("hover:bg-zen-cinnabar");
    expect(CONTROL_BTN_DANGER_COMPACT).toContain("border-zen-cinnabar");
    expect(CONTROL_BTN_DANGER_COMPACT).toContain("text-zen-cinnabar");
  });

  it("uses saffron + ink at rest, white on hover (WCAG AA)", () => {
    expect(CONTROL_BTN_PRIMARY).toContain("bg-zen-primary-action-bg");
    expect(CONTROL_BTN_PRIMARY).toContain("text-zen-primary-action-fg");
    expect(CONTROL_BTN_PRIMARY).toContain("hover:bg-zen-primary-action-bg-hover");
    expect(CONTROL_BTN_PRIMARY).toContain("hover:text-zen-primary-action-fg-hover");
    expect(CONTROL_BTN_PRIMARY_PROMINENT).toContain("bg-zen-primary-action-bg");
  });

  it("uses body (12px) semibold on standard buttons (panel rhythm)", () => {
    expect(CONTROL_BTN_PRIMARY).toContain("text-body");
    expect(CONTROL_BTN_PRIMARY).toContain("font-semibold");
    expect(CONTROL_BTN_SECONDARY).toContain("text-body");
  });

  it("exposes toolbar ghost and workspace import tokens", () => {
    expect(CONTROL_BTN_TOOLBAR_GHOST).toContain("rounded-sm");
    expect(CONTROL_BTN_TOOLBAR_GHOST).toContain("text-body");
    expect(CONTROL_BTN_WORKSPACE_IMPORT).toContain("h-7");
    expect(CONTROL_BTN_COMPACT_SECONDARY).toContain("text-label");
  });

  it("exposes prominent rem-scalable hero controls", () => {
    expect(CONTROL_BTN_PRIMARY_PROMINENT).toContain("h-10");
    expect(CONTROL_BTN_PRIMARY_PROMINENT).toContain("min-h-10");
    expect(CONTROL_BTN_SECONDARY_PROMINENT).toContain("rounded-sm");
    expect(CONTROL_BTN_PRIMARY_PROMINENT).toContain("text-sm");
  });

  it("exposes icon ghost and compact segmented toggle API", () => {
    expect(CONTROL_BTN_ICON_GHOST).toContain("h-7");
    expect(CONTROL_BTN_ICON_GHOST).toContain("rounded-sm");
    expect(CONTROL_TEXTAREA).toContain("rounded-sm");
    expect(ENV_SEGMENTED_TOGGLE_TRACK_COMPACT).toContain("bg-secondary-container");
    expect(envSegmentedToggleTrackClass(true)).toBe(ENV_SEGMENTED_TOGGLE_TRACK_COMPACT);
    expect(envSegmentedToggleBtnClass(true, true)).toContain("bg-notion-bg");
    expect(envSegmentedToggleBtnClass(false, true)).toContain("bg-transparent");
  });

  it("exposes top bar and breadcrumb chip tokens", () => {
    expect(CONTROL_BTN_STATUS_CHIP).toContain("bg-transparent");
    expect(CONTROL_BTN_STATUS_CHIP).toContain("hover:bg-notion-sidebar-hover");
    expect(CONTROL_BTN_BREADCRUMB).toContain("truncate");
    expect(CONTROL_BTN_BREADCRUMB).toContain("text-title");
    expect(CONTROL_BTN_WELCOME_ICON).toContain("rounded-full");
    expect(CONTROL_BTN_WELCOME_ICON).toContain("bg-transparent");
  });
});
