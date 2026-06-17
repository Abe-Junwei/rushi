import type { ReactNode } from "react";
import { ENV_FLAT_STACK_CLASS, ENV_PANEL_BUTTON_ROW_CLASS } from "../utils/environmentPanelNav";

type Props = {
  banner: ReactNode;
  /** banner 与表单之间（厂商 pill / provider 选择等） */
  middle?: ReactNode;
  form: ReactNode;
  /** 底栏 CTA；LLM 表单项内自带 CTA 时可省略 */
  footer?: ReactNode;
  /** 栈底说明（在线 STT footnote 等），与上方块共用 gap-5 */
  trailing?: ReactNode;
};

/** 环境页扁平配置区：banner + 可选中间区 + 表单 + 可选底栏（无 section 分隔线）。 */
export function EnvFlatConfigStack({ banner, middle, form, footer, trailing }: Props) {
  return (
    <div className={ENV_FLAT_STACK_CLASS}>
      {banner}
      {middle}
      {form}
      {footer ? <div className={ENV_PANEL_BUTTON_ROW_CLASS}>{footer}</div> : null}
      {trailing}
    </div>
  );
}
