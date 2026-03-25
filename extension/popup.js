const DATA_URLS = [
  "https://directory.chrissabato.com/schools.json",
  "https://chrissabato.github.io/college-athletics-directory/schools.json"
];

const searchInput  = document.getElementById("search-input");
const resultsList  = document.getElementById("results-list");
const emptyState   = document.getElementById("empty-state");
const initialState = document.getElementById("initial-state");
const refreshBtn   = document.getElementById("refresh-btn");

let SCHOOLS = [];
let activeIndex = -1;

// ── Data loading ──────────────────────────────────────────────────────────
async function fetchSchools() {
  let lastError;
  for (const url of DATA_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      SCHOOLS = await res.json();
      chrome.storage.local.set({ schools: SCHOOLS });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function loadSchools() {
  const cached = await chrome.storage.local.get("schools");
  if (cached.schools) {
    SCHOOLS = cached.schools;
    return;
  }
  await fetchSchools();
}

// ── Utilities ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function highlightMatch(name, query) {
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHtml(name);
  return escapeHtml(name.slice(0, idx)) +
    "<mark>" + escapeHtml(name.slice(idx, idx + query.length)) + "</mark>" +
    escapeHtml(name.slice(idx + query.length));
}

// ── Rendering ─────────────────────────────────────────────────────────────
function renderResults(matches, query) {
  initialState.hidden = true;

  if (matches.length === 0) {
    resultsList.innerHTML = "";
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  activeIndex = -1;

  resultsList.innerHTML = matches.map((school, i) => {
    const location = [school.city, school.state].filter(Boolean).join(", ");
    const meta = [school.association, school.conference, location].filter(Boolean).join(" — ");
    return `
      <li role="option" data-url="${escapeHtml(school.url)}" data-index="${i}">
        ${school.url ? `<img class="favicon" src="https://www.google.com/s2/favicons?domain=${new URL(school.url).hostname}&sz=64" alt="">` : ''}
        <div class="info">
          <span class="name">${highlightMatch(school.name, query)}</span>
          <span class="meta">${escapeHtml(meta)}</span>
        </div>
      </li>`;
  }).join("");

  resultsList.querySelectorAll("li").forEach(li => {
    li.addEventListener("click", () => openSchool(li.dataset.url));
  });
}

function openSchool(url) {
  if (url) chrome.tabs.create({ url, active: true });
}

function setActive(index) {
  const items = resultsList.querySelectorAll("li");
  items.forEach(li => li.classList.remove("active"));
  activeIndex = index;
  if (index >= 0 && items[index]) {
    items[index].classList.add("active");
    items[index].scrollIntoView({ block: "nearest" });
  }
}

// ── Search ────────────────────────────────────────────────────────────────
function search(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    resultsList.innerHTML = "";
    emptyState.hidden = true;
    initialState.hidden = false;
    return;
  }

  const matches = SCHOOLS
    .filter(s => s.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q);
      const bStarts = b.name.toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10);

  renderResults(matches, query.trim());
}

// ── Event listeners ───────────────────────────────────────────────────────
searchInput.addEventListener("input", () => search(searchInput.value));

searchInput.addEventListener("keydown", e => {
  const items = resultsList.querySelectorAll("li");
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    setActive(activeIndex < items.length - 1 ? activeIndex + 1 : 0);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setActive(activeIndex > 0 ? activeIndex - 1 : items.length - 1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (activeIndex >= 0 && items[activeIndex]) {
      openSchool(items[activeIndex].dataset.url);
    }
  }
});

// ── Refresh ───────────────────────────────────────────────────────────────
refreshBtn.addEventListener("click", async () => {
  refreshBtn.classList.add("spinning");
  refreshBtn.disabled = true;
  try {
    await chrome.storage.local.remove("schools");
    await fetchSchools();
    search(searchInput.value);
  } catch {
    // silently fail — data stays as-is
  } finally {
    refreshBtn.classList.remove("spinning");
    refreshBtn.disabled = false;
  }
});

// ── Init ──────────────────────────────────────────────────────────────────
loadSchools().then(() => {
  searchInput.focus();
}).catch(() => {
  initialState.textContent = "Failed to load data. Check your connection.";
});
