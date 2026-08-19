const CONFIG = window.__MOONSHADOW_FACTORY_CONFIG__ ?? {};
const ANALYSIS_ENDPOINT = String(CONFIG.analysisEndpoint ?? "").trim();
const PUBLISH_ENDPOINTS = {
  youtube: String(CONFIG.publishEndpoints?.youtube ?? "").trim(),
  tiktok: String(CONFIG.publishEndpoints?.tiktok ?? "").trim()
};

const STAGES = ["INBOX", "ANALYZED", "EDITING", "REVIEW", "READY", "PUBLISHED"];
const CHANNELS = ["youtube-long", "youtube-short", "tiktok", "vertical-social"];
const DB_NAME = "moonshadow-content-factory";
const DB_VERSION = 1;

const $ = selector => document.querySelector(selector);

const els = {
  factoryStage: $("#factory-stage"),
  factoryStageDetail: $("#factory-stage-detail"),
  factoryDot: $("#factory-dot"),
  sourcePreserved: $("#source-preserved"),
  preservationStatus: $("#preservation-status"),
  masterStatus: $("#master-status"),
  derivativeStatus: $("#derivative-status"),
  queueCount: $("#queue-count"),
  queueList: $("#queue-list"),
  providerStatus: $("#provider-status"),
  currentStage: $("#current-stage"),
  approvalStatus: $("#approval-status"),
  publishStatus: $("#publish-status"),
  analysisCard: $("#analysis-card"),
  versionCount: $("#version-count"),
  versionSelect: $("#version-select"),
  compareSelect: $("#compare-select"),
  compareResult: $("#compare-result"),
  previewVideo: $("#preview-video"),
  previewOverlay: $("#preview-overlay"),
  exportStatus: $("#export-status"),
  youtubeStatus: $("#youtube-status"),
  tiktokStatus: $("#tiktok-status"),
  analyticsStatus: $("#analytics-status"),
  blockedList: $("#blocked-list"),
  proofCard: $("#proof-card"),
  analyticsList: $("#analytics-list"),
  intakeForm: $("#intake-form"),
  projectName: $("#project-name"),
  sourceFiles: $("#source-files"),
  sourceNotes: $("#source-notes"),
  sourceCloud: $("#source-cloud"),
  resetFactory: $("#reset-factory"),
  analyzeProject: $("#analyze-project"),
  generateDerivatives: $("#generate-derivatives"),
  applyPlan: $("#apply-plan"),
  splitClip: $("#split-clip"),
  trimClip: $("#trim-clip"),
  moveClip: $("#move-clip"),
  reframeClip: $("#reframe-clip"),
  addCaption: $("#add-caption"),
  addAudio: $("#add-audio"),
  duckAudio: $("#duck-audio"),
  addOverlay: $("#add-overlay"),
  previewRange: $("#preview-range"),
  undoEdit: $("#undo-edit"),
  exportPackage: $("#export-package"),
  renderWebm: $("#render-webm"),
  publishYoutube: $("#publish-youtube"),
  publishTiktok: $("#publish-tiktok"),
  approvePaid: $("#approve-paid"),
  approveEdit: $("#approve-edit"),
  approveExport: $("#approve-export"),
  approvePublish: $("#approve-publish"),
  clipId: $("#clip-id"),
  clipStart: $("#clip-start"),
  clipEnd: $("#clip-end"),
  moveFrom: $("#move-from"),
  moveTo: $("#move-to"),
  cropValues: $("#crop-values"),
  captionText: $("#caption-text"),
  audioAsset: $("#audio-asset"),
  overlayAsset: $("#overlay-asset"),
  previewStart: $("#preview-start"),
  previewEnd: $("#preview-end")
};

const appState = {
  projects: [],
  selectedProjectId: null,
  selectedVersionId: null,
  objectUrls: new Map(),
  assetsById: new Map(),
  brain: null,
  analytics: []
};

function id(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function toLocalDateTime(value) {
  return new Date(value).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

function humanBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
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

async function digest(buffer) {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function clone(value) {
  return structuredClone(value);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets", { keyPath: "id" });
      if (!db.objectStoreNames.contains("analytics")) db.createObjectStore("analytics", { keyPath: "id" });
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function withDb(mode, stores, callback) {
  const db = await openDatabase();
  const tx = db.transaction(stores, mode);
  const result = await callback(tx);
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  return result;
}

async function getAll(storeName) {
  return withDb("readonly", [storeName], tx => new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  }));
}

async function getByKey(storeName, key) {
  return withDb("readonly", [storeName], tx => new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  }));
}

async function putRecord(storeName, value) {
  return withDb("readwrite", [storeName], tx => new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).put(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

async function deleteAllData() {
  const db = await openDatabase();
  const storeNames = [...db.objectStoreNames];
  await Promise.all(storeNames.map(storeName => withDb("readwrite", [storeName], tx => new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }))));
  db.close();
  appState.objectUrls.forEach(url => URL.revokeObjectURL(url));
  appState.objectUrls.clear();
  appState.projects = [];
  appState.selectedProjectId = null;
  appState.selectedVersionId = null;
  appState.analytics = [];
}

async function saveSetting(key, value) {
  await putRecord("settings", { key, value });
}

async function loadSetting(key) {
  const record = await getByKey("settings", key);
  return record?.value ?? null;
}

async function saveAsset(asset) {
  await putRecord("assets", asset);
}

async function loadAsset(assetId) {
  return getByKey("assets", assetId);
}

async function saveProject(project) {
  project.updatedAt = now();
  await putRecord("projects", project);
}

async function saveAnalytics(record) {
  await putRecord("analytics", record);
}

async function loadBrain() {
  try {
    const response = await fetch("brain/current.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Brain unavailable");
    appState.brain = await response.json();
  } catch {
    appState.brain = null;
  }
}

async function readMediaMetadata(file, kind) {
  if (kind === "photo") {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }
  return {};
}

async function fileToAsset(projectId, file, kind = inferKind(file.type)) {
  const buffer = await file.arrayBuffer();
  const sha256 = await digest(buffer);
  const metadata = await readMediaMetadata(file, kind);
  return {
    id: id("asset"),
    projectId,
    kind,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    sha256,
    blob: file,
    metadata,
    createdAt: now()
  };
}

function inferKind(mimeType = "") {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
}

function cloudAsset(projectId, url) {
  return {
    id: id("asset"),
    projectId,
    kind: "cloud",
    name: url,
    mimeType: "text/uri-list",
    size: url.length,
    sha256: "",
    sourceUrl: url,
    metadata: {},
    createdAt: now()
  };
}

function noteAsset(projectId, text) {
  return {
    id: id("asset"),
    projectId,
    kind: "notes",
    name: "Notes",
    mimeType: "text/plain",
    size: text.length,
    sha256: "",
    text,
    metadata: {},
    createdAt: now()
  };
}

function emptyTimeline(frame = { width: 1920, height: 1080 }) {
  return { frame, clips: [], captions: [], audio: [], overlays: [], preview: { start: 0, end: 15 } };
}

function createMasterVersion(project, sourceAsset) {
  const duration = sourceAsset?.metadata?.duration || 0;
  const landscape = (sourceAsset?.metadata?.width ?? 0) >= (sourceAsset?.metadata?.height ?? 0);
  const frame = landscape ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
  const timeline = emptyTimeline(frame);
  timeline.clips = sourceAsset ? [{
    id: id("clip"),
    sourceAssetId: sourceAsset.id,
    start: 0,
    end: duration || 0,
    order: 0,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    transform: { scale: 1, x: 0, y: 0 }
  }] : [];
  timeline.preview = { start: 0, end: Math.min(15, duration || 15) };
  const version = {
    id: id("version"),
    label: "master",
    kind: "master",
    parentVersionId: null,
    targetChannels: [...project.targetChannels],
    createdAt: now(),
    updatedAt: now(),
    status: "draft",
    approval: "pending",
    history: [],
    timeline,
    editLog: [],
    export: { status: "not-exported" },
    publish: {}
  };
  return version;
}

function duplicateVersion(base, label, kind, targetChannels = []) {
  return {
    id: id("version"),
    label,
    kind,
    parentVersionId: base.id,
    targetChannels,
    createdAt: now(),
    updatedAt: now(),
    status: "draft",
    approval: "pending",
    history: [],
    timeline: clone(base.timeline),
    editLog: [],
    export: { status: "not-exported" },
    publish: {}
  };
}

function versionLookup(project, versionId) {
  return project.versions.find(version => version.id === versionId) ?? null;
}

function pushHistory(version) {
  version.history.push(clone({
    timeline: version.timeline,
    editLog: version.editLog,
    status: version.status,
    approval: version.approval
  }));
}

function applyAction(version, action) {
  if (action.type === "undo") {
    const previous = version.history.pop();
    if (previous) {
      version.timeline = previous.timeline;
      version.editLog = previous.editLog;
      version.status = previous.status;
      version.approval = previous.approval;
      version.updatedAt = now();
    }
    return version;
  }

  pushHistory(version);
  switch (action.type) {
    case "split": {
      const clipIndex = version.timeline.clips.findIndex(clip => clip.id === action.clipId);
      if (clipIndex < 0) break;
      const clip = version.timeline.clips[clipIndex];
      const splitAt = Math.min(Math.max(action.at, clip.start), clip.end);
      const left = { ...clip, id: id("clip"), end: splitAt };
      const right = { ...clip, id: id("clip"), start: splitAt };
      version.timeline.clips.splice(clipIndex, 1, left, right);
      version.editLog.push(`split ${clip.id} at ${splitAt.toFixed(2)}s`);
      break;
    }
    case "trim": {
      const clip = version.timeline.clips.find(item => item.id === action.clipId);
      if (clip) {
        clip.start = Math.max(0, action.start);
        clip.end = Math.max(clip.start, action.end);
        version.editLog.push(`trim ${clip.id} to ${clip.start.toFixed(2)}–${clip.end.toFixed(2)}`);
      }
      break;
    }
    case "move": {
      const fromIndex = version.timeline.clips.findIndex(clip => clip.id === action.clipId);
      if (fromIndex < 0) break;
      const [clip] = version.timeline.clips.splice(fromIndex, 1);
      const toIndex = Math.max(0, Math.min(action.toIndex, version.timeline.clips.length));
      version.timeline.clips.splice(toIndex, 0, clip);
      version.timeline.clips.forEach((item, index) => { item.order = index; });
      version.editLog.push(`move ${clip.id} to ${toIndex}`);
      break;
    }
    case "reframe": {
      const clip = version.timeline.clips.find(item => item.id === action.clipId);
      if (clip) {
        clip.crop = action.crop;
        clip.transform = action.transform ?? clip.transform;
        version.editLog.push(`reframe ${clip.id}`);
      }
      break;
    }
    case "caption": {
      version.timeline.captions.push({
        id: id("caption"),
        text: action.text,
        start: action.start,
        end: action.end,
        style: action.style ?? { position: "bottom", emphasis: "hook" }
      });
      version.editLog.push(`caption "${action.text}"`);
      break;
    }
    case "audio": {
      version.timeline.audio.push({
        id: id("audio"),
        assetId: action.assetId,
        start: action.start,
        end: action.end,
        gain: action.gain ?? 1,
        duck: action.duck ?? 0.35
      });
      version.editLog.push(`audio ${action.assetId}`);
      break;
    }
    case "duck": {
      const layer = version.timeline.audio.find(item => item.assetId === action.assetId);
      if (layer) {
        layer.duck = action.duck ?? layer.duck;
        layer.gain = action.gain ?? layer.gain;
        version.editLog.push(`duck ${action.assetId}`);
      }
      break;
    }
    case "overlay": {
      version.timeline.overlays.push({
        id: id("overlay"),
        assetId: action.assetId,
        start: action.start,
        end: action.end,
        x: action.x ?? 0.1,
        y: action.y ?? 0.1,
        width: action.width ?? 0.8,
        height: action.height ?? 0.2
      });
      version.editLog.push(`overlay ${action.assetId}`);
      break;
    }
    case "preview": {
      version.timeline.preview = { start: action.start, end: action.end };
      version.editLog.push(`preview ${action.start.toFixed(2)}–${action.end.toFixed(2)}`);
      break;
    }
  }
  version.updatedAt = now();
  return version;
}

function compareVersions(left, right) {
  if (!left || !right) return "Pick two versions to compare.";
  const fields = [
    ["clips", left.timeline.clips.length, right.timeline.clips.length],
    ["captions", left.timeline.captions.length, right.timeline.captions.length],
    ["audio", left.timeline.audio.length, right.timeline.audio.length],
    ["overlays", left.timeline.overlays.length, right.timeline.overlays.length],
    ["frame", `${left.timeline.frame.width}x${left.timeline.frame.height}`, `${right.timeline.frame.width}x${right.timeline.frame.height}`],
    ["approval", left.approval, right.approval],
    ["status", left.status, right.status]
  ];
  return fields.map(([name, a, b]) => `${name}: ${a} → ${b}`).join("\n");
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function heuristicAnalysis(project) {
  const video = project.assets.find(asset => asset.kind === "video");
  const notes = project.assets.filter(asset => asset.kind === "notes").map(asset => asset.text).join("\n").trim();
  const duration = video?.metadata?.duration || 0;
  const shortEnd = duration ? Math.min(Math.max(18, duration * 0.6), 45) : 32;
  return {
    provider: "heuristic",
    title: `${project.name} | Moonshadow Short`,
    description: notes || "Creator-controlled vertical Short derived from the master source.",
    hooks: [
      "Open with the strongest visual or verbal hook.",
      "Cut any dead air immediately after the hook.",
      "Keep the close on a clean CTA or payoff."
    ],
    clipCandidates: [
      { start: 0, end: Math.min(8, shortEnd), reason: "hook" },
      { start: Math.min(8, shortEnd), end: shortEnd, reason: "core story" }
    ],
    editPlan: [
      { type: "preview", start: 0, end: shortEnd },
      { type: "trim", clipId: "clip-1", start: 0, end: shortEnd },
      { type: "reframe", clipId: "clip-1", crop: { x: 0.14, y: 0, width: 0.72, height: 1 }, transform: { scale: 1, x: 0, y: 0 } },
      { type: "caption", text: "Hook the viewer in the first 3 seconds.", start: 0, end: 3 },
      { type: "overlay", assetId: project.assets.find(asset => asset.kind === "photo")?.id ?? "none", start: 0, end: 5 }
    ],
    explanation: `Built from ${project.assets.length} imported assets. Target duration is ${shortEnd.toFixed(1)}s.`,
    sourceDuration: duration,
    shortDuration: shortEnd
  };
}

async function callAnalysisEndpoint(project) {
  if (!ANALYSIS_ENDPOINT) {
    return heuristicAnalysis(project);
  }
  const response = await fetch(ANALYSIS_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project: summarizeProject(project),
      assets: await summarizeAssets(project)
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Analysis failed (${response.status})`);
  return payload;
}

async function summarizeAssets(project) {
  const assets = [];
  for (const assetId of project.assetIds) {
    const asset = await loadAsset(assetId);
    if (!asset) continue;
    assets.push({
      id: asset.id,
      kind: asset.kind,
      name: asset.name,
      size: asset.size,
      mimeType: asset.mimeType,
      duration: asset.metadata?.duration ?? 0,
      width: asset.metadata?.width ?? 0,
      height: asset.metadata?.height ?? 0
    });
  }
  return assets;
}

function summarizeProject(project) {
  return {
    id: project.id,
    name: project.name,
    stage: project.stage,
    targetChannels: project.targetChannels,
    versionCount: project.versions.length,
    sourceHash: project.sourceHash,
    assetIds: [...project.assetIds]
  };
}

function hasApprovalGate(checkbox) {
  return Boolean(checkbox?.checked);
}

function selectedProject() {
  return appState.projects.find(project => project.id === appState.selectedProjectId) ?? null;
}

function selectedVersion(project = selectedProject()) {
  if (!project) return null;
  return versionLookup(project, appState.selectedVersionId ?? project.currentVersionId) ?? project.versions[0] ?? null;
}

function selectedCompareVersion(project = selectedProject()) {
  if (!project) return null;
  return versionLookup(project, els.compareSelect.value) ?? null;
}

function makeProof(project, analysis) {
  const master = project.versions.find(version => version.kind === "master");
  const derivatives = project.versions.filter(version => version.kind !== "master").map(version => version.id);
  return {
    projectId: project.id,
    sourceHash: project.sourceHash,
    sourcePreserved: true,
    stageHistory: [...project.stageHistory],
    masterVersionId: master?.id ?? null,
    derivativeIds: derivatives,
    analysisSummary: analysis?.title ?? "Pending",
    exportStatus: project.exportStatus ?? "waiting",
    publishStatus: project.publishStatus ?? "blocked"
  };
}

function renderPreview(project, version) {
  if (!project || !version) {
    els.previewVideo.removeAttribute("src");
    els.previewOverlay.innerHTML = `<div class="preview-caption">No version selected.</div>`;
    return;
  }
  const clip = version.timeline.clips[0];
  const asset = clip ? appState.assetsById?.get(clip.sourceAssetId) : null;
  if (!asset || asset.kind !== "video" || !asset.blob) {
    els.previewVideo.removeAttribute("src");
    els.previewOverlay.innerHTML = `<div class="preview-caption">Preview requires a video source. Imported media remains preserved in the project record.</div>`;
    return;
  }
  let url = appState.objectUrls.get(asset.id);
  if (!url) {
    url = URL.createObjectURL(asset.blob);
    appState.objectUrls.set(asset.id, url);
  }
  const start = Number(version.timeline.preview?.start ?? clip.start ?? 0);
  const end = Number(version.timeline.preview?.end ?? clip.end ?? 15);
  els.previewVideo.onloadedmetadata = () => {
    els.previewVideo.currentTime = start;
    els.previewOverlay.innerHTML = renderOverlayMarkup(version, start);
  };
  els.previewVideo.src = url;
  els.previewVideo.dataset.start = String(start);
  els.previewVideo.dataset.end = String(end);
}

function renderOverlayMarkup(version, time) {
  const captions = version.timeline.captions.filter(item => time >= item.start && time <= item.end);
  if (!captions.length) return `<div class="preview-caption">Preview range loaded. Select a caption or overlay to show it here.</div>`;
  return captions.map(caption => `<div class="preview-caption">${escapeHtml(caption.text)}</div>`).join("");
}

function renderQueue() {
  els.queueList.innerHTML = appState.projects.length ? appState.projects.map(project => {
    const activeVersion = project.versions.find(version => version.id === project.currentVersionId) ?? project.versions[0];
    const blockers = project.errors.length ? project.errors[project.errors.length - 1] : project.blockers.length ? project.blockers[project.blockers.length - 1] : "None";
    return `
      <article class="queue-item" data-project="${escapeHtml(project.id)}">
        <h3>${escapeHtml(project.name)}</h3>
        <div class="queue-meta">
          <span>${escapeHtml(project.stage)}</span>
          <span>${escapeHtml(activeVersion?.label ?? "n/a")} · v${escapeHtml(String(project.versions.length))}</span>
        </div>
        <div class="tags">
          <span class="tag stage">${escapeHtml(project.stage)}</span>
          <span class="tag approval">${escapeHtml(project.approvalStatus)}</span>
          <span class="tag">${escapeHtml(project.targetChannels.join(", ") || "no target")}</span>
          <span class="tag blocker">${escapeHtml(blockers)}</span>
        </div>
      </article>
    `;
  }).join("") : `<div class="analysis-card empty"><strong>No projects yet.</strong><p>Import media to create the first factory queue item.</p></div>`;
  els.queueCount.textContent = `${appState.projects.length} project${appState.projects.length === 1 ? "" : "s"}`;
}

function renderVersionControls(project) {
  const versions = project?.versions ?? [];
  els.versionSelect.innerHTML = versions.map(version => `<option value="${escapeHtml(version.id)}">${escapeHtml(version.label)} · ${escapeHtml(version.kind)}</option>`).join("");
  els.compareSelect.innerHTML = versions.map(version => `<option value="${escapeHtml(version.id)}">${escapeHtml(version.label)} · ${escapeHtml(version.kind)}</option>`).join("");
  els.versionCount.textContent = `${versions.length} version${versions.length === 1 ? "" : "s"}`;
  if (project) {
    els.versionSelect.value = appState.selectedVersionId && versions.some(version => version.id === appState.selectedVersionId)
      ? appState.selectedVersionId
      : project.currentVersionId;
    const compareTarget = versions.find(version => version.id !== els.versionSelect.value) ?? versions[0];
    if (compareTarget) els.compareSelect.value = compareTarget.id;
  }
}

function renderAnalysisCard(project, analysis) {
  if (!project) {
    els.analysisCard.className = "analysis-card empty";
    els.analysisCard.innerHTML = `<strong>Waiting for analysis.</strong><p>Import a source and ask Producer to analyze it.</p>`;
    return;
  }
  if (!analysis) {
    els.analysisCard.className = "analysis-card empty";
    els.analysisCard.innerHTML = `<strong>Analysis not run.</strong><p>Run Producer analysis to generate a hook, title, description, and edit plan.</p>`;
    return;
  }
  els.analysisCard.className = "analysis-card";
  els.analysisCard.innerHTML = `
    <strong>${escapeHtml(analysis.title ?? "Analysis")}</strong>
    <p>${escapeHtml(analysis.description ?? "")}</p>
    <ul>
      ${(analysis.hooks ?? []).map(hook => `<li>${escapeHtml(hook)}</li>`).join("")}
    </ul>
    <p><strong>Plan:</strong> ${escapeHtml(analysis.explanation ?? "No explanation supplied.")}</p>
    <p><strong>Short duration:</strong> ${escapeHtml(String(analysis.shortDuration ?? ""))}s</p>
  `;
}

function renderCompare(project, version) {
  const compare = selectedCompareVersion(project);
  if (!version || !compare) {
    els.compareResult.className = "compare-result empty";
    els.compareResult.innerHTML = "No comparison loaded.";
    return;
  }
  els.compareResult.className = "compare-result";
  els.compareResult.innerHTML = `<pre>${escapeHtml(compareVersions(version, compare))}</pre>`;
}

function renderStatuses(project) {
  if (!project) {
    els.factoryStage.textContent = "INBOX";
    els.factoryStageDetail.textContent = "Waiting for a project import.";
    els.factoryDot.classList.add("offline");
    els.sourcePreserved.textContent = "No source yet";
    els.preservationStatus.textContent = "Waiting";
    els.masterStatus.textContent = "None";
    els.derivativeStatus.textContent = "0";
    els.currentStage.textContent = "INBOX";
    els.approvalStatus.textContent = "Pending";
    els.publishStatus.textContent = "Blocked";
    els.exportStatus.textContent = "Waiting";
    els.youtubeStatus.textContent = PUBLISH_ENDPOINTS.youtube ? "Ready" : "Disconnected";
    els.tiktokStatus.textContent = PUBLISH_ENDPOINTS.tiktok ? "Ready" : "Disconnected";
    els.analyticsStatus.textContent = "Empty";
    els.providerStatus.textContent = ANALYSIS_ENDPOINT ? "Provider connected" : "Provider not configured";
    return;
  }
  const version = selectedVersion(project);
  els.factoryStage.textContent = project.stage;
  els.factoryStageDetail.textContent = `${project.name} · ${project.targetChannels.join(", ") || "no target"}`;
  els.factoryDot.classList.toggle("offline", project.stage === "INBOX");
  els.sourcePreserved.textContent = project.sourceHash ? "Immutable source stored" : "Missing";
  els.preservationStatus.textContent = project.sourceHash ? "Verified" : "Missing";
  els.masterStatus.textContent = project.currentVersionId ? "Linked" : "Missing";
  els.derivativeStatus.textContent = String(project.versions.filter(item => item.kind !== "master").length);
  els.currentStage.textContent = project.stage;
  els.approvalStatus.textContent = project.approvalStatus;
  els.publishStatus.textContent = project.publishStatus ?? "Blocked";
  els.exportStatus.textContent = project.exportStatus ?? "Waiting";
  els.youtubeStatus.textContent = project.publish?.youtube?.status ?? (PUBLISH_ENDPOINTS.youtube ? "Ready" : "Disconnected");
  els.tiktokStatus.textContent = project.publish?.tiktok?.status ?? (PUBLISH_ENDPOINTS.tiktok ? "Ready" : "Disconnected");
  els.analyticsStatus.textContent = project.analytics?.length ? `${project.analytics.length} records` : "Empty";
  els.providerStatus.textContent = ANALYSIS_ENDPOINT ? "Provider connected" : "Provider not configured";
  if (version) {
    const clip = version.timeline.clips[0];
    const duration = clip ? `${clip.start.toFixed(1)}–${clip.end.toFixed(1)}s` : "No clip";
    els.factoryStageDetail.textContent = `${project.name} · ${project.targetChannels.join(", ") || "no target"} · ${duration}`;
  }
}

function renderBlockedList(project) {
  if (!project) {
    els.blockedList.innerHTML = `<strong>Known blockers</strong><p>Missing publish endpoint or approval gate.</p>`;
    return;
  }
  const blockers = [
    ...new Set([
      ...(project.blockers ?? []),
      ...(project.errors ?? []),
      ANALYSIS_ENDPOINT && !hasApprovalGate(els.approvePaid) ? "Paid generation or external model calls not approved" : null,
      PUBLISH_ENDPOINTS.youtube || hasApprovalGate(els.approvePublish) ? null : "YouTube connector not configured",
      PUBLISH_ENDPOINTS.tiktok || hasApprovalGate(els.approvePublish) ? null : "TikTok connector not configured"
    ].filter(Boolean))
  ];
  els.blockedList.innerHTML = blockers.length
    ? `<strong>Known blockers</strong><ul>${blockers.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<strong>Known blockers</strong><p>None. The selected project is clear to move forward.</p>`;
}

function renderProof(project, analysis) {
  if (!project) {
    els.proofCard.className = "analysis-card empty";
    els.proofCard.innerHTML = `<strong>Proof record</strong><p>No project imported yet.</p>`;
    return;
  }
  const proof = makeProof(project, analysis);
  els.proofCard.className = "analysis-card";
  els.proofCard.innerHTML = `
    <strong>Proof record</strong>
    <p>Project ${escapeHtml(project.name)} — stage ${escapeHtml(project.stage)} — source preserved: ${proof.sourcePreserved ? "yes" : "no"}.</p>
    <ul>
      <li>Source hash: ${escapeHtml(proof.sourceHash || "n/a")}</li>
      <li>Master version: ${escapeHtml(proof.masterVersionId || "n/a")}</li>
      <li>Derivatives: ${escapeHtml(String(proof.derivativeIds.length))}</li>
      <li>Export: ${escapeHtml(proof.exportStatus)}</li>
      <li>Publish: ${escapeHtml(proof.publishStatus)}</li>
    </ul>
  `;
}

function renderAnalytics(project) {
  const records = project?.analytics ?? [];
  els.analyticsList.innerHTML = records.length
    ? records.slice(-6).reverse().map(record => `
        <article class="analytics-row">
          <strong>${escapeHtml(record.platform)} · ${escapeHtml(record.status)}</strong>
          <div>${escapeHtml(toLocalDateTime(record.createdAt))}</div>
          <div>${escapeHtml(record.title ?? "")}</div>
          <div>${escapeHtml(record.url ?? record.resultId ?? "no result yet")}</div>
        </article>
      `).join("")
    : `<div class="analysis-card empty"><strong>No analytics yet.</strong><p>Publish or export to add a result record.</p></div>`;
}

async function persistCurrentProject(project) {
  await saveProject(project);
  if (!appState.projects.some(item => item.id === project.id)) {
    appState.projects.unshift(project);
  } else {
    appState.projects = appState.projects.map(item => item.id === project.id ? project : item);
  }
  appState.selectedProjectId = project.id;
  appState.selectedVersionId = project.currentVersionId;
  await saveSetting("selectedProjectId", project.id);
  await saveSetting("selectedVersionId", project.currentVersionId);
}

async function loadProjects() {
  const projects = await getAll("projects");
  const assets = await getAll("assets");
  appState.assetsById = new Map(assets.map(asset => [asset.id, asset]));
  appState.projects = projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  appState.analytics = await getAll("analytics");
  appState.selectedProjectId = await loadSetting("selectedProjectId");
  appState.selectedVersionId = await loadSetting("selectedVersionId");
  if (appState.selectedProjectId && !appState.projects.some(project => project.id === appState.selectedProjectId)) {
    appState.selectedProjectId = appState.projects[0]?.id ?? null;
  }
}

function renderAll() {
  const project = selectedProject();
  const version = selectedVersion(project);
  const analysis = project?.analysis ?? null;
  renderStatuses(project);
  renderQueue();
  renderVersionControls(project);
  renderAnalysisCard(project, analysis);
  renderCompare(project, version);
  renderProof(project, analysis);
  renderAnalytics(project);
  renderPreview(project, version);
  renderBlockedList(project);
}

function selectedChannelTargets() {
  return [...document.querySelectorAll(".channels input[type='checkbox']")].filter(input => input.checked).map(input => input.value);
}

async function handleImport(event) {
  event.preventDefault();
  const files = [...els.sourceFiles.files];
  const notes = els.sourceNotes.value.trim();
  const cloudUrls = els.sourceCloud.value.split("\n").map(line => line.trim()).filter(Boolean);
  const name = els.projectName.value.trim() || `Project ${new Date().toLocaleDateString()}`;
  const project = {
    id: id("project"),
    name,
    createdAt: now(),
    updatedAt: now(),
    stage: "INBOX",
    stageHistory: ["INBOX"],
    approvalStatus: "pending",
    publishStatus: "blocked",
    exportStatus: "waiting",
    blockers: [],
    errors: [],
    targetChannels: selectedChannelTargets(),
    assetIds: [],
    versions: [],
    currentVersionId: null,
    sourceHash: "",
    analysis: null,
    publish: {},
    analytics: []
  };

  const importedAssets = [];
  for (const file of files) {
    const asset = await fileToAsset(project.id, file);
    importedAssets.push(asset);
  }
  if (notes) importedAssets.push(noteAsset(project.id, notes));
  cloudUrls.forEach(url => importedAssets.push(cloudAsset(project.id, url)));

  const sourceVideo = importedAssets.find(asset => asset.kind === "video") ?? null;
  const sourceHashInput = importedAssets.map(asset => asset.sha256 || asset.sourceUrl || asset.text || asset.id).join("|");
  project.sourceHash = sourceHashInput ? await digest(new TextEncoder().encode(sourceHashInput)) : "";
  project.assetIds = importedAssets.map(asset => asset.id);

  for (const asset of importedAssets) {
    await saveAsset(asset);
  }

  const master = createMasterVersion(project, sourceVideo);
  project.versions.push(master);
  project.currentVersionId = master.id;
  project.masterVersionId = master.id;
  project.stage = "INBOX";
  project.sourceSummary = importedAssets.map(asset => `${asset.kind}:${asset.name}`).join(", ");
  project.blockers = sourceVideo ? [] : ["No local video source selected yet"];
  await persistCurrentProject(project);
  renderAll();
}

async function ensureSelectedProject() {
  const project = selectedProject();
  if (!project) throw new Error("Import a project first.");
  return project;
}

async function analyzeSelectedProject() {
  const project = await ensureSelectedProject();
  if (ANALYSIS_ENDPOINT && !hasApprovalGate(els.approvePaid)) {
    project.blockers = ["Paid generation or external model calls need approval."];
    project.errors.push("Paid generation blocked by human gate");
    project.publishStatus = "blocked";
    await persistCurrentProject(project);
    renderAll();
    return;
  }
  const analysis = await callAnalysisEndpoint(project);
  project.analysis = analysis;
  project.stage = "ANALYZED";
  project.stageHistory.push("ANALYZED");
  project.blockers = [];
  project.errors = [];
  const master = project.versions.find(version => version.kind === "master") ?? project.versions[0];
  if (master) {
    master.status = "draft";
    master.editLog.push("Producer analysis completed");
  }
  await persistCurrentProject(project);
  await maybeRecordAnalytics(project, "analysis", analysis);
  renderAll();
}

async function generateDerivativeVersions() {
  const project = await ensureSelectedProject();
  const master = project.versions.find(version => version.kind === "master");
  if (!master) return;
  const existingKinds = new Set(project.versions.map(version => version.kind));
  const specs = [
    ["youtube-long", "YouTube Long-form", ["youtube-long"]],
    ["youtube-short", "YouTube Short", ["youtube-short"]],
    ["tiktok", "TikTok Vertical", ["tiktok"]],
    ["vertical-social", "Vertical Social", ["vertical-social"]]
  ];
  for (const [kind, label, targetChannels] of specs) {
    if (existingKinds.has(kind)) continue;
    project.versions.push(duplicateVersion(master, label, kind, targetChannels));
  }
  project.stage = "ANALYZED";
  project.stageHistory.push("ANALYZED");
  project.currentVersionId = project.versions.find(version => version.kind === "youtube-short")?.id ?? master.id;
  project.blockers = [];
  await persistCurrentProject(project);
  renderAll();
}

async function applyPlan() {
  const project = await ensureSelectedProject();
  const analysis = project.analysis ?? await callAnalysisEndpoint(project);
  const version = selectedVersion(project) ?? project.versions.find(item => item.kind === "youtube-short") ?? project.versions[0];
  if (!version) return;
  if (!analysis?.editPlan?.length) {
    project.blockers = ["No edit plan available yet."];
    await persistCurrentProject(project);
    renderAll();
    return;
  }
  for (const action of analysis.editPlan) {
    const normalized = { ...action };
    if (normalized.clipId === "clip-1" || !normalized.clipId) {
      normalized.clipId = version.timeline.clips[0]?.id ?? normalized.clipId;
    }
    if (normalized.assetId === "none") {
      delete normalized.assetId;
    }
    applyAction(version, normalized);
  }
  version.status = "editing";
  project.stage = "EDITING";
  project.stageHistory.push("EDITING");
  project.currentVersionId = version.id;
  project.approvalStatus = "pending";
  await persistCurrentProject(project);
  renderAll();
}

async function approveEditVersion() {
  const project = await ensureSelectedProject();
  if (!hasApprovalGate(els.approveEdit)) {
    project.blockers = ["Approve edit version before accepting this cut."];
    await persistCurrentProject(project);
    renderAll();
    return;
  }
  const version = selectedVersion(project);
  if (!version) return;
  version.approval = "approved";
  version.status = "review";
  project.approvalStatus = "approved";
  project.stage = "REVIEW";
  project.stageHistory.push("REVIEW");
  await persistCurrentProject(project);
  renderAll();
}

async function previewSelectedRange() {
  const project = await ensureSelectedProject();
  const version = selectedVersion(project);
  if (!version) return;
  const start = Number(els.previewStart.value || version.timeline.preview?.start || 0);
  const end = Number(els.previewEnd.value || version.timeline.preview?.end || start + 15);
  applyAction(version, { type: "preview", start, end });
  project.stage = "REVIEW";
  await persistCurrentProject(project);
  renderPreview(project, version);
  renderAll();
}

async function splitClip() {
  const project = await ensureSelectedProject();
  const version = selectedVersion(project);
  if (!version) return;
  const clipId = els.clipId.value.trim() || version.timeline.clips[0]?.id;
  const at = Number(els.clipStart.value || 0);
  applyAction(version, { type: "split", clipId, at });
  project.stage = "EDITING";
  await persistCurrentProject(project);
  renderAll();
}

async function trimClip() {
  const project = await ensureSelectedProject();
  const version = selectedVersion(project);
  if (!version) return;
  const clipId = els.clipId.value.trim() || version.timeline.clips[0]?.id;
  const start = Number(els.clipStart.value || 0);
  const end = Number(els.clipEnd.value || start + 1);
  applyAction(version, { type: "trim", clipId, start, end });
  project.stage = "EDITING";
  await persistCurrentProject(project);
  renderAll();
}

async function moveClip() {
  const project = await ensureSelectedProject();
  const version = selectedVersion(project);
  if (!version) return;
  const clipId = els.clipId.value.trim() || version.timeline.clips[0]?.id;
  applyAction(version, { type: "move", clipId, fromIndex: Number(els.moveFrom.value || 0), toIndex: Number(els.moveTo.value || 0) });
  project.stage = "EDITING";
  await persistCurrentProject(project);
  renderAll();
}

async function reframeClip() {
  const project = await ensureSelectedProject();
  const version = selectedVersion(project);
  if (!version) return;
  const clipId = els.clipId.value.trim() || version.timeline.clips[0]?.id;
  const crop = parseCrop(els.cropValues.value.trim());
  applyAction(version, { type: "reframe", clipId, crop });
  project.stage = "EDITING";
  await persistCurrentProject(project);
  renderAll();
}

function parseCrop(value) {
  if (!value) return { x: 0.14, y: 0, width: 0.72, height: 1 };
  const parts = value.split(",").map(item => item.trim());
  if (parts.length === 4) {
    const [x, y, width, height] = parts.map(Number);
    if (parts.every(item => !Number.isNaN(Number(item)))) {
      return { x, y, width, height };
    }
  }
  return { x: 0.14, y: 0, width: 0.72, height: 1 };
}

async function addCaption() {
  const project = await ensureSelectedProject();
  const version = selectedVersion(project);
  if (!version) return;
  const text = els.captionText.value.trim() || "Hook the viewer in the first 3 seconds.";
  applyAction(version, { type: "caption", text, start: 0, end: Math.min(3, Number(els.previewEnd.value || 3)) });
  project.stage = "EDITING";
  await persistCurrentProject(project);
  renderAll();
}

async function addAudio() {
  const project = await ensureSelectedProject();
  const version = selectedVersion(project);
  if (!version) return;
  const assetId = els.audioAsset.value.trim() || project.assetIds.find(assetId => appState.assetsById.get(assetId)?.kind === "audio");
  if (!assetId) {
    project.blockers = ["Import an audio asset before adding audio."];
    await persistCurrentProject(project);
    renderAll();
    return;
  }
  applyAction(version, { type: "audio", assetId, start: 0, end: Number(els.previewEnd.value || 15), gain: 1 });
  project.stage = "EDITING";
  await persistCurrentProject(project);
  renderAll();
}

async function duckAudio() {
  const project = await ensureSelectedProject();
  const version = selectedVersion(project);
  if (!version) return;
  const assetId = els.audioAsset.value.trim() || project.assetIds.find(assetId => appState.assetsById.get(assetId)?.kind === "audio");
  if (!assetId) return;
  applyAction(version, { type: "duck", assetId, gain: 0.65, duck: 0.35 });
  project.stage = "EDITING";
  await persistCurrentProject(project);
  renderAll();
}

async function addOverlay() {
  const project = await ensureSelectedProject();
  const version = selectedVersion(project);
  if (!version) return;
  const assetId = els.overlayAsset.value.trim() || project.assetIds.find(assetId => appState.assetsById.get(assetId)?.kind === "photo");
  if (!assetId) return;
  applyAction(version, { type: "overlay", assetId, start: 0, end: Number(els.previewEnd.value || 15), x: 0.12, y: 0.08, width: 0.76, height: 0.2 });
  project.stage = "EDITING";
  await persistCurrentProject(project);
  renderAll();
}

async function undoEdit() {
  const project = await ensureSelectedProject();
  const version = selectedVersion(project);
  if (!version) return;
  applyAction(version, { type: "undo" });
  await persistCurrentProject(project);
  renderAll();
}

async function exportPackage() {
  const project = await ensureSelectedProject();
  const version = selectedVersion(project);
  if (!version) return;
  if (!hasApprovalGate(els.approveExport)) {
    project.blockers = ["Approve final export before exporting."];
    await persistCurrentProject(project);
    renderAll();
    return;
  }
  const payload = {
    project: summarizeProject(project),
    analysis: project.analysis,
    version,
    sourcePreserved: true,
    exportedAt: now()
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${slugify(project.name)}-${slugify(version.label)}-package.json`);
  project.exportStatus = "exported";
  version.export = { status: "exported", exportedAt: now(), format: "json-package" };
  project.stage = "READY";
  project.stageHistory.push("READY");
  await maybeRecordAnalytics(project, "export", payload);
  await persistCurrentProject(project);
  renderAll();
}

async function renderWebm() {
  const project = await ensureSelectedProject();
  const version = selectedVersion(project);
  if (!version) return;
  const videoAsset = project.assetIds.map(assetId => appState.assetsById.get(assetId)).find(asset => asset?.kind === "video" && asset.blob);
  if (!videoAsset) {
    project.blockers = ["No video source available for browser render."];
    await persistCurrentProject(project);
    renderAll();
    return;
  }
  try {
    const blob = await renderPreviewWebm(project, version, videoAsset);
    downloadBlob(blob, `${slugify(project.name)}-${slugify(version.label)}.webm`);
    project.exportStatus = "rendered";
    version.export = { status: "rendered", exportedAt: now(), format: "webm" };
    project.stage = "READY";
    project.stageHistory.push("READY");
    await maybeRecordAnalytics(project, "export", { format: "webm", resultId: blob.size });
    await persistCurrentProject(project);
  } catch (error) {
    project.errors.push(String(error.message || error));
    await persistCurrentProject(project);
  }
  renderAll();
}

async function renderPreviewWebm(project, version, videoAsset) {
  const url = appState.objectUrls.get(videoAsset.id) ?? (() => {
    const objectUrl = URL.createObjectURL(videoAsset.blob);
    appState.objectUrls.set(videoAsset.id, objectUrl);
    return objectUrl;
  })();
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = reject;
  });
  const width = version.timeline.frame.width;
  const height = version.timeline.frame.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const start = version.timeline.preview?.start ?? 0;
  const end = version.timeline.preview?.end ?? Math.min(video.duration || 15, start + 15);
  const canvasStream = canvas.captureStream(30);
  const sourceStream = typeof video.captureStream === "function" ? video.captureStream() : null;
  const combined = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(sourceStream?.getAudioTracks() ?? [])
  ]);
  const recorder = new MediaRecorder(combined, { mimeType: chooseMimeType() });
  const chunks = [];
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  const done = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    recorder.onerror = () => reject(recorder.error ?? new Error("Recorder failed"));
  });
  function draw() {
    drawFrame(context, video, version, width, height);
    els.previewOverlay.innerHTML = renderOverlayMarkup(version, video.currentTime);
  }
  video.currentTime = start;
  await video.play();
  await new Promise(resolve => {
    const tick = () => {
      if (video.currentTime >= end || video.ended) {
        recorder.stop();
        resolve();
        return;
      }
      draw();
      requestAnimationFrame(tick);
    };
    recorder.start();
    requestAnimationFrame(tick);
  });
  return done;
}

function chooseMimeType() {
  const choices = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  return choices.find(mimeType => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function drawFrame(context, video, version, width, height) {
  if (!context) return;
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  const crop = version.timeline.clips[0]?.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const sx = video.videoWidth * crop.x;
  const sy = video.videoHeight * crop.y;
  const sw = video.videoWidth * crop.width;
  const sh = video.videoHeight * crop.height;
  context.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
  const activeCaptions = version.timeline.captions.filter(caption => video.currentTime >= caption.start && video.currentTime <= caption.end);
  if (activeCaptions.length) {
    context.fillStyle = "rgba(0,0,0,0.55)";
    context.fillRect(40, height - 240, width - 80, 180);
    context.fillStyle = "#fff";
    context.font = "bold 42px Inter, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    activeCaptions.forEach((caption, index) => {
      context.fillText(caption.text, width / 2, height - 180 + index * 48, width - 120);
    });
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function publish(platform) {
  const project = await ensureSelectedProject();
  const version = selectedVersion(project);
  if (!version) return;
  if (!hasApprovalGate(els.approvePublish)) {
    project.blockers = ["Approve publishing/posting before calling a connector."];
    await persistCurrentProject(project);
    renderAll();
    return;
  }
  const endpoint = PUBLISH_ENDPOINTS[platform];
  const connectorRecord = {
    platform,
    createdAt: now(),
    status: "blocked",
    title: project.analysis?.title ?? `${project.name} Short`,
    description: project.analysis?.description ?? "",
    versionId: version.id,
    sourceProjectId: project.id
  };
  if (!endpoint) {
    connectorRecord.blocker = `${platform} endpoint not configured`;
    project.publishStatus = "blocked";
    project.publish[platform] = connectorRecord;
    project.errors.push(connectorRecord.blocker);
    await maybeRecordAnalytics(project, platform, connectorRecord);
    await persistCurrentProject(project);
    renderAll();
    return;
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project: summarizeProject(project),
      version,
      analysis: project.analysis,
      title: project.analysis?.title ?? `${project.name} Short`,
      description: project.analysis?.description ?? "",
      platform
    })
  });
  const payload = await response.json().catch(() => ({}));
  connectorRecord.status = response.ok ? payload.status ?? "published" : "blocked";
  connectorRecord.resultId = payload.id ?? payload.resultId ?? "";
  connectorRecord.url = payload.url ?? payload.resultUrl ?? "";
  connectorRecord.metrics = payload.metrics ?? {};
  project.publish[platform] = connectorRecord;
  project.publishStatus = connectorRecord.status;
  if (!response.ok) {
    connectorRecord.blocker = payload.error || `Publish failed (${response.status})`;
    project.errors.push(connectorRecord.blocker);
  } else {
    project.stage = "PUBLISHED";
    project.stageHistory.push("PUBLISHED");
    version.status = "published";
  }
  await maybeRecordAnalytics(project, platform, connectorRecord);
  await persistCurrentProject(project);
  renderAll();
}

async function maybeRecordAnalytics(project, platform, payload) {
  const record = {
    id: id("analytics"),
    platform,
    createdAt: now(),
    sourceProjectId: project.id,
    masterProjectId: project.id,
    derivativeVersionId: project.currentVersionId,
    title: payload?.title ?? project.analysis?.title ?? project.name,
    description: payload?.description ?? project.analysis?.description ?? "",
    thumbnail: payload?.thumbnail ?? "",
    resultId: payload?.resultId ?? payload?.id ?? "",
    url: payload?.url ?? "",
    status: payload?.status ?? (platform === "export" ? "exported" : "recorded"),
    metrics: payload?.metrics ?? {}
  };
  project.analytics.push(record);
  appState.analytics.unshift(record);
  await saveAnalytics(record);
}

function bindPreviewLoop() {
  els.previewVideo.addEventListener("timeupdate", () => {
    const project = selectedProject();
    const version = selectedVersion(project);
    if (!project || !version) return;
    const end = Number(els.previewVideo.dataset.end || version.timeline.preview?.end || 0);
    if (end && els.previewVideo.currentTime >= end) {
      els.previewVideo.currentTime = Number(els.previewVideo.dataset.start || version.timeline.preview?.start || 0);
      els.previewVideo.pause();
    }
    els.previewOverlay.innerHTML = renderOverlayMarkup(version, els.previewVideo.currentTime);
  });
}

function bindProjectSelection() {
  els.queueList.addEventListener("click", event => {
    const row = event.target.closest(".queue-item");
    if (!row) return;
    appState.selectedProjectId = row.dataset.project;
    const project = selectedProject();
    if (project) {
      appState.selectedVersionId = project.currentVersionId;
      saveSetting("selectedProjectId", project.id);
      saveSetting("selectedVersionId", project.currentVersionId);
      renderAll();
    }
  });
}

function bindControls() {
  els.intakeForm.addEventListener("submit", handleImport);
  els.resetFactory.addEventListener("click", async () => {
    if (!confirm("Reset all local factory data?")) return;
    await deleteAllData();
    await loadProjects();
    renderAll();
  });
  els.analyzeProject.addEventListener("click", analyzeSelectedProject);
  els.generateDerivatives.addEventListener("click", generateDerivativeVersions);
  els.applyPlan.addEventListener("click", applyPlan);
  els.splitClip.addEventListener("click", splitClip);
  els.trimClip.addEventListener("click", trimClip);
  els.moveClip.addEventListener("click", moveClip);
  els.reframeClip.addEventListener("click", reframeClip);
  els.addCaption.addEventListener("click", addCaption);
  els.addAudio.addEventListener("click", addAudio);
  els.duckAudio.addEventListener("click", duckAudio);
  els.addOverlay.addEventListener("click", addOverlay);
  els.previewRange.addEventListener("click", previewSelectedRange);
  els.undoEdit.addEventListener("click", undoEdit);
  els.exportPackage.addEventListener("click", exportPackage);
  els.renderWebm.addEventListener("click", renderWebm);
  els.publishYoutube.addEventListener("click", () => publish("youtube"));
  els.publishTiktok.addEventListener("click", () => publish("tiktok"));
  [els.versionSelect, els.compareSelect].forEach(select => {
    select.addEventListener("change", () => {
      const project = selectedProject();
      if (!project) return;
      appState.selectedVersionId = els.versionSelect.value;
      saveSetting("selectedVersionId", appState.selectedVersionId);
      renderAll();
    });
  });
  [els.approvePaid, els.approveEdit, els.approveExport, els.approvePublish].forEach(input => {
    input.addEventListener("change", () => renderAll());
  });
  els.previewVideo.addEventListener("loadedmetadata", () => {
    const project = selectedProject();
    const version = selectedVersion(project);
    if (!project || !version) return;
    els.previewOverlay.innerHTML = renderOverlayMarkup(version, Number(els.previewVideo.dataset.start || 0));
  });
}

async function init() {
  bindControls();
  bindProjectSelection();
  bindPreviewLoop();
  await loadBrain();
  await loadProjects();
  if (!appState.selectedProjectId) {
    appState.selectedProjectId = appState.projects[0]?.id ?? null;
  }
  if (appState.selectedProjectId && !appState.selectedVersionId) {
    const project = selectedProject();
    appState.selectedVersionId = project?.currentVersionId ?? null;
  }
  renderAll();
  if (!ANALYSIS_ENDPOINT) {
    els.factoryStageDetail.textContent = "Local heuristic analysis ready. Add a secure provider endpoint later if needed.";
  }
}

init().catch(error => {
  els.factoryStageDetail.textContent = error.message;
  els.factoryDot.classList.add("offline");
  console.error(error);
});

window.addEventListener("beforeunload", () => {
  appState.objectUrls.forEach(url => URL.revokeObjectURL(url));
  appState.objectUrls.clear();
});
