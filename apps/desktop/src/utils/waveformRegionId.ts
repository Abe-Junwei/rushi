export const REGION_ID_PREFIX = "rushi-seg-";

export function segmentRegionId(index: number): string {
  return `${REGION_ID_PREFIX}${index}`;
}

export function parseSegmentRegionId(id: string): number | null {
  if (!id.startsWith(REGION_ID_PREFIX)) return null;
  const n = Number(id.slice(REGION_ID_PREFIX.length));
  return Number.isInteger(n) && n >= 0 ? n : null;
}
