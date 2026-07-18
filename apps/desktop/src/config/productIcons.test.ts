import { describe, expect, it } from "vitest";
import {
  IconArrowsUpDown as ArrowDownUp,
  IconChartBar as BarChart3,
  IconBookmarks as BookMarked,
  IconBooks as Books,
  IconRobot as Bot,
  IconBrain as Brain,
  IconCircleCaretRight as CirclePlay,
  IconCloud as Cloud,
  IconCpu as Cpu,
  IconEyeCheck as EyeCheck,
  IconFileText as FileText,
  IconHome as Home,
  IconInfoCircle as Info,
  IconKeyboard as Keyboard,
  IconListCheck as ListChecks,
  IconMessage as MessageSquare,
  IconMicrophone as Mic,
  IconPalette as Palette,
  IconPlayerPause as Pause,
  IconPlayerPlay as Play,
  IconReplace as Replace,
  IconTarget as Target,
  IconWand as Wand2,
} from "@tabler/icons-react";
import { PRODUCT_ICON } from "./productIcons";

describe("productIcons", () => {
  it("maps welcome sidebar primary nav icons", () => {
    expect(PRODUCT_ICON.navHome).toBe(Home);
    expect(PRODUCT_ICON.navTranscript).toBe(FileText);
    expect(PRODUCT_ICON.navGlossary).toBe(Books);
  });

  it("assigns distinct icons for former Sparkles conflicts", () => {
    expect(PRODUCT_ICON.navLlm).toBe(Brain);
    expect(PRODUCT_ICON.navGlossaryMemory).toBe(BookMarked);
    expect(PRODUCT_ICON.aiRefine).toBe(Wand2);
    expect(PRODUCT_ICON.stageAiRevised).toBe(Wand2);
    expect(PRODUCT_ICON.navLlm).not.toBe(PRODUCT_ICON.navGlossaryMemory);
  });

  it("separates eval run from audio play semantics", () => {
    expect(PRODUCT_ICON.runJob).toBe(CirclePlay);
    expect(PRODUCT_ICON.playAudio).toBe(Play);
    expect(PRODUCT_ICON.pauseAudio).toBe(Pause);
    expect(PRODUCT_ICON.runJob).not.toBe(PRODUCT_ICON.playAudio);
  });

  it("uses non-FileText icon for segment annotation", () => {
    expect(PRODUCT_ICON.segmentAnnotation).toBe(MessageSquare);
  });

  it("uses migrate icon for profile nav", () => {
    expect(PRODUCT_ICON.navProfileMigrate).toBe(ArrowDownUp);
  });

  it("maps environment panel nav icons", () => {
    expect(PRODUCT_ICON.navLocalAsr).toBe(Cpu);
    expect(PRODUCT_ICON.navOnlineStt).toBe(Cloud);
    expect(PRODUCT_ICON.navPreferences).toBe(Palette);
    expect(PRODUCT_ICON.navShortcuts).toBe(Keyboard);
    expect(PRODUCT_ICON.navQuality).toBe(BarChart3);
    expect(PRODUCT_ICON.navAbout).toBe(Info);
  });

  it("separates transcribe action from stage auto icon", () => {
    expect(PRODUCT_ICON.transcribeAction).toBe(Mic);
    expect(PRODUCT_ICON.stageAutoTranscribe).toBe(Bot);
    expect(PRODUCT_ICON.transcribeAction).not.toBe(PRODUCT_ICON.stageAutoTranscribe);
  });

  it("uses EyeCheck for first-proof stage (not a numeral badge)", () => {
    expect(PRODUCT_ICON.stageFirstProof).toBe(EyeCheck);
  });

  it("maps workbench editor actions", () => {
    expect(PRODUCT_ICON.findReplace).toBe(Replace);
    expect(PRODUCT_ICON.qualityGate).toBe(Target);
  });

  it("separates correction toolbar from batch accept icons", () => {
    expect(PRODUCT_ICON.correctionRulesAccept).toBe(ListChecks);
    expect(PRODUCT_ICON.correctionRules).not.toBe(PRODUCT_ICON.correctionRulesAccept);
  });
});
