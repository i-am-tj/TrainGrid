/**
 * Scans the repository for credentials (story 19, 23; check S2).
 *
 *   npm run scan:secrets              tracked and untracked-but-not-ignored files
 *   npm run scan:secrets -- --history every line ever added, in every commit, on every branch
 *
 * Exits 1 if anything is found. Matches are printed redacted, never in full.
 * Patterns cover the credentials this project could plausibly leak; it is a
 * guard rail, not a replacement for GitHub secret scanning.
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";

type Rule = { name: string; pattern: RegExp; allow?: (match: string) => boolean };

const RULES: Rule[] = [
  { name: "Supabase secret key", pattern: /sb_secret_[A-Za-z0-9_-]{16,}/g },
  {
    name: "Supabase publishable key",
    // Public by design, but production values belong in Vercel, not Git.
    pattern: /sb_publishable_[A-Za-z0-9_-]{16,}/g,
  },
  { name: "JSON Web Token", pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: "Private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "GitHub token", pattern: /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  { name: "Google OAuth client secret", pattern: /GOCSPX-[A-Za-z0-9_-]{16,}/g },
  { name: "Google API key", pattern: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    name: "Database URL with password",
    pattern: /postgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@[^\s"'`]+/g,
    // The local Supabase stack's fixed development credentials.
    allow: (match) => /^postgres(?:ql)?:\/\/postgres:postgres@(127\.0\.0\.1|localhost)[:/]/.test(match),
  },
  {
    name: "Secret assigned in an env file",
    pattern: /^\+?\s*(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD)\s*=\s*\S{8,}/gm,
  },
];

const SELF = "scripts/scan-secrets.ts";

function redact(value: string): string {
  return `${value.slice(0, 10)}…(${value.length} chars)`;
}

function scanText(text: string, where: string, findings: string[]) {
  for (const rule of RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      if (rule.allow?.(match[0])) continue;
      findings.push(`${rule.name}: ${redact(match[0])} in ${where}`);
    }
  }
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
}

const findings: string[] = [];

if (process.argv.includes("--history")) {
  // Every added line of every commit on every branch, with its commit and file.
  const log = git(["log", "--all", "-p", "--no-color", "--format=commit %H", "--unified=0"]);
  let commit = "";
  let file = "";
  for (const line of log.split("\n")) {
    if (line.startsWith("commit ")) commit = line.slice(7, 19);
    else if (line.startsWith("+++ b/")) file = line.slice(6);
    else if (line.startsWith("+") && !line.startsWith("+++") && file !== SELF) {
      scanText(line, `${commit} ${file}`, findings);
    }
  }
  const commits = git(["rev-list", "--all", "--count"]).trim();
  console.log(`Scanned the history: ${commits} commits on all branches.`);
} else {
  const files = git(["ls-files", "--cached", "--others", "--exclude-standard"])
    .split("\n")
    .filter((file) => file && file !== SELF && !file.startsWith("node_modules/"));
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    scanText(text, file, findings);
  }
  console.log(`Scanned ${files.length} files (tracked, or untracked and not ignored).`);
}

if (findings.length > 0) {
  console.error(`Possible credentials found (${findings.length}):`);
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}
console.log("No credentials found.");
