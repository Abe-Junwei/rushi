import type { SegmentDto } from "../tauri/projectApi";

/** 新建语段时分配稳定 id（波形 region / 持久化 upsert 共用）。 */
export function createSegmentUid(): string {
  return crypto.randomUUID();
}

export function segmentUidOf(seg: SegmentDto): string | null {
  const uid = seg.uid?.trim();
  return uid && uid.length > 0 ? uid : null;
}

function hasSegmentUid(seg: SegmentDto): boolean {
  return typeof seg.uid === "string" && seg.uid.trim().length > 0;
}

/** 为历史语段补 uid；仅在缺失时克隆数组。 */
export function ensureSegmentUids(segs: SegmentDto[]): SegmentDto[] {
  let changed = false;
  const out = segs.map((s) => {
    if (hasSegmentUid(s)) return s;
    changed = true;
    return { ...s, uid: createSegmentUid() };
  });
  return changed ? out : segs;
}

/** 重复 uid 会导致 React key / 草稿 store 串行，按出现顺序为后者换新 uid。 */
export function ensureUniqueSegmentUids(segs: SegmentDto[]): SegmentDto[] {
  const seen = new Set<string>();
  let changed = false;
  const out = segs.map((s) => {
    const uid = segmentUidOf(s);
    if (!uid) return s;
    if (!seen.has(uid)) {
      seen.add(uid);
      return s;
    }
    changed = true;
    return { ...s, uid: createSegmentUid() };
  });
  return changed ? out : segs;
}

/** 语段集合身份签名：仅 uid 集合变化时触发 region 增删。 */
export function segmentsUidSignature(segments: Pick<SegmentDto, "uid">[]): string {
  return segments
    .map((s) => s.uid?.trim() ?? "")
    .filter((uid) => uid.length > 0)
    .sort()
    .join("|");
}
