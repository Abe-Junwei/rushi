function createZhPinyinCollator(): Intl.Collator {
  try {
    return new Intl.Collator("zh-Hans-CN-u-co-pinyin", { numeric: true });
  } catch {
    return new Intl.Collator("zh-Hans-CN", { numeric: true });
  }
}

const zhPinyinCollator = createZhPinyinCollator();

/** 中文按拼音序比较（用于列表排序）。 */
export function compareZhPinyin(a: string, b: string): number {
  return zhPinyinCollator.compare(a, b);
}
