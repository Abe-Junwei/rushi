import { invoke } from "@tauri-apps/api/core";

export type AppBuildInfo = {
  productName: string;
  version: string;
  identifier: string;
  platformOs: string;
  platformArch: string;
  shellProfile: string;
  asrShellManaged: boolean;
  bundledSidecarBuild: string | null;
  appDataRoot: string | null;
  dbPath: string | null;
};

export type ThirdPartyLicenses = {
  notices: string;
  licenseTexts: string;
};

export async function fetchAppVersion(): Promise<string> {
  return invoke<string>("app_version");
}

export async function fetchAppBuildInfo(): Promise<AppBuildInfo> {
  return invoke<AppBuildInfo>("app_build_info");
}

export async function readThirdPartyLicenses(): Promise<ThirdPartyLicenses> {
  return invoke<ThirdPartyLicenses>("read_third_party_licenses");
}

export async function openBundledUserGuide(): Promise<void> {
  return invoke<void>("open_bundled_user_guide");
}
