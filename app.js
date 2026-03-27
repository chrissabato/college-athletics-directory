// College Athletics Directory - Application Logic

// ── Data (populated after fetch) ──────────────────────────────────────────
let SCHOOLS = [];
let CONFERENCES_BY_ASSOCIATION = {};

// ── State ────────────────────────────────────────────────────────────────
let activeFilters = {
  search:      "",
  state:       "",
  association: "",
  conference:  "",
};

let autocompleteIndex = -1;

// ── DOM References ────────────────────────────────────────────────────────
const searchInput      = document.getElementById("search-input");
const autocompleteList = document.getElementById("autocomplete-list");
const stateFilter      = document.getElementById("state-filter");
const associationFilter= document.getElementById("association-filter");
const conferenceFilter = document.getElementById("conference-filter");
const resetBtn         = document.getElementById("reset-btn");
const emptyResetBtn    = document.getElementById("empty-reset-btn");
const resultsGrid      = document.getElementById("results-grid");
const resultsCount     = document.getElementById("results-count");
const emptyState       = document.getElementById("empty-state");

// ── State code lookup ─────────────────────────────────────────────────────
const STATE_CODES = {
  "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA",
  "Colorado":"CO","Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA",
  "Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA",
  "Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD",
  "Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS",
  "Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH",
  "New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC",
  "North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA",
  "Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN",
  "Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA",
  "West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY","District of Columbia":"DC"
};

function getStateCode(state) {
  return STATE_CODES[state] || state;
}

// ── Utilities ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getFaviconUrl(url, faviconUrl) {
  if (faviconUrl) return faviconUrl;
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return '';
  }
}

function getBadgeClass(association) {
  const map = {
    "NCAA Division I":   "ncaa1",
    "NCAA Division II":  "ncaa2",
    "NCAA Division III": "ncaa3",
    "NAIA":              "naia",
    "NJCAA":             "njcaa",
    "NCCAA":             "nccaa",
  };
  return map[association] || "ncaa1";
}

function highlightMatch(name, query) {
  if (!query) return escapeHtml(name);
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHtml(name);
  return (
    escapeHtml(name.slice(0, idx)) +
    "<mark>" + escapeHtml(name.slice(idx, idx + query.length)) + "</mark>" +
    escapeHtml(name.slice(idx + query.length))
  );
}

// ── Autocomplete ──────────────────────────────────────────────────────────
function updateAutocomplete(rawQuery) {
  const query = rawQuery.trim();
  if (!query) {
    closeAutocomplete();
    return;
  }

  const lower = query.toLowerCase();
  const matches = SCHOOLS
    .filter(s => s.name.toLowerCase().includes(lower))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(lower);
      const bStarts = b.name.toLowerCase().startsWith(lower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 8);

  if (matches.length === 0) {
    closeAutocomplete();
    return;
  }

  autocompleteList.innerHTML = matches
    .map((school, i) => {
      const location = [school.city, school.state].filter(Boolean).join(', ');
      const metaParts = [school.association, school.conference, location].filter(Boolean);
      if (school.ncaa_id) metaParts.push(`ID: ${school.ncaa_id}`);
      const meta = metaParts.join(' &mdash; ');
      const favicon = school.url ? `<img class="ac-favicon" src="${escapeHtml(getFaviconUrl(school.url, school.favicon_url))}" alt="" aria-hidden="true">` : '';
      return `<li role="option" data-value="${escapeHtml(school.name)}" data-url="${escapeHtml(school.url)}" data-index="${i}">` +
        favicon +
        `<span class="ac-text"><span class="ac-name">${highlightMatch(school.name, query)}</span>` +
        `<span class="ac-meta">${meta}</span></span>` +
        `</li>`;
    })
    .join("");

  autocompleteList.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
  autocompleteIndex = -1;

  autocompleteList.querySelectorAll("li").forEach(li => {
    li.addEventListener("mousedown", e => {
      // mousedown fires before blur — prevent input blur from closing list first
      e.preventDefault();
      selectAutocompleteItem(li.dataset.value, li.dataset.url);
    });
  });
}

function closeAutocomplete() {
  autocompleteList.hidden = true;
  autocompleteList.innerHTML = "";
  searchInput.setAttribute("aria-expanded", "false");
  autocompleteIndex = -1;
}

function selectAutocompleteItem(name, url) {
  if (url) window.open(url, "_blank", "noopener,noreferrer");
  searchInput.value = name;
  activeFilters.search = name.toLowerCase();
  closeAutocomplete();
  applyFiltersAndRender();
  searchInput.focus();
}

function highlightAutocompleteItem(newIndex) {
  const items = autocompleteList.querySelectorAll("li");
  items.forEach(li => li.classList.remove("autocomplete-active"));
  autocompleteIndex = newIndex;
  if (newIndex >= 0 && newIndex < items.length) {
    items[newIndex].classList.add("autocomplete-active");
    searchInput.setAttribute("aria-activedescendant", items[newIndex].id || "");
  }
}

// ── Conference Dropdown ────────────────────────────────────────────────────
function updateConferenceDropdown(association) {
  const current = conferenceFilter.value;
  conferenceFilter.innerHTML = '<option value="">All Conferences</option>';

  const conferences = association
    ? CONFERENCES_BY_ASSOCIATION[association] || []
    : [...new Set(SCHOOLS.map(s => s.conference).filter(Boolean))].sort();

  conferences.forEach(conf => {
    const opt = document.createElement("option");
    opt.value = conf;
    opt.textContent = conf;
    conferenceFilter.appendChild(opt);
  });

  // Restore selection if still valid, otherwise clear it
  conferenceFilter.value = conferences.includes(current) ? current : "";
  if (conferenceFilter.value !== current) {
    activeFilters.conference = "";
  }
}

// ── Filtering & Rendering ──────────────────────────────────────────────────
function applyFiltersAndRender() {
  let results = SCHOOLS;

  if (activeFilters.search) {
    results = results.filter(s =>
      s.name.toLowerCase().includes(activeFilters.search)
    );
  }
  if (activeFilters.state) {
    results = results.filter(s => s.state === activeFilters.state);
  }
  if (activeFilters.association) {
    results = results.filter(s => s.association === activeFilters.association);
  }
  if (activeFilters.conference) {
    results = results.filter(s => s.conference === activeFilters.conference);
  }

  results = [...results].sort((a, b) => a.name.localeCompare(b.name));

  renderResults(results);
}

function renderResults(schools) {
  const n = schools.length;
  resultsCount.textContent =
    n === 1 ? "Showing 1 school" : `Showing ${n} school${n === 0 ? "s" : "s"}`;

  if (n === 0) {
    resultsGrid.innerHTML = "";
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  resultsGrid.innerHTML = schools
    .map(school => `
      <article class="school-card" role="listitem">
        <h3 class="card-name">
          ${school.url ? `<img class="card-favicon" src="${escapeHtml(getFaviconUrl(school.url, school.favicon_url))}" alt="" aria-hidden="true">` : ''}
          <a href="${escapeHtml(school.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(school.name)}</a>
        </h3>
        <p class="card-conference">${escapeHtml(school.conference)}</p>
        <div class="card-footer">
          <p class="card-state">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
            ${school.city ? escapeHtml(school.city) + ', ' : ''}${escapeHtml(school.state)}
          </p>
          <span class="card-association">${escapeHtml(school.association)}</span>
        </div>
        ${school.ncaa_id ? `<p class="card-ncaa-id">NCAA ID: ${school.ncaa_id}</p>` : ''}
      </article>
    `)
    .join("");
}

// ── Reset ──────────────────────────────────────────────────────────────────
function resetAll() {
  activeFilters = { search: "", state: "", association: "", conference: "" };
  searchInput.value = "";
  stateFilter.value = "";
  associationFilter.value = "";
  conferenceFilter.value = "";
  updateConferenceDropdown("");
  closeAutocomplete();
  applyFiltersAndRender();
}

// ── Event Listeners ────────────────────────────────────────────────────────
searchInput.addEventListener("input", () => {
  activeFilters.search = searchInput.value.trim().toLowerCase();
  updateAutocomplete(searchInput.value);
  applyFiltersAndRender();
});

searchInput.addEventListener("keydown", e => {
  const items = autocompleteList.querySelectorAll("li");
  if (autocompleteList.hidden || items.length === 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    const next = autocompleteIndex < items.length - 1 ? autocompleteIndex + 1 : 0;
    highlightAutocompleteItem(next);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const prev = autocompleteIndex > 0 ? autocompleteIndex - 1 : items.length - 1;
    highlightAutocompleteItem(prev);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (autocompleteIndex >= 0 && items[autocompleteIndex]) {
      selectAutocompleteItem(items[autocompleteIndex].dataset.value, items[autocompleteIndex].dataset.url);
    } else {
      closeAutocomplete();
    }
  } else if (e.key === "Escape") {
    closeAutocomplete();
  }
});

document.addEventListener("click", e => {
  if (!e.target.closest(".autocomplete-wrapper")) {
    closeAutocomplete();
  }
});

stateFilter.addEventListener("change", () => {
  activeFilters.state = stateFilter.value;
  applyFiltersAndRender();
});

associationFilter.addEventListener("change", () => {
  activeFilters.association = associationFilter.value;
  activeFilters.conference = "";
  conferenceFilter.value = "";
  updateConferenceDropdown(associationFilter.value);
  applyFiltersAndRender();
});

conferenceFilter.addEventListener("change", () => {
  activeFilters.conference = conferenceFilter.value;
  applyFiltersAndRender();
});

resetBtn.addEventListener("click", resetAll);
emptyResetBtn.addEventListener("click", resetAll);

// ── Initialization ─────────────────────────────────────────────────────────
async function init() {
  const res = await fetch("schools.json");
  SCHOOLS = await res.json();

  // Build conference lookup from loaded data
  const map = {};
  for (const school of SCHOOLS) {
    if (!map[school.association]) map[school.association] = new Set();
    map[school.association].add(school.conference);
  }
  for (const key in map) map[key] = [...map[key]].sort();
  CONFERENCES_BY_ASSOCIATION = map;

  // Populate conference dropdown with all conferences
  updateConferenceDropdown("");

  // Populate association dropdown from data
  const associations = [...new Set(SCHOOLS.map(s => s.association))].sort();
  associations.forEach(assoc => {
    const opt = document.createElement("option");
    opt.value = assoc;
    opt.textContent = assoc;
    associationFilter.appendChild(opt);
  });

  // Populate state dropdown (only states present in dataset)
  const states = [...new Set(SCHOOLS.map(s => s.state))].sort();
  states.forEach(state => {
    const opt = document.createElement("option");
    opt.value = state;
    opt.textContent = state;
    stateFilter.appendChild(opt);
  });

  applyFiltersAndRender();
}

document.addEventListener("DOMContentLoaded", init);

// ── Correction Modal ───────────────────────────────────────────────────────
const WORKER_URL = "https://athletics-issues.chris-sabato.workers.dev";

const modal          = document.getElementById("correction-modal");
const modalClose     = document.getElementById("modal-close");
const schoolField    = document.getElementById("field-school");
const corrForm       = document.getElementById("correction-form");
const formStatus     = document.getElementById("form-status");
const toast          = document.getElementById("toast");
const schoolDataFields = document.getElementById("school-data-fields");
const macList        = document.getElementById("modal-ac-list");

// ── Modal school autocomplete ──────────────────────────────────────────────
let macIndex = -1;

function populateSchoolFields(school) {
  document.getElementById("field-association").value = school.association || "";
  document.getElementById("field-conference").value  = school.conference  || "";
  document.getElementById("field-city").value        = school.city        || "";
  document.getElementById("field-state").value       = school.state       || "";
  document.getElementById("field-url").value         = school.url         || "";
  // Store originals for diffing
  document.getElementById("orig-association").value  = school.association || "";
  document.getElementById("orig-conference").value   = school.conference  || "";
  document.getElementById("orig-city").value         = school.city        || "";
  document.getElementById("orig-state").value        = school.state       || "";
  document.getElementById("orig-url").value          = school.url         || "";
  schoolDataFields.hidden = false;
}

function clearSchoolFields() {
  schoolDataFields.hidden = true;
  ["field-association","field-conference","field-city","field-state","field-url"]
    .forEach(id => document.getElementById(id).value = "");
}

function closeMacList() {
  macList.hidden = true;
  macList.innerHTML = "";
  macIndex = -1;
}

schoolField.addEventListener("input", () => {
  const q = schoolField.value.trim().toLowerCase();
  clearSchoolFields();
  if (q.length < 1) { closeMacList(); return; }

  const matches = SCHOOLS
    .filter(s => s.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aS = a.name.toLowerCase().startsWith(q);
      const bS = b.name.toLowerCase().startsWith(q);
      return (aS === bS) ? a.name.localeCompare(b.name) : aS ? -1 : 1;
    })
    .slice(0, 8);

  if (!matches.length) { closeMacList(); return; }

  macList.innerHTML = matches.map((s, i) => {
    const loc = [s.city, s.state].filter(Boolean).join(", ");
    return `<li data-index="${i}">
      <span>${escapeHtml(s.name)}</span>
      <span class="mac-meta">${escapeHtml([s.association, loc].filter(Boolean).join(" — "))}</span>
    </li>`;
  }).join("");

  macList.hidden = false;
  macIndex = -1;

  macList.querySelectorAll("li").forEach((li, i) => {
    li.addEventListener("mousedown", e => {
      e.preventDefault();
      schoolField.value = matches[i].name;
      populateSchoolFields(matches[i]);
      closeMacList();
    });
  });
});

schoolField.addEventListener("keydown", e => {
  const items = macList.querySelectorAll("li");
  if (macList.hidden || !items.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    items.forEach(li => li.classList.remove("modal-ac-active"));
    macIndex = macIndex < items.length - 1 ? macIndex + 1 : 0;
    items[macIndex].classList.add("modal-ac-active");
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    items.forEach(li => li.classList.remove("modal-ac-active"));
    macIndex = macIndex > 0 ? macIndex - 1 : items.length - 1;
    items[macIndex].classList.add("modal-ac-active");
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (macIndex >= 0) items[macIndex].dispatchEvent(new MouseEvent("mousedown"));
  } else if (e.key === "Escape") {
    closeMacList();
  }
});

document.addEventListener("click", e => {
  if (!e.target.closest(".modal-ac-wrapper")) closeMacList();
});

// ── Modal open/close ───────────────────────────────────────────────────────
function openModal(schoolName) {
  corrForm.reset();
  clearSchoolFields();
  closeMacList();
  formStatus.hidden = true;
  if (schoolName) {
    schoolField.value = schoolName;
    const school = SCHOOLS.find(s => s.name === schoolName);
    if (school) populateSchoolFields(school);
  }
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => schoolField.focus(), 50);
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
  closeMacList();
}

function showToast() {
  toast.hidden = false;
  toast.classList.add("toast--visible");
  setTimeout(() => {
    toast.classList.remove("toast--visible");
    toast.addEventListener("transitionend", () => { toast.hidden = true; }, { once: true });
  }, 3000);
}

modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeExtModal(); } });

document.getElementById("report-link").addEventListener("click", () => openModal(""));

// ── Extension Modal ─────────────────────────────────────────────────────────
const extModal      = document.getElementById("extension-modal");
const extModalClose = document.getElementById("ext-modal-close");

function openExtModal() {
  extModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeExtModal() {
  extModal.hidden = true;
  document.body.style.overflow = "";
}

document.getElementById("extension-link").addEventListener("click", openExtModal);
extModalClose.addEventListener("click", closeExtModal);
extModal.addEventListener("click", e => { if (e.target === extModal) closeExtModal(); });

// ── Form submission ────────────────────────────────────────────────────────
corrForm.addEventListener("submit", async e => {
  e.preventDefault();
  const submitBtn = corrForm.querySelector(".submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  const data = {
    school:           schoolField.value,
    association:      document.getElementById("field-association").value,
    conference:       document.getElementById("field-conference").value,
    city:             document.getElementById("field-city").value,
    state:            document.getElementById("field-state").value,
    url:              document.getElementById("field-url").value,
    orig_association: document.getElementById("orig-association").value,
    orig_conference:  document.getElementById("orig-conference").value,
    orig_city:        document.getElementById("orig-city").value,
    orig_state:       document.getElementById("orig-state").value,
    orig_url:         document.getElementById("orig-url").value,
    details:          document.getElementById("field-details").value,
  };

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (res.ok) {
      closeModal();
      showToast();
    } else {
      throw new Error(json.error || "Unknown error");
    }
  } catch (err) {
    formStatus.hidden = false;
    formStatus.className = "form-status form-status--error";
    formStatus.textContent = "Something went wrong. Please try again.";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
});
