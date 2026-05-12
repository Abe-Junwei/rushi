import { test, expect } from "@playwright/test";

test.describe("loopback rushi-asr", () => {
  test("GET /health returns service metadata", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("rushi-asr");
    expect(body).toHaveProperty("funasr_default_model_cached");
  });
});
