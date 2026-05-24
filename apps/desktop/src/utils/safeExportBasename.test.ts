import { describe, expect, it } from "vitest";
import { safeExportBasename } from "./safeExportBasename";

describe("safeExportBasename", () => {
  it("保留正常中文/英文文件名", () => {
    expect(safeExportBasename("演讲稿", "txt")).toBe("演讲稿.txt");
    expect(safeExportBasename("lecture_notes", "srt")).toBe("lecture_notes.srt");
    expect(safeExportBasename("项目归档", "zip")).toBe("项目归档.zip");
  });

  it("替换路径分隔符与非法字符为下划线", () => {
    expect(safeExportBasename("a/b\\c?d*e:f|g<h>i", "txt")).toBe("a_b_c_d_e_f_g_h_i.txt");
  });

  it("替换控制字符为下划线", () => {
    expect(safeExportBasename("a\x00b\x01c", "txt")).toBe("a_b_c.txt");
  });

  it("压缩连续下划线", () => {
    expect(safeExportBasename("a///b", "txt")).toBe("a_b.txt");
  });

  it("去除首尾空格与句点", () => {
    expect(safeExportBasename("  hello  ", "txt")).toBe("hello.txt");
    expect(safeExportBasename("...world...", "txt")).toBe("world.txt");
    expect(safeExportBasename(" . hidden . ", "txt")).toBe("hidden.txt");
  });

  it("规避 Windows 保留名", () => {
    expect(safeExportBasename("CON", "txt")).toBe("CON_.txt");
    expect(safeExportBasename("com1", "txt")).toBe("com1_.txt");
    expect(safeExportBasename("LPT9", "txt")).toBe("LPT9_.txt");
    expect(safeExportBasename("AUX", "txt")).toBe("AUX_.txt");
  });

  it("空字符串或仅剩非法字符时回退到 export", () => {
    expect(safeExportBasename("", "txt")).toBe("export.txt");
    expect(safeExportBasename("   ", "txt")).toBe("export.txt");
    expect(safeExportBasename("///", "txt")).toBe("export.txt");
  });
});
