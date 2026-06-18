import type { ReactNode } from "react";

type Props = {
  banner: ReactNode;
  provider: ReactNode;
  form: ReactNode;
  footer: ReactNode;
};

/** 在线 STT 配置区：状态 banner + 厂商 + 表单 + 底栏（无外层卡片边框）。 */
export function EnvOnlineSttConfigCard({ banner, provider, form, footer }: Props) {
  return (
    <div className="flex flex-col">
      {banner}
      <div className="border-t border-notion-divider/60 py-4">{provider}</div>
      <div className="border-t border-notion-divider/60 py-6">{form}</div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-notion-divider/60 pt-4">
        {footer}
      </div>
    </div>
  );
}
