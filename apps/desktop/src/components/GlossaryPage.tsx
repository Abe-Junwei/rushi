import { useCallback, useState } from "react";
import { BookOpen, RefreshCw, Trash2 } from "lucide-react";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import { useGlossaryController } from "../pages/useGlossaryController";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type GlossaryPageProps = {
  busy: boolean;
};

function formatTermDate(ms: number): string {
  return new Date(ms).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GlossaryPage({ busy }: GlossaryPageProps) {
  const g = useGlossaryController();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const disabled = busy || g.busy;

  const handleAdd = useCallback(() => {
    void g.add();
  }, [g]);

  const handleRemove = useCallback(
    (id: number) => {
      if (deleteConfirmId !== id) {
        setDeleteConfirmId(id);
        return;
      }
      setDeleteConfirmId(null);
      void g.remove(id);
    },
    [deleteConfirmId, g],
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-notion-bg px-10 py-8"
      data-purpose="glossary-page"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2 border-b border-notion-divider pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zen-saffron/15 text-zen-saffron">
              <BookOpen className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            </div>
            <div>
              <h1 className="m-0 text-[18px] font-semibold leading-[1.4] text-notion-text">术语库</h1>
              <p className={PANEL_TYPOGRAPHY.sectionDescription}>
                全局术语表，在本机 ASR 拉取语段时作为热词（hotwords）提交；在线 STT 按引擎能力使用。
              </p>
            </div>
          </div>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className={PANEL_TYPOGRAPHY.sectionTitle}>添加术语</h2>
          <div className="flex flex-wrap items-stretch gap-2">
            <input
              type="text"
              value={g.newTerm}
              onChange={(e) => g.setNewTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="输入专有名词、人名、术语…"
              disabled={disabled}
              className={`min-h-[44px] min-w-[12rem] flex-1 rounded-lg border border-notion-border bg-notion-bg px-3 py-2 outline-none transition-colors focus:border-zen-saffron focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-50 ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
              aria-label="新术语"
            />
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-0 bg-zen-saffron px-5 text-sm font-semibold text-notion-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={disabled || !g.newTerm.trim()}
              onClick={handleAdd}
            >
              添加
            </button>
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-notion-border bg-notion-bg px-3 text-sm font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
              disabled={disabled}
              onClick={() => void g.refresh()}
              aria-label="刷新术语列表"
            >
              <RefreshCw className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              刷新
            </button>
          </div>
          {g.error ? (
            <p className="rounded-md border border-zen-cinnabar/25 bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar">
              {g.error}
            </p>
          ) : null}
        </section>

        <section className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className={PANEL_TYPOGRAPHY.sectionTitle}>已收录术语</h2>
            <span className={PANEL_TYPOGRAPHY.meta}>{g.terms.length} 条</span>
          </div>

          {g.terms.length === 0 ? (
            <p className="rounded-xl border border-dashed border-notion-divider bg-notion-bg/80 px-4 py-10 text-center text-sm text-notion-text-muted">
              暂无术语。添加后，下次对项目执行「从 ASR 拉取语段」时会自动带上热词。
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {g.terms.map((row) => {
                const confirming = deleteConfirmId === row.id;
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-notion-divider bg-notion-bg px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-sm font-medium text-notion-text">{row.term}</p>
                      <p className={`m-0 mt-0.5 ${PANEL_TYPOGRAPHY.meta}`}>添加于 {formatTermDate(row.created_at_ms)}</p>
                    </div>
                    <button
                      type="button"
                      className={[
                        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        confirming
                          ? "border-zen-cinnabar bg-zen-cinnabar/10 text-zen-cinnabar"
                          : "border-notion-border bg-notion-bg text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text",
                      ].join(" ")}
                      disabled={disabled}
                      onClick={() => handleRemove(row.id)}
                      aria-label={confirming ? "确认删除术语" : "删除术语"}
                    >
                      <Trash2 className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                      {confirming ? "确认删除" : "删除"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className={PANEL_TYPOGRAPHY.helper}>
          术语按字母序存储，重复项（忽略大小写）无法添加。修改术语后无需保存项目，转写请求会读取最新列表。
        </p>
      </div>
    </div>
  );
}
