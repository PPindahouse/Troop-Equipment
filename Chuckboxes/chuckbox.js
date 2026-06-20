import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot,
  collection, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  CHUCKBOXES, ITEM_DIRECTORY, STATUS_META,
  itemBelongsTo, getCycleFor, missingLabel
} from "./chuckboxData.js";

// ── FIREBASE ──────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAEfDeKEZ3l0XWVNTfy4pZMcRuE8KvwNTY",
  authDomain: "troop-equipment.firebaseapp.com",
  projectId: "troop-equipment",
  storageBucket: "troop-equipment.firebasestorage.app",
  messagingSenderId: "175531346010",
  appId: "1:175531346010:web:b8ff0a82e05ae8cebc3063"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const SECRET = "BePrepared";

// ── STATE ─────────────────────────────────────────────────────────────────
let isAdmin = false;
let currentChuckbox = "Cobra";
let chuckboxDocData = null;   // live data for the currently selected chuckbox
let outingsData = [];         // shared across all chuckboxes: [{id, outing, leaders:{Cobra:"", Egg:"", ...}}]
let unsubChuckbox = null;
let pendingDeleteId = null;
let holdTimer = null;
let holdFiredAsTooltip = false;

// ── DOM ───────────────────────────────────────────────────────────────────
const adminBtn       = document.getElementById("adminBtn");
const adminNav       = document.getElementById("adminNav");
const chuckboxSelect = document.getElementById("chuckboxSelect");
const lastUpdatedEl  = document.getElementById("lastUpdated");
const commentBox     = document.getElementById("commentBox");
const commentText    = document.getElementById("commentText");
const commentEditor  = document.getElementById("commentEditor");
const commentInput   = document.getElementById("commentInput");
const itemGrid       = document.getElementById("itemGrid");
const tooltip        = document.getElementById("itemTooltip");

const patrolLogBody  = document.getElementById("patrolLogBody");
const patrolLogAdd   = document.getElementById("patrolLogAdd");
const plActionHead   = document.getElementById("plActionHead");
const newOutingEl    = document.getElementById("newOuting");
const newLeaderEl    = document.getElementById("newLeader");
const addOutingBtn   = document.getElementById("addOutingBtn");

const modalOverlay   = document.getElementById("modalOverlay");
const codeInput      = document.getElementById("codeInput");
const codeError      = document.getElementById("codeError");
const cancelModal    = document.getElementById("cancelModal");
const confirmModal   = document.getElementById("confirmModal");

const confirmOverlay = document.getElementById("confirmOverlay");
const cancelDelete   = document.getElementById("cancelDelete");
const confirmDelete  = document.getElementById("confirmDelete");

// ── HASH ROUTING: /Chuckboxes/#cobra ─────────────────────────────────────
function chuckboxFromHash() {
  const hash = decodeURIComponent(location.hash.replace("#", "")).trim().toLowerCase();
  const match = CHUCKBOXES.find(c => c.toLowerCase() === hash);
  return match || "Cobra";
}

currentChuckbox = chuckboxFromHash();
chuckboxSelect.value = currentChuckbox;

window.addEventListener("hashchange", () => {
  const fromHash = chuckboxFromHash();
  if (fromHash !== currentChuckbox) {
    currentChuckbox = fromHash;
    chuckboxSelect.value = currentChuckbox;
    subscribeToChuckbox();
  }
});

chuckboxSelect.addEventListener("change", () => {
  currentChuckbox = chuckboxSelect.value;
  history.replaceState(null, "", "#" + currentChuckbox.toLowerCase());
  subscribeToChuckbox();
});

// ── ADMIN UNLOCK ──────────────────────────────────────────────────────────
adminBtn.addEventListener("click", () => {
  modalOverlay.classList.remove("hidden");
  codeInput.value = "";
  codeError.classList.add("hidden");
  setTimeout(() => codeInput.focus(), 50);
});
cancelModal.addEventListener("click", () => modalOverlay.classList.add("hidden"));
confirmModal.addEventListener("click", unlock);
codeInput.addEventListener("keydown", e => { if (e.key === "Enter") unlock(); });

function unlock() {
  if (codeInput.value === SECRET) {
    isAdmin = true;
    modalOverlay.classList.add("hidden");
    adminBtn.classList.add("hidden");
    adminNav.classList.remove("hidden");
    plActionHead.classList.remove("hidden");
    patrolLogAdd.classList.remove("hidden");
    renderComment();
    renderItems();
    renderPatrolLog();
  } else {
    codeError.classList.remove("hidden");
    codeInput.value = "";
    codeInput.focus();
  }
}

// ── FIRESTORE: CHUCKBOX DOC ──────────────────────────────────────────────
// Doc shape: chuckboxes/{name} = { statuses: { [itemName]: {status, missingCount} }, comment: "", updatedAt: ISOString }
function subscribeToChuckbox() {
  if (unsubChuckbox) unsubChuckbox();
  const ref = doc(db, "chuckboxes", currentChuckbox);

  unsubChuckbox = onSnapshot(ref, async (snap) => {
    if (!snap.exists()) {
      // Initialize a blank doc so the first save has something to merge into
      chuckboxDocData = { statuses: {}, comment: "", updatedAt: null };
    } else {
      chuckboxDocData = snap.data();
    }
    renderLastUpdated();
    renderComment();
    renderItems();
  }, (err) => {
    console.error("Chuckbox listener error:", err);
    itemGrid.innerHTML = `<p style="grid-column:1/-1;color:var(--text-muted);font-style:italic;">Could not load chuckbox data.</p>`;
  });
}

async function saveChuckboxField(partialData) {
  const ref = doc(db, "chuckboxes", currentChuckbox);
  const updated = {
    ...chuckboxDocData,
    ...partialData,
    updatedAt: new Date().toISOString(),
    secret: SECRET // required by Firestore security rules on write
  };
  await setDoc(ref, updated, { merge: true });
}

function renderLastUpdated() {
  if (!chuckboxDocData || !chuckboxDocData.updatedAt) {
    lastUpdatedEl.textContent = "Last updated: never";
    return;
  }
  const d = new Date(chuckboxDocData.updatedAt);
  lastUpdatedEl.textContent = "Last updated: " + d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
  });
}

// ── COMMENT ───────────────────────────────────────────────────────────────
function renderComment() {
  const comment = (chuckboxDocData && chuckboxDocData.comment) || "";

  if (isAdmin) {
    commentBox.classList.add("hidden");
    commentEditor.classList.remove("hidden");
    if (document.activeElement !== commentInput) commentInput.value = comment;
  } else {
    commentEditor.classList.add("hidden");
    if (comment.trim()) {
      commentText.textContent = comment;
      commentBox.classList.remove("hidden");
    } else {
      commentBox.classList.add("hidden");
    }
  }
}

let commentSaveTimer = null;
commentInput.addEventListener("input", () => {
  clearTimeout(commentSaveTimer);
  commentSaveTimer = setTimeout(() => {
    saveChuckboxField({ comment: commentInput.value });
  }, 600); // debounce so we're not writing on every keystroke
});

// ── ITEM GRID ─────────────────────────────────────────────────────────────
function getItemState(itemName) {
  const statuses = (chuckboxDocData && chuckboxDocData.statuses) || {};
  return statuses[itemName] || { status: "checked", missingCount: 1 };
}

function renderItems() {
  itemGrid.innerHTML = "";
  const itemsForBox = ITEM_DIRECTORY.filter(it => itemBelongsTo(it, currentChuckbox));

  itemsForBox.forEach(item => {
    const state = getItemState(item.name);
    const meta = STATUS_META[state.status] || STATUS_META.checked;

    const btn = document.createElement("div");
    btn.className = `item-btn status-${meta.color}` + (isAdmin ? " admin-editable" : "");
    btn.tabIndex = 0;
    btn.setAttribute("role", "button");
    btn.setAttribute("aria-label", `${item.name}: ${meta.label}`);

    const displayStatus = (state.status === "missing" && item.quantity && item.quantity > 1)
      ? missingLabel(item, state.missingCount)
      : meta.label;

    btn.innerHTML = `
      <span class="item-btn-name">${escHtml(item.name)}${item.quantity ? ` (${item.quantity})` : ""}</span>
      <span class="item-btn-emoji">${item.emoji}</span>
      <span class="item-btn-status">${escHtml(displayStatus)}</span>
    `;

    attachTooltipHandlers(btn, item, state, meta);

    if (isAdmin) {
      btn.addEventListener("click", (e) => {
        if (holdFiredAsTooltip) { holdFiredAsTooltip = false; return; }
        cycleStatus(item);
      });
    }

    itemGrid.appendChild(btn);
  });
}

function cycleStatus(item) {
  const cycle = getCycleFor(item);
  const state = getItemState(item.name);
  const idx = cycle.indexOf(state.status);
  const nextStatus = cycle[(idx + 1) % cycle.length];

  let nextMissingCount = state.missingCount || 1;
  if (nextStatus === "missing" && item.quantity && item.quantity > 1) {
    nextMissingCount = state.missingCount || 1;
  }

  const newStatuses = {
    ...(chuckboxDocData.statuses || {}),
    [item.name]: { status: nextStatus, missingCount: nextMissingCount }
  };
  saveChuckboxField({ statuses: newStatuses });
}

// ── TOOLTIP: hover (desktop) + hold-to-reveal (mobile, all users) ────────
function attachTooltipHandlers(btn, item, state, meta) {
  const getText = () => {
    const s = getItemState(item.name);
    const m = STATUS_META[s.status] || STATUS_META.checked;
    return m.describe(item);
  };

  // Desktop hover
  btn.addEventListener("mouseenter", (e) => showTooltip(getText(), e));
  btn.addEventListener("mousemove", (e) => positionTooltip(e));
  btn.addEventListener("mouseleave", hideTooltip);

  // Hold-to-reveal (touch) — for both admin and public, per spec
  btn.addEventListener("touchstart", (e) => {
    holdFiredAsTooltip = false;
    holdTimer = setTimeout(() => {
      const touch = e.touches[0];
      showTooltip(getText(), { clientX: touch.clientX, clientY: touch.clientY });
      holdFiredAsTooltip = true;
      if (navigator.vibrate) navigator.vibrate(8);
    }, 420);
  }, { passive: true });

  btn.addEventListener("touchend", () => {
    clearTimeout(holdTimer);
    hideTooltip();
    // holdFiredAsTooltip stays true briefly so the click handler ignores this tap
    setTimeout(() => { holdFiredAsTooltip = false; }, 50);
  });
  btn.addEventListener("touchmove", () => {
    clearTimeout(holdTimer);
    hideTooltip();
  });
}

function showTooltip(text, evt) {
  tooltip.textContent = text;
  tooltip.classList.add("visible");
  positionTooltip(evt);
}
function positionTooltip(evt) {
  const padding = 14;
  let x = evt.clientX + padding;
  let y = evt.clientY + padding;
  const rect = tooltip.getBoundingClientRect();
  if (x + rect.width > window.innerWidth - 8) x = evt.clientX - rect.width - padding;
  if (y + rect.height > window.innerHeight - 8) y = evt.clientY - rect.height - padding;
  tooltip.style.left = x + "px";
  tooltip.style.top = y + "px";
}
function hideTooltip() {
  tooltip.classList.remove("visible");
}

// ── PATROL LEADER LOG (shared outings, per-chuckbox leaders) ─────────────
// Firestore: collection "outings" — each doc: { outing: "Fall Campout", leaders: { Cobra: "...", Egg: "...", ... }, order: number }
const outingsCol = collection(db, "outings");

onSnapshot(outingsCol, (snap) => {
  outingsData = snap.docs.map(d => ({ id: d.id, ...normalizeOutingDoc(d.data()) }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  renderPatrolLog();
}, (err) => {
  console.error("Outings listener error:", err);
  patrolLogBody.innerHTML = `<tr><td colspan="3" class="patrol-log-empty">Could not load patrol log.</td></tr>`;
});

function renderPatrolLog() {
  patrolLogBody.innerHTML = "";

  const visibleOutings = isAdmin
    ? outingsData
    : outingsData.filter(o => (o.leaders && o.leaders[currentChuckbox] && o.leaders[currentChuckbox].trim()));

  if (visibleOutings.length === 0) {
    patrolLogBody.innerHTML = `<tr><td colspan="${isAdmin ? 3 : 2}" class="patrol-log-empty">No outings logged yet.</td></tr>`;
    return;
  }

  visibleOutings.forEach(o => {
    const leaderName = getLeaderForChuckbox(o, currentChuckbox);
    const tr = document.createElement("tr");

    if (isAdmin) {
      tr.innerHTML = `
        <td><input type="text" class="outing-name-input" value="${escAttr(o.outing)}" /></td>
        <td><input type="text" class="leader-input" value="${escAttr(leaderName)}" placeholder="—" /></td>
        <td><button class="btn-del-row" title="Remove outing">✕</button></td>
      `;
      const outingInput = tr.querySelector(".outing-name-input");
      const leaderInput = tr.querySelector(".leader-input");

      outingInput.addEventListener("change", () => {
        updateOuting(o.id, { outing: outingInput.value.trim() });
      });
      leaderInput.addEventListener("change", () => {
        const leaders = { ...(o.leaders || {}), [currentChuckbox]: leaderInput.value.trim() };
        updateOuting(o.id, { leaders });
      });
      tr.querySelector(".btn-del-row").addEventListener("click", () => {
        pendingDeleteId = o.id;
        confirmOverlay.classList.remove("hidden");
      });
    } else {
      tr.innerHTML = `
        <td>${escHtml(o.outing)}</td>
        <td>${escHtml(leaderName)}</td>
      `;
    }
    patrolLogBody.appendChild(tr);
  });
}

async function updateOuting(id, partial) {
  const ref = doc(db, "outings", id);
  await setDoc(ref, { ...partial, secret: SECRET }, { merge: true });
}

function normalizeOutingDoc(data) {
  const leaders = {};
  CHUCKBOXES.forEach(chuckbox => {
    const value = data?.leaders?.[chuckbox];
    leaders[chuckbox] = typeof value === "string" ? value : "";
  });

  return {
    ...data,
    leaders
  };
}

function getLeaderForChuckbox(outing, chuckbox) {
  return typeof outing?.leaders?.[chuckbox] === "string" ? outing.leaders[chuckbox] : "";
}

addOutingBtn.addEventListener("click", async () => {
  const outingName = newOutingEl.value.trim();
  if (!outingName) return;
  const leaders = {};
  CHUCKBOXES.forEach(c => leaders[c] = "");
  leaders[currentChuckbox] = newLeaderEl.value.trim();

  const ref = doc(collection(db, "outings"));
  await setDoc(ref, {
    outing: outingName,
    leaders,
    order: Date.now(),
    secret: SECRET
  });
  newOutingEl.value = "";
  newLeaderEl.value = "";
});

cancelDelete.addEventListener("click", () => {
  confirmOverlay.classList.add("hidden");
  pendingDeleteId = null;
});
confirmDelete.addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  confirmOverlay.classList.add("hidden");
  try {
    await deleteDoc(doc(db, "outings", pendingDeleteId));
  } catch (err) {
    alert("Error removing outing. See console.");
    console.error(err);
  }
  pendingDeleteId = null;
});

// ── HELPERS ───────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escAttr(str) { return escHtml(str); }

// ── INIT ──────────────────────────────────────────────────────────────────
subscribeToChuckbox();
