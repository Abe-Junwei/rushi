import { describe, expect, it } from "vitest";
import { isPrepareModelResumableError, normalizePrepareModelErrorCode } from "./prepareModelResume";

describe("normalizePrepareModelErrorCode", () => {
  it("maps HTTPSConnectionPool to model_prepare_network_error", () => {
    expect(
      normalizePrepareModelErrorCode(
        "HTTPSConnectionPool(host='www.modelscope.cn', port=443): Max retries exceeded",
      ),
    ).toBe("model_prepare_network_error");
  });
});

describe("isPrepareModelResumableError", () => {
  it("accepts known resumable sidecar codes", () => {
    expect(isPrepareModelResumableError("model_prepare_network_error")).toBe(true);
    expect(isPrepareModelResumableError("model_prepare_failed")).toBe(true);
    expect(isPrepareModelResumableError("fetch_failed")).toBe(true);
  });

  it("accepts transient network hints in free-form codes", () => {
    expect(isPrepareModelResumableError("Connection reset by peer")).toBe(true);
    expect(isPrepareModelResumableError("request timeout")).toBe(true);
  });

  it("rejects non-resumable failures", () => {
    expect(isPrepareModelResumableError("model_prepare_disk_full")).toBe(false);
    expect(isPrepareModelResumableError("funasr_not_installed")).toBe(false);
  });
});
