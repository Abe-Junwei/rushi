import { describe, expect, it } from "vitest";
import { humanizeInvokeError } from "./humanizeInvokeError";
import { TauriCommandError } from "../../tauri/commandError";

describe("humanizeInvokeError", () => {
  it("returns structured TauriCommandError message directly", () => {
    expect(
      humanizeInvokeError(
        new TauriCommandError({ code: "project_not_found", message: "项目不存在或已被删除。" }),
      ),
    ).toBe("项目不存在或已被删除。");
  });

  it("maps Tauri ACL denial for stt_save_api_key", () => {
    expect(
      humanizeInvokeError(
        new Error(
          "stt_save_api_key not allowed. Permissions associated with this command: allow-stt-save-api-key",
        ),
      ),
    ).toContain("在线 STT");
    expect(
      humanizeInvokeError(
        new Error(
          "stt_save_api_key not allowed. Permissions associated with this command: allow-stt-save-api-key",
        ),
      ),
    ).not.toContain("Permissions");
  });

  it("falls back for unknown denied commands", () => {
    expect(humanizeInvokeError(new Error("foo_bar not allowed. Permissions associated with this command: allow-foo"))).toContain(
      "权限未配置",
    );
  });

  it("passes through normal business errors", () => {
    expect(humanizeInvokeError(new Error("API 密钥为空，无法保存。"))).toBe("API 密钥为空，无法保存。");
  });

  it("maps Failed to fetch to Chinese", () => {
    expect(humanizeInvokeError(new Error("Failed to fetch"))).toBe(
      "网络请求失败，请检查网络与代理后重试。",
    );
  });

  it("shortens reqwest network errors with a Chinese prefix", () => {
    expect(
      humanizeInvokeError(
        new Error(
          "百炼 ASR 请求失败: error sending request for url (https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation)",
        ),
      ),
    ).toBe("百炼 ASR 请求失败：网络不通或代理拦截，请检查连接。");
  });

  it("maps dashscope TooLarge payload errors", () => {
    expect(
      humanizeInvokeError(
        new Error(
          '百炼 ASR HTTP 400 Bad Request: {"code":"BadRequest.TooLarge","message":"Exceeded limit on max bytes per data-uri item : 20971520"}',
        ),
      ),
    ).toContain("20 MB");
  });
});
