import {
  buildOnlineSttEnvPresentation,
  type OnlineSttEnvPresentation,
  type OnlineSttEnvTone,
} from "./onlineSttEnvStatus";
import { buildOnlineSttEnvPresentationInputFromStorage } from "./onlineSttEnvPresentationInput";

/** 设置侧栏在线 STT 状态点（读持久化 + 会话密钥，不含表单草稿）。 */
export function readOnlineSttEnvNavTone(keychainReady: boolean | null = null): OnlineSttEnvTone {
  return readOnlineSttEnvNavPresentation(keychainReady).tone;
}

export function readOnlineSttEnvNavPresentation(
  keychainReady: boolean | null = null,
): OnlineSttEnvPresentation {
  return buildOnlineSttEnvPresentation(
    buildOnlineSttEnvPresentationInputFromStorage({ keychainReady }),
  );
}
