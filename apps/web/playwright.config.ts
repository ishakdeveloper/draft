import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Test credentials live in the repo-root .env locally and in CI secrets on GitHub.
function loadRootEnv(): void {
  try {
    const text = readFileSync(path.resolve(import.meta.dirname, "../../.env"), "utf8");
    for (const line of text.split("\n")) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2];
    }
  } catch {
    // No local .env (CI): the environment already has what it needs.
  }
}
loadRootEnv();

const PORT = 3200;

export default defineConfig({
  testDir: "__tests__/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bun run build && bun run start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
