# College Athletics Website Directory

A searchable directory of 1,300+ college athletics websites across NCAA Division I, II, III, and NAIA. Filter by state, association, and conference. Live at [directory.chrissabato.com](https://directory.chrissabato.com).

## Features

- **Search** with autocomplete — shows school name, association, conference, and location
- **Filter** by state, association (NCAA DI/DII/DIII, NAIA), and conference
- **1,319 schools** with direct links to their athletics websites
- **Chrome extension** for searching from your browser toolbar
- **Report an issue** form — submissions create GitHub Issues via a Cloudflare Worker

## Project Structure

```
├── index.html                  # Main page
├── app.js                      # Filter, search, and render logic
├── styles.css                  # All styling
├── schools.json                # School data (name, location, association, conference, URL)
├── logo.svg / favicon.png      # Site branding
├── og-image.jpg                # Social preview image
│
├── extension/                  # Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── popup.html / popup.js / popup.css
│   └── icons/
│
├── worker/                     # Cloudflare Worker — proxies form submissions to GitHub Issues
│   ├── index.js
│   └── wrangler.toml
│
├── check-urls.js               # Node.js script to validate all URLs and open GitHub Issues
└── fix-issue-bodies.js         # Utility to reformat existing GitHub issue bodies
```

## Data

`schools.json` contains one entry per school:

```json
{
  "name": "University of Alabama",
  "city": "Tuscaloosa",
  "state": "Alabama",
  "stateCode": "AL",
  "association": "NCAA DI",
  "conference": "Southeastern Conference",
  "url": "https://rolltide.com"
}
```

School favicons are generated at render time from each school's URL using the Google favicon service — they are not stored in the data file.

## Chrome Extension

The extension lets you search the directory from your browser toolbar. Install it from the [Chrome Web Store](https://chromewebstore.google.com/detail/daegngbppoekohefhkmbmndhajekcpdi).

## URL Checker

`check-urls.js` sends a HEAD request to every school URL and opens a GitHub Issue for each broken one:

```bash
node check-urls.js
```

Requires the `gh` CLI to be authenticated.

## Issue Submission (Cloudflare Worker)

The "Report an Issue" form on the site posts to a Cloudflare Worker at `athletics-issues.chris-sabato.workers.dev`, which creates a GitHub Issue using a stored secret token. The token is never exposed client-side.

To deploy the worker:

```bash
cd worker
wrangler secret put GITHUB_TOKEN
wrangler deploy
```

## Deployment

The site is hosted on GitHub Pages with a custom domain. The `CNAME` file points to `directory.chrissabato.com`.

To run locally, serve the root directory with any static file server:

```bash
npx serve .
```
