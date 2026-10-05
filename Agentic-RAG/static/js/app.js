const chat = document.getElementById("chat");
const form = document.getElementById("chatForm");
const question = document.getElementById("question");
const trace = document.getElementById("trace");
const sourceUsed = document.getElementById("sourceUsed");
const AUTH_API = `${window.APP_CONFIG?.backendApiUrl || "http://127.0.0.1:3000"}/api`;
let currentUser = null;
let authMode = "login";
let authRole = "employee";
let currentConversationId = null;
const landingPage = document.getElementById("landingPage");
const authPage = document.getElementById("authPage");
const appShell = document.querySelector(".shell");

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
  landingPage?.classList.add("hidden");
  authPage?.classList.add("hidden");
  appShell?.classList.remove("hidden");
  document.getElementById("profile").textContent = (user.name || user.email).slice(0, 2).toUpperCase();
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.classList.toggle("hidden", user.role !== "admin");
  });
  document.querySelector('[data-view="admin"]')?.classList.toggle("hidden", user.role !== "admin");
  if (user.role === "admin") {
    window.history.replaceState({}, "", "/admin/dashboard");
    document.querySelector('[data-view="admin"]')?.click();
  } else {
    window.history.replaceState({}, "", "/employee/dashboard");
    document.querySelector('[data-view="chat"]')?.click();
    renderEmployeeSharedDocuments();
  }
  loadConversations();
}
function showLanding() {
  landingPage?.classList.remove("hidden");
  authPage?.classList.add("hidden");
  appShell?.classList.add("hidden");
  window.history.replaceState({}, "", "/");
}
function showAuth() {
  landingPage?.classList.add("hidden");
  authPage?.classList.remove("hidden");
  appShell?.classList.add("hidden");
  setAuthRole("employee");
  document.getElementById("authStatus").textContent = "";
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
  ]],
  admin: ["Admin dashboard", "Manage shared company documents and administrator access.", []]
};
async function loadDocuments() {
  const response = await fetch(`${AUTH_API}/documents`, { headers: authHeaders() });
  if (!response.ok) throw new Error("Unable to load documents");
  return (await response.json()).documents || [];
}
async function renderSharedDocuments(target) {
  try {
    const documents = await loadDocuments();
    target.insertAdjacentHTML(
      "beforeend",
      documents.length
        ? documents.map((document) => `<article class="workspace-card shared-document-card"><span class="card-status">Shared document</span><h3>${escapeHtml(document.filename)}</h3><p>${document.chunks} indexed chunks · Added ${new Date(document.uploadedAt).toLocaleDateString()}</p></article>`).join("")
        : `<article class="workspace-card shared-document-card"><h3>No shared documents yet</h3><p>Documents uploaded by an administrator will appear here for all employees.</p></article>`,
    );
  } catch (error) {
    target.insertAdjacentHTML("beforeend", `<article class="workspace-card shared-document-card"><p>Shared documents are temporarily unavailable: ${escapeHtml(error.message)}</p></article>`);
  }
}
async function renderEmployeeSharedDocuments() {
  if (currentUser?.role !== "employee") return;
  const chatArea = document.getElementById("chat");
  if (!chatArea || document.getElementById("employeeSharedDocuments")) return;
  const section = document.createElement("section");
  section.id = "employeeSharedDocuments";
  section.className = "employee-shared-documents";
  section.innerHTML = `
    <div class="shared-documents-heading">
      <div><span class="eyebrow">COMPANY KNOWLEDGE</span><h3>Shared documents</h3></div>
    </div>
    <div class="shared-documents-list"><span class="muted">Loading shared documents…</span></div>`;
  chatArea.appendChild(section);
  await renderSharedDocuments(section.querySelector(".shared-documents-list"));
}
async function renderAdminDashboard() {
  secondaryContent.innerHTML = `
    <article class="workspace-card workspace-card-action">
      <span class="card-status">Administrator access</span>
      <h3>Add company document</h3>
      <p>Index an approved PDF, TXT, Markdown, or DOCX file for every authenticated employee and administrator.</p>
      <button type="button" class="send-btn workspace-action-btn" id="openUploadFromAdmin">+ Add document</button>
    </article>
    <article class="workspace-card">
      <span class="card-status">Administrator access</span>
      <h3>Add a new administrator</h3>
      <form id="newAdminForm" class="admin-form">
        <input name="name" type="text" placeholder="Full name" required maxlength="100" />
        <input name="email" type="email" placeholder="admin@company.com" required />
        <input name="password" type="password" placeholder="Temporary password (8+ characters)" minlength="8" required />
        <button class="send-btn workspace-action-btn" type="submit">Create administrator</button>
        <div id="newAdminStatus" class="upload-status" role="alert"></div>
      </form>
    </article>
    <article class="workspace-card">
      <span class="card-status">Current administrators</span>
      <div id="adminList">Loading administrators…</div>
    </article>`;
  document.getElementById("openUploadFromAdmin")?.addEventListener("click", () => {
    document.getElementById("uploadModal")?.classList.remove("hidden");
  });
  document.getElementById("newAdminForm")?.addEventListener("submit", createAdmin);
  try {
    const response = await fetch(`${AUTH_API}/admin/admins`, { headers: authHeaders() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load administrators");
    document.getElementById("adminList").innerHTML = data.admins
      .map((admin) => `<div class="admin-list-item"><strong>${escapeHtml(admin.name)}</strong><span>${escapeHtml(admin.email)}</span></div>`)
      .join("");
  } catch (error) {
    document.getElementById("adminList").textContent = error.message;
  }
}
async function createAdmin(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const status = document.getElementById("newAdminStatus");
  const submit = formElement.querySelector("button");
  submit.disabled = true;
  status.textContent = "";
  try {
    const payload = Object.fromEntries(new FormData(formElement).entries());
    const response = await fetch(`${AUTH_API}/admin/admins`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to create administrator");
    status.textContent = `${data.admin.name} can now sign in through the Administrator portal.`;
    formElement.reset();
    await renderAdminDashboard();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
}
async function renderWorkspaceView(view) {
  if (view === "documents" && currentUser?.role !== "admin") {
    document.querySelector('[data-view="chat"]')?.click();
    return;
  }
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
  if (view === "workflow") {
    secondaryContent.innerHTML = `<figure class="workflow-diagram">
        <img src="/static/langgraph-workflow.png" alt="LangGraph workflow diagram showing question routing, knowledge-base retrieval, guardrails, web search fallback, answer generation, response validation, and the final response." style="width:100%;height:auto;display:block;" />
        <figcaption>LangGraph execution path used to ground each support answer.</figcaption>
      </figure>`;
    return;
  }
  secondaryContent.innerHTML = copy[2].map(([title, body, status]) =>
    `<article class="workspace-card"><span class="card-status">${escapeHtml(status)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></article>`
  ).join("");
  if (view === "admin" && currentUser?.role === "admin") {
    await renderAdminDashboard();
    return;
  }
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
  if (view === "documents") {
    await renderSharedDocuments(secondaryContent);
  }
}
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", async () => {
    document.querySelectorAll(".nav-item").forEach((navItem) => navItem.classList.remove("active"));
    item.classList.add("active");
    await renderWorkspaceView(item.dataset.view);
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
  window.history.replaceState({}, "", "/");
  showLanding();
}
document.getElementById("logoutBtn")?.addEventListener("click", logout);
document.getElementById("openAuthFlow")?.addEventListener("click", showAuth);
document.getElementById("openAuthFlowTop")?.addEventListener("click", showAuth);
document.getElementById("backToLanding")?.addEventListener("click", showLanding);
function setAuthRole(role) {
  authRole = role;
  authMode = "login";
  const isAdmin = role === "admin";
  document.querySelector(".auth-card")?.setAttribute("data-role", role);
  document.getElementById("authTitle").textContent = isAdmin ? "Admin Portal" : "Employee Portal";
  document.getElementById("authDescription").textContent = isAdmin
    ? "Manage workspace, users, documents, and IT support content."
    : "Access company knowledge base and get IT support assistance.";
  document.getElementById("authModeIcon").textContent = isAdmin ? "◆" : "♙";
  document.getElementById("nameField").classList.add("hidden");
  document.getElementById("authPassword").autocomplete = "current-password";
  document.getElementById("authSubmitLabel").textContent = isAdmin ? "Sign in as Admin" : "Sign in as Employee";
  document.getElementById("authModeToggle").classList.toggle("hidden", isAdmin);
  document.querySelectorAll(".auth-role-tab").forEach((tab) => {
    const active = tab.id === `${role}AuthTab`;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
}
document.getElementById("employeeAuthTab")?.addEventListener("click", () => setAuthRole("employee"));
document.getElementById("adminAuthTab")?.addEventListener("click", () => setAuthRole("admin"));
document.getElementById("authModeToggle")?.addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  document.getElementById("authTitle").textContent = authMode === "login" ? "Employee Portal" : "Create employee account";
  document.getElementById("authDescription").textContent = authMode === "login" ? "Use your employee or administrator account to continue." : "Employee accounts can ask questions and view the knowledge workspace.";
  document.getElementById("nameField").classList.toggle("hidden", authMode === "login");
  document.getElementById("authPassword").autocomplete = authMode === "login" ? "current-password" : "new-password";
  document.getElementById("authSubmitLabel").textContent = authMode === "login" ? "Sign in as Employee" : "Create account";
  document.querySelector("#authModeToggle span").textContent = authMode === "login" ? "New employee?" : "Already have an account?";
  document.querySelector("#authModeToggle button").textContent = authMode === "login" ? "Create an account" : "Sign in";
});
document.getElementById("togglePassword")?.addEventListener("click", () => {
  const password = document.getElementById("authPassword");
  const visible = password.type === "text";
  password.type = visible ? "password" : "text";
  document.getElementById("togglePassword").textContent = visible ? "◉" : "◌";
  document.getElementById("togglePassword").setAttribute("aria-label", visible ? "Show password" : "Hide password");
});
document.getElementById("forgotPassword")?.addEventListener("click", () => {
  document.getElementById("authStatus").textContent = "Password reset is managed by your IT administrator.";
});
const rememberedEmail = localStorage.getItem("nexusiq-remembered-email");
if (rememberedEmail) {
  document.getElementById("authEmail").value = rememberedEmail;
  document.getElementById("rememberMe").checked = true;
}
document.getElementById("authForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.getElementById("authStatus");
  const submit = document.getElementById("authSubmit");
  const submitLabel = document.getElementById("authSubmitLabel");
  status.textContent = "";
  submit.disabled = true;
  const payload = {
    email: document.getElementById("authEmail").value.trim(),
    password: document.getElementById("authPassword").value,
    role: authRole,
  };
  if (document.getElementById("rememberMe").checked) {
    localStorage.setItem("nexusiq-remembered-email", payload.email);
  } else {
    localStorage.removeItem("nexusiq-remembered-email");
  }
  if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    status.textContent = "Enter a valid work email address.";
    submit.disabled = false;
    return;
  }
  if (!payload.password) {
    status.textContent = "Enter your password to continue.";
    submit.disabled = false;
    return;
  }
  if (authMode === "register") {
    payload.name = document.getElementById("authName").value.trim();
    if (authRole !== "employee") {
      status.textContent = "Only employees can create an account.";
      submit.disabled = false;
      return;
    }
    if (!payload.name) {
      status.textContent = "Enter your full name to create an employee account.";
      submit.disabled = false;
      return;
    }
  }
  try {
    const endpoint = authMode === "register" ? "register" : `${authRole}/login`;
    submitLabel.textContent = authMode === "register" ? "Creating account…" : "Signing in…";
    submit.classList.add("is-loading");
    const response = await fetch(`${AUTH_API}/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(response.ok ? "Authentication returned an invalid response" : `Authentication failed (${response.status})`);
    }
    if (!response.ok) throw new Error(data.error || "Authentication failed");
    localStorage.setItem("nexusiq-token", data.token);
    showApp(data.user);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.classList.remove("is-loading");
    submitLabel.textContent = authMode === "register" ? "Create account" : `Sign in as ${authRole === "admin" ? "Admin" : "Employee"}`;
  }
});
async function restoreSession() {
  const token = localStorage.getItem("nexusiq-token");
  if (!token) return showLanding();
  try {
    const response = await fetch(`${AUTH_API}/auth/me`, { headers: authHeaders() });
    if (!response.ok) throw new Error("Session expired");
    showApp((await response.json()).user);
  } catch {
    localStorage.removeItem("nexusiq-token");
    currentUser = null;
    currentConversationId = null;
    resetChatView();
    showLanding();
  }
}
restoreSession();
