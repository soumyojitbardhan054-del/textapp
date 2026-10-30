import { getAll, put, remove } from "./db.js";

const $ = (selector) => document.querySelector(selector);
const today = new Date();
const isoToday = localDate(today);
let entries = [];
let memories = [];
let selectedId = null;
let toastTimer;

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function prettyDate(value, options = { day: "numeric", month: "long", year: "numeric" }) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", options);
}
function escapeHTML(value = "") {
  return value.replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
function wordCount(value) { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}
function setSaved(message = "ALL CHANGES SAVED") { $("#save-state").textContent = message; }

function initialiseDate() {
  $("#today-date").textContent = prettyDate(isoToday, { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
  $("#date-day").textContent = String(today.getDate()).padStart(2, "0");
  $("#date-month").textContent = today.toLocaleDateString("en-GB", { month: "long" }).toUpperCase();
  const hour = today.getHours();
  $("#greeting").textContent = hour < 12 ? "Good morning." : hour < 17 ? "Good afternoon." : "Good evening.";
}
function switchView(name) {
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === `view-${name}`));
  document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === name));
  const labels = { today: "YOUR PERSONAL ARCHIVE", journal: "THE MANUSCRIPT", timeline: "THE YEARS, AS THEY HAPPENED", memories: "THE THINGS WORTH KEEPING", more: "BEYOND THE DAILY PAGE" };
  $("#section-label").textContent = labels[name] || "EVERMORE";
  if (name === "journal") renderJournal();
  if (name === "timeline") renderTimeline();
  if (name === "memories") renderMemories();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function renderDashboard() {
  const sorted = [...entries].sort((a,b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
  const todayCount = entries.filter(entry => entry.date === isoToday).length;
  $("#today-entry-count").textContent = todayCount ? `${todayCount} PAGE${todayCount === 1 ? "" : "S"} TODAY` : "NO ENTRIES YET";
  $("#total-entries").textContent = entries.length;
  $("#total-words").textContent = entries.reduce((sum, entry) => sum + wordCount(entry.body), 0).toLocaleString("en-GB");
  $("#margin-pages").textContent = entries.length;
  $("#margin-photos").textContent = memories.length;
  $("#recent-entries").innerHTML = sorted.length ? sorted.slice(0, 4).map(entry => `
    <div class="recent-item" data-open="${entry.id}"><span class="recent-title">${escapeHTML(entry.title || "Untitled page")}</span><span class="recent-date">${prettyDate(entry.date,{day:"numeric",month:"short"}).toUpperCase()}</span></div>`).join("") : '<div class="empty-note">Your pages will find a home here.</div>';
  document.querySelectorAll("[data-open]").forEach(item => item.addEventListener("click", () => {
    selectedId = item.dataset.open; switchView("journal"); renderJournal(); showPreview(selectedId);
  }));
}
function renderJournal() {
  const query = $("#journal-search").value.trim().toLowerCase();
  const sorted = [...entries].filter(entry => `${entry.title} ${entry.body}`.toLowerCase().includes(query))
    .sort((a,b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
  $("#journal-count").textContent = `${sorted.length} PAGE${sorted.length === 1 ? "" : "S"}`;
  $("#entry-list").innerHTML = sorted.length ? sorted.map(entry => `
    <div class="entry-card ${entry.id === selectedId ? "selected" : ""}" data-id="${entry.id}">
      <time>${prettyDate(entry.date,{day:"numeric",month:"short",year:"numeric"}).toUpperCase()}</time>
      <h3>${escapeHTML(entry.title || "Untitled page")}</h3>
      <p>${escapeHTML(entry.body.slice(0,100) || "An empty page…")}${entry.body.length > 100 ? "…" : ""}</p>
    </div>`).join("") : '<div class="empty-note">No matching pages. Try another search, or write a new entry.</div>';
  document.querySelectorAll(".entry-card").forEach(card => card.addEventListener("click", () => {
    selectedId = card.dataset.id; renderJournal(); showPreview(selectedId);
  }));
  if (selectedId && entries.some(entry => entry.id === selectedId)) showPreview(selectedId);
}
function showPreview(id) {
  const entry = entries.find(item => item.id === id);
  if (!entry) return;
  $("#editor").innerHTML = `<div class="editor-preview"><time>${prettyDate(entry.date,{day:"numeric",month:"long",year:"numeric"}).toUpperCase()}</time><h2>${escapeHTML(entry.title || "Untitled page")}</h2><p>${escapeHTML(entry.body)}</p><div class="preview-actions"><button class="text-button" id="edit-selected">EDIT PAGE ↗</button><button class="text-button" id="delete-selected">DELETE PAGE</button></div></div>`;
  $("#edit-selected").addEventListener("click", () => openEntryDialog(entry));
  $("#delete-selected").addEventListener("click", () => deleteEntry(entry.id));
}
function renderTimeline() {
  const sorted = [...entries].sort((a,b) => b.date.localeCompare(a.date));
  if (!sorted.length) { $("#timeline-content").innerHTML = '<div class="empty-note">Your timeline will grow with every journal entry.</div>'; return; }
  const groups = Object.groupBy ? Object.groupBy(sorted, entry => entry.date.slice(0,4)) : sorted.reduce((acc, entry) => ((acc[entry.date.slice(0,4)] ||= []).push(entry), acc), {});
  $("#timeline-content").innerHTML = Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(year => `
    <section class="timeline-year"><h2>${year}</h2><div>${groups[year].map(entry => `<div class="timeline-entry"><time>${prettyDate(entry.date,{day:"numeric",month:"long"}).toUpperCase()}</time><h3>${escapeHTML(entry.title || "Untitled page")}</h3><p>${escapeHTML(entry.body.slice(0,180))}${entry.body.length > 180 ? "…" : ""}</p></div>`).join("")}</div></section>`).join("");
}
function renderMemories() {
  $("#memory-grid").innerHTML = memories.length ? memories.map(memory => `<article class="memory-card"><img src="${memory.url}" alt="${escapeHTML(memory.name)}"><div><p>${escapeHTML(memory.name)}</p></div></article>`).join("") : '<div class="empty-note">No photographs saved yet. Add a picture to begin your collection.</div>';
}
function openEntryDialog(entry = null) {
  selectedId = entry?.id || null;
  $("#entry-title").value = entry?.title || "";
  $("#entry-body").value = entry?.body || "";
  $("#entry-date").value = entry?.date || isoToday;
  $("#delete-entry").hidden = !entry;
  $("#word-count").textContent = `${wordCount($("#entry-body").value)} WORDS`;
  $("#entry-dialog").showModal();
  $("#entry-title").focus();
}
async function saveEntry(event) {
  event.preventDefault();
  const title = $("#entry-title").value.trim();
  const body = $("#entry-body").value.trim();
  const date = $("#entry-date").value || isoToday;
  if (!title && !body) { notify("Write a title or a few words first."); return; }
  const existing = entries.find(entry => entry.id === selectedId);
  const entry = { id: selectedId || crypto.randomUUID(), title, body, date, createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now() };
  try {
    await put("entries", entry);
    await refresh();
    selectedId = entry.id;
    $("#entry-dialog").close();
    switchView("journal");
    showPreview(entry.id);
    notify("Page saved on this device.");
    setSaved();
  } catch (error) { console.error(error); notify("Could not save. Please try again."); setSaved("SAVE FAILED"); }
}
async function deleteEntry(id) {
  if (!confirm("Delete this journal page? This cannot be undone.")) return;
  await remove("entries", id);
  selectedId = null;
  await refresh();
  $("#editor").innerHTML = '<div class="editor-empty"><span class="large-quote">“</span><h2>Every story begins somewhere.</h2><p>Choose a page, or begin a new one.</p><button class="text-button" id="empty-new">WRITE YOUR FIRST PAGE ↗</button></div>';
  $("#empty-new").addEventListener("click", () => openEntryDialog());
  notify("Page deleted.");
}
async function uploadPhotos(files) {
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 8 * 1024 * 1024) { notify(`${file.name} is over 8 MB and was skipped.`); continue; }
    const memory = { id: crypto.randomUUID(), name: file.name, blob: file, createdAt: Date.now() };
    await put("memories", memory);
  }
  await refresh();
  switchView("memories");
  notify("Photographs added to this device.");
}
async function refresh() {
  entries = await getAll("entries");
  memories = await getAll("memories");
  // Revoke previous object URLs before rebuilding the memory view.
  memories = memories.map(memory => ({ ...memory, url: URL.createObjectURL(memory.blob) }));
  renderDashboard();
  renderJournal();
  renderTimeline();
  renderMemories();
}
$("#new-entry").addEventListener("click", () => openEntryDialog());
$("#write-today").addEventListener("click", () => openEntryDialog());
$("#empty-new").addEventListener("click", () => openEntryDialog());
$("#entry-form").addEventListener("submit", saveEntry);
$("#entry-body").addEventListener("input", () => $("#word-count").textContent = `${wordCount($("#entry-body").value)} WORDS`);
$("#delete-entry").addEventListener("click", () => { $("#entry-dialog").close(); if (selectedId) deleteEntry(selectedId); });
$("#journal-search").addEventListener("input", renderJournal);
$("#photo-upload").addEventListener("change", event => uploadPhotos([...event.target.files]));
document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.go)));
$("#empty-new").addEventListener("click", () => openEntryDialog());
initialiseDate();
refresh().catch(error => { console.error(error); notify("Storage could not be opened in this browser."); });
