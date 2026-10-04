const chat = document.getElementById("chat");
const form = document.getElementById("chatForm");
const question = document.getElementById("question");
const trace = document.getElementById("trace");
const sourceUsed = document.getElementById("sourceUsed");
const AUTH_API = `${window.APP_CONFIG?.backendApiUrl || "http://127.0.0.1:3000"}/api`;
let currentUser = null;
let authMode = "login";
let currentConversationId = null;

function authHeaders(extra = {}) {
  const token = localStorage.getItem("nexusiq-token");
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}
function showApp(user) {
  if (currentUser && currentUser.id !== user.id) {
    currentConversationId = null;
    resetChatView();
  }
  currentUser = user;
  document.getElementById("authPage")?.classList.add("hidden");
  document.querySelector(".shell")?.classList.remove("hidden");
  document.getElementById("profile").textContent = (user.name || user.email).slice(0, 2).toUpperCase();
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.classList.toggle("hidden", user.role !== "admin");
  });
  document.querySelector('[data-view="documents"]')?.classList.toggle("hidden", user.role !== "admin");
  loadConversations();
}
function showAuth() {
  document.getElementById("authPage")?.classList.remove("hidden");
  document.querySelector(".shell")?.classList.add("hidden");
}

function escapeHtml(s = "") {
  return s.replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
}
function formatText(s = "") {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^\s*[-*]\s+(.+)$/gm, "• $1")
    .replace(/\n/g, "<br>");
}
function addMessage(role, text, source = "", citations = [], steps = [], evidenceStatus = "") {
  const wrap = document.createElement("div");
  wrap.className = `message ${role}`;
  const stepHtml = steps.length
    ? `<div class="response-section"><strong>Required steps</strong><ol>${steps.map((step) => `<li>${formatText(step)}</li>`).join("")}</ol></div>`
    : "";
  const citeHtml = citations.length
    ? `<div class="citations"><strong>Sources</strong>${citations.map((c) => {
        const label = `${escapeHtml(c.title || "Source")} · ${c.type === "internal" ? "Verified internal source" : "External reference"}`;
        return c.url ? `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${label}</a>` : `<span>${label}</span>`;
      }).join("")}</div>`
    : "";
  const status = evidenceStatus ? `<div class="evidence-status">Evidence status: ${escapeHtml(evidenceStatus.replaceAll("_", " "))}</div>` : "";
  wrap.innerHTML = `<div class="avatar">AI</div><div class="bubble"><div class="response-section">${formatText(text)}</div>${stepHtml}${status}${source ? `<div class="answer-source">Source: ${escapeHtml(source)}</div>` : ""}${citeHtml}</div>`;
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}
function resetChatView() {
  chat.innerHTML = `<div class="message assistant"><div class="avatar">✦</div><div class="bubble"><div class="message-meta"><strong>NexusIQ AI</strong><span>Just now</span></div><strong class="welcome-title">How can I help with IT support?</strong><p>Start a new grounded support request below.</p></div></div>`;
  renderTrace([]);
  sourceUsed.textContent = "—";
  document.getElementById("viewSources")?.classList.add("hidden");
}
function markActiveConversation() {
  document.querySelectorAll(".recent-chat").forEach((chatButton) => {
    chatButton.classList.toggle("active", chatButton.dataset.conversationId === currentConversationId);
  });
}
function renderSavedMessage(message) {
  const metadata = message.metadata || {};
  addMessage(message.role, message.content, metadata.source_used || "", metadata.citations || metadata.sources || [], metadata.steps || [], metadata.evidence_status || "");
}
async function loadConversations(skipAutoOpen = false) {
  try {
    const response = await fetch(`${AUTH_API}/conversations`, { headers: authHeaders() });
    if (!response.ok) throw new Error("Unable to load conversations");
    const data = await response.json();
    const recentChats = document.querySelector(".recent-chats");
    if (!recentChats) return;
    recentChats.innerHTML = `<div class="nav-label">Recent chats</div>`;
    data.conversations.forEach((conversation) => {
      const button = document.createElement("button");
      button.className = "recent-chat";
      button.type = "button";
      button.dataset.conversationId = conversation.id;
      button.setAttribute("aria-current", conversation.id === currentConversationId ? "page" : "false");
      button.innerHTML = `<span>${escapeHtml(conversation.title)}</span><small>${new Date(conversation.updatedAt).toLocaleString()}</small>`;
      button.addEventListener("click", () => openConversation(conversation.id));
      recentChats.appendChild(button);
    });
    markActiveConversation();
    if (!skipAutoOpen) {
      if (!currentConversationId && data.conversations.length) await openConversation(data.conversations[0].id);
      if (!currentConversationId) await createConversation();
    }
  } catch (error) {
    console.error(error);
  }
}
async function createConversation() {
  const response = await fetch(`${AUTH_API}/conversations`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ title: "New chat" }),
  });
  if (!response.ok) throw new Error("Unable to create conversation");
  const data = await response.json();
  currentConversationId = data.conversation.id;
  resetChatView();
  await loadConversations(true);
  markActiveConversation();
}
async function openConversation(id) {
  const response = await fetch(`${AUTH_API}/conversations/${encodeURIComponent(id)}`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Unable to open conversation");
  const data = await response.json();
  currentConversationId = data.conversation.id;
  chat.innerHTML = "";
  data.messages.forEach(renderSavedMessage);
  if (!data.messages.length) resetChatView();
  markActiveConversation();
  document.querySelector('[data-view="chat"]')?.click();
}
function addLoadingMessage() {
  const wrap = document.createElement("div");
  wrap.className = "message loading-message";
  wrap.setAttribute("role", "status");
  wrap.setAttribute("aria-live", "polite");
  wrap.innerHTML = `
    <div class="avatar loading-avatar" aria-hidden="true"><span></span></div>
    <div class="bubble loading-bubble">
      <div class="loading-label">Thinking through your request</div>
      <div class="loading-dots" aria-hidden="true"><i></i><i></i><i></i></div>
    </div>`;
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
  return wrap;
}
function renderTrace(items = []) {
  trace.innerHTML = items.length
    ? items
        .map((x, index) => `<div class="trace-item"><span class="trace-index">${String(index + 1).padStart(2, "0")}</span><span>${escapeHtml(x)}</span><b>✓</b></div>`)
        .join("")
    : '<div class="empty">No trace.</div>';
  const traceStatus = document.getElementById("traceStatus");
  if (traceStatus) traceStatus.innerHTML = items.length
    ? '<span class="status-dot"></span> Complete'
    : '<span class="status-dot"></span> Ready';
}
async function askAgent(q) {
  addMessage("user", q);
  question.value = "";
  renderTrace(["Running LangGraph workflow..."]);
  sourceUsed.textContent = "Running";
  const btn = form.querySelector("button");
  const loadingMessage = addLoadingMessage();
  btn.disabled = true;
  try {
    const res = await fetch(`${AUTH_API}/questions`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ question: q, conversationId: currentConversationId }),
    });
    const data = await res.json();
    if (res.status === 401) { logout(); return; }
    if (!res.ok) throw new Error(data.error || data.detail || "Request failed");
    addMessage("assistant", data.answer || "No answer was returned.", data.source_used, data.sources || data.citations || [], data.steps || [], data.evidence_status || "");
    renderTrace(data.trace || []);
    sourceUsed.textContent = data.source_used;
    await loadConversations(true);
    const viewSources = document.getElementById("viewSources");
    if (viewSources) viewSources.classList.toggle("hidden", !(data.citations || []).length);
    if (viewSources) viewSources.onclick = () => {
      const citationText = (data.citations || []).map((citation) => citation.title).join("\n");
      addMessage("assistant", `Sources used for this answer:\n${citationText}`);
    };
  } catch (e) {
    addMessage("assistant", `Error: ${e.message}`);
    renderTrace(["Request failed"]);
    sourceUsed.textContent = "Error";
  } finally {
    loadingMessage.remove();
    btn.disabled = false;
  }
}
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = question.value.trim();
  if (q) askAgent(q);
});
document
  .querySelectorAll(".example")
  .forEach((b) =>
    b.addEventListener("click", () => askAgent(b.textContent.trim())),
  );

const modal = document.getElementById("uploadModal");
document.getElementById("openUpload").onclick = () =>
  modal.classList.remove("hidden");
document.getElementById("closeUpload").onclick = () =>
  modal.classList.add("hidden");
document.getElementById("uploadBtn").onclick = async () => {
  const file = document.getElementById("fileInput").files[0];
  const status = document.getElementById("uploadStatus");
  if (!file) {
    status.textContent = "Choose a file first.";
    return;
  }
  status.textContent = "Indexing document...";
  const fd = new FormData();
  fd.append("file", file);
  try {
    const r = await fetch(`${AUTH_API}/documents`, {
      method: "POST",
      headers: authHeaders(),
      body: fd,
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Upload failed");
    status.textContent = `Indexed ${d.document.filename}: ${d.document.chunks} chunks.`;
  } catch (e) {
    status.textContent = `Error: ${e.message}`;
  }
};

const themeToggle = document.getElementById("themeToggle");
const sidebarThemeToggle = document.getElementById("sidebarThemeToggle");
const savedTheme = localStorage.getItem("nexusiq-theme") || "dark";
document.body.dataset.theme = savedTheme;
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("nexusiq-theme", theme);
}
applyTheme(savedTheme);
if (themeToggle) themeToggle.onclick = () => applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
if (sidebarThemeToggle) sidebarThemeToggle.onclick = () => applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");

const sidebar = document.getElementById("sidebar");
const mobileBackdrop = document.getElementById("mobileBackdrop");
const setSidebarOpen = (open) => {
  sidebar?.classList.toggle("is-open", open);
  mobileBackdrop?.classList.toggle("hidden", !open);
};
document.getElementById("openSidebar")?.addEventListener("click", () => setSidebarOpen(true));
document.getElementById("closeSidebar")?.addEventListener("click", () => setSidebarOpen(false));
mobileBackdrop?.addEventListener("click", () => setSidebarOpen(false));

const chatView = document.getElementById("chatView");
const secondaryView = document.getElementById("secondaryView");
const secondaryTitle = document.getElementById("secondaryTitle");
const secondaryDescription = document.getElementById("secondaryDescription");
const secondaryContent = document.getElementById("secondaryContent");
const viewCopy = {
  workflow: ["LangGraph workflow", "Inspect the workflow nodes used by the current request. Live node timing is shown after a request runs.", [
    ["01 · Route question", "Classifies requests as internal policy, internal knowledge, current external information, or general technical questions.", "Deterministic routing"],
    ["02 · Retrieve internal evidence", "Searches the approved internal knowledge base first for company-specific requests.", "Pinecone + Gemini"],
    ["03 · Grade evidence", "Filters duplicate, unapproved, and irrelevant chunks before answer generation.", "Evidence gate"],
    ["04 · Generate and validate", "Creates a concise grounded response and validates its schema and citations.", "Response validated"]
  ]],
  knowledge: ["Knowledge base", "Review how NexusIQ protects company-specific answers with approved internal evidence.", [
    ["Approved internal sources", "Documents ingested through the company document flow are marked internal and approved for policy retrieval.", "Authority source"],
    ["Retrieval policy", "Internal policy and internal knowledge questions never silently substitute public web content.", "Internal first"],
    ["Insufficient evidence", "When an official policy cannot be verified, NexusIQ abstains and recommends contacting the IT Service Desk.", "Safe fallback"]
  ]],
  documents: ["Documents", "Manage source files that are sent through the existing ingestion pipeline.", [
    ["Upload company documentation", "PDF, TXT, Markdown, and DOCX files are supported.", "Add company document"],
    ["Chunk and index", "Files are split into searchable chunks with document IDs, titles, and chunk metadata.", "Gemini embeddings"],
    ["Manage access", "The admin key and provider credentials remain server-side and are never sent to the chat interface.", "Protected"]
  ]],
  observability: ["Observability", "Review only execution information returned by the backend. No synthetic metrics are generated.", [
    ["Agent trace", "The right-hand panel shows the latest route, retrieval, evidence, and validation events after each request.", "Live"],
    ["Source status", "The final source panel identifies internal, external, direct, or insufficient evidence.", "Live"],
    ["No fabricated metrics", "Duration, token counts, confidence scores, and source counts are not invented by the interface.", "Safe display"]
  ]],
  settings: ["Settings", "Personalize the workspace without changing backend configuration.", [
    ["Appearance", "Switch between the Midnight + Neon Rose dark theme and the accessible light theme.", "Use the theme button"],
    ["Backend configuration", "API keys, embedding configuration, vector search, and model settings remain server-side.", "Protected"],
    ["Response behavior", "Answers are concise, source-aware, citation-validated, and explicit when evidence is insufficient.", "Grounded by default"]
  ]]
};
function renderWorkspaceView(view) {
  const copy = viewCopy[view];
  if (!copy) {
    chatView?.classList.remove("hidden");
    secondaryView?.classList.add("hidden");
    return;
  }
  chatView?.classList.add("hidden");
  secondaryView?.classList.remove("hidden");
  secondaryTitle.textContent = copy[0];
  secondaryDescription.textContent = copy[1];
  const workflowDiagram = view === "workflow"
    ? `<figure class="workflow-diagram">
        <img src="/static/images/langgraph-workflow.png" alt="LangGraph workflow diagram showing question routing, knowledge-base retrieval, evidence grading, web search fallback, answer generation, query rewriting, and the final response." />
        <figcaption>LangGraph execution path used to ground each support answer.</figcaption>
      </figure>`
    : "";
  secondaryContent.innerHTML = workflowDiagram + copy[2].map(([title, body, status]) =>
    `<article class="workspace-card"><span class="card-status">${escapeHtml(status)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></article>`
  ).join("");
  if (view === "documents" && currentUser?.role === "admin") {
    secondaryContent.insertAdjacentHTML(
      "afterbegin",
      `<article class="workspace-card workspace-card-action">
        <span class="card-status">Document management</span>
        <h3>Add company document</h3>
        <p>Upload an approved PDF, TXT, Markdown, or DOCX file to index it in the private knowledge base.</p>
        <button type="button" class="send-btn workspace-action-btn" id="openUploadFromDocuments">+ Add document</button>
      </article>`,
    );
    document.getElementById("openUploadFromDocuments")?.addEventListener("click", () => {
      document.getElementById("uploadModal")?.classList.remove("hidden");
    });
  }
}
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((navItem) => navItem.classList.remove("active"));
    item.classList.add("active");
    renderWorkspaceView(item.dataset.view);
    setSidebarOpen(false);
  });
});
document.getElementById("newChat")?.addEventListener("click", async () => {
  try {
    await createConversation();
    document.querySelector('[data-view="chat"]')?.click();
  } catch (error) {
    addMessage("assistant", `Unable to create a new chat: ${error.message}`);
  }
});

function logout() {
  localStorage.removeItem("nexusiq-token");
  currentUser = null;
  currentConversationId = null;
  resetChatView();
  showAuth();
}
document.getElementById("logoutBtn")?.addEventListener("click", logout);
document.getElementById("authModeToggle")?.addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  document.getElementById("authTitle").textContent = authMode === "login" ? "Sign in to NexusIQ" : "Create employee account";
  document.getElementById("authDescription").textContent = authMode === "login" ? "Use your employee or administrator account to continue." : "Employee accounts can ask questions and view the knowledge workspace.";
  document.getElementById("nameField").classList.toggle("hidden", authMode === "login");
  document.getElementById("authPassword").autocomplete = authMode === "login" ? "current-password" : "new-password";
  document.getElementById("authSubmit").textContent = authMode === "login" ? "Sign in" : "Create account";
  document.getElementById("authModeToggle").textContent = authMode === "login" ? "New employee? Create an account" : "Already have an account? Sign in";
});
document.getElementById("authForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.getElementById("authStatus");
  const submit = document.getElementById("authSubmit");
  status.textContent = "";
  submit.disabled = true;
  const payload = {
    email: document.getElementById("authEmail").value.trim(),
    password: document.getElementById("authPassword").value,
  };
  if (authMode === "register") payload.name = document.getElementById("authName").value.trim();
  try {
    const response = await fetch(`${AUTH_API}/auth/${authMode === "login" ? "login" : "register"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Authentication failed");
    localStorage.setItem("nexusiq-token", data.token);
    showApp(data.user);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
async function restoreSession() {
  const token = localStorage.getItem("nexusiq-token");
  if (!token) return showAuth();
  try {
    const response = await fetch(`${AUTH_API}/auth/me`, { headers: authHeaders() });
    if (!response.ok) throw new Error("Session expired");
    showApp((await response.json()).user);
  } catch {
    localStorage.removeItem("nexusiq-token");
    currentUser = null;
    currentConversationId = null;
    resetChatView();
    showAuth();
  }
}
restoreSession();
