//! Canvas 2D waveform renderer via wasm-bindgen.
//!
//! Replaces DOM-based rendering with a tight Rust loop over PCM f32 samples,
//! drawing directly to an HTMLCanvasElement through web-sys.

use wasm_bindgen::prelude::*;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};

/// Draw a waveform onto the canvas identified by `canvas_id`.
///
/// * `samples` — interleaved PCM f32 (mono or stereo; stereo is averaged to mono).
/// * `width`, `height` — canvas CSS pixel dimensions.
/// * `color` — CSS color string for the waveform line/fill.
/// * `bar_width` — width of each bar in px (0 = line mode).
/// * `gap` — gap between bars in px.
#[wasm_bindgen]
pub fn draw_waveform(
    canvas_id: &str,
    samples: &[f32],
    width: u32,
    height: u32,
    color: &str,
    bar_width: f64,
    gap: f64,
) -> Result<(), JsValue> {
    let window = web_sys::window().ok_or("no window")?;
    let document = window.document().ok_or("no document")?;
    let canvas: HtmlCanvasElement = document
        .get_element_by_id(canvas_id)
        .ok_or("canvas not found")?
        .dyn_into()?;

    canvas.set_width(width);
    canvas.set_height(height);

    let ctx: CanvasRenderingContext2d = canvas
        .get_context("2d")?
        .ok_or("no 2d context")?
        .dyn_into()?;

    ctx.clear_rect(0.0, 0.0, width as f64, height as f64);

    if samples.is_empty() {
        return Ok(());
    }

    let h = height as f64;
    let w = width as f64;
    let mid = h / 2.0;

    // Average stereo to mono if sample count is even and plausible.
    let mono: Vec<f32> = if samples.len() % 2 == 0 && samples.len() >= 2 {
        samples
            .chunks_exact(2)
            .map(|c| (c[0] + c[1]) * 0.5)
            .collect()
    } else {
        samples.to_vec()
    };

    if mono.is_empty() {
        return Ok(());
    }

    let samples_per_pixel = mono.len() as f64 / w;
    if samples_per_pixel <= 1.0 {
        // Line mode for short audio: draw sample-by-sample.
        ctx.set_stroke_style_str(color);
        ctx.begin_path();
        ctx.move_to(0.0, mid);
        for (i, &s) in mono.iter().enumerate() {
            let x = (i as f64 / mono.len() as f64) * w;
            let y = mid - (s as f64).clamp(-1.0, 1.0) * mid;
            ctx.line_to(x, y);
        }
        ctx.stroke();
    } else {
        // Bar mode: downsample to min/max per pixel column.
        let _step = samples_per_pixel.ceil() as usize;
        let col_w = if bar_width > 0.0 { bar_width } else { 1.0 };
        let cols = (w / (col_w + gap)).ceil() as usize;
        ctx.set_fill_style_str(color);
        for col in 0..cols {
            let start = (col as f64 * samples_per_pixel).floor() as usize;
            let end = ((col + 1) as f64 * samples_per_pixel).ceil() as usize;
            let end = end.min(mono.len());
            if start >= end {
                continue;
            }
            let mut min = mono[start];
            let mut max = mono[start];
            for &s in &mono[start..end] {
                if s < min {
                    min = s;
                }
                if s > max {
                    max = s;
                }
            }
            let top = mid - (max as f64).clamp(-1.0, 1.0) * mid;
            let bottom = mid - (min as f64).clamp(-1.0, 1.0) * mid;
            let x = col as f64 * (col_w + gap);
            ctx.fill_rect(x, top, col_w, bottom - top);
        }
    }

    Ok(())
}

/// Convenience: draw a single-channel waveform with sensible defaults.
#[wasm_bindgen]
pub fn draw_waveform_simple(
    canvas_id: &str,
    samples: &[f32],
    width: u32,
    height: u32,
) -> Result<(), JsValue> {
    draw_waveform(canvas_id, samples, width, height, "#3D4F5D", 2.0, 1.0)
}
