export const REGION_ID_PREFIX = "rushi-seg-";

export function segmentRegionId(uid: string): string {
  return `${REGION_ID_PREFIX}${uid}`;
}

/** 从 region id 解析稳定语段 uid。 */
export function parseSegmentRegionUid(id: string): string | null {
  if (!id.startsWith(REGION_ID_PREFIX)) return null;
  const uid = id.slice(REGION_ID_PREFIX.length);
  return uid.length > 0 ? uid : null;
}
