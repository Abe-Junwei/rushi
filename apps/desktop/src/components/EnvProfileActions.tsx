import { useCallback, useState } from "react";
import {
  IconDownload as Download,
  IconUpload as Upload,
} from "@tabler/icons-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { ENV_PANEL_PAGE_CLASS, ENV_PANEL_SECTION_TOOLS_CLASS } from "../utils/environmentPanelNav";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { toast } from "../services/ui/toast";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { applySettingsProfileV1, buildSettingsProfileV1 } from "../services/profile/profileContract";
import { exportSettingsProfile, importSettingsProfile } from "../tauri/profileApi";

type Props = {
  busy: boolean;
  onImported?: () => void;
};

export function EnvProfileActions({ busy, onImported }: Props) {
  const [actionBusy, setActionBusy] = useState<"idle" | "export" | "import">("idle");

  const exportProfile = useCallback(async () => {
    setActionBusy("export");
    try {
      const profile = buildSettingsProfileV1();
      const out = await exportSettingsProfile(profile);
      if (out) toast.success(`已导出配置文件：${out}`);
    } catch (e) {
      toast.errorFromUnknown(e);
    } finally {
      setActionBusy("idle");
    }
  }, []);

  const importProfile = useCallback(async () => {
    setActionBusy("import");
    try {
      const profile = await importSettingsProfile();
      if (!profile) return;
      applySettingsProfileV1(profile);
      onImported?.();
      toast.success("已导入；若本机无对应密钥，请在各页重新保存。");
    } catch (e) {
      toast.errorFromUnknown(e);
    } finally {
      setActionBusy("idle");
    }
  }, [onImported]);

  const disabled = busy || actionBusy !== "idle";

  return (
    <div className={ENV_PANEL_PAGE_CLASS}>
      <section className={ENV_PANEL_SECTION_TOOLS_CLASS}>
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>导出与导入</h3>
        <p className={PANEL_TYPOGRAPHY.meta}>
          不含已保存密钥明文；含 LLM / 在线 STT、转写编辑偏好（含文稿跟随播放）、本机 ASR 模型选择。请勿在提示词中粘贴密钥，导入后请逐页确认密钥与探测。
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={CONTROL_BTN_PRIMARY} disabled={disabled} onClick={() => void exportProfile()}>
            <Download className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            {actionBusy === "export" ? "导出中…" : "导出配置"}
          </button>
          <button type="button" className={CONTROL_BTN_SECONDARY} disabled={disabled} onClick={() => void importProfile()}>
            <Upload className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            {actionBusy === "import" ? "导入中…" : "导入配置"}
          </button>
        </div>
      </section>
    </div>
  );
}
