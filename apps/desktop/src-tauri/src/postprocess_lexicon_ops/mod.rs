//! F0 stage B: lexicon-guided proofread — merged punct + typo prompt, parse, evidence grounding.

mod ground;
mod parse;
mod prompt;
mod types;

#[cfg(test)]
mod tests;

pub use ground::filter_grounded_lexicon_ops;
pub use parse::parse_lexicon_proofread_json_lenient;
pub use prompt::build_stage_b_merged_proofread_prompt;
pub use types::GroundedLexiconOp;
