// Checks all school URLs and creates a GitHub issue for each broken one.
// Usage: node check-urls.js

const https = require("https");
const http = require("http");
const fs = require("fs");
const { execSync } = require("child_process");

const SCHOOLS = require("./schools.json");
const CONCURRENCY = 20;
const TIMEOUT_MS = 10000;
const REPO = "chrissabato/college-athletics-directory";

function checkUrl(url) {
  return new Promise(resolve => {
    if (!url) return resolve({ ok: false, status: "no URL" });

    const lib = url.startsWith("https") ? https : http;
    let resolved = false;

    const done = (ok, status) => {
      if (!resolved) {
        resolved = true;
        resolve({ ok, status: String(status) });
      }
    };

    try {
      const req = lib.request(url, { method: "HEAD", timeout: TIMEOUT_MS }, res => {
        const s = res.statusCode;
        // Follow one level of redirect for reporting purposes
        done(s >= 200 && s < 400, s);
      });
      req.on("timeout", () => { req.destroy(); done(false, "timeout"); });
      req.on("error", e => done(false, e.code || e.message));
      req.end();
    } catch (e) {
      done(false, e.message);
    }
  });
}

async function runBatch(batch) {
  return Promise.all(batch.map(async school => {
    const result = await checkUrl(school.url);
    return { school, ...result };
  }));
}

async function main() {
  console.log(`Checking ${SCHOOLS.length} URLs (${CONCURRENCY} at a time)…\n`);

  const broken = [];
  let checked = 0;

  for (let i = 0; i < SCHOOLS.length; i += CONCURRENCY) {
    const batch = SCHOOLS.slice(i, i + CONCURRENCY);
    const results = await runBatch(batch);
    checked += batch.length;

    for (const r of results) {
      if (!r.ok) {
        broken.push(r);
        process.stdout.write(`✗ [${r.status}] ${r.school.name} — ${r.school.url}\n`);
      }
    }

    process.stdout.write(`\rProgress: ${checked}/${SCHOOLS.length}  `);
  }

  console.log(`\n\nDone. ${broken.length} broken URLs found.\n`);

  if (broken.length === 0) return;

  console.log("Creating GitHub issues…");

  // Check for existing open issues to avoid duplicates
  const existing = execSync(
    `gh issue list --repo ${REPO} --label broken-url --state open --limit 500 --json title`,
    { encoding: "utf8" }
  );
  const existingTitles = new Set(JSON.parse(existing).map(i => i.title));

  let created = 0;
  for (const r of broken) {
    const title = `Broken URL: ${r.school.name}`;
    if (existingTitles.has(title)) {
      console.log(`  Skipping (already open): ${title}`);
      continue;
    }

    const body = [
      `**School:** ${r.school.name}`,
      `**Association:** ${r.school.association}`,
      `**Conference:** ${r.school.conference}`,
      `**Location:** ${[r.school.city, r.school.state].filter(Boolean).join(", ")}`,
      `**Current URL:** ${r.school.url}`,
      `**Error:** ${r.status}`,
    ].join("\n");

    const tmpFile = `/tmp/gh-issue-body-${Date.now()}.md`;
    fs.writeFileSync(tmpFile, body);
    execSync(
      `gh issue create --repo ${REPO} --title "${title.replace(/"/g, '\\"')}" --label broken-url --body-file "${tmpFile}"`,
      { encoding: "utf8" }
    );
    fs.unlinkSync(tmpFile);
    console.log(`  Created: ${title}`);
    created++;
  }

  console.log(`\nDone. ${created} issues created.`);
}

main().catch(console.error);
