import { useEffect, useState } from "react";
import { useSttKeychainReady } from "./useSttKeychainReady";
import { readOnlineSttEnvNavTone } from "../services/stt/readOnlineSttEnvNavPresentation";
import type { OnlineSttEnvTone } from "../services/stt/onlineSttEnvStatus";
import { STT_CONNECTION_VERIFIED_EVENT } from "../services/stt/sttOnlineProviderContract";
import { STT_ONLINE_RUNTIME_CHANGED_EVENT } from "../services/stt/sttOnlineRuntimeNotify";

/** 设置侧栏在线 STT 状态点；订阅持久化/探测/密钥变更，与主面板 banner 同源。 */
export function useOnlineSttEnvNavTone(refreshSeq = 0): OnlineSttEnvTone {
  const { keychainReady, checking } = useSttKeychainReady(refreshSeq);
  const keychainReadyForPresentation = checking ? null : keychainReady;
  const [tone, setTone] = useState<OnlineSttEnvTone>(() =>
    readOnlineSttEnvNavTone(keychainReadyForPresentation),
  );

  useEffect(() => {
    setTone(readOnlineSttEnvNavTone(keychainReadyForPresentation));
  }, [keychainReadyForPresentation, refreshSeq]);

  useEffect(() => {
    const refresh = () => setTone(readOnlineSttEnvNavTone(keychainReadyForPresentation));
    window.addEventListener(STT_CONNECTION_VERIFIED_EVENT, refresh);
    window.addEventListener(STT_ONLINE_RUNTIME_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(STT_CONNECTION_VERIFIED_EVENT, refresh);
      window.removeEventListener(STT_ONLINE_RUNTIME_CHANGED_EVENT, refresh);
    };
  }, [keychainReadyForPresentation]);

  return tone;
}
