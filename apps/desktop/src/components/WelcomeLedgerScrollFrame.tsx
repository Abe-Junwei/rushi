import { useEffect, useRef, useState, type ReactNode } from "react";

/** 列表可滚时在上下缘显示渐变；贴顶/贴底时隐藏对应一侧。 */
export function ledgerScrollEdgeFade(el: HTMLElement): { top: boolean; bottom: boolean } {
  const maxScroll = el.scrollHeight - el.clientHeight;
  if (maxScroll <= 1) return { top: false, bottom: false };
  return {
    top: el.scrollTop > 1,
    bottom: el.scrollTop < maxScroll - 1,
  };
}

type Props = {
  children: ReactNode;
  /** 内容变化时重算渐变（条数 / 展开态等） */
  contentKey?: string | number | boolean;
  purpose?: string;
};

/** 欢迎页 ledger 单页滚动壳：overflow + 上下边缘渐变。 */
export function WelcomeLedgerScrollFrame({ children, contentKey, purpose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edgeFade, setEdgeFade] = useState({ top: false, bottom: false });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sync = () => setEdgeFade(ledgerScrollEdgeFade(el));
    sync();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [contentKey]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className="welcome-ledger-scroll min-h-0 flex-1"
        data-purpose={purpose}
        onScroll={(e) => setEdgeFade(ledgerScrollEdgeFade(e.currentTarget))}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={[
          "welcome-ledger-fade welcome-ledger-fade-top",
          edgeFade.top ? "is-visible" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <div
        aria-hidden
        className={[
          "welcome-ledger-fade welcome-ledger-fade-bottom",
          edgeFade.bottom ? "is-visible" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
    </div>
  );
}
