import { describe, expect, it } from "vitest";
import {
  isTauriCommandErrorCode,
  parseTauriCommandError,
  tauriCommandErrorMessage,
  TauriCommandError,
} from "./commandError";

describe("parseTauriCommandError", () => {
  it("parses structured dto objects", () => {
    expect(parseTauriCommandError({ code: "project_not_found", message: "项目不存在" })).toEqual({
      code: "project_not_found",
      message: "项目不存在",
    });
  });

  it("parses serialized structured dto strings from Tauri", () => {
    expect(parseTauriCommandError('{"code":"delete_project","message":"删除项目失败"}')).toEqual({
      code: "delete_project",
      message: "删除项目失败",
    });
  });

  it("uses unknown code for structured objects without code", () => {
    expect(parseTauriCommandError({ message: "加载项目详情失败" })).toEqual({
      code: "unknown",
      message: "加载项目详情失败",
    });
  });

  it("falls back for legacy string errors", () => {
    expect(parseTauriCommandError("磁盘已满")).toEqual({
      code: "unknown",
      message: "磁盘已满",
    });
  });

  it("falls back for Error objects not shaped like command dto", () => {
    expect(parseTauriCommandError(new Error("磁盘已满"))).toEqual({
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

  it("preserves structured dto on TauriCommandError", () => {
    const error = new TauriCommandError({ code: "project_detail_load", message: "加载项目详情失败" });

    expect(error.name).toBe("TauriCommandError");
    expect(error.code).toBe("project_detail_load");
    expect(error.message).toBe("加载项目详情失败");
    expect(error.dto).toEqual({ code: "project_detail_load", message: "加载项目详情失败" });
  });
});
