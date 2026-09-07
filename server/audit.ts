import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./data-dir";

export interface AuditEntry {
  id: number;
  timestamp: string;
  actor: "host" | "teacher" | "student" | "system" | "anonymous";
  action: string;
  target?: string;
  details?: string;
}

const AUDIT_FILE = join(DATA_DIR, "audit-log.json");
const MAX_ENTRIES = 5000;
let nextId = 1;
let entries: AuditEntry[] = [];

function load(): void {
  try {
    if (!existsSync(AUDIT_FILE)) return;
    const saved = JSON.parse(readFileSync(AUDIT_FILE, "utf8"));
    if (!Array.isArray(saved)) return;
    entries = saved.filter((entry) => entry && typeof entry.timestamp === "string").slice(-MAX_ENTRIES);
    nextId = entries.reduce((max, entry) => Math.max(max, Number(entry.id) || 0), 0) + 1;
  } catch {
    entries = [];
  }
}

function persist(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(AUDIT_FILE, JSON.stringify(entries, null, 2), "utf8");
}

load();

export function recordAudit(entry: Omit<AuditEntry, "id" | "timestamp">): void {
  entries.push({ ...entry, id: nextId++, timestamp: new Date().toISOString() });
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
  persist();
}

export function getAuditEntries(limit = 200): AuditEntry[] {
  return entries.slice(-Math.min(Math.max(limit, 1), 500)).reverse();
}