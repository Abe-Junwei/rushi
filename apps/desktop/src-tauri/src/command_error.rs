//! Structured command-layer errors (Phase 3). Tauri handlers still expose `String` via [`CommandResultExt`].
use std::io;

use thiserror::Error;

pub type CommandResult<T> = Result<T, CommandError>;

#[derive(Debug, Error)]
pub enum CommandError {
    #[error("项目不存在或已被删除。")]
    ProjectNotFound,

    #[error("目标文件已存在，请另选文件名或先删除该文件。")]
    TargetFileExists,

    #[error("数据库连接不可用: {0}")]
    DbPool(String),

    #[error("数据库错误: {0}")]
    Db(#[from] rusqlite::Error),

    #[error("{operation}失败: {source}")]
    Io {
        operation: &'static str,
        #[source]
        source: io::Error,
    },

    #[error("写入文件失败: {0}")]
    WriteFile(#[source] io::Error),

    #[error("写入词表包失败: {0}")]
    WriteLexiconBundle(#[source] io::Error),

    #[error("读取词表包失败: {0}")]
    ReadLexiconBundle(#[source] io::Error),

    #[error("该文件没有可导出的音频，或文件不属于当前项目。")]
    BundleNoExportableAudio,

    #[error("项目音频不存在：{path}")]
    BundleAudioMissing { path: String },

    #[error("项目音频文件名无效。")]
    BundleInvalidAudioFileName,

    #[error("无法导入：不是受支持的 Rushi 项目包。")]
    BundleUnsupportedKind,

    #[error("无法导入：项目包版本 {found} 与当前支持版本 {supported} 不匹配。")]
    BundleUnsupportedVersion { found: u32, supported: u32 },

    #[error("无法导入：项目包内音频文件名无效。")]
    BundleInvalidAudioName,

    #[error("无法导入：项目包内音频路径不安全。")]
    BundleUnsafeAudioPath,

    #[error("无法导入：项目包路径不安全。")]
    BundleUnsafeZipPath,

    #[error("无法导入：项目包解压体积过大（>{limit} 字节）。")]
    BundleUncompressedTooLarge { limit: u64 },

    #[error("无法导入：语段数量超过上限（>{limit}）。")]
    BundleTooManySegments { limit: usize },

    #[error("项目包缺少 {name}: {detail}")]
    BundleMissingEntry { name: String, detail: String },

    #[error("项目包文件 {name} 过大（>{limit} 字节）。")]
    BundleEntryTooLarge { name: String, limit: u64 },

    #[error("读取项目包文件失败 {name}: {source}")]
    BundleReadEntry {
        name: String,
        #[source]
        source: io::Error,
    },

    #[error("读取项目包条目失败: {0}")]
    BundleZipEntry(#[source] zip::result::ZipError),

    #[error("打开项目包失败: {0}")]
    BundleOpen(#[source] io::Error),

    #[error("读取项目包失败: {0}")]
    BundleRead(#[from] zip::result::ZipError),

    #[error("解析项目包文件失败 {name}: {source}")]
    BundleJsonParse {
        name: String,
        #[source]
        source: serde_json::Error,
    },

    #[error("创建项目包失败: {0}")]
    BundleCreate(#[source] io::Error),

    #[error("序列化 manifest 失败: {0}")]
    BundleSerializeManifest(#[source] serde_json::Error),

    #[error("序列化项目数据失败: {0}")]
    BundleSerializeProject(#[source] serde_json::Error),

    #[error("完成项目包失败: {0}")]
    BundleFinish(#[source] zip::result::ZipError),

    #[error("保存项目包失败: {0}")]
    BundleSave(#[source] io::Error),

    #[error("创建项目目录失败: {0}")]
    BundleCreateProjectDir(#[source] io::Error),

    #[error("写入项目音频失败: {0}")]
    BundleWriteAudio(#[source] io::Error),

    #[error("读取项目音频失败: {0}")]
    BundleReadAudio(#[source] io::Error),

    #[error("导出项目包失败: {detail}")]
    ExportProjectBundle { detail: String },

    #[error("导入项目包失败: {detail}")]
    ImportProjectBundle { detail: String },

    #[error("导出文本失败: {detail}")]
    ExportTextFile { detail: String },

    #[error("删除项目失败: {detail}")]
    DeleteProject { detail: String },

    #[error("导出词表包失败: {detail}")]
    ExportLexiconBundle { detail: String },

    #[error("导入词表包失败: {detail}")]
    ImportLexiconBundle { detail: String },
}

impl CommandError {
    pub fn io(operation: &'static str, source: io::Error) -> Self {
        Self::Io { operation, source }
    }

    pub fn db_pool(message: impl Into<String>) -> Self {
        Self::DbPool(message.into())
    }
}

pub trait CommandResultExt<T> {
    fn map_command_err(self) -> Result<T, String>;
}

impl<T, E: std::fmt::Display> CommandResultExt<T> for Result<T, E> {
    fn map_command_err(self) -> Result<T, String> {
        self.map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_not_found_message_is_stable() {
        assert_eq!(
            CommandError::ProjectNotFound.to_string(),
            "项目不存在或已被删除。"
        );
    }

    #[test]
    fn bundle_unsafe_audio_path_message_is_stable() {
        assert_eq!(
            CommandError::BundleUnsafeAudioPath.to_string(),
            "无法导入：项目包内音频路径不安全。"
        );
    }
}
