//! 润色导出修订轨：逐语段（行）错字/标点 diff，语义分段仅决定 Word 段落。

#[path = "export_docx_polish_track_diff.rs"]
mod diff;
#[path = "export_docx_polish_track_write.rs"]
mod write;

pub use diff::before_lines_from_joined;
pub use write::{
    append_polished_with_track_changes, inject_track_revisions_flag, POLISH_TRACK_AUTHOR,
};
