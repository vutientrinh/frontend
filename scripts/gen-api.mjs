import { spawnSync } from "node:child_process";
const url = process.env.OPENAPI_URL || "http://localhost:8081/v3/api-docs";
const result = spawnSync(
  process.execPath,
  [
    "node_modules/openapi-typescript/bin/cli.js",
    url,
    "-o",
    "src/api/schema.d.ts",
  ],
  { stdio: "inherit" },
);
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
