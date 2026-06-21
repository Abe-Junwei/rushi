import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AsrEnvPresentation } from "../../services/asr/asrEnvStatus";
import { EnvLocalAsrStatusSection } from "./EnvLocalAsrStatusSection";

afterEach(() => {
  cleanup();
});

function makePresentation(overrides: Partial<AsrEnvPresentation> = {}): AsrEnvPresentation {
  return {
    health: "ok",
    transcribeReady: true,
    sidecarMatchesSelection: true,
    ffmpegOk: true,
    envOk: true,
    runtimeReady: true,
    tone: "ok",
    chipLabel: "ASR 就绪",
    chipOk: true,
    chipTitle: "",
    ffmpegChipOk: true,
    ffmpegChipTitle: "",
    statusRows: [
      { id: "env", label: "环境", ok: true, text: "侧车已连接" },
      { id: "ffmpeg", label: "FFmpeg", ok: true, text: "可用" },
      { id: "runtime", label: "运行时", ok: true, text: "FunASR 就绪" },
      { id: "transcribe", label: "转写", ok: true, text: "所选模型可转写" },
    ],
    bannerTitle: "本机 ASR · 可直接转写",
    bannerDetail: "侧车、FFmpeg 与当前所选模型已就绪，可直接拉取语段与转写。",
    blockReason: null,
    errorDetail: null,
    errorBannerMessage: "",
    connectedGuidance: null,
    ffmpegWarning: null,
    cachePathMismatch: false,
    cachePathMismatchDetail: null,
    modelsOnDiskButSidecarBlind: false,
    modelsOnDiskButSidecarBlindDetail: null,
    ...overrides,
  };
}

describe("EnvLocalAsrStatusSection", () => {
  it("collapses status rows when all checks pass", () => {
    const { container } = render(
      <EnvLocalAsrStatusSection
        presentation={makePresentation()}
        busy={false}
        refreshAsrHealth={vi.fn()}
      />,
    );

    const details = within(container).getByText(/环境明细 · 4\/4 就绪/).closest("details") as HTMLDetailsElement;
    expect(details).toBeTruthy();
    expect(details.open).toBe(false);
  });

  it("shows status rows when any check fails", () => {
    const { container } = render(
      <EnvLocalAsrStatusSection
        presentation={makePresentation({
          tone: "warn",
          statusRows: [
            { id: "env", label: "环境", ok: true, text: "侧车已连接" },
            { id: "ffmpeg", label: "FFmpeg", ok: true, text: "可用" },
            { id: "runtime", label: "运行时", ok: false, text: "未就绪" },
            { id: "transcribe", label: "转写", ok: false, text: "不可用" },
          ],
        })}
        busy={false}
        refreshAsrHealth={vi.fn()}
      />,
    );

    expect(within(container).queryByText(/环境明细 ·/)).toBeNull();
    expect(within(container).getByText("未就绪")).toBeTruthy();
  });

  it("shows bundled preparing banner while seed copy is in flight", () => {
    const { container } = render(
      <EnvLocalAsrStatusSection
        presentation={makePresentation({
          tone: "warn",
          transcribeReady: false,
          chipOk: false,
          bannerTitle: "本机 ASR · 正在准备内置模型",
          bannerDetail: "正在准备内置语音模型（42%），完成后方可转写。无需联网。",
          statusRows: [
            { id: "env", label: "环境", ok: true, text: "侧车已连接" },
            { id: "ffmpeg", label: "FFmpeg", ok: true, text: "可用" },
            { id: "runtime", label: "运行时", ok: false, text: "复制中", warn: true },
            { id: "transcribe", label: "转写", ok: false, text: "准备中", warn: true },
          ],
        })}
        busy={false}
        refreshAsrHealth={vi.fn()}
      />,
    );

    expect(within(container).getByText("本机 ASR · 正在准备内置模型")).toBeTruthy();
    expect(within(container).getByText("复制中")).toBeTruthy();
  });

  it("shows legacy cancel banner for dev ModelScope prepare", () => {
    const { container } = render(
      <EnvLocalAsrStatusSection
        presentation={makePresentation({
          tone: "warn",
          bannerTitle: "本机 ASR · 正在取消下载",
          bannerDetail: "侧车将在当前文件传完后停止；完成后可重新点「下载当前模型」。",
          statusRows: [
            { id: "env", label: "环境", ok: true, text: "侧车已连接" },
            { id: "ffmpeg", label: "FFmpeg", ok: true, text: "可用" },
            { id: "runtime", label: "运行时", ok: true, text: "FunASR 就绪" },
            { id: "transcribe", label: "转写", ok: false, text: "取消中", warn: true },
          ],
        })}
        busy={false}
        refreshAsrHealth={vi.fn()}
      />,
    );

    expect(within(container).getByText("本机 ASR · 正在取消下载")).toBeTruthy();
    expect(within(container).getByText("取消中")).toBeTruthy();
  });
});
