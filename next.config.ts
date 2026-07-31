import type { NextConfig } from "next";

const isSiteBuild = process.env.DART_ROOM_BUILD_TARGET === "site";
const siteBasePath = "/project-apps/dart-room";
const sharePath = "/projects/dart-room/play";

const nextConfig: NextConfig = {
  ...(isSiteBuild
    ? {
        basePath: siteBasePath,
        images: { unoptimized: true },
        output: "export" as const,
      }
    : {}),
  env: {
    NEXT_PUBLIC_DART_ROOM_SHARE_PATH: isSiteBuild ? sharePath : "",
  },
};

export default nextConfig;
