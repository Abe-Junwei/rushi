import type { ReactNode } from "react";

type Props = {
  /** 云端模式：厂商 pill，渲染在卡片上方 */
  vendorPills?: ReactNode;
  banner: ReactNode;
  form: ReactNode;
};

/** LLM 配置区：可选厂商 pill + 状态 banner + 表单（无外层卡片边框）。 */
export function EnvLlmConnectionCard({ vendorPills, banner, form }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {vendorPills}
      <div className="flex flex-col">
        {banner}
        <div className="border-t border-notion-divider/60">{form}</div>
      </div>
    </div>
  );
}
