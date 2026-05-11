from __future__ import annotations

import uvicorn

from rushi_asr.app import app, bind_addr


def main() -> None:
    host, port = bind_addr()
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
