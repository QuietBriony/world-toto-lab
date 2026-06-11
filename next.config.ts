import type { NextConfig } from "next";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const shouldUseBasePath =
  process.env.GITHUB_ACTIONS === "true" &&
  repositoryName &&
  !repositoryName.endsWith(".github.io");
const basePath = shouldUseBasePath ? `/${repositoryName}` : "";
const deploymentId =
  process.env.NEXT_DEPLOYMENT_ID ??
  process.env.CF_PAGES_COMMIT_SHA?.slice(0, 12) ??
  process.env.GITHUB_SHA?.slice(0, 12);

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  deploymentId: deploymentId || undefined,
  images: {
    unoptimized: true,
  },
  basePath,
  assetPrefix: basePath || undefined,
};

export default nextConfig;
