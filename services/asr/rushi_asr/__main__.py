from __future__ import annotations

import uvicorn

from rushi_asr.app import app, bind_addr
from rushi_asr.ffmpeg_audio import ensure_ffmpeg_on_path
from rushi_asr.model_cache_env import configure_hub_env


def main() -> None:
    configure_hub_env()
    ensure_ffmpeg_on_path()
    host, port = bind_addr()
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
