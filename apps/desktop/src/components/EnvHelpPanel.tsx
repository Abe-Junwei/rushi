import { asrHealthUrl } from "../config/env";

export function EnvHelpPanel() {
  return (
    <div className="space-y-3 text-[12px] leading-relaxed text-zen-stone">
      <h3 className="text-[12px] font-semibold text-zen-ink">使用说明</h3>
      <p className="mb-2">
        创建或打开项目后，点「<strong className="text-zen-ink">从 ASR 拉取语段</strong>」将音频发往
        <strong className="text-zen-ink"> 本机 ASR </strong>
        或（若已启用）<strong className="text-zen-ink">在线 STT</strong>
        ，时间段与文本填入表格；修改后请「
        <strong className="text-zen-ink">保存到 SQLite</strong>」。
      </p>
      <p>
        未配置 FunASR 时多为 <strong className="text-zen-ink">stub</strong>（语段常有、正文或为空）。请先启动{" "}
        <code className="rounded bg-black/[0.04] px-1 py-0.5 font-mono text-[11px] text-zen-indigo">python -m rushi_asr</code>。
      </p>
      <h4 className="mt-4 text-[11px] font-semibold text-zen-ink">没有中文稿？</h4>
      <ol className="list-inside list-decimal space-y-1 leading-relaxed">
        <li>
          识别在<strong className="text-zen-ink">本机另一进程</strong>（默认 <code className="font-mono text-zen-indigo">{asrHealthUrl()}</code>）。
        </li>
        <li>
          终端进入 <code className="font-mono text-zen-indigo">services/asr</code> 的 venv，执行{" "}
          <code className="font-mono text-zen-indigo">python -m rushi_asr</code>。
        </li>
        <li>stub 下正文常为空属占位，非故障。</li>
        <li>
          详见仓库内 <code className="font-mono text-zen-indigo">services/asr/README.md</code>。
        </li>
      </ol>
    </div>
  );
}
