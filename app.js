import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getDatabase,
  limitToLast,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  query,
  ref,
  serverTimestamp,
  set
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

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

const workflowList = document.querySelector("#workflow-list");

const feed = document.querySelector("#bridge-feed");
const sender = document.querySelector("#message-sender");
const lastSync = document.querySelector("#last-sync");
const connectionTitle = document.querySelector("#connection-title");
const connectionDetail = document.querySelector("#connection-detail");
const statusDot = document.querySelector(".status-dot");
const entries = [];
let database;
let currentUser;
let realtimeStarted = false;

function setConnection(title, detail, online = false) {
  connectionTitle.textContent = title;
  connectionDetail.textContent = detail;
  statusDot.classList.toggle("offline", !online);
}

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

document.querySelector("#crew-list").innerHTML = crew.map(([initial, name, role]) => `
  <article class="crew-card">
    <span class="avatar">${initial}</span>
    <div><strong>${name}</strong><small>${role}</small></div>
    <span class="crew-state">UNVERIFIED</span>
  </article>
`).join("");

sender.innerHTML = crew.map(([, name]) => `<option>${name}</option>`).join("");
sender.value = "Amber";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
}

function displayTime(entry) {
  const date = entry.createdAt ? new Date(entry.createdAt) : new Date();
  return date.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

function render() {
  if (!entries.length) {
    feed.innerHTML = `<div class="empty-state"><div><strong>The Bridge is quiet.</strong><br />Waiting for the first verified live message.</div></div>`;
    return;
  }
  feed.innerHTML = entries.map(entry => `
    <article class="feed-item ${entry.type === "checkpoint" ? "checkpoint" : "message"}">
      <div class="feed-meta"><strong>${escapeHtml(entry.sender)}</strong><span>${escapeHtml(displayTime(entry))}</span></div>
      <p>${escapeHtml(entry.text)}</p>
    </article>
  `).join("");
  feed.scrollTop = feed.scrollHeight;
}

async function sendEntry(entry) {
  if (!database || !currentUser) throw new Error("Bridge is not connected yet.");
  await push(ref(database, "bridge/v1/entries"), {
    ...entry,
    uid: currentUser.uid,
    createdAt: Date.now(),
    serverCreatedAt: serverTimestamp()
  });
  lastSync.textContent = `Bridge sync: ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

document.querySelector("#message-form").addEventListener("submit", async event => {
  event.preventDefault();
  const text = document.querySelector("#message-text");
  const button = event.submitter;
  button.disabled = true;
  try {
    await sendEntry({ type: "message", sender: sender.value, text: text.value.trim().slice(0, 700) });
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
  const value = id => document.querySelector(id).value.trim();
  const brain = document.querySelector("#cp-brain").checked ? "YES" : "NO";
  const name = value("#cp-name");
  const checkpoint = `${name.toUpperCase()} | ${value("#cp-role")} | ${value("#cp-task")} | ${value("#cp-status")} | ${value("#cp-last")} | ${value("#cp-blocker")} | ${value("#cp-next")} | BRAIN UPDATED: ${brain}`;
  const button = event.submitter;
  button.disabled = true;
  try {
    await sendEntry({ type: "checkpoint", sender: `${name} — CHECKPOINT`, text: checkpoint.slice(0, 1600) });
  } catch (error) {
    alert(`Checkpoint not sent: ${error.message}`);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#refresh-feed").addEventListener("click", () => location.reload());

async function connectBridge() {
  const config = window.__FIREBASE_CONFIG__;
  if (!config) throw new Error("Firebase runtime configuration is unavailable.");
  const app = initializeApp(config);
  const auth = getAuth(app);
  database = getDatabase(app);

  onAuthStateChanged(auth, async user => {
    if (!user) return;
    currentUser = user;
    const presenceRef = ref(database, `bridge/v1/presence/${user.uid}`);
    await onDisconnect(presenceRef).remove();
    await set(presenceRef, { online: true, connectedAt: serverTimestamp() });
    setConnection("BRIDGE CONNECTED", "Realtime backend authenticated", true);

    if (realtimeStarted) return;
    realtimeStarted = true;

    const connectedRef = ref(database, ".info/connected");
    onValue(connectedRef, snapshot => {
      if (snapshot.val()) {
        setConnection("BRIDGE CONNECTED", "Realtime backend authenticated", true);
      } else {
        setConnection("RECONNECTING", "Waiting for Firebase…", false);
      }
    });

    const presenceQuery = ref(database, "bridge/v1/presence");
    onValue(presenceQuery, snapshot => {
      const active = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
      document.querySelector("#active-count").textContent = `${active} active`;
    });

    const feedQuery = query(ref(database, "bridge/v1/entries"), limitToLast(100));
    onChildAdded(feedQuery, snapshot => {
      entries.push({ id: snapshot.key, ...snapshot.val() });
      if (entries.length > 100) entries.shift();
      render();
      lastSync.textContent = `Bridge sync: ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    });
  });

  await signInAnonymously(auth);
}

render();
loadBrain();
connectBridge().catch(error => {
  console.error(error);
  setConnection("BACKEND BLOCKED", error.message, false);
});
