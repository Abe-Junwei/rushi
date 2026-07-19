mod app_commands;

fn main() {
    cc::Build::new()
        .cpp(true)
        .file("src/native_audio/signalsmith_tempo.cpp")
        .include("../../../third_party/signalsmith-stretch/include")
        .flag_if_supported("/std:c++17")
        .flag_if_supported("-std=c++17")
        .opt_level(2)
        .compile("rushi_signalsmith_tempo");

    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(app_commands::APP_COMMANDS)),
    )
    .expect("failed to run build script");
}
