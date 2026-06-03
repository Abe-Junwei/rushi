/** Reject remote or traversal plugin entry URLs before dynamic import. */
export function validatePluginEntry(entry: string, pluginId: string): void {
  const trimmed = entry.trim();
  if (!trimmed) {
    throw new Error(`Plugin ${pluginId}: entry URL is empty`);
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("//")) {
    throw new Error(`Plugin ${pluginId}: remote entry URLs are not permitted`);
  }
  if (trimmed.startsWith("data:")) {
    if (!trimmed.startsWith("data:text/javascript")) {
      throw new Error(`Plugin ${pluginId}: only data:text/javascript entries are allowed`);
    }
    return;
  }
  if (trimmed.includes("..")) {
    throw new Error(`Plugin ${pluginId}: entry path must not contain ..`);
  }
}
