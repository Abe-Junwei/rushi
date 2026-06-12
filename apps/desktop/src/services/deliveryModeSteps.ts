export type DeliveryModeStepId = "rules" | "stage_b" | "final_check" | "export";

export type DeliveryModeStepDef = {
  id: DeliveryModeStepId;
  title: string;
  description: string;
  optional?: boolean;
};

/** A-2：转写后可选处理 + 终检 + 导出。 */
export const DELIVERY_MODE_PREP_STEPS: DeliveryModeStepDef[] = [
  {
    id: "rules",
    title: "规则纠错",
    description: "按稳定纠错规则预览并写回（不含 LLM）。",
    optional: true,
  },
  {
    id: "stage_b",
    title: "智能改稿",
    description: "LLM 标点与改字，预览后写回。",
    optional: true,
  },
];

export const DELIVERY_MODE_STEPS: DeliveryModeStepDef[] = [
  ...DELIVERY_MODE_PREP_STEPS,
  {
    id: "final_check",
    title: "终检",
    description: "确认语段与场次信息满足交付导出条件。",
  },
  {
    id: "export",
    title: "交付导出",
    description: "选择讲稿 / 逐字稿 / 干净稿并导出 Word。",
  },
];
