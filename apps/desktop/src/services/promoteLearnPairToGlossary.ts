import { glossaryAdd } from "../tauri/glossaryApi";
import { notifyGlossaryDataChanged } from "./glossaryRefresh";

export type PromoteToGlossaryResult = {
  added: string[];
  alreadyInGlossary: string[];
  failed: string[];
};

/** F6+：将纳入记忆的 after 正形写入术语表（仅 term，禁止 before 作 alias）。 */
export async function promoteAfterTextsToGlossary(afterTexts: string[]): Promise<PromoteToGlossaryResult> {
  const unique = [...new Set(afterTexts.map((t) => t.trim()).filter((t) => t.length > 0))];
  const result: PromoteToGlossaryResult = { added: [], alreadyInGlossary: [], failed: [] };
  if (!unique.length) return result;

  for (const term of unique) {
    try {
      await glossaryAdd({
        term,
        aliases: "",
        domain: "",
        note: "纳入记忆时加入转写词汇表",
        hotwordEnabled: true,
      });
      result.added.push(term);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("已存在")) {
        result.alreadyInGlossary.push(term);
      } else {
        result.failed.push(term);
      }
    }
  }

  if (result.added.length > 0) {
    notifyGlossaryDataChanged();
  }
  return result;
}

export function formatPromoteToGlossaryToast(result: PromoteToGlossaryResult): string | null {
  if (result.added.length === 1) {
    return `已将「${result.added[0]}」加入转写词汇表`;
  }
  if (result.added.length > 1) {
    return `已将 ${result.added.length} 个词条加入转写词汇表`;
  }
  if (result.alreadyInGlossary.length === 1 && !result.failed.length) {
    return `「${result.alreadyInGlossary[0]}」已在转写词汇表中`;
  }
  if (result.alreadyInGlossary.length > 0 && !result.added.length && !result.failed.length) {
    return "所选词条已在转写词汇表中";
  }
  if (result.failed.length) {
    return "部分词条未能加入转写词汇表，请稍后在术语库重试";
  }
  return null;
}
