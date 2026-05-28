use std::fs;
use std::path::{Path, PathBuf};

pub(crate) fn required_runtime_files(exe: &Path) -> Vec<(&'static str, PathBuf)> {
    let runtime_dir = exe.parent().unwrap_or(exe);
    let internal_dir = runtime_dir.join("_internal");
    #[cfg(target_os = "windows")]
    let ffmpeg = internal_dir.join("ffmpeg.exe");
    #[cfg(not(target_os = "windows"))]
    let ffmpeg = internal_dir.join("ffmpeg");
    #[cfg(target_os = "windows")]
    let ffprobe = internal_dir.join("ffprobe.exe");
    #[cfg(not(target_os = "windows"))]
    let ffprobe = internal_dir.join("ffprobe");

    vec![
        (
            "FunASR 资源",
            internal_dir.join("funasr").join("version.txt"),
        ),
        ("FFmpeg", ffmpeg),
        ("FFprobe", ffprobe),
    ]
}

pub(crate) fn inspect_runtime_files(exe: &Path) -> Result<(), String> {
    for (label, path) in required_runtime_files(exe) {
        match fs::metadata(&path) {
            Ok(meta) if meta.is_file() && meta.len() > 0 => {}
            Ok(_) => {
                return Err(format!("{label} 文件异常: {}", path.to_string_lossy()));
            }
            Err(e) => {
                return Err(format!("{label} 缺失: {} ({e})", path.to_string_lossy()));
            }
        }
    }
    Ok(())
}
