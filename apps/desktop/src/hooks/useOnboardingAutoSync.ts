import { useEffect } from "react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { hasRecordedProjectMetadata } from "../services/deliveryModeChecklist";
import {
  syncOnboardingAsrReady,
  syncOnboardingMetadata,
  syncOnboardingProjectAudio,
} from "../services/onboarding/onboardingAutoSync";

type Args = {
  controller: ProjectControllerApi;
  asrChipOk: boolean;
};

/** O-2：能力态自动勾选 onboarding 步骤（非 blocking）。 */
export function useOnboardingAutoSync({ controller: c, asrChipOk }: Args) {
  useEffect(() => {
    syncOnboardingAsrReady(asrChipOk);
  }, [asrChipOk]);

  useEffect(() => {
    const hasAudio = Boolean(c.current?.id && c.currentFileId && c.audioSrc);
    if (hasAudio) syncOnboardingProjectAudio(true);
  }, [c.current?.id, c.currentFileId, c.audioSrc]);

  useEffect(() => {
    const meta = hasRecordedProjectMetadata({
      narrator: c.current?.narrator,
      recorded_at: c.current?.recorded_at,
      location: c.current?.location,
      subject: c.current?.subject,
      transcriber: c.current?.transcriber,
    });
    if (meta) syncOnboardingMetadata(true);
  }, [
    c.current?.narrator,
    c.current?.recorded_at,
    c.current?.location,
    c.current?.subject,
    c.current?.transcriber,
  ]);
}
