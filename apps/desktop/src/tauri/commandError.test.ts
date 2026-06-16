import { describe, expect, it } from "vitest";
import {
  isTauriCommandErrorCode,
  parseTauriCommandError,
  tauriCommandErrorMessage,
} from "./commandError";

describe("parseTauriCommandError", () => {
  it("parses structured dto objects", () => {
    expect(parseTauriCommandError({ code: "project_not_found", message: "项目不存在" })).toEqual({
      code: "project_not_found",
      message: "项目不存在",
    });
  });

  it("falls back for legacy string errors", () => {
    expect(parseTauriCommandError("磁盘已满")).toEqual({
      code: "unknown",
      message: "磁盘已满",
    });
  });

  it("extracts message helper", () => {
    expect(tauriCommandErrorMessage({ code: "db_pool", message: "连接失败" })).toBe("连接失败");
  });

  it("matches error codes", () => {
    expect(isTauriCommandErrorCode({ code: "empty_project_name", message: "x" }, "empty_project_name")).toBe(
      true,
    );
  });
});
