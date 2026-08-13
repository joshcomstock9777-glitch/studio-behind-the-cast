const crew = [
  ["J", "Josh", "Final creative authority"],
  ["A", "Allie", "Creative lead and synthesis"],
  ["A", "Amber", "Intake, routing, and inbox"],
  ["A", "Artisa", "Editor and final QA"],
  ["S", "Slick", "Publisher and release gate"],
  ["T", "Tigra", "Social media manager"],
  ["SC", "The Scout", "Runner and resource finder"],
  ["M", "Marketer", "Distribution and outreach"]
];

const pathConfig = window.__PATH_CONFIG__ ?? {};
const pathBaseUrl = String(pathConfig.apiBaseUrl ?? "").trim();
const workflowList = document.querySelector("#workflow-list");
const feed = document.querySelector("#bridge-feed");
const sender = document.querySelector("#message-sender");
const lastSync = document.querySelector("#last-sync");
const connectionTitle = document.querySelector("#connection-title");
const connectionDetail = document.querySelector("#connection-detail");
const statusDot = document.querySelector(".status-dot");
const entries = [];

let currentUserSessionId = null;
let currentSession = null;
let pollTimer = null;
let polling = false;

function setConnection(title, detail, online = false) {
  connectionTitle.textContent = title;
  connectionDetail.textContent = detail;
  statusDot.classList.toggle("offline", !online);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[character]));
}

function displayTime(entry) {
  const date = entry.createdAt ? new Date(entry.createdAt) : new Date();
  return date.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

function pathUrl(pathname) {
  if (!pathBaseUrl) throw new Error("Path runtime configuration is unavailable.");
  return new URL(pathname, pathBaseUrl).toString();
}

function sessionSummary(record) {
  return `${String(record.status ?? "open").toUpperCase()} · ${record.calls ?? 0} call${record.calls === 1 ? "" : "s"} · v${record.stateVersion ?? 0}`;
}

function renderEntry(entry) {
  if (entry?.schema === "moonshadow.path.v1") {
    const role = entry.from === "josh" ? "Josh" : String(entry.from ?? "path");
    const title = `${role} → ${String(entry.to ?? "unknown").toUpperCase()}`;
    const tag = `${String(entry.kind ?? "seed").toUpperCase()} · ${String(entry.correlationId ?? "").slice(0, 8)}`;
    return `<article class="feed-item request"><div class="feed-meta"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(displayTime(entry))}</span></div><p>${escapeHtml(entry.body ?? "")}</p><div class="tags"><span class="tag">${escapeHtml(tag)}</span><span class="tag">TURN ${escapeHtml(String(entry.turn ?? 0))}</span></div></article>`;
  }

  if (entry?.identity) {
    const title = `${String(entry.identity).toUpperCase()} RESPONSE`;
    const tag = `${String(entry.kind ?? "handoff").toUpperCase()} · ${String(entry.correlationId ?? "").slice(0, 8)}`;
    return `<article class="feed-item response"><div class="feed-meta"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(displayTime(entry))}</span></div><p>${escapeHtml(entry.body ?? "")}</p><div class="tags"><span class="tag">${escapeHtml(tag)}</span><span class="tag">MODEL ${escapeHtml(entry.model ?? "unknown")}</span></div></article>`;
  }

  return "";
}

function render() {
  const transcript = currentSession && Array.isArray(currentSession.transcript) ? currentSession.transcript : [];
  if (!currentSession || !transcript.length) {
    feed.innerHTML = `<div class="empty-state"><div><strong>The Path is quiet.</strong><br />Waiting for the first request through the current contract.</div></div>`;
    sender.value = sender.value || "Amber";
    document.querySelector("#active-count").textContent = "No session";
    return;
  }

  entries.length = 0;
  entries.push(...transcript);
  feed.innerHTML = entries.map(renderEntry).filter(Boolean).join("");
  feed.scrollTop = feed.scrollHeight;
  document.querySelector("#active-count").textContent = sessionSummary(currentSession);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function readSession(sessionId) {
  const response = await fetch(pathUrl(`/sessions/${sessionId}`), {
    headers: { accept: "application/json" }
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.error ? `: ${body.error}` : "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(`Path session fetch failed (${response.status})${detail}`);
  }
  return response.json();
}

async function refreshSession(sessionId) {
  if (polling) return;
  polling = true;
  try {
    const session = await readSession(sessionId);
    if (!session) return;
    currentSession = session;
    render();
    lastSync.textContent = `Path sync: ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    if (session.status === "final" || session.status === "error") {
      stopPolling();
    }
  } finally {
    polling = false;
  }
}

async function startSession(sessionId) {
  currentUserSessionId = sessionId;
  stopPolling();
  await refreshSession(sessionId);
  if (currentSession?.status === "final" || currentSession?.status === "error") return;
  pollTimer = setInterval(() => {
    refreshSession(sessionId).catch(error => {
      setConnection("PATH BACKEND BLOCKED", error.message, false);
      stopPolling();
    });
  }, 2000);
}

async function sendRequest(target, message) {
  if (!pathBaseUrl) throw new Error("Path runtime configuration is unavailable.");
  const response = await fetch(pathUrl("/sessions"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target, message })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ? `Path request failed: ${payload.error}` : `Path request failed (${response.status})`);
  }

  currentSession = {
    sessionId: payload.sessionId,
    correlationId: payload.correlationId,
    status: payload.status ?? "open",
    calls: 0,
    stateVersion: 0,
    transcript: [],
    processed: {}
  };
  render();
  await startSession(payload.sessionId);
  return payload;
}

document.querySelector("#crew-list").innerHTML = crew.map(([initial, name, role]) => `
  <article class="crew-card">
    <span class="avatar">${initial}</span>
    <div><strong>${name}</strong><small>${role}</small></div>
    <span class="crew-state">UNVERIFIED</span>
  </article>
`).join("");

sender.innerHTML = ["Amber", "Allie"].map(name => `<option>${name}</option>`).join("");
sender.value = "Amber";

document.querySelector("#message-form").addEventListener("submit", async event => {
  event.preventDefault();
  const text = document.querySelector("#message-text");
  const button = event.submitter;
  button.disabled = true;
  try {
    await sendRequest(sender.value, text.value.trim().slice(0, 700));
    text.value = "";
    text.focus();
  } catch (error) {
    alert(`Message not sent: ${error.message}`);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#checkpoint-form").addEventListener("submit", async event => {
  event.preventDefault();
  const value = selector => document.querySelector(selector).value.trim();
  const brain = document.querySelector("#cp-brain").checked ? "YES" : "NO";
  const name = value("#cp-name");
  const checkpoint = `${name.toUpperCase()} | ${value("#cp-role")} | ${value("#cp-task")} | ${value("#cp-status")} | ${value("#cp-last")} | ${value("#cp-blocker")} | ${value("#cp-next")} | BRAIN UPDATED: ${brain}`;
  const button = event.submitter;
  button.disabled = true;
  try {
    await sendRequest("Amber", checkpoint.slice(0, 1600));
  } catch (error) {
    alert(`Checkpoint not sent: ${error.message}`);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#refresh-feed").addEventListener("click", () => {
  if (!currentUserSessionId) {
    location.reload();
    return;
  }
  refreshSession(currentUserSessionId).catch(error => {
    setConnection("PATH BACKEND BLOCKED", error.message, false);
  });
});

async function loadBrain() {
  const state = document.querySelector("#brain-loaded");
  try {
    const response = await fetch("brain/current.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Brain unavailable");
    const brain = await response.json();
    document.querySelector("#brain-version").textContent = brain.version;
    document.querySelector("#brain-summary").textContent = brain.summary;
    workflowList.innerHTML = (brain.workflow ?? []).map(step => `<li>${escapeHtml(step)}</li>`).join("");
    state.textContent = "REPOSITORY SNAPSHOT LOADED";
    state.classList.add("loaded");
  } catch {
    document.querySelector("#brain-version").textContent = "Unavailable";
    document.querySelector("#brain-summary").textContent = "The repository Brain snapshot could not be read.";
    workflowList.innerHTML = `<li>Workflow unavailable.</li>`;
    state.textContent = "NOT LOADED";
  }
}

render();
loadBrain();

if (!pathBaseUrl) {
  setConnection("PATH CONFIG MISSING", "Set the Pages Path client config to the current Path endpoint.", false);
} else {
  setConnection("PATH CONTROL SURFACE", "Current Path contract loaded", true);
}
