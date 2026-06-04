import { useCallback, useState } from "react";
import { Download, Upload } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { toast } from "../services/ui/toast";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { applySettingsProfileV1, buildSettingsProfileV1 } from "../services/profile/profileContract";
import { exportSettingsProfile, importSettingsProfile } from "../tauri/profileApi";

type Props = {
  busy: boolean;
  onImported?: () => void;
};

const btnPrimary = CONTROL_BTN_PRIMARY;
const btnSecondary = CONTROL_BTN_SECONDARY;

export function EnvProfileActions({ busy, onImported }: Props) {
  const [actionBusy, setActionBusy] = useState<"idle" | "export" | "import">("idle");

  const exportProfile = useCallback(async () => {
    setActionBusy("export");
    try {
      const profile = buildSettingsProfileV1();
      const out = await exportSettingsProfile(profile);
      if (out) toast.success(`已导出配置文件：${out}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
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
      toast.success("已导入配置文件（仅包含非敏感配置；API Key 仍需系统钥匙串或会话内存提供）。");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy("idle");
    }
  }, [onImported]);

  const disabled = busy || actionBusy !== "idle";

  return (
    <div className="flex max-w-[860px] flex-col gap-7">
      <section className="flex flex-col gap-4">
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>导出与导入</h3>
        <p className={PANEL_TYPOGRAPHY.meta}>
          导出或导入环境相关偏好（不含 API Key 明文）。导入后请在本机 ASR / LLM / 在线 STT 各页确认状态。
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={disabled} onClick={() => void exportProfile()}>
            <Download className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            {actionBusy === "export" ? "导出中…" : "导出配置"}
          </button>
          <button type="button" className={btnSecondary} disabled={disabled} onClick={() => void importProfile()}>
            <Upload className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            {actionBusy === "import" ? "导入中…" : "导入配置"}
          </button>
        </div>
      </section>
    </div>
  );
}
