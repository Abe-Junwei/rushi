/** 顶栏 / 设置导航共用的环境状态色（ok / warn / error / idle）。 */
export type EnvStatusTone = "ok" | "warn" | "error" | "idle";

export const ENV_STATUS_DOT_CLASS: Record<EnvStatusTone, string> = {
  ok: "bg-zen-success",
  warn: "bg-zen-saffron",
  error: "bg-zen-cinnabar",
  idle: "bg-notion-divider",
};

export function envStatusToneFromOk(ok: boolean, warn = false): EnvStatusTone {
  if (ok) return "ok";
  if (warn) return "warn";
  return "error";
}
