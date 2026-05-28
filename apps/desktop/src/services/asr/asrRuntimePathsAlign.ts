/** Normalize paths for comparing desktop cache dir vs sidecar /health.rushi_models_root. */

export function normalizePathForCompare(path: string): string {
  return path.trim().replace(/\/+$/, "");
}

export function modelsRootMismatch(
  desktopModelsRoot: string | null | undefined,
  sidecarModelsRoot: string | null | undefined,
): boolean {
  const a = desktopModelsRoot ? normalizePathForCompare(desktopModelsRoot) : "";
  const b = sidecarModelsRoot ? normalizePathForCompare(sidecarModelsRoot) : "";
  if (!a || !b) return Boolean(a && !b);
  return a !== b;
}
