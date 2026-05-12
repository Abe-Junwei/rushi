import { useRef, useEffect } from "react";
import { asrBaseUrl, asrHealthUrl, isDefaultBundledAsrTarget } from "../config/env";
import { useGlossaryP2Controller } from "../pages/useGlossaryP2Controller";
import { funasrManualSetupCommands, useProjectP1Controller } from "../pages/useProjectP1Controller";
import "./ProjectP1Panel.css";

export function ProjectP1Panel() {
  const c = useProjectP1Controller();
  const gl = useGlossaryP2Controller();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !c.audioSrc) return;
    el.src = c.audioSrc;
    void el.load();
  }, [c.audioSrc]);

  const seekToSegment = (idx: number) => {
    const s = c.segments[idx];
    if (!s || !audioRef.current) return;
    audioRef.current.currentTime = s.start_sec;
    c.setSelectedIdx(idx);
  };

  return (
    <section className="p1-panel panel panel-spaced">
      <h2 className="panel-title">本地项目与校对（P1–P4）</h2>
      <p className="panel-meta">
        <strong>自动转写</strong>：创建或打开项目后，点「<strong>从 ASR 拉取语段</strong>」会把当前项目里的音频副本发给本地
        ASR，返回的<strong>时间段与文本会填入下方表格</strong>（不是让你从零手打）。表格可再手改，再点「保存到 SQLite」。
      </p>
      <p className="panel-meta">
        请先启动本地 ASR；若未配置 FunASR，服务会走 <strong>stub</strong>：往往只有一条语段且<strong>文本为空</strong>，属正常——按
        ASR 文档装好 FunASR 后再拉取一次即可出中文。
      </p>

      {c.error ? <p className="panel-err">{c.error}</p> : null}

      {c.funasrInstallMessage && !c.prepareModelBusy ? (
        <pre className="panel-hint p1-funasr-install-msg">{c.funasrInstallMessage}</pre>
      ) : null}

      {c.asrHealth === "ok" && c.asrCaps && !c.asrCaps.ffmpeg_ok ? (
        <div className="panel-warn p1-funasr-banner">
          <p>
            <strong>未检测到 FFmpeg</strong>：ASR 无法解码上传音频。请先安装 ffmpeg/ffprobe 并加入 PATH，再重启 ASR。
          </p>
        </div>
      ) : null}

      {c.asrHealth === "ok" && c.asrCaps && c.asrCaps.ffmpeg_ok && !c.asrCaps.funasr_ready ? (
        <div className="panel-warn p1-funasr-banner">
          <p>
            <strong>FunASR 未就绪</strong>：当前多为 <strong>stub</strong>（语段时间可能有，<strong>中文正文常为空</strong>）。请先安装
            FunASR 依赖；未设置 <code>RUSHI_FUNASR_MODEL</code> 时服务会使用<strong>内置默认</strong>模型 id（首次转写需联网下载权重到应用数据目录下的{" "}
            <code>models/</code>）。桌面可在 <strong>macOS / Linux</strong> 下一键安装；完成后<strong>重启</strong>{" "}
            <code>python -m rushi_asr</code>。若无本仓库源码，请用手动命令或阅读 <code>services/asr/README.md</code>。
          </p>
          <div className="row-gap p1-funasr-actions">
            <button
              type="button"
              className="primary"
              disabled={c.busy}
              onClick={() => void c.installFunasrDepsInteractive()}
            >
              一键安装 FunASR 依赖（选仓库根目录）
            </button>
            <button type="button" className="secondary" disabled={c.busy} onClick={() => void c.copyFunasrManualCommands()}>
              复制手动命令
            </button>
          </div>
          <pre className="panel-hint p1-funasr-snippet">{funasrManualSetupCommands()}</pre>
        </div>
      ) : null}

      {c.asrHealth === "checking" ? (
        <p className="panel-hint">
          正在检测本机 ASR：<code>{asrHealthUrl()}</code>…
        </p>
      ) : null}
      {c.asrHealth === "error" ? (
        <div className="panel-warn p1-asr-block">
          <p className="p1-asr-health-detail">{c.asrHealthDetail}</p>
          <div className="row-gap">
            <button type="button" className="secondary" disabled={c.busy} onClick={() => void c.refreshAsrHealth()}>
              重新检测 ASR
            </button>
            {isDefaultBundledAsrTarget() && c.bundledAsrDiag?.attempted ? (
              <button type="button" className="secondary" disabled={c.busy} onClick={() => void c.retryBundledAsrSidecar()}>
                重试启动内置侧车
              </button>
            ) : null}
            <button type="button" className="secondary" disabled={c.busy} onClick={() => void c.openAppDataFolder()}>
              打开应用数据目录
            </button>
          </div>
          <p className="panel-hint p1-asr-url">
            当前 ASR 基址：<code>{asrBaseUrl()}</code>（开发时可在 <code>apps/desktop/.env</code> 设置 <code>VITE_ASR_BASE_URL</code>）
          </p>
        </div>
      ) : null}
      {c.asrHealth === "ok" ? (
        <div className="p1-asr-ok-block">
          <p className="panel-hint p1-asr-ok">
            本机 ASR 已连通：<code>{asrBaseUrl()}</code>
          </p>
          {c.asrCaps ? (
            <p className="panel-hint p1-asr-cap-line">
              FFmpeg：<strong>{c.asrCaps.ffmpeg_ok ? "可用" : "不可用"}</strong>
              {" · "}
              FunASR 包：<strong>{c.asrCaps.funasr_import_ok ? "已安装" : "未安装"}</strong>
              {" · "}
              模型 <code>{c.asrCaps.funasr_model_id ?? "—"}</code>
              {c.asrCaps.funasr_model_explicit_from_env ? "（环境变量）" : "（内置默认）"}
              {" · "}
              默认权重缓存探测：<strong>{c.asrCaps.funasr_default_model_cached ? "已命中" : "未命中"}</strong>
              {" · "}
              中文转写就绪：<strong>{c.asrCaps.funasr_ready ? "是" : "否（stub）"}</strong>
              {c.asrCaps.rushi_models_root ? (
                <>
                  {" · "}
                  权重缓存：<code className="p1-mono">{c.asrCaps.rushi_models_root}</code>
                </>
              ) : null}
            </p>
          ) : (
            <p className="panel-hint">（ASR 未返回能力字段，请升级本仓库中的 rushi-asr 后重启服务。）</p>
          )}
          {c.asrCaps && c.asrCaps.funasr_import_ok && !c.asrCaps.funasr_default_model_cached ? (
            <div className="p1-model-prefetch">
              <div className="row-gap">
                <button
                  type="button"
                  className="secondary"
                  disabled={c.busy || c.prepareModelBusy}
                  onClick={() => void c.prepareDefaultFunasrModel()}
                >
                  {c.prepareModelBusy ? "正在下载默认模型…" : "预先下载默认模型（需联网，可能较久）"}
                </button>
              </div>
              {c.prepareModelBusy ? (
                <div className="p1-model-prepare-meter" aria-live="polite">
                  <div
                    className="p1-progress-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={c.prepareModelProgress}
                    aria-label="默认模型下载粗略进度（按等待时间估算）"
                  >
                    <div className="p1-progress-fill" style={{ width: `${c.prepareModelProgress}%` }} />
                  </div>
                  {c.funasrInstallMessage ? (
                    <pre className="panel-hint p1-funasr-install-msg p1-model-prepare-status">{c.funasrInstallMessage}</pre>
                  ) : null}
                  <p className="panel-hint p1-model-prepare-foot">
                    进度条按等待时间粗略估算，实际取决于网络；关闭本窗口不会取消侧车上的下载任务。
                  </p>
                </div>
              ) : null}
              {c.prepareModelFailure ? (
                <div className="p1-model-prepare-failure" role="alert">
                  <p className="p1-model-prepare-failure-lead">
                    <strong>预先下载未完成</strong>
                  </p>
                  <p className="p1-model-prepare-failure-headline">{c.prepareModelFailure.headline}</p>
                  <ul className="p1-model-prepare-failure-tips">
                    {c.prepareModelFailure.tips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                  <div className="row-gap p1-model-prepare-retry">
                    <button
                      type="button"
                      className="secondary"
                      disabled={c.busy || c.prepareModelBusy}
                      onClick={() => void c.prepareDefaultFunasrModel()}
                    >
                      重试下载默认模型
                    </button>
                    <button type="button" className="secondary" disabled={c.busy} onClick={() => void c.refreshAsrHealth()}>
                      重新检测 ASR
                    </button>
                    <button type="button" className="secondary" disabled={c.busy} onClick={() => void c.openAppDataFolder()}>
                      打开应用数据目录
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {c.transcribeHints.length > 0 ? (
        <div className="p1-transcribe-hints">
          {c.transcribeHints.map((h, i) => (
            <p key={i} className="panel-meta p1-hint-line">
              {h}
            </p>
          ))}
        </div>
      ) : null}

      <details className="p1-help-details">
        <summary>没有中文稿？本机 ASR 与 FunASR 是做什么的</summary>
        <ol className="panel-meta p1-help-list">
          <li>
            桌面应用<strong>不内置</strong>语音识别模型；识别在<strong>本机另一个进程</strong>里完成（默认{" "}
            <code>127.0.0.1:8741</code>）。
          </li>
          <li>
            在终端进入 <code>services/asr</code> 的 Python venv，执行 <code>python -m rushi_asr</code>，保持该窗口运行。
          </li>
          <li>
            仅安装基础依赖时，ASR 多为 <strong>stub</strong>：有时间段、正文常为空——这是<strong>占位行为</strong>，不是软件坏了。
          </li>
          <li>
            要出中文识别结果：在同一 venv 中按说明执行 <code>pip install -e &quot;.[funasr]&quot;</code>，并配置环境变量{" "}
            <code>RUSHI_FUNASR_MODEL</code>（模型名见 FunASR / ModelScope 文档）。若你从 Git 克隆了本仓库，可在本面板用「一键安装
            FunASR 依赖」代替手动 <code>pip</code>（macOS/Linux；仍需自行设变量并重启 ASR）。
          </li>
          <li>
            开发调试时完整步骤见仓库内 <code>services/asr/README.md</code>；正式发版时一般会另附用户说明。
          </li>
        </ol>
      </details>

      <div className="p1-grid">
        <div className="p1-col">
          <h3 className="p1-sub">新建</h3>
          <label className="p1-label">
            项目名称
            <input
              className="p1-input"
              value={c.newName}
              onChange={(e) => c.setNewName(e.target.value)}
              disabled={c.busy}
            />
          </label>
          <div className="row-gap">
            <button type="button" className="secondary" disabled={c.busy} onClick={() => void c.pickAudio()}>
              选择音频…
            </button>
            <button type="button" className="primary" disabled={c.busy || !c.pickedPath} onClick={() => void c.createProject()}>
              创建项目
            </button>
          </div>
          {c.pickedPath ? (
            <p className="panel-hint">
              已选：<code>{c.pickedPath}</code>
            </p>
          ) : null}

          <h3 className="p1-sub">打开</h3>
          <div className="row-gap">
            <select
              className="p1-select"
              value=""
              disabled={c.busy}
              onChange={(e) => {
                const id = e.target.value;
                if (id) void c.loadProject(id);
                e.target.value = "";
              }}
            >
              <option value="">选择已有项目…</option>
              {c.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({new Date(p.updated_at_ms).toLocaleString()})
                </option>
              ))}
            </select>
            <button type="button" className="secondary" disabled={c.busy} onClick={() => void c.refreshProjects()}>
              刷新列表
            </button>
          </div>

          <h3 className="p1-sub">P2 本地术语库</h3>
          <p className="panel-hint">
            词条存 SQLite；点「从 ASR 拉取语段」时会<strong>一并提交</strong>为 `hotwords`（空格拼接）。FunASR
            可用时参与偏置；stub 时忽略并在 ASR 返回的 <code>warnings</code> 中含 <code>hotwords_ignored_stub</code>。
          </p>
          {gl.error ? <p className="panel-err">{gl.error}</p> : null}
          <div className="row-gap p1-glossary-add">
            <input
              className="p1-input"
              placeholder="输入术语…"
              value={gl.newTerm}
              onChange={(e) => gl.setNewTerm(e.target.value)}
              disabled={gl.busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") void gl.add();
              }}
            />
            <button type="button" className="secondary" disabled={gl.busy || !gl.newTerm.trim()} onClick={() => void gl.add()}>
              添加
            </button>
          </div>
          <ul className="p1-glossary-list">
            {gl.terms.map((t) => (
              <li key={t.id} className="p1-glossary-row">
                <span className="p1-glossary-term">{t.term}</span>
                <button type="button" className="secondary" disabled={gl.busy} onClick={() => void gl.remove(t.id)}>
                  删除
                </button>
              </li>
            ))}
          </ul>

          <h3 className="p1-sub">P4 诊断</h3>
          <p className="panel-hint">
            导出 zip：版本与平台信息；若本地库不超过 5MiB 则附带 <code>rushi.sqlite3</code>。详见{" "}
            <code>docs/execution/p4-stabilization.md</code>。
          </p>
          <div className="row-gap">
            <button type="button" className="secondary" disabled={c.busy} onClick={() => void c.exportDiagnosticBundle()}>
              导出诊断包（zip）
            </button>
          </div>
        </div>

        <div className="p1-col">
          <h3 className="p1-sub">当前项目</h3>
          {c.current ? (
            <>
              <p className="panel-meta">
                <strong>{c.current.name}</strong> · id <code className="p1-mono">{c.current.id.slice(0, 8)}…</code>
              </p>
              {c.audioSrc ? (
                <audio ref={audioRef} className="p1-audio" controls preload="metadata" />
              ) : (
                <p className="panel-warn">无法生成音频预览 URL（仅 Tauri 壳内可用）。</p>
              )}
              {c.segments.length === 0 ? (
                <p className="panel-warn p1-warn-inline">尚未有语段：请先点「从 ASR 拉取语段」做自动转写。</p>
              ) : null}

              <div className="row-gap p1-actions">
                <button type="button" className="primary" disabled={c.busy} onClick={() => void c.runTranscribe()}>
                  从 ASR 拉取语段
                </button>
                <button type="button" className="primary" disabled={c.busy} onClick={() => void c.saveSegments()}>
                  保存到 SQLite
                </button>
                <button type="button" className="secondary" disabled={c.busy} onClick={() => c.undo()}>
                  撤销一步
                </button>
                <button type="button" className="secondary" disabled={c.busy} onClick={() => void c.exportTxt()}>
                  导出 TXT
                </button>
                <button type="button" className="secondary" disabled={c.busy} onClick={() => void c.exportSrt()}>
                  导出 SRT
                </button>
                <button type="button" className="secondary" disabled={c.busy} onClick={() => void c.exportDocx("verbatim")}>
                  导出 DOCX（逐字稿）
                </button>
                <button type="button" className="secondary" disabled={c.busy} onClick={() => void c.exportDocx("lecture")}>
                  导出 DOCX（讲稿）
                </button>
                <button
                  type="button"
                  className="secondary danger"
                  disabled={c.busy}
                  onClick={() => {
                    const id = c.current?.id;
                    if (id) void c.deleteProject(id);
                  }}
                >
                  删除项目
                </button>
              </div>
              <div className="row-gap">
                <button type="button" className="secondary" disabled={c.busy} onClick={() => c.splitAtSelection()}>
                  拆分当前语段（中点）
                </button>
                <button type="button" className="secondary" disabled={c.busy || c.selectedIdx >= c.segments.length - 1} onClick={() => c.mergeWithNext()}>
                  与下一条合并
                </button>
              </div>

              {c.segments.length > 0 ? (
                <p className="panel-hint p1-seg-hint">
                  语段含 ASR 返回的置信度与「低置信」标记（P2）；可直接改时间与文本，修改后请点「保存到 SQLite」。
                </p>
              ) : null}

              <div className="seg-table-wrap p1-seg-wrap">
                <table className="seg-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>标记</th>
                      <th>开始 (s)</th>
                      <th>结束 (s)</th>
                      <th>文本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.segments.map((s, i) => (
                      <tr
                        key={`${s.idx}-${i}`}
                        className={[i === c.selectedIdx ? "p1-row-active" : "", s.low_confidence ? "p1-row-low" : ""]
                          .filter(Boolean)
                          .join(" ")}
                        title={s.detail ?? undefined}
                        onClick={() => seekToSegment(i)}
                      >
                        <td>{i + 1}</td>
                        <td className="p1-mark-cell">
                          {s.low_confidence ? <span className="p1-badge-low">低置信</span> : null}
                          {s.confidence != null && Number.isFinite(s.confidence) ? (
                            <span className="p1-conf-num">{s.confidence.toFixed(2)}</span>
                          ) : null}
                          {!s.low_confidence && (s.confidence == null || !Number.isFinite(s.confidence)) ? (
                            <span className="p1-mark-dash">—</span>
                          ) : null}
                        </td>
                        <td>
                          <input
                            className="p1-num"
                            type="number"
                            step={0.01}
                            value={s.start_sec}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => c.updateSegmentTime(i, "start_sec", Number(e.target.value))}
                          />
                        </td>
                        <td>
                          <input
                            className="p1-num"
                            type="number"
                            step={0.01}
                            value={s.end_sec}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => c.updateSegmentTime(i, "end_sec", Number(e.target.value))}
                          />
                        </td>
                        <td>
                          <textarea
                            className="p1-text"
                            rows={2}
                            value={s.text}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => c.updateSegmentText(i, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="panel-hint">创建或打开一个项目后开始校对。</p>
          )}
        </div>
      </div>
    </section>
  );
}
