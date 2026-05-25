import { useCallback, useState } from "react";
import { Download, Upload } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
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
  const [msg, setMsg] = useState<string | null>(null);

  const exportProfile = useCallback(async () => {
    setMsg(null);
    setActionBusy("export");
    try {
      const profile = buildSettingsProfileV1();
      const out = await exportSettingsProfile(profile);
      if (out) setMsg(`已导出配置文件：${out}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy("idle");
    }
  }, []);

  const importProfile = useCallback(async () => {
    setMsg(null);
    setActionBusy("import");
    try {
      const profile = await importSettingsProfile();
      if (!profile) return;
      applySettingsProfileV1(profile);
      onImported?.();
      setMsg("已导入配置文件（仅包含非敏感配置；API Key 仍需系统钥匙串或会话内存提供）。");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy("idle");
    }
  }, [onImported]);

  const disabled = busy || actionBusy !== "idle";

  return (
    <section className="rounded-lg border border-notion-divider bg-notion-sidebar/50 px-4 py-3">
      <div className="flex flex-col gap-3">
        <div className="space-y-1">
          <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>配置迁移</h3>
          <p className={PANEL_TYPOGRAPHY.meta}>
            备份或恢复当前云侧环境设置（LLM + 在线 STT）。导出的 YAML 不包含 API Key 等敏感字段。
          </p>
        </div>
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
        {msg ? <p className={PANEL_TYPOGRAPHY.meta}>{msg}</p> : null}
      </div>
    </section>
  );
}
