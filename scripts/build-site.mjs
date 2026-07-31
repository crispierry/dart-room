import { spawnSync } from "node:child_process";

const nextExecutable = process.platform === "win32" ? "next.cmd" : "next";
const result = spawnSync(nextExecutable, ["build"], {
  env: {
    ...process.env,
    DART_ROOM_BUILD_TARGET: "site",
  },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
