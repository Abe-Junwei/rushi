import http from "node:http";

const port = Number(process.env.PW_ASR_MOCK_PORT ?? 18741);

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "rushi-asr",
        funasr_default_model_cached: true,
        rushi_models_root: "/tmp/rushi-asr-mock-models",
        funasr_required_models_cached: true,
        funasr_loaded_model_id: "mock-funasr",
      }),
    );
    return;
  }

  if (req.method === "POST" && req.url === "/v1/transcribe") {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          schema_version: "1",
          segments: [],
          engine: "mock-funasr",
          warnings: [],
        }),
      );
    });
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`rushi-asr mock listening on http://127.0.0.1:${port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
