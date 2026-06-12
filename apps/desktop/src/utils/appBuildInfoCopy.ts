import type { AppBuildInfo } from "../tauri/appInfoApi";

const PLATFORM_OS_LABELS: Record<string, string> = {
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
};

const PLATFORM_ARCH_LABELS: Record<string, string> = {
  aarch64: "Apple 芯片",
  x86_64: "64 位 x86",
  x86: "32 位 x86",
};

export function formatPlatformLabel(os: string, arch: string): string {
  const osLabel = PLATFORM_OS_LABELS[os] ?? os;
  const archLabel = PLATFORM_ARCH_LABELS[arch] ?? arch;
  return `${osLabel}（${archLabel}）`;
}

/** 与诊断 zip `build-info.txt` 字段顺序一致，便于粘贴反馈。 */
export function formatAppBuildInfoForClipboard(info: AppBuildInfo): string {
  return [
    `rushi-desktop ${info.version}`,
    `platform: ${info.platformOs} ${info.platformArch}`,
    `identifier: ${info.identifier}`,
    `app_data_root: ${info.appDataRoot ?? "(unknown)"}`,
    `db_path: ${info.dbPath ?? "(unknown)"}`,
    "",
  ].join("\n");
}
