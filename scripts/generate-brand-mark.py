#!/usr/bin/env python3
"""Generate Rushi brand mark assets from stitch-brand-logo-reference.png.

Vector paths require: pip3 install potracer  (imports as `potrace`)
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "apps/desktop/stitch-brand-logo-reference.png"
OUT_DIR = ROOT / "apps/desktop/src/assets/brand"

INK = (0x2C, 0x2C, 0x2C, 255)
WHITE = (0xFF, 0xFF, 0xFF, 255)
SAFFRON = (0xC5, 0x8A, 0x43, 255)
ICON_SIZE = 1024
VIEW_BOX = 32
CONTENT_RATIO = 0.86
GLYPH_PADDING_RATIO = 0.06
TRACE_SCALE = 4
WHITE_THRESHOLD = 240


def crop_to_glyph(image: Image.Image, padding_ratio: float = GLYPH_PADDING_RATIO) -> Image.Image:
    bbox = image.getbbox()
    if not bbox:
        return image
    left, upper, right, lower = bbox
    width = right - left
    height = lower - upper
    pad = int(max(width, height) * padding_ratio)
    left = max(0, left - pad)
    upper = max(0, upper - pad)
    right = min(image.width, right + pad)
    lower = min(image.height, lower + pad)
    return image.crop((left, upper, right, lower))


def rgba_from_reference(source: Path) -> Image.Image:
    img = Image.open(source).convert("RGBA")
    pixels = img.load()
    width, height = img.size
    for y in range(height):
        for x in range(width):
            r, g, b, _a = pixels[x, y]
            luminance = (r + g + b) / 3
            if luminance >= WHITE_THRESHOLD:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                pixels[x, y] = INK
    return img


def recolor_alpha(source: Image.Image, color: tuple[int, int, int, int]) -> Image.Image:
    out = Image.new("RGBA", source.size, (0, 0, 0, 0))
    src_pixels = source.load()
    out_pixels = out.load()
    for y in range(source.height):
        for x in range(source.width):
            if src_pixels[x, y][3] > 0:
                out_pixels[x, y] = color
    return out


def fit_on_canvas(
    glyph: Image.Image,
    canvas_size: int,
    background: tuple[int, int, int, int] | None,
    content_ratio: float,
) -> Image.Image:
    margin = int(canvas_size * (1 - content_ratio) / 2)
    max_dim = canvas_size - margin * 2
    scale = min(max_dim / glyph.width, max_dim / glyph.height)
    target = (
        max(1, int(glyph.width * scale)),
        max(1, int(glyph.height * scale)),
    )
    resized = glyph.resize(target, Image.Resampling.LANCZOS)
    if background is None:
        canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGBA", (canvas_size, canvas_size), background)
    offset = ((canvas_size - target[0]) // 2, (canvas_size - target[1]) // 2)
    canvas.paste(resized, offset, resized)
    return canvas


def _fmt(value: float) -> str:
    text = f"{value:.3f}".rstrip("0").rstrip(".")
    return text or "0"


def _norm_point(
    x: float,
    y: float,
    min_x: float,
    min_y: float,
    width: float,
    height: float,
    margin: float,
    usable: float,
) -> tuple[float, float]:
    span = max(width, height) or 1.0
    scale = usable / span
    offset_x = margin + (usable - width * scale) / 2
    offset_y = margin + (usable - height * scale) / 2
    return (
        (x - min_x) * scale + offset_x,
        (y - min_y) * scale + offset_y,
    )


def trace_vector_paths(glyph: Image.Image) -> list[str]:
    try:
        import potrace  # type: ignore[import-untyped]  # pip package: potracer
    except ImportError as exc:
        raise SystemExit(
            "potrace module missing; install with: pip3 install potracer"
        ) from exc

    white = Image.new("RGBA", glyph.size, (255, 255, 255, 255))
    composited = Image.alpha_composite(white, glyph.convert("RGBA")).convert("L")
    scaled = composited.resize(
        (composited.width * TRACE_SCALE, composited.height * TRACE_SCALE),
        Image.Resampling.LANCZOS,
    )
    height = scaled.height
    traced = potrace.Bitmap(scaled).trace(turdsize=2, opttolerance=0.2)

    raw_points: list[tuple[float, float]] = []
    raw_segments: list[tuple[str, tuple]] = []

    for curve in traced:
        start = curve.start_point
        raw_points.append((start.x, height - start.y))
        curve_points: list[tuple[str, tuple]] = [("M", (start.x, height - start.y))]
        for segment in curve:
            if segment.is_corner:
                c = (segment.c.x, height - segment.c.y)
                end = (segment.end_point.x, height - segment.end_point.y)
                raw_points.extend([c, end])
                curve_points.append(("L", c))
                curve_points.append(("L", end))
            else:
                c1 = (segment.c1.x, height - segment.c1.y)
                c2 = (segment.c2.x, height - segment.c2.y)
                end = (segment.end_point.x, height - segment.end_point.y)
                raw_points.extend([c1, c2, end])
                curve_points.append(("C", (c1, c2, end)))
        raw_segments.append(curve_points)

    xs = [p[0] for p in raw_points]
    ys = [p[1] for p in raw_points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    width = max_x - min_x
    height = max_y - min_y
    margin = VIEW_BOX * (1 - CONTENT_RATIO) / 2
    usable = VIEW_BOX - margin * 2

    def tx(point: tuple[float, float]) -> tuple[float, float]:
        return _norm_point(point[0], point[1], min_x, min_y, width, height, margin, usable)

    paths: list[str] = []
    for curve_points in raw_segments:
        parts: list[str] = []
        for op, payload in curve_points:
            if op == "M":
                x, y = tx(payload)
                parts.append(f"M{_fmt(x)},{_fmt(y)}")
            elif op == "L":
                x, y = tx(payload)
                parts.append(f"L{_fmt(x)},{_fmt(y)}")
            else:
                (c1, c2, end) = payload
                x1, y1 = tx(c1)
                x2, y2 = tx(c2)
                x3, y3 = tx(end)
                parts.append(
                    f"C{_fmt(x1)},{_fmt(y1)} {_fmt(x2)},{_fmt(y2)} {_fmt(x3)},{_fmt(y3)}"
                )
        parts.append("Z")
        paths.append("".join(parts))
    return paths


def write_mark_master_svg(paths: list[str], out_path: Path) -> None:
    body = "\n".join(
        f'  <path fill="#2C2C2C" d="{path}"/>' for path in paths
    )
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VIEW_BOX} {VIEW_BOX}" fill="none">\n'
        f"{body}\n"
        "</svg>\n"
    )
    out_path.write_text(svg, encoding="utf-8")


def write_mark_paths_ts(paths: list[str], out_path: Path) -> None:
    joined = ",\n  ".join(f'"{path}"' for path in paths)
    content = f"""/** Generated by scripts/generate-brand-mark.py — do not edit */
export const BRAND_MARK_VIEW_BOX = {VIEW_BOX} as const;

export const BRAND_MARK_PATHS = [
  {joined},
] as const;
"""
    out_path.write_text(content, encoding="utf-8")


def write_lockup_readme_png(glyph: Image.Image, out_path: Path) -> None:
    mark = fit_on_canvas(recolor_alpha(glyph, WHITE), 64, SAFFRON, 0.86)
    canvas = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    canvas.paste(mark, (0, 0), mark)
    canvas.save(out_path)


def main() -> int:
    if not REFERENCE.is_file():
        print(f"missing reference: {REFERENCE}", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ink_glyph = crop_to_glyph(rgba_from_reference(REFERENCE))
    white_glyph = recolor_alpha(ink_glyph, WHITE)

    ink_glyph.save(OUT_DIR / "mark-ru-standard.png")
    white_glyph.save(OUT_DIR / "mark-ru-on-primary.png")

    icon_source = fit_on_canvas(
        white_glyph,
        ICON_SIZE,
        SAFFRON,
        CONTENT_RATIO,
    )
    icon_source.save(OUT_DIR / "icon-source.png")
    write_lockup_readme_png(ink_glyph, OUT_DIR / "lockup-readme.png")

    vector_paths = trace_vector_paths(ink_glyph)
    write_mark_master_svg(vector_paths, OUT_DIR / "mark-master.svg")
    write_mark_paths_ts(vector_paths, OUT_DIR / "markPaths.ts")

    print(
        f"[generate-brand-mark] wrote assets under {OUT_DIR} "
        f"({len(vector_paths)} vector path(s))"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
