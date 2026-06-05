import { describe, expect, it } from "vitest";
import {
  formatLearningCorrectionHintLabel,
  listLearningCorrectionHintsForSegments,
} from "./learningCorrectionRuleHints";

describe("learningCorrectionRuleHints", () => {
  it("lists hit=1 learning pairs matching segment text", () => {
    const hints = listLearningCorrectionHintsForSegments(
      [
        {
          wrong: "智控",
          right: "制控",
          hitCount: 1,
          acceptedAsRule: false,
          updatedAtMs: 0,
          isStable: false,
        },
      ],
      [],
      [{ text: "这是智控系统" }],
    );
    expect(hints).toEqual([{ beforeText: "智控", afterText: "制控", hitCount: 1 }]);
    expect(formatLearningCorrectionHintLabel(hints[0]!)).toContain("学习中 1/3");
  });

  it("skips stable pairs and segments without wrong form", () => {
    const hints = listLearningCorrectionHintsForSegments(
      [
        {
          wrong: "智控",
          right: "制控",
          hitCount: 1,
          acceptedAsRule: false,
          updatedAtMs: 0,
          isStable: false,
        },
      ],
      [{ wrong: "智控", right: "制控" }],
      [{ text: "已是制控" }],
    );
    expect(hints).toEqual([]);
  });
});
