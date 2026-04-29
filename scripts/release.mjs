import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

function run(cmd, args, options = {}) {
  const result = execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
  return typeof result === "string" ? result.trim() : "";
}

function getLastTag() {
  try {
    return run("git", ["describe", "--tags", "--abbrev=0"]);
  } catch {
    return null;
  }
}

function getCommitSubjects(fromRef) {
  const range = fromRef ? `${fromRef}..HEAD` : "HEAD";
  const output = run("git", ["log", range, "--pretty=format:%s"]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("Merge "));
}

function formatNotes(version, lastTag, commits) {
  const lines = [
    `# ${version}`,
    "",
    `## Changes${lastTag ? ` since ${lastTag}` : ""}`,
    "",
  ];

  if (!commits.length) {
    lines.push("- No commit messages found.");
  } else {
    for (const subject of commits) lines.push(`- ${subject}`);
  }

  lines.push("", "## Install", "", "Download the distribution zip from the release assets and load the unpacked `dist/` folder in Chrome.");
  return lines.join("\n");
}

async function main() {
  const version = process.argv[2];
  if (!version) {
    console.error("Usage: node scripts/release.mjs <version>");
    process.exit(1);
  }

  const lastTag = getLastTag();
  const commits = getCommitSubjects(lastTag);
  const notes = formatNotes(version, lastTag, commits);

  await writeFile("RELEASE_NOTES.md", notes + "\n", "utf8");
  console.log(notes);
  console.log("\nWrote RELEASE_NOTES.md");

  run("git", ["tag", "-a", version, "-F", "RELEASE_NOTES.md"], { stdio: "inherit" });
  console.log(`\nCreated tag ${version}`);
  console.log(`\nPush command:\n  git push origin ${version}`);
}

await main();
