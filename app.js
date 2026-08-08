const crew = [
  ["J", "Josh", "Architect & Creator"],
  ["A", "Amber", "Studio & Social Media Manager"],
  ["A", "Allie", "Studio Architect & Working Partner"],
  ["H", "Hallie", "Role recovery pending"],
  ["R", "Ro", "Role recovery pending"],
  ["A", "Ariza / Artisan", "Visual & Pacing Editor"],
  ["S", "Slick", "Infrastructure & Runner"],
  ["T", "Tigra", "Role recovery pending"]
];

const storageKey = "moonshadow-bridge-local-v1";
const feed = document.querySelector("#bridge-feed");
const sender = document.querySelector("#message-sender");
const lastSave = document.querySelector("#last-local-save");

function safeLoad() {
  try { return JSON.parse(localStorage.getItem(storageKey)) || []; }
  catch { return []; }
}

let entries = safeLoad();

async function loadBrain() {
  const state = document.querySelector("#brain-loaded");
  try {
    const response = await fetch("brain/current.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Brain unavailable");
    const brain = await response.json();
    document.querySelector("#brain-version").textContent = brain.version;
    document.querySelector("#brain-summary").textContent = brain.summary;
    state.textContent = "REPOSITORY SNAPSHOT LOADED";
    state.classList.add("loaded");
  } catch {
    document.querySelector("#brain-version").textContent = "Unavailable";
    document.querySelector("#brain-summary").textContent = "The repository Brain snapshot could not be read.";
    state.textContent = "NOT LOADED";
  }
}

document.querySelector("#crew-list").innerHTML = crew.map(([initial, name, role]) => `
  <article class="crew-card">
    <span class="avatar">${initial}</span>
    <div><strong>${name}</strong><small>${role}</small></div>
    <span class="crew-state">UNVERIFIED</span>
  </article>
`).join("");

sender.innerHTML = crew.map(([, name]) => `<option>${name}</option>`).join("");
sender.value = "Amber";

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(entries));
  const now = new Date();
  lastSave.textContent = `Local save: ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function render() {
  if (!entries.length) {
    feed.innerHTML = `<div class="empty-state"><div><strong>The Bridge is quiet.</strong><br />Local testing is available. Live worker connections are not.</div></div>`;
    return;
  }

  feed.innerHTML = entries.map(entry => `
    <article class="feed-item ${entry.type}">
      <div class="feed-meta"><strong>${escapeHtml(entry.sender)}</strong><span>${escapeHtml(entry.time)}</span></div>
      <p>${escapeHtml(entry.text)}</p>
    </article>
  `).join("");
  feed.scrollTop = feed.scrollHeight;
}

function addEntry(entry) {
  entries.push({ ...entry, time: new Date().toLocaleString([], { dateStyle: "short", timeStyle: "short" }) });
  entries = entries.slice(-100);
  save();
  render();
}

document.querySelector("#message-form").addEventListener("submit", event => {
  event.preventDefault();
  const text = document.querySelector("#message-text");
  addEntry({ type: "message", sender: sender.value, text: text.value.trim() });
  text.value = "";
  text.focus();
});

document.querySelector("#checkpoint-form").addEventListener("submit", event => {
  event.preventDefault();
  const value = id => document.querySelector(id).value.trim();
  const brain = document.querySelector("#cp-brain").checked ? "YES" : "NO";
  const name = value("#cp-name");
  const checkpoint = `${name.toUpperCase()} | ${value("#cp-role")} | ${value("#cp-task")} | ${value("#cp-status")} | ${value("#cp-last")} | ${value("#cp-blocker")} | ${value("#cp-next")} | BRAIN UPDATED: ${brain}`;
  addEntry({ type: "checkpoint", sender: `${name} — CHECKPOINT`, text: checkpoint });
});

document.querySelector("#clear-feed").addEventListener("click", () => {
  if (!confirm("Clear this device's local Bridge test feed?")) return;
  entries = [];
  save();
  render();
});

render();
loadBrain();
