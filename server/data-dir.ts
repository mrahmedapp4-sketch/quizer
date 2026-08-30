import { accessSync, constants, existsSync } from "node:fs";
import { join } from "node:path";

// A mounted /appdata volume is the durable location in deployment. During
// local development, keep using the repository's data directory.
export function getDataDir(): string {
  const configured = process.env.APP_DATA_DIR?.trim();
  if (configured) return configured;

  try {
    if (existsSync("/appdata")) {
      accessSync("/appdata", constants.W_OK);
      return "/appdata";
    }
  } catch {
    // Fall through to the local project directory.
  }

  return join(process.cwd(), "data");
}

export const DATA_DIR = getDataDir();