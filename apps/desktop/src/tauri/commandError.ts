export type CommandErrorDto = {
  code: string;
  message: string;
};

/** Parse Tauri invoke errors (structured DTO or legacy string). */
export function parseTauriCommandError(error: unknown): CommandErrorDto {
  if (typeof error === "string") {
    const trimmed = error.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        return parseTauriCommandError(parsed);
      } catch {
        return { code: "unknown", message: error };
      }
    }
    return { code: "unknown", message: error };
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") {
      return {
        code: typeof record.code === "string" ? record.code : "unknown",
        message: record.message,
      };
    }
  }
  return { code: "unknown", message: String(error) };
}

export function tauriCommandErrorMessage(error: unknown): string {
  return parseTauriCommandError(error).message;
}

export function isTauriCommandErrorCode(error: unknown, code: string): boolean {
  return parseTauriCommandError(error).code === code;
}
