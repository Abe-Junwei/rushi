import { describe, expect, it } from "vitest";
import capabilitiesJson from "../../src-tauri/capabilities/default.json";
import appCommandsSource from "../../src-tauri/app_commands.rs?raw";
import asrPermissionsSource from "../../src-tauri/permissions/asr.toml?raw";
import glossaryPermissionsSource from "../../src-tauri/permissions/glossary.toml?raw";
import llmPermissionsSource from "../../src-tauri/permissions/llm.toml?raw";
import projectPermissionsSource from "../../src-tauri/permissions/project.toml?raw";
import systemPermissionsSource from "../../src-tauri/permissions/system.toml?raw";

function readAppCommands(source: string): string[] {
  return [...source.matchAll(/"([a-z][a-z0-9_]*)"/g)].map((m) => m[1]);
}

function readAllowPermissions(sources: string[]): Set<string> {
  const allows = new Set<string>();
  for (const text of sources) {
    for (const match of text.matchAll(/"(allow-[a-z0-9-]+)"/g)) {
      allows.add(match[1]);
    }
  }
  return allows;
}

function commandToAllow(cmd: string): string {
  return `allow-${cmd.replace(/_/g, "-")}`;
}

describe("tauri invoke ACL", () => {
  it("lists every registered command in app_commands.rs and permissions", () => {
    const commands = readAppCommands(appCommandsSource);
    const allows = readAllowPermissions([
      asrPermissionsSource,
      glossaryPermissionsSource,
      llmPermissionsSource,
      projectPermissionsSource,
      systemPermissionsSource,
    ]);

    expect(commands.length).toBeGreaterThan(0);
    for (const cmd of commands) {
      expect(allows.has(commandToAllow(cmd)), `${commandToAllow(cmd)} missing from permissions`).toBe(
        true,
      );
    }
  });

  it("grants domain-grouped ACL to the main window", () => {
    const perms = (capabilitiesJson as { permissions: string[] }).permissions;
    expect(perms).toContain("main-window-full");
    expect(perms).toContain("core:window:allow-close");
    expect(perms).toContain("core:window:allow-destroy");
  });
});
