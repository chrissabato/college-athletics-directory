const ALLOWED_ORIGIN = "https://directory.chrissabato.com";
const REPO = "chrissabato/college-athletics-directory";

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }

    if (request.method !== "POST") {
      return cors(new Response("Method not allowed", { status: 405 }));
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return cors(new Response("Invalid JSON", { status: 400 }));
    }

    const { school, association, conference, city, state, url,
            orig_association, orig_conference, orig_city, orig_state, orig_url,
            details } = data;

    if (!school) {
      return cors(new Response("Missing required fields", { status: 400 }));
    }

    const fields = [
      { label: "Association", orig: orig_association, val: association },
      { label: "Conference",  orig: orig_conference,  val: conference  },
      { label: "City",        orig: orig_city,        val: city        },
      { label: "State",       orig: orig_state,       val: state       },
      { label: "URL",         orig: orig_url,         val: url         },
    ];

    const changed = fields.filter(f => f.orig && f.val && f.orig !== f.val);
    const unchanged = fields.filter(f => f.val && (!f.orig || f.orig === f.val));

    const lines = [`**School:** ${school}`, ""];

    if (changed.length) {
      lines.push("**Changes:**");
      changed.forEach(f => lines.push(`- **${f.label}:** ~~${f.orig}~~ → ${f.val}`));
      lines.push("");
    }

    if (unchanged.length) {
      lines.push("**Unchanged data:**");
      unchanged.forEach(f => lines.push(`- **${f.label}:** ${f.val}`));
      lines.push("");
    }

    if (details) lines.push(`**Details:** ${details}`);

    const body = lines.join("\n");
    const issue_type = changed.length ? "Update" : "Report";

    const response = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "CollegeAthleticsDirectory",
        "Accept": "application/vnd.github+json",
      },
      body: JSON.stringify({
        title: `${issue_type}: ${school}`,
        body,
        labels: ["correction"],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return cors(new Response(JSON.stringify({ error: result.message }), { status: 502 }));
    }

    return cors(new Response(JSON.stringify({ url: result.html_url }), { status: 201 }));
  }
};

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(response.body, { status: response.status, headers });
}
