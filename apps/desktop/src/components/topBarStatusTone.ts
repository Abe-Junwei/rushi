import { ENV_STATUS_DOT_CLASS, type EnvStatusTone } from "../services/ui/envStatusTokens";

export { ENV_STATUS_DOT_CLASS, type EnvStatusTone };

export function envStatusToneFromOk(ok: boolean, warn = false): EnvStatusTone {
  if (ok) return "ok";
  if (warn) return "warn";
  return "error";
}
