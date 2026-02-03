#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

function getOriginalArgs() {
  const raw = process.env.npm_config_argv;
  if (!raw) {
    return process.argv.slice(2);
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.original)) {
      return parsed.original.slice(1);
    }
  } catch {
    // Fall back to direct argv when npm_config_argv is malformed.
  }
  return process.argv.slice(2);
}

const originalArgs = getOriginalArgs();
const wantsCoverage =
  originalArgs.includes("coverage") || originalArgs.includes("--coverage");
const dashIndex = originalArgs.indexOf("--");
const extraArgs = dashIndex >= 0 ? originalArgs.slice(dashIndex + 1) : [];
const filteredExtraArgs = wantsCoverage
  ? extraArgs.filter((arg) => arg !== "--coverage")
  : extraArgs;

const script = wantsCoverage ? "test:coverage" : "test";
const npmArgs = ["run", script, "-w", "apps/server"];
if (filteredExtraArgs.length > 0) {
  npmArgs.push("--", ...filteredExtraArgs);
}

const result = spawnSync("npm", npmArgs, { stdio: "inherit" });
process.exit(typeof result.status === "number" ? result.status : 1);
