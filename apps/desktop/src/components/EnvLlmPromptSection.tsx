import { CONTROL_BTN_SECONDARY, CONTROL_TEXTAREA } from "../config/controlStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import {
  ENV_PANEL_BUTTON_ROW_CLASS,
  ENV_PANEL_SECTION_CLASS,
} from "../utils/environmentPanelNav";
import {
  EnvCollapsibleSectionSummary,
  ENV_COLLAPSIBLE_DETAILS,
  ENV_UTILITIES_BODY,
} from "./envLocalAsr/envLocalAsrPanelUi";
import type { useEnvLlmPromptConfig } from "../hooks/useEnvLlmPromptConfig";
import type { LlmPromptDraft } from "../services/postprocess/postprocessRuntimeContract";

type PromptState = ReturnType<typeof useEnvLlmPromptConfig>;

type Props = {
  disabled: boolean;
  prompt: PromptState;
};

type TaskBlockProps = {
  id: string;
  title: string;
  hint: string;
  disabled: boolean;
  systemKey: keyof LlmPromptDraft;
  instructionsKey: keyof LlmPromptDraft;
  systemRows: number;
  instructionsRows: number;
  prompt: PromptState;
  defaultOpen?: boolean;
};

function PromptTaskBlock({
  id,
  title,
  hint,
  disabled,
  systemKey,
  instructionsKey,
  systemRows,
  instructionsRows,
  prompt,
  defaultOpen = false,
}: TaskBlockProps) {
  const monoTextarea = `${CONTROL_TEXTAREA} ${PANEL_CONTROL_TYPOGRAPHY.compactTechnicalInput} min-h-[5rem] font-mono leading-relaxed`;
  const fieldsDisabled = disabled || !prompt.defaults;
  const defaults = prompt.defaults;
  const changed =
    defaults !== null &&
    (prompt.draft[systemKey].trim() !== defaults[systemKey].trim() ||
      prompt.draft[instructionsKey].trim() !== defaults[instructionsKey].trim());

  return (
    <details
      id={id}
      open={defaultOpen}
      className={`${ENV_COLLAPSIBLE_DETAILS} border-b border-notion-divider/60 py-2.5 last:border-b-0`}
    >
      <EnvCollapsibleSectionSummary
        title={title}
        trailing={changed ? <span className="text-zen-saffron">已修改</span> : undefined}
      />
      <div className={ENV_UTILITIES_BODY}>
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{hint}</p>
        <label className="flex flex-col gap-2">
          <span className={PANEL_TYPOGRAPHY.fieldLabel}>角色说明</span>
          <textarea
            className={monoTextarea}
            value={prompt.draft[systemKey]}
            disabled={fieldsDisabled}
            rows={systemRows}
            onChange={(e) => prompt.setField(systemKey, e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={PANEL_TYPOGRAPHY.fieldLabel}>任务指令</span>
          <textarea
            className={monoTextarea}
            value={prompt.draft[instructionsKey]}
            disabled={fieldsDisabled}
            rows={instructionsRows}
            onChange={(e) => prompt.setField(instructionsKey, e.target.value)}
          />
        </label>
      </div>
    </details>
  );
}

export function EnvLlmPromptSection({ disabled, prompt }: Props) {
  return (
    <section className={ENV_PANEL_SECTION_CLASS} aria-labelledby="llm-prompt-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 id="llm-prompt-heading" className={PANEL_TYPOGRAPHY.sectionTitle}>
            提示词
          </h3>
          <p className={PANEL_TYPOGRAPHY.sectionDescription}>
            查看并调整大模型使用的角色说明与任务指令。语段、词表、规则和分批信息仍由客户端自动补入。
          </p>
        </div>
        {prompt.isCustomized ? (
          <span className={`${PANEL_TYPOGRAPHY.meta} text-zen-saffron`}>已自定义</span>
        ) : null}
      </div>

      {prompt.loadError ? (
        <p className={`${PANEL_TYPOGRAPHY.meta} text-zen-cinnabar`}>{prompt.loadError}</p>
      ) : null}

      <PromptTaskBlock
        id="llm-prompt-stage-b"
        title="智能改稿"
        hint="转写后批量改字、补标点。词表、纠错规则与输入语段会自动追加。"
        disabled={disabled}
        systemKey="stageBSystem"
        instructionsKey="stageBInstructions"
        systemRows={3}
        instructionsRows={10}
        prompt={prompt}
        defaultOpen
      />

      <PromptTaskBlock
        id="llm-prompt-auto-punctuate"
        title="自动标点"
        hint="单条语段补标点。相邻语段和当前正文会自动追加。"
        disabled={disabled}
        systemKey="autoPunctuateSystem"
        instructionsKey="autoPunctuateInstructions"
        systemRows={3}
        instructionsRows={5}
        prompt={prompt}
      />

      <PromptTaskBlock
        id="llm-prompt-export-polish"
        title="导出润色"
        hint="导出稿逐行润色。任务指令是模板，必须保留：{line_count}、{batch_note}、{rule_hints}、{body}。"
        disabled={disabled}
        systemKey="exportPolishSystem"
        instructionsKey="exportPolishInstructions"
        systemRows={3}
        instructionsRows={12}
        prompt={prompt}
      />

      <div className={ENV_PANEL_BUTTON_ROW_CLASS}>
        <button
          type="button"
          className={`${CONTROL_BTN_SECONDARY} text-notion-text-muted`}
          disabled={disabled || !prompt.defaults}
          onClick={prompt.resetToDefaults}
        >
          恢复全部提示词默认
        </button>
      </div>
    </section>
  );
}
