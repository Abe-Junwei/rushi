use serde::Serialize;

use super::postprocess_config::{
    default_auto_punctuate_instructions, default_auto_punctuate_system_prompt,
};
use super::postprocess_export_polish::{
    default_export_polish_instructions_template, default_export_polish_system_prompt,
};
use super::postprocess_lexicon_ops::{
    default_stage_b_instructions, default_stage_b_system_prompt,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmPromptDefaults {
    pub stage_b_system: String,
    pub stage_b_instructions: String,
    pub auto_punctuate_system: String,
    pub auto_punctuate_instructions: String,
    pub export_polish_system: String,
    pub export_polish_instructions: String,
}

#[tauri::command]
pub fn get_llm_prompt_defaults() -> LlmPromptDefaults {
    LlmPromptDefaults {
        stage_b_system: default_stage_b_system_prompt().to_string(),
        stage_b_instructions: default_stage_b_instructions(),
        auto_punctuate_system: default_auto_punctuate_system_prompt().to_string(),
        auto_punctuate_instructions: default_auto_punctuate_instructions(),
        export_polish_system: default_export_polish_system_prompt().to_string(),
        export_polish_instructions: default_export_polish_instructions_template(),
    }
}
