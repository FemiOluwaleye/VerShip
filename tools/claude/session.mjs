#!/usr/bin/env node
// Claude session catch-up + rolling session log for this Replit workspace.
//
//   node tools/claude/session.mjs show            -> print catch-up (shown at every `claude` launch)
//   node tools/claude/session.mjs record "<line>" -> prepend a session summary, keep newest 5
//
// "show" prints highlights from the last 3 sessions read straight from Claude's
// live transcripts, then summaries of older sessions from CODEX_SessionLog.md.
// Transcripts live under $CLAUDE_CONFIG_DIR/projects/<slug>/*.jsonl.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.env.REPL_HOME || path.join(os.homedir(), "workspace");
const CFG = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const PROJECT_SLUG = "-home-runner-workspace";
const PROJ_DIR = path.join(CFG, "projects", PROJECT_SLUG);
const SESSION_LOG = path.join(ROOT, "CODEX_SessionLog.md");
const STATUS_FILE = path.join(ROOT, "CLAUDE_SessionStatus.md");
const KEEP = 5; // rolling window
const SHOW_RAW = 3; // sessions shown from live transcripts

function listTranscripts() {
  try {
    return fs
      .readdirSync(PROJ_DIR)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => {
        const p = path.join(PROJ_DIR, f);
        return { f, p, m: fs.statSync(p).mtimeMs };
      })
      .sort((a, b) => b.m - a.m);
  } catch {
    return [];
  }
}

function textFromContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join(" ");
  }
  return "";
}

function highlightsFor(file) {
  let firstUser = "";
  let lastAssistant = "";
  let turns = 0;
  let lines;
  try {
    lines = fs.readFileSync(file, "utf8").split("\n");
  } catch {
    return null;
  }
  for (const line of lines) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const role = o.type || o.role || (o.message && o.message.role);
    const content = (o.message && o.message.content) ?? o.content;
    const text = textFromContent(content).replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (role === "user") {
      if (!firstUser) firstUser = text;
      turns++;
    } else if (role === "assistant") {
      lastAssistant = text;
      turns++;
    }
  }
  return { firstUser, lastAssistant, turns };
}

function clip(s, n = 180) {
  s = (s || "").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function readStatusHeadline() {
  try {
    const body = fs.readFileSync(STATUS_FILE, "utf8");
    const m = body.match(/^-\s*\*\*Last task:\*\*\s*(.+)$/m);
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}

function olderSummaries() {
  try {
    const body = fs.readFileSync(SESSION_LOG, "utf8");
    return body
      .split(/^## /m)
      .slice(1)
      .map((e) => e.split("\n")[0].trim());
  } catch {
    return [];
  }
}

function show() {
  const t = listTranscripts();
  const out = [];
  const bar = "─".repeat(60);
  out.push("");
  out.push(bar);
  out.push("  \u{1F4D3} Claude session catch-up · " + ROOT);
  out.push(bar);

  const headline = readStatusHeadline();
  if (headline) out.push("  Last task: " + clip(headline, 150));

  if (t.length === 0) {
    out.push("  (no previous session transcripts found yet)");
  } else {
    out.push(
      `  Recent sessions (${Math.min(SHOW_RAW, t.length)} of ${t.length} from live transcripts):`,
    );
    t.slice(0, SHOW_RAW).forEach((s, i) => {
      const h = highlightsFor(s.p) || {};
      const id = s.f.replace(".jsonl", "").slice(0, 8);
      out.push("");
      out.push(`  ${i + 1}. session ${id}  (${h.turns || 0} turns)`);
      if (h.firstUser) out.push("     ▸ started: " + clip(h.firstUser));
      if (h.lastAssistant) out.push("     ▸ last:    " + clip(h.lastAssistant));
    });
  }

  const older = olderSummaries().slice(SHOW_RAW, KEEP);
  if (older.length) {
    out.push("");
    out.push("  Earlier sessions (summarized — CODEX_SessionLog.md):");
    older.forEach((e) => out.push("     • " + clip(e, 120)));
  }

  out.push("");
  out.push("  Status: CLAUDE_SessionStatus.md · Build list: CODEX_BuildLog.md");
  out.push(bar);
  out.push("");
  process.stdout.write(out.join("\n"));
}

function record(summary) {
  summary = (summary || "").trim() || "(no summary provided)";
  const when = new Date().toISOString();
  let existing = "";
  try {
    existing = fs.readFileSync(SESSION_LOG, "utf8");
  } catch {
    // fresh file
  }
  const header =
    "# CODEX Session Log\n\n" +
    `Rolling record of recent Claude sessions (most recent first, newest ${KEEP} kept).\n` +
    "Older sessions are pruned; their gist survives in CODEX_ChangeLog.md / CODEX_BuildLog.md.\n\n";
  const body = existing.replace(/^# CODEX Session Log[\s\S]*?\n\n(?=## |$)/, "");
  const entries = body
    .split(/^## /m)
    .map((s) => s.trim())
    .filter(Boolean);
  const newEntry = `${when}\n\n${summary}`;
  const all = [newEntry, ...entries].slice(0, KEEP);
  const rebuilt = header + all.map((e) => "## " + e + "\n").join("\n") + "\n";
  fs.writeFileSync(SESSION_LOG, rebuilt);
  process.stdout.write("Recorded session summary to CODEX_SessionLog.md (keeping newest " + KEEP + ").\n");
}

const cmd = process.argv[2] || "show";
if (cmd === "show") show();
else if (cmd === "record") record(process.argv.slice(3).join(" "));
else {
  process.stderr.write("usage: session.mjs [show | record <summary>]\n");
  process.exit(1);
}
