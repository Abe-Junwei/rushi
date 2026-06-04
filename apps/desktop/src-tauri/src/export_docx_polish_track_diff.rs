//! 润色导出修订轨：逐行 diff 与 hunk 过滤（与 TS `exportPolishTrackMarkup` 对齐）。

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum DiffPiece {
    Same(String),
    Del(String),
    Ins(String),
}

fn is_punctuation_char(c: char) -> bool {
    c.is_ascii_punctuation()
        || matches!(
            c,
            '，' | '。'
                | '！'
                | '？'
                | '；'
                | '、'
                | '：'
                | '「'
                | '」'
                | '『'
                | '』'
                | '（'
                | '）'
                | '《'
                | '》'
                | '…'
                | '—'
                | '·'
        )
}

fn strip_for_punct_compare(s: &str) -> String {
    s.chars()
        .filter(|c| !c.is_whitespace() && !is_punctuation_char(*c))
        .collect()
}

fn is_punctuation_only_line_diff(before: &str, after: &str) -> bool {
    if before == after {
        return true;
    }
    strip_for_punct_compare(before) == strip_for_punct_compare(after)
}

fn han_core_edit_distance(before: &str, after: &str) -> (usize, usize) {
    let b: Vec<char> = strip_for_punct_compare(before).chars().collect();
    let a: Vec<char> = strip_for_punct_compare(after).chars().collect();
    if b == a {
        return (0, b.len().max(a.len()).max(1));
    }
    let ops = diff_edit_ops(&b, &a);
    let mut dist = 0usize;
    for op in ops {
        match op {
            EditOp::Delete | EditOp::Insert => dist += 1,
            EditOp::Keep => {}
        }
    }
    (dist, b.len().max(a.len()).max(1))
}

fn collapse_oral_stutter(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    if chars.is_empty() {
        return String::new();
    }
    let mut out = String::new();
    let mut i = 0usize;
    while i < chars.len() {
        let ch = chars[i];
        let mut run = 1usize;
        while i + run < chars.len() && chars[i + run] == ch {
            run += 1;
        }
        out.push(ch);
        i += if run >= 3 { run } else { 1 };
    }
    out
}

fn is_oral_stutter_cleanup(before: &str, after: &str) -> bool {
    collapse_oral_stutter(before) == after
}

fn is_punctuation_only_hunk(del: &str, ins: &str) -> bool {
    if strip_for_punct_compare(del) != strip_for_punct_compare(ins) {
        return false;
    }
    del.chars()
        .all(|c| c.is_whitespace() || is_punctuation_char(c))
        && ins
            .chars()
            .all(|c| c.is_whitespace() || is_punctuation_char(c))
}

fn hunk_eligible_for_export_track(del: &str, ins: &str) -> bool {
    if del.is_empty() && ins.is_empty() {
        return false;
    }
    let hunk_len = del.chars().count() + ins.chars().count();
    if hunk_len > 10 {
        return false;
    }
    if is_oral_stutter_cleanup(del, ins) {
        return true;
    }
    if is_punctuation_only_hunk(del, ins) {
        return del != ins;
    }
    if ins.is_empty() {
        return del.chars().count() <= 2;
    }
    if del.is_empty() {
        return ins.chars().count() <= 2
            || ins
                .chars()
                .all(|c| is_punctuation_char(c) || c.is_whitespace());
    }
    let (dist, max_len) = han_core_edit_distance(del, ins);
    dist <= 4 || dist * 100 <= max_len * 12
}

/// 整行字符 diff 后，仅保留小块错字/标点修订；大段改写折叠为定稿 Same（不进 w:ins/w:del）。
fn filter_char_diff_hunks_for_export_track(pieces: Vec<DiffPiece>) -> Vec<DiffPiece> {
    let mut out = Vec::new();
    let mut i = 0usize;
    while i < pieces.len() {
        match &pieces[i] {
            DiffPiece::Same(s) => {
                push_same_str(&mut out, s);
                i += 1;
            }
            _ => {
                let mut del = String::new();
                let mut ins = String::new();
                while i < pieces.len() {
                    match &pieces[i] {
                        DiffPiece::Del(s) => {
                            del.push_str(s);
                            i += 1;
                        }
                        DiffPiece::Ins(s) => {
                            ins.push_str(s);
                            i += 1;
                        }
                        DiffPiece::Same(_) => break,
                    }
                }
                if hunk_eligible_for_export_track(&del, &ins) {
                    if !del.is_empty() {
                        push_del_str(&mut out, &del);
                    }
                    for ch in ins.chars() {
                        push_ins_char(&mut out, ch);
                    }
                } else if !ins.is_empty() {
                    push_same_str(&mut out, &ins);
                }
            }
        }
    }
    out
}

/// 修订轨仅标错字/标点；大段语义改写不进修订（正文仍用润色后定稿）。
pub(crate) fn diff_pieces_for_export_track(before: &str, after: &str) -> Vec<DiffPiece> {
    if before == after {
        return vec![];
    }
    if is_oral_stutter_cleanup(before, after) {
        return diff_pieces_char(before, after);
    }
    if is_punctuation_only_line_diff(before, after) {
        return diff_pieces_char(before, after);
    }
    let (dist, max_len) = han_core_edit_distance(before, after);
    if dist <= 4 || dist * 100 <= max_len * 12 {
        return diff_pieces_char(before, after);
    }
    filter_char_diff_hunks_for_export_track(diff_pieces_char(before, after))
}

pub fn before_lines_from_joined(joined: &str) -> Vec<String> {
    joined
        .split(['\n', '\r'])
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum EditOp {
    Keep,
    Delete,
    Insert,
}

/// LCS 回溯；语段行过长时退回单区间前缀/后缀 diff。
fn diff_edit_ops(before: &[char], after: &[char]) -> Vec<EditOp> {
    let n = before.len();
    let m = after.len();
    if n == 0 && m == 0 {
        return vec![];
    }
    if n.saturating_mul(m) > 2_500_000 {
        return diff_edit_ops_single_interval(before, after);
    }
    let mut dp = vec![vec![0u32; m + 1]; n + 1];
    for i in 1..=n {
        for j in 1..=m {
            if before[i - 1] == after[j - 1] {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
            }
        }
    }
    let mut ops = Vec::with_capacity(n + m);
    let mut i = n;
    let mut j = m;
    while i > 0 || j > 0 {
        if i > 0 && j > 0 && before[i - 1] == after[j - 1] {
            ops.push(EditOp::Keep);
            i -= 1;
            j -= 1;
        } else if j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) {
            ops.push(EditOp::Insert);
            j -= 1;
        } else {
            ops.push(EditOp::Delete);
            i -= 1;
        }
    }
    ops.reverse();
    ops
}

fn diff_edit_ops_single_interval(before: &[char], after: &[char]) -> Vec<EditOp> {
    let mut prefix = 0usize;
    while prefix < before.len() && prefix < after.len() && before[prefix] == after[prefix] {
        prefix += 1;
    }
    let mut b_end = before.len();
    let mut a_end = after.len();
    while b_end > prefix && a_end > prefix && before[b_end - 1] == after[a_end - 1] {
        b_end -= 1;
        a_end -= 1;
    }
    let mut ops = Vec::new();
    for _ in 0..prefix {
        ops.push(EditOp::Keep);
    }
    for _ in prefix..b_end {
        ops.push(EditOp::Delete);
    }
    for _ in prefix..a_end {
        ops.push(EditOp::Insert);
    }
    for _ in a_end..after.len() {
        ops.push(EditOp::Keep);
    }
    ops
}

pub(crate) fn push_same_str(bucket: &mut Vec<DiffPiece>, s: &str) {
    if s.is_empty() {
        return;
    }
    match bucket.last_mut() {
        Some(DiffPiece::Same(t)) => t.push_str(s),
        _ => bucket.push(DiffPiece::Same(s.to_string())),
    }
}

fn edit_ops_to_pieces(before: &[char], after: &[char], ops: &[EditOp]) -> Vec<DiffPiece> {
    let mut out = Vec::new();
    let mut bi = 0usize;
    let mut ai = 0usize;
    for op in ops {
        match op {
            EditOp::Keep => {
                let ch = before[bi];
                debug_assert_eq!(ch, after[ai]);
                push_same_str(&mut out, &ch.to_string());
                bi += 1;
                ai += 1;
            }
            EditOp::Delete => {
                push_del_str(&mut out, &before[bi].to_string());
                bi += 1;
            }
            EditOp::Insert => {
                push_ins_char(&mut out, after[ai]);
                ai += 1;
            }
        }
    }
    debug_assert_eq!(bi, before.len());
    debug_assert_eq!(ai, after.len());
    out
}

pub(crate) fn diff_pieces_char(before: &str, after: &str) -> Vec<DiffPiece> {
    if before == after {
        return vec![];
    }
    let b: Vec<char> = before.chars().collect();
    let a: Vec<char> = after.chars().collect();
    let ops = diff_edit_ops(&b, &a);
    edit_ops_to_pieces(&b, &a, &ops)
}

pub(crate) fn push_same_char(bucket: &mut Vec<DiffPiece>, ch: char) {
    match bucket.last_mut() {
        Some(DiffPiece::Same(t)) => t.push(ch),
        _ => bucket.push(DiffPiece::Same(ch.to_string())),
    }
}

pub(crate) fn push_ins_char(bucket: &mut Vec<DiffPiece>, ch: char) {
    match bucket.last_mut() {
        Some(DiffPiece::Ins(t)) => t.push(ch),
        _ => bucket.push(DiffPiece::Ins(ch.to_string())),
    }
}

pub(crate) fn push_del_str(bucket: &mut Vec<DiffPiece>, s: &str) {
    if s.is_empty() {
        return;
    }
    match bucket.last_mut() {
        Some(DiffPiece::Del(t)) => t.push_str(s),
        _ => bucket.push(DiffPiece::Del(s.to_string())),
    }
}

pub(crate) fn pieces_have_markup(pieces: &[DiffPiece]) -> bool {
    pieces
        .iter()
        .any(|p| matches!(p, DiffPiece::Del(_) | DiffPiece::Ins(_)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn per_line_punct_diff_is_small() {
        let pieces = diff_pieces_char("你好世界", "你好，世界。");
        assert!(pieces_have_markup(&pieces));
        let markup_len: usize = pieces
            .iter()
            .filter_map(|p| match p {
                DiffPiece::Del(s) | DiffPiece::Ins(s) => Some(s.chars().count()),
                _ => None,
            })
            .sum();
        assert!(markup_len < 10);
    }

    #[test]
    fn export_track_skips_large_rewrite() {
        let before = "嗯那个我们今天呢就来说一下这个问题";
        let after = "今天我们讨论这个问题。";
        let pieces = diff_pieces_for_export_track(before, after);
        let markup_len: usize = pieces
            .iter()
            .filter_map(|p| match p {
                DiffPiece::Del(s) | DiffPiece::Ins(s) => Some(s.chars().count()),
                _ => None,
            })
            .sum();
        assert!(
            markup_len * 100 <= before.chars().count().max(1) * 15,
            "markup too large ({markup_len}): {pieces:?}"
        );
    }

    #[test]
    fn export_track_keeps_punct_diff() {
        let pieces = diff_pieces_for_export_track("你好", "你好。");
        assert!(pieces_have_markup(&pieces));
    }

    #[test]
    fn export_track_keeps_typo_hunks_in_long_line() {
        let before = "脊柱向上屈肩背胸小胸小向两臂自然舒展";
        let after = "脊柱向上，屈肩背，胸腔向两臂自然舒展";
        let pieces = diff_pieces_for_export_track(before, after);
        assert!(
            pieces_have_markup(&pieces),
            "expected typo/punct hunks, got {pieces:?}"
        );
    }

    #[test]
    fn multi_region_typo_diff_has_two_del_regions() {
        let pieces = diff_pieces_char("甲错乙错丙", "甲对乙对丙");
        let del_count = pieces
            .iter()
            .filter(|p| matches!(p, DiffPiece::Del(_)))
            .count();
        assert!(
            del_count >= 2,
            "expected multiple del regions, got {del_count:?}"
        );
    }

    #[test]
    fn export_track_markup_shared_fixture() {
        #[derive(serde::Deserialize)]
        struct Case {
            id: String,
            before: String,
            after: String,
            #[serde(rename = "expectMarkup")]
            expect_markup: bool,
        }
        #[derive(serde::Deserialize)]
        struct Fixture {
            cases: Vec<Case>,
        }
        let raw = include_str!("../../src/services/fixtures/exportTrackMarkupCases.json");
        let fixture: Fixture = serde_json::from_str(raw).expect("fixture json");
        for case in fixture.cases {
            let pieces = diff_pieces_for_export_track(&case.before, &case.after);
            let has = pieces_have_markup(&pieces);
            assert_eq!(
                has, case.expect_markup,
                "fixture {} ({})",
                case.id, case.before
            );
        }
    }
}
