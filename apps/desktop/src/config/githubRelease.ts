import githubRelease from "../../../../resources/github-release.json";

export const RUSHI_GITHUB_OWNER = githubRelease.owner;
export const RUSHI_GITHUB_REPO = githubRelease.repo;
export const RUSHI_GITHUB_REPOSITORY = `${RUSHI_GITHUB_OWNER}/${RUSHI_GITHUB_REPO}`;

export function normalizeReleaseVersion(version: string): string {
  return version.trim().replace(/^v/, "");
}

/** GitHub Release asset download URL: `/releases/download/v{version}/{asset}`. */
export function rushiReleaseAssetDownloadUrl(version: string, assetName: string): string {
  const v = normalizeReleaseVersion(version);
  return `https://github.com/${RUSHI_GITHUB_REPOSITORY}/releases/download/v${v}/${assetName}`;
}
