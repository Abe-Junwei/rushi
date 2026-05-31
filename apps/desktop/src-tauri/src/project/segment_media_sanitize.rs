use super::types::SegmentDto;

pub const DOMINANT_SPAN_RATIO: f64 = 0.85;
const MIN_SPAN_SEC: f64 = 0.05;

fn round_sec3(v: f64) -> f64 {
    if !v.is_finite() {
        return 0.0;
    }
    (v * 1000.0).round() / 1000.0
}

pub fn is_dominant_span_segment(start_sec: f64, end_sec: f64, duration_sec: f64) -> bool {
    if duration_sec <= 0.0 || !duration_sec.is_finite() {
        return false;
    }
    let lo = start_sec.min(end_sec);
    let hi = start_sec.max(end_sec);
    let span = hi - lo;
    if span <= 0.0 {
        return false;
    }
    span / duration_sec >= DOMINANT_SPAN_RATIO
}

/// 是否整轨占位语段。显式 `kind` 优先（"placeholder"=是、"speech"=否），
/// 缺省时回退 0.85 跨度启发式。与 TS `isPlaceholderSegment` 语义一致。
pub fn is_placeholder_segment(
    kind: Option<&str>,
    start_sec: f64,
    end_sec: f64,
    duration_sec: f64,
) -> bool {
    match kind.map(str::trim) {
        Some("placeholder") => true,
        Some("speech") => false,
        _ => is_dominant_span_segment(start_sec, end_sec, duration_sec),
    }
}

pub fn clamp_segment_time_bounds(start_sec: f64, end_sec: f64, duration_sec: f64) -> (f64, f64) {
    let dur = if duration_sec > 0.0 {
        duration_sec
    } else {
        start_sec.max(end_sec).max(MIN_SPAN_SEC)
    };
    let lo = start_sec.min(end_sec);
    let hi = start_sec.max(end_sec);
    let clamped_start = round_sec3(lo.max(0.0));
    let clamped_end = round_sec3(
        hi.max(clamped_start + MIN_SPAN_SEC)
            .min(dur.max(clamped_start + MIN_SPAN_SEC)),
    );
    (clamped_start, clamped_end)
}

/// Clamp bounds to media duration; optionally drop whole-track placeholders when normal segments exist.
pub fn sanitize_segments_for_media(
    segments: Vec<SegmentDto>,
    duration_sec: Option<f64>,
    filter_dominant_when_redundant: bool,
) -> (Vec<SegmentDto>, usize) {
    let dur = duration_sec.filter(|d| d.is_finite() && *d > 0.0);
    let mut clamped: Vec<SegmentDto> = segments
        .into_iter()
        .map(|mut s| {
            if let Some(d) = dur {
                let (start, end) = clamp_segment_time_bounds(s.start_sec, s.end_sec, d);
                s.start_sec = start;
                s.end_sec = end;
            }
            s
        })
        .collect();

    // 未发生过滤的路径保留调用方 idx（不 reindex），避免覆盖如保存时的语段次序。
    if !filter_dominant_when_redundant || dur.is_none() || clamped.len() <= 1 {
        return (clamped, 0);
    }

    let d = dur.unwrap_or(0.0);
    let non_dominant_count = clamped
        .iter()
        .filter(|s| !is_placeholder_segment(s.kind.as_deref(), s.start_sec, s.end_sec, d))
        .count();
    if non_dominant_count == 0 {
        return (clamped, 0);
    }

    let before = clamped.len();
    clamped.retain(|s| !is_placeholder_segment(s.kind.as_deref(), s.start_sec, s.end_sec, d));
    let removed = before.saturating_sub(clamped.len());
    if removed == 0 {
        return (clamped, 0);
    }
    // 仅在确有删除时按位置重排 idx，填补被移除占位留下的空隙。
    for (i, s) in clamped.iter_mut().enumerate() {
        s.idx = i as i32;
    }
    (clamped, removed)
}

const BOUNDARY_EPS_SEC: f64 = 1e-6;

/// 按 start 升序后消除相邻语段重叠（ASR 拉取落库前；与 TS `trimAdjacentSegmentOverlaps` 对齐）。
pub fn trim_adjacent_segment_overlaps(segments: &mut [SegmentDto]) {
    if segments.len() < 2 {
        return;
    }
    segments.sort_by(|a, b| {
        a.start_sec
            .partial_cmp(&b.start_sec)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                a.end_sec
                    .partial_cmp(&b.end_sec)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
    });
    for i in 0..segments.len() - 1 {
        let next_start = segments[i + 1].start_sec;
        if segments[i].end_sec <= next_start + BOUNDARY_EPS_SEC {
            continue;
        }
        segments[i].end_sec = round_sec3(next_start);
        let cur_min_end = segments[i].start_sec + MIN_SPAN_SEC;
        if segments[i].end_sec + BOUNDARY_EPS_SEC < cur_min_end {
            segments[i].end_sec = round_sec3(cur_min_end);
        }
        if segments[i].end_sec > segments[i + 1].start_sec + BOUNDARY_EPS_SEC {
            segments[i + 1].start_sec = round_sec3(segments[i].end_sec);
            let next_min_end = segments[i + 1].start_sec + MIN_SPAN_SEC;
            if segments[i + 1].end_sec + BOUNDARY_EPS_SEC < next_min_end {
                segments[i + 1].end_sec = round_sec3(next_min_end);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seg(start: f64, end: f64) -> SegmentDto {
        SegmentDto {
            uid: None,
            idx: 0,
            start_sec: start,
            end_sec: end,
            text: "x".to_string(),
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
        }
    }

    #[test]
    fn clamps_end_to_media_duration() {
        let (lo, hi) = clamp_segment_time_bounds(0.0, 999.0, 120.0);
        assert_eq!(lo, 0.0);
        assert_eq!(hi, 120.0);
    }

    #[test]
    fn filters_dominant_spans_when_normal_segments_exist() {
        let input = vec![
            seg(30.0, 1000.0),
            seg(40.0, 50.0),
            seg(55.0, 65.0),
            seg(100.0, 1000.0),
        ];
        let (out, removed) = sanitize_segments_for_media(input, Some(1000.0), true);
        assert_eq!(removed, 2);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].start_sec, 40.0);
        assert_eq!(out[1].start_sec, 55.0);
    }

    #[test]
    fn keeps_single_whole_track_segment() {
        let input = vec![seg(0.0, 20.0)];
        let (out, removed) = sanitize_segments_for_media(input, Some(20.0), true);
        assert_eq!(removed, 0);
        assert_eq!(out.len(), 1);
    }

    fn seg_kind(start: f64, end: f64, kind: &str) -> SegmentDto {
        let mut s = seg(start, end);
        s.kind = Some(kind.to_string());
        s
    }

    #[test]
    fn is_placeholder_segment_prefers_explicit_kind() {
        // Explicit speech wins over the heuristic.
        assert!(!is_placeholder_segment(Some("speech"), 0.0, 95.0, 100.0));
        // Explicit placeholder wins even for a short span.
        assert!(is_placeholder_segment(Some("placeholder"), 0.0, 3.0, 100.0));
        // No kind → heuristic fallback.
        assert!(is_placeholder_segment(None, 0.0, 95.0, 100.0));
        assert!(!is_placeholder_segment(None, 0.0, 10.0, 100.0));
    }

    #[test]
    fn keeps_explicit_speech_span_the_heuristic_would_drop() {
        let input = vec![seg_kind(0.0, 950.0, "speech"), seg(960.0, 990.0)];
        let (out, removed) = sanitize_segments_for_media(input, Some(1000.0), true);
        assert_eq!(removed, 0);
        assert_eq!(out.len(), 2);
    }

    #[test]
    fn filters_explicit_placeholder_among_normal_segments() {
        let input = vec![
            seg_kind(0.0, 4.0, "placeholder"),
            seg(40.0, 50.0),
            seg(55.0, 65.0),
        ];
        let (out, removed) = sanitize_segments_for_media(input, Some(1000.0), true);
        assert_eq!(removed, 1);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].start_sec, 40.0);
    }

    #[test]
    fn trim_adjacent_overlaps_for_asr_pull() {
        let mut segs = vec![seg(0.0, 10.6), seg(10.0, 22.0), seg(22.0, 35.8)];
        trim_adjacent_segment_overlaps(&mut segs);
        assert_eq!(segs[0].end_sec, 10.0);
        assert!(segs[0].end_sec <= segs[1].start_sec + BOUNDARY_EPS_SEC);
        assert!(segs[1].end_sec <= segs[2].start_sec + BOUNDARY_EPS_SEC);
    }

    #[test]
    fn trim_eliminates_false_parallel_overlap_between_neighbors() {
        let mut segs = vec![seg(0.0, 10.0), seg(5.0, 15.0)];
        trim_adjacent_segment_overlaps(&mut segs);
        assert_eq!(segs[0].end_sec, 5.0);
        assert_eq!(segs[1].start_sec, 5.0);
    }
}
