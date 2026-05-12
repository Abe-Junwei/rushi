import { test, expect } from "@playwright/test";

function makeSilentWavBuffer(sampleRate = 16000, durationMs = 120): Buffer {
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const dataSize = sampleCount * channels * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buf.writeUInt16LE(channels * bytesPerSample, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  return buf;
}

test.describe("loopback rushi-asr", () => {
  test("GET /health returns service metadata", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("rushi-asr");
    expect(body).toHaveProperty("funasr_default_model_cached");
  });

  test("POST /v1/transcribe returns v1 contract", async ({ request }) => {
    const wav = makeSilentWavBuffer();
    const res = await request.post("/v1/transcribe", {
      multipart: {
        file: {
          name: "smoke.wav",
          mimeType: "audio/wav",
          buffer: wav,
        },
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.schema_version).toBe("1");
    expect(Array.isArray(body.segments)).toBeTruthy();
    expect(typeof body.engine).toBe("string");
    expect(Array.isArray(body.warnings)).toBeTruthy();
  });
});
