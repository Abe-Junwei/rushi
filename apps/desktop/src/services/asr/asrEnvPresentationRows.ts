import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import type { AsrHealthState } from "../../pages/useAsrHealthPoll";

export type AsrEnvStatusRow = {
  id: "env" | "ffmpeg" | "runtime" | "transcribe" | "device" | "inference_queue" | "model_memory";
  label: string;
  ok: boolean;
  text: string;
  warn?: boolean;
};

/** Short banner hint for resolved FunASR device (visible without expanding 环境明细). */
export function funasrDeviceBannerHint(
  device: string | null | undefined,
  source: "env" | "auto" | null | undefined,
): string | null {
  const raw = device?.trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  const via = source === "env" ? "（环境变量）" : "";
  if (key === "mps") return `Apple 芯片加速（MPS）已启用${via}`;
  if (key === "cuda") return `NVIDIA GPU（CUDA）已启用${via}`;
  if (key === "cpu") return `当前使用 CPU 推理${via}`;
  return `推理设备：${formatFunasrDeviceStatusText(raw, source)}`;
}

/** Display label for FunASR /health device fields. */
export function formatFunasrDeviceStatusText(
  device: string,
  source: "env" | "auto" | null | undefined,
): string {
  const key = device.trim().toLowerCase();
  const pretty =
    key === "mps" ? "MPS" : key === "cuda" ? "CUDA" : key === "cpu" ? "CPU" : device.trim();
  const sourceLabel = source === "env" ? "环境变量" : "自动";
  return `${pretty} · ${sourceLabel}`;
}

/** 顶栏/转写预检：模型就绪且侧车支持 async 路由 */
export function effectiveTranscribeReady(input: {
  transcribeReady: boolean;
  sidecarAsyncTranscribeCapable?: boolean;
}): boolean {
  if (!input.transcribeReady) return false;
  if (input.sidecarAsyncTranscribeCapable === false) return false;
  return true;
}

export function buildAsrEnvStatusRows(input: {
  envOk: boolean;
  ffmpegOk: boolean;
  runtimeReady: boolean;
  presentationTranscribeReady: boolean;
  sidecarAsyncTranscribeCapable?: boolean;
  asrCaps: AsrHealthCapabilities | null;
  modelMemoryState?: "disk" | "loaded" | "unloading";
}): AsrEnvStatusRow[] {
  const statusRows: AsrEnvStatusRow[] = [
    { id: "env", label: "环境", ok: input.envOk, text: input.envOk ? "侧车已连接" : "连接失败" },
    { id: "ffmpeg", label: "FFmpeg", ok: input.ffmpegOk, text: input.ffmpegOk ? "可用" : "未检测到" },
    { id: "runtime", label: "运行时", ok: input.runtimeReady, text: input.runtimeReady ? "FunASR 就绪" : "未就绪" },
    {
      id: "transcribe",
      label: "转写",
      ok: input.presentationTranscribeReady,
      text: input.presentationTranscribeReady
        ? "所选模型可转写"
        : input.sidecarAsyncTranscribeCapable === false
          ? "侧车需升级"
          : "不可用",
    },
  ];
  const device = input.asrCaps?.funasr_device?.trim();
  if (input.envOk && device) {
    const loaded = input.asrCaps?.funasr_loaded_device?.trim() || null;
    const mismatch = Boolean(loaded && loaded !== device);
    statusRows.push({
      id: "device",
      label: "推理设备",
      ok: !mismatch,
      text: mismatch
        ? `${formatFunasrDeviceStatusText(device, input.asrCaps?.funasr_device_source)}（已加载 ${loaded}，下次推理将重载）`
        : formatFunasrDeviceStatusText(device, input.asrCaps?.funasr_device_source),
      warn: mismatch || undefined,
    });
  }
  const queuePending = input.asrCaps?.inference_queue_pending ?? 0;
  const queueRunning = input.asrCaps?.inference_queue_running ?? 0;
  if (queuePending + queueRunning > 0) {
    const queuedAhead = Math.max(0, queuePending - queueRunning);
    const runningText = queueRunning > 0 ? `正在推理 ${queueRunning} 个任务` : "推理空闲";
    const queueText =
      queuedAhead > 0 ? `前方 ${queuedAhead} 个任务排队 · ${runningText}` : runningText;
    statusRows.push({
      id: "inference_queue",
      label: "推理队列",
      ok: true,
      text: queueText,
    });
  }
  if (input.envOk && input.runtimeReady && input.modelMemoryState === "loaded") {
    statusRows.push({
      id: "model_memory",
      label: "权重内存",
      ok: true,
      text: "已加载 · 占 RAM",
      warn: true,
    });
  }
  return statusRows;
}

export function chipLabelFor(input: {
  asrHealth: AsrHealthState;
  transcribeReady: boolean;
  sidecarAsyncTranscribeCapable?: boolean;
}): string {
  if (input.asrHealth === "checking") return "ASR 检测中";
  if (input.asrHealth === "error") return "ASR 未连接";
  const ready = effectiveTranscribeReady(input);
  return ready ? "ASR 就绪" : "ASR 未就绪";
}

export function toneFor(input: {
  asrHealth: AsrHealthState;
  transcribeReady: boolean;
  envOk: boolean;
  sidecarAsyncTranscribeCapable?: boolean;
}): "ok" | "warn" | "error" | "idle" {
  if (input.asrHealth === "checking") return "idle";
  if (input.asrHealth === "error" || !input.envOk) return "error";
  return effectiveTranscribeReady(input) ? "ok" : "warn";
}

export function bannerTitleFor(input: {
  asrHealth: AsrHealthState;
  transcribeReady: boolean;
  sidecarAsyncTranscribeCapable?: boolean;
}): string {
  if (input.asrHealth === "checking") return "本机 ASR · 检测中";
  if (input.asrHealth === "error") return "本机 ASR · 环境异常";
  return effectiveTranscribeReady(input) ? "本机 ASR · 可直接转写" : "本机 ASR · 已连接";
}

export function mapPrepareModelCancelRows(rows: AsrEnvStatusRow[]): AsrEnvStatusRow[] {
  return rows.map((row) =>
    row.id === "transcribe" ? { ...row, ok: false, text: "取消中", warn: true } : row,
  );
}

export function mapPrepareModelBusyRows(rows: AsrEnvStatusRow[]): AsrEnvStatusRow[] {
  return rows.map((row) => {
    if (row.id === "runtime") return { ...row, ok: false, text: "下载中", warn: true };
    if (row.id === "transcribe") return { ...row, ok: false, text: "下载中", warn: true };
    return row;
  });
}

export function mapBundledModelBusyRows(rows: AsrEnvStatusRow[]): AsrEnvStatusRow[] {
  return rows.map((row) => {
    if (row.id === "runtime") return { ...row, ok: false, text: "复制中", warn: true };
    if (row.id === "transcribe") return { ...row, ok: false, text: "准备中", warn: true };
    return row;
  });
}

export function mapRuntimeInstallBusyRows(rows: AsrEnvStatusRow[]): AsrEnvStatusRow[] {
  return rows.map((row) => {
    if (row.id === "runtime") return { ...row, ok: false, text: "安装中", warn: true };
    if (row.id === "transcribe") return { ...row, ok: false, text: "等待运行时", warn: true };
    return row;
  });
}

