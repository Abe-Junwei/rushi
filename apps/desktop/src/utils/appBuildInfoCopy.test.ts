import { describe, expect, it } from "vitest";
import { formatAppBuildInfoForClipboard, formatPlatformLabel } from "./appBuildInfoCopy";

describe("formatPlatformLabel", () => {
  it("maps common os/arch to Chinese labels", () => {
    expect(formatPlatformLabel("macos", "aarch64")).toBe("macOS（Apple 芯片）");
    expect(formatPlatformLabel("windows", "x86_64")).toBe("Windows（64 位 x86）");
  });
});

describe("formatAppBuildInfoForClipboard", () => {
  it("matches diagnostic build-info.txt shape", () => {
    const text = formatAppBuildInfoForClipboard({
      productName: "如是我闻",
      version: "0.1.0",
      identifier: "studio.lingchuang.rushi",
      platformOs: "macos",
      platformArch: "aarch64",
      appDataRoot: "/tmp/rushi-data",
      dbPath: "/tmp/rushi-data/rushi.sqlite3",
    });
    expect(text).toBe(
      [
        "rushi-desktop 0.1.0",
        "platform: macos aarch64",
        "identifier: studio.lingchuang.rushi",
        "app_data_root: /tmp/rushi-data",
        "db_path: /tmp/rushi-data/rushi.sqlite3",
        "",
      ].join("\n"),
    );
  });
});
