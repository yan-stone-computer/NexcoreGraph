# -*- coding: utf-8 -*-
"""Hardened local static server for the NexcoreGraph Web client.

Unlike `python -m http.server`, this server:
- refuses dotfiles/dot-directories such as `.env`;
- prevents escaping the configured web root;
- disables directory listings;
- adds basic browser security headers.
"""

from __future__ import annotations

import argparse
import http.server
import mimetypes
import os
from pathlib import Path
from urllib.parse import unquote, urlsplit


class SafeHandler(http.server.SimpleHTTPRequestHandler):
    server_version = "NexcoreStatic/1.0"

    def __init__(self, *args, root: Path, **kwargs):
        self.web_root = root.resolve()
        super().__init__(*args, directory=str(self.web_root), **kwargs)

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        super().end_headers()

    def list_directory(self, path):  # noqa: ANN001 - stdlib signature
        self.send_error(404, "Directory listing disabled")
        return None

    def translate_path(self, path: str) -> str:
        raw = unquote(urlsplit(path).path)
        parts = [part for part in raw.split("/") if part not in ("", ".")]
        if any(part.startswith(".") for part in parts):
            return str(self.web_root / "__blocked_dotfile__")
        candidate = (self.web_root / Path(*parts)).resolve()
        try:
            candidate.relative_to(self.web_root)
        except ValueError:
            return str(self.web_root / "__blocked_traversal__")
        return str(candidate)

    def send_head(self):  # noqa: ANN001 - stdlib signature
        original = self.path
        blocked = any(
            part.startswith(".") for part in unquote(urlsplit(original).path).split("/") if part
        )
        if blocked:
            self.send_error(404, "Dotfiles are not served")
            return None
        return super().send_head()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--port", type=int, default=8090)
    parser.add_argument("--bind", default="127.0.0.1")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not (root / "index.html").is_file():
        raise SystemExit(f"index.html not found under {root}")

    def handler(*handler_args, **handler_kwargs):
        return SafeHandler(*handler_args, root=root, **handler_kwargs)

    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    with http.server.ThreadingHTTPServer((args.bind, args.port), handler) as server:
        print(f"[nexcore-web] serving {root} on http://{args.bind}:{args.port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
