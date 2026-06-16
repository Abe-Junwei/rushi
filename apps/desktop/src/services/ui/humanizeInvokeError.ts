const TAURI_COMMAND_DENIED =
  /^([\w_]+) not allowed\. Permissions associated with this command: ([\w-]+)$/;

const COMMAND_DENIED_HINTS: Record<string, string> = {
  stt_save_api_key: "无法保存在线 STT 密钥：应用权限未配置，请更新后重试。",
  stt_delete_api_key: "无法清除在线 STT 密钥：应用权限未配置，请更新后重试。",
  stt_read_api_key: "无法读取在线 STT 密钥：应用权限未配置，请更新后重试。",
  stt_has_stored_api_key: "无法检查在线 STT 密钥：应用权限未配置，请更新后重试。",
  llm_save_api_key: "无法保存 LLM 密钥：应用权限未配置，请更新后重试。",
  llm_delete_api_key: "无法清除 LLM 密钥：应用权限未配置，请更新后重试。",
  llm_has_stored_api_key: "无法检查 LLM 密钥：应用权限未配置，请更新后重试。",
  llm_migrate_legacy_api_key: "无法迁移 LLM 密钥：应用权限未配置，请更新后重试。",
};

import { TauriCommandError } from "../../tauri/commandError";

/** 将 Tauri invoke 等技术错误转为用户可读中文；无法识别时尽量保留原意。 */
export function humanizeInvokeError(raw: unknown): string {
  if (raw instanceof TauriCommandError) {
    return raw.message;
  }
  const message =
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : raw == null
          ? ""
          : typeof raw === "number" || typeof raw === "boolean" || typeof raw === "bigint"
            ? String(raw)
            : "操作失败，请重试。";
  const trimmed = message.trim();
  if (!trimmed) return "操作失败，请重试。";

  const denied = trimmed.match(TAURI_COMMAND_DENIED);
  if (denied) {
    const command = denied[1];
    return COMMAND_DENIED_HINTS[command] ?? "应用权限未配置，请更新后重试。";
  }

  if (/not allowed/i.test(trimmed) && /Permissions associated/i.test(trimmed)) {
    return "应用权限未配置，请更新后重试。";
  }

  if (/error sending request for url/i.test(trimmed)) {
    const prefix = trimmed.split(/:\s*error sending request/i)[0]?.trim();
    if (prefix && prefix.length <= 80) {
      return `${prefix}：网络不通或代理拦截，请检查连接。`;
    }
    return "网络请求失败，请检查网络与代理后重试。";
  }

  if (
    /TooLarge|20971520|BadRequest\.TooLarge/i.test(trimmed) &&
    (/百炼/i.test(trimmed) || /dashscope/i.test(trimmed))
  ) {
    return "百炼 Fun-ASR 同步识别单段 Base64 音频上限为 20 MB（指编码后体积，不是原始文件大小）。请先用本机 ASR，或缩短/压缩音频后再试在线识别（推荐 MP3）。";
  }

  return trimmed;
}
