import type { ReactNode } from "react";
import { WORKSPACE_HOME_PAGE_CLASS, WORKSPACE_HOME_STAGE_CLASS } from "../config/workspaceShellLayout";

interface WorkspaceHomeMainStageProps {
  children: ReactNode;
  /** 渲染于 page padding 之上、Stage Card 之上（如 ASR 错误条） */
  beforePage?: ReactNode;
  stageClassName?: string;
  pageClassName?: string;
  stagePurpose?: string;
}

/** 欢迎页 / Hub 右侧主区：TopBar 下 stage + 顶对齐 page padding */
export function WorkspaceHomeMainStage({
  children,
  beforePage,
  stageClassName = "",
  pageClassName = "",
  stagePurpose,
}: WorkspaceHomeMainStageProps) {
  return (
    <div
      className={`${WORKSPACE_HOME_STAGE_CLASS} ${stageClassName}`.trim()}
      data-purpose={stagePurpose}
    >
      {beforePage}
      <div className={`${WORKSPACE_HOME_PAGE_CLASS} ${pageClassName}`.trim()}>{children}</div>
    </div>
  );
}
