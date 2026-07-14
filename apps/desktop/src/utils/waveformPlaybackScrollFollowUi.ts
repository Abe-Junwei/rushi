import {
  IconArrowsLeftRight,
  IconCrosshair,
  type TablerIcon,
} from "@tabler/icons-react";
import type { WaveformPlaybackScrollFollowMode } from "./waveformPlaybackScrollFollow";

/**
 * 播放头滚屏 UI 文案（工具条 + 偏好页共用）。
 *
 * 对标 Premiere Page / Smooth：两种模式都会跟播放，差别是滚屏几何。
 * - 翻页：播放头在视口内游走，接近边缘时整页滚（Page Scroll）
 * - 居中：播放头锁在中线，波形平移（Smooth / Pinned）
 *
 * 图标：Tabler（ArrowsLeftRight / Crosshair）
 */
export type WaveformPlaybackScrollFollowUiMode = {
  id: WaveformPlaybackScrollFollowMode;
  label: string;
  ariaLabel: string;
  title: string;
  hint: string;
  Icon: TablerIcon;
};

export const WAVEFORM_PLAYBACK_SCROLL_FOLLOW_UI_MODES: readonly WaveformPlaybackScrollFollowUiMode[] =
  [
    {
      id: "edge",
      label: "翻页",
      ariaLabel: "翻页滚屏：接近边缘时翻页",
      title: "翻页滚屏：播放头在视口内移动，接近左右边缘时自动滚屏",
      hint: "播放头在视口内移动，接近左右边缘时自动滚屏",
      Icon: IconArrowsLeftRight,
    },
    {
      id: "center",
      label: "居中",
      ariaLabel: "居中滚屏：播放头固定中线",
      title: "居中滚屏：播放头固定在视口中线，波形随播放平移",
      hint: "播放头固定在视口中线，波形随播放平移",
      Icon: IconCrosshair,
    },
  ] as const;

export const WAVEFORM_PLAYBACK_SCROLL_FOLLOW_GROUP_LABEL = "播放头滚屏方式";
