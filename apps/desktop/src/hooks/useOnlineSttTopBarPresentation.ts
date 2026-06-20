import { useEffect, useState } from "react";
import { readOnlineSttEnvNavPresentation } from "../services/stt/readOnlineSttEnvNavPresentation";
import type { OnlineSttEnvPresentation } from "../services/stt/onlineSttEnvStatus";
import { STT_CONNECTION_VERIFIED_EVENT } from "../services/stt/sttOnlineProviderContract";
import { STT_ONLINE_RUNTIME_CHANGED_EVENT } from "../services/stt/sttOnlineRuntimeNotify";
import { useSttKeychainReady } from "./useSttKeychainReady";

/** 顶栏在线 STT 芯片；与设置侧栏状态点同源。 */
export function useOnlineSttTopBarPresentation(refreshSeq = 0): OnlineSttEnvPresentation {
  const { keychainReady, checking } = useSttKeychainReady(refreshSeq);
  const keychainReadyForPresentation = checking ? null : keychainReady;
  const [presentation, setPresentation] = useState<OnlineSttEnvPresentation>(() =>
    readOnlineSttEnvNavPresentation(keychainReadyForPresentation),
  );

  useEffect(() => {
    setPresentation(readOnlineSttEnvNavPresentation(keychainReadyForPresentation));
  }, [keychainReadyForPresentation, refreshSeq]);

  useEffect(() => {
    const refresh = () =>
      setPresentation(readOnlineSttEnvNavPresentation(keychainReadyForPresentation));
    window.addEventListener(STT_CONNECTION_VERIFIED_EVENT, refresh);
    window.addEventListener(STT_ONLINE_RUNTIME_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(STT_CONNECTION_VERIFIED_EVENT, refresh);
      window.removeEventListener(STT_ONLINE_RUNTIME_CHANGED_EVENT, refresh);
    };
  }, [keychainReadyForPresentation]);

  return presentation;
}
