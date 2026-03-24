// Fixes malformatted bodies on all open broken-url issues.
// Usage: node fix-issue-bodies.js

const fs = require("fs");
const { execSync } = require("child_process");

const SCHOOLS = require("./schools.json");
const REPO = "chrissabato/college-athletics-directory";

const schoolByName = new Map(SCHOOLS.map(s => [s.name, s]));

function buildBody(school, errorStatus) {
  return [
    `**School:** ${school.name}`,
    `**Association:** ${school.association}`,
    `**Conference:** ${school.conference}`,
    `**Location:** ${[school.city, school.state].filter(Boolean).join(", ")}`,
    `**Current URL:** ${school.url}`,
    `**Error:** ${errorStatus}`,
  ].join("\n");
}

function main() {
  console.log("Fetching open broken-url issues…");

  const raw = execSync(
    `gh issue list --repo ${REPO} --label broken-url --state open --limit 500 --json number,title,body`,
    { encoding: "utf8" }
  );
  const issues = JSON.parse(raw);
  console.log(`Found ${issues.length} issues.\n`);

  let updated = 0;
  let skipped = 0;

  for (const issue of issues) {
    const schoolName = issue.title.replace(/^Broken URL:\s*/, "").trim();
    const school = schoolByName.get(schoolName);

    if (!school) {
      console.log(`  SKIP (school not found): ${issue.title}`);
      skipped++;
      continue;
    }

    // Extract error status from existing body (handles both \n literals and real newlines)
    const errorMatch = issue.body.match(/\*\*Error:\*\*\s*(.+?)(?:\\n|$|\n)/);
    const errorStatus = errorMatch ? errorMatch[1].trim() : "unknown";

    const newBody = buildBody(school, errorStatus);
    const tmpFile = `/tmp/gh-fix-body-${Date.now()}.md`;
    fs.writeFileSync(tmpFile, newBody);

    execSync(
      `gh issue edit ${issue.number} --repo ${REPO} --body-file "${tmpFile}"`,
      { encoding: "utf8" }
    );
    fs.unlinkSync(tmpFile);

    console.log(`  Updated #${issue.number}: ${schoolName}`);
    updated++;
  }

  console.log(`\nDone. ${updated} updated, ${skipped} skipped.`);
}

main();
