import type { ExternalSttOnlineHealthCheckResult } from "./sttOnlineProviderContract/types";

const STATE_LABELS: Partial<Record<ExternalSttOnlineHealthCheckResult["state"], string>> = {
  unauthorized: "密钥被拒绝",
  forbidden: "访问被拒绝",
  timeout: "探测超时",
  "network-error": "网络错误",
  "http-error": "HTTP 错误",
  "method-not-allowed": "端点不接受探测请求",
  aborted: "探测已取消",
  unconfigured: "配置不完整",
  disabled: "在线 STT 未启用",
};

/** 探测失败 toast：优先用业务 message，避免暴露 `unauthorized:` 等内部 state。 */
export function formatSttProbeFailureMessage(result: ExternalSttOnlineHealthCheckResult): string {
  const detail = result.message?.trim();
  if (detail) return detail;
  const label = STATE_LABELS[result.state];
  if (label) return label;
  return "在线 STT 连接探测失败，请检查网络与配置后重试。";
}
