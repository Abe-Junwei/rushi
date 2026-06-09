/** 在线 STT 运行时变更（会话密钥 / 持久化配置 / 连接验证）— 供编辑器与设置 UI 同步刷新。 */
export const STT_ONLINE_RUNTIME_CHANGED_EVENT = "rushi:stt-online-runtime-changed";

export function notifySttOnlineRuntimeChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(STT_ONLINE_RUNTIME_CHANGED_EVENT));
  }
}
