#!/usr/bin/env bash
# Generate 10 short Chinese WAVs under fixtures/p0-samples/ using macOS `say` + ffmpeg.
# Requires: macOS, ffmpeg in PATH.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/fixtures/p0-samples"
mkdir -p "$OUT"

command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg required"; exit 1; }
command -v say >/dev/null 2>&1 || { echo "This script requires macOS 'say'"; exit 1; }

pick_voice() {
  local line name
  while IFS= read -r line; do
    name="${line%% *}"
    case "$name" in
      Ting-Ting|Tingting|Sin-ji|Mei-Jia) echo "$name"; return 0 ;;
    esac
  done < <(say -v '?' 2>/dev/null || true)
  return 1
}

VOICE="$(pick_voice || true)"
if [[ -z "${VOICE}" ]]; then
  echo "No suitable Chinese voice (Ting-Ting / Sin-ji / Mei-Jia) in 'say -v ?'."
  echo "Add voices in System Settings → Accessibility → Spoken Content, or drop 10 *.wav into $OUT."
  exit 1
fi

PHRASES=(
  "如是我闻本地语音识别测试第一句"
  "禅修课程转写与校对工作台"
  "南无阿弥陀佛"
  "请安装独立虚拟环境避免依赖冲突"
  "本地服务只绑定回环地址"
  "分段结果包含开始与结束时间"
  "置信度可以为空但需可降级标记"
  "失败时返回明确错误原因"
  "FunASR 与 SenseVoice 为中文主线"
  "第十句样本用于批量验收"
)

i=0
for phrase in "${PHRASES[@]}"; do
  i=$((i + 1))
  tmp_aiff="$(mktemp "/tmp/rushi_p0_XXXXXX.aiff")"
  say -v "$VOICE" "$phrase" -o "$tmp_aiff"
  ffmpeg -hide_banner -nostdin -loglevel error -y -i "$tmp_aiff" -ac 1 -ar 16000 "$OUT/$(printf '%02d' "$i").wav"
  rm -f "$tmp_aiff"
  echo "wrote $(printf '%02d' "$i").wav"
done

echo "Done: 10 files in $OUT (gitignored *.wav)"
