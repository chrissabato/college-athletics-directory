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

    const { school, issue_type, details, correct_url } = data;

    if (!school || !issue_type) {
      return cors(new Response("Missing required fields", { status: 400 }));
    }

    const body = [
      `**School:** ${school}`,
      `**Issue type:** ${issue_type}`,
      details ? `**Details:** ${details}` : null,
      correct_url ? `**Correct URL:** ${correct_url}` : null,
    ].filter(Boolean).join("\n");

    const response = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "CollegeAthleticsDirectory",
        "Accept": "application/vnd.github+json",
      },
      body: JSON.stringify({
        title: `Correction: ${school}`,
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
