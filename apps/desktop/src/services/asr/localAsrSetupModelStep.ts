import * as projectApi from "../../tauri/projectApi";
import { fetchAsrHealthCaps } from "./asrHealthSnapshot";
import {
  catalogEntryForHub,
  computeLocalAsrTranscribeReady,
  resolvePreferredLocalAsrHubModelId,
} from "./localAsrModelCatalog";

export type SelectedModelPrepareSnapshot = {
  hub: string;
  modelLabel: string;
  ready: boolean;
  sidecarMatchesSelection: boolean;
};

/** Read pref + /health caps; D1=D2 aligned transcribe readiness for setup flows. */
export async function snapshotSelectedModelPrepare(): Promise<SelectedModelPrepareSnapshot> {
  const hub = await resolvePreferredLocalAsrHubModelId();
  const caps = await fetchAsrHealthCaps();
  const modelLabel = catalogEntryForHub(hub)?.label ?? "当前所选模型";
  const { ready, sidecarMatchesSelection } = computeLocalAsrTranscribeReady({
    asrHealth: caps ? "ok" : "error",
    asrCaps: caps,
    selectedHubModelId: hub,
  });
  return { hub, modelLabel, ready, sidecarMatchesSelection };
}

/** Apply stored hub pref and force-restart bundled sidecar (no-op when pref unchanged). */
export async function syncBundledSidecarToPreferredHub(): Promise<void> {
  const hub = await resolvePreferredLocalAsrHubModelId();
  await projectApi.setLocalAsrHubModelPref(hub);
}
