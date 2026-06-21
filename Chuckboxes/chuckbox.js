import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot,
  collection, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  CHUCKBOXES, ITEM_DIRECTORY, STATUS_META, CATEGORY_DISPLAY,
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
let isCheckingIn = false;                    // turn-based check-in mode active
let currentChuckbox = "Cobra";
let chuckboxDocData = null;
let outingsData = [];
let unsubChuckbox = null;
let pendingDeleteId = null;
let holdTimer = null;
let holdFiredAsTooltip = false;

// ── CHECK-IN STATE (local, not yet persisted) ────────────────────────────
let localItemChanges = {};                   // {itemName: {status, missingCount}, ...}
let localPatrolLeader = "";                  // patrol leader for current chuckbox
let localOuting = null;                      // {id, name} or null for new outing
let isModifyingLog = false;                  // modify log mode active

// ── DOM ───────────────────────────────────────────────────────────────────
const adminBtn       = document.getElementById("adminBtn");
const modifyPatrolLogBtn = document.getElementById("modifyPatrolLogBtn");
const adminNav       = document.getElementById("adminNav");
const saveBtn        = document.getElementById("saveBtn");
const chuckboxSelect = document.getElementById("chuckboxSelect");
const lastUpdatedEl  = document.getElementById("lastUpdated");
const commentBox     = document.getElementById("commentBox");
const commentText    = document.getElementById("commentText");
const commentEditor  = document.getElementById("commentEditor");
const commentInput   = document.getElementById("commentInput");
const itemGrid       = document.getElementById("itemGrid");
const tooltip        = document.getElementById("itemTooltip");

const patrolLoggerUI = document.getElementById("patrolLoggerUI");
const patrolLeaderInput = document.getElementById("patrolLeaderInput");
const outingSelect   = document.getElementById("outingSelect");
const newOutingInput = document.getElementById("newOutingInput");

const patrolLogBody  = document.getElementById("patrolLogBody");
const plActionHead   = document.getElementById("plActionHead");

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
  if (isCheckingIn) return; // locked during check-in
  const fromHash = chuckboxFromHash();
  if (fromHash !== currentChuckbox) {
    currentChuckbox = fromHash;
    chuckboxSelect.value = currentChuckbox;
    subscribeToChuckbox();
  }
});

chuckboxSelect.addEventListener("change", () => {
  if (isCheckingIn) {
    chuckboxSelect.value = currentChuckbox; // revert
    return;
  }
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

// ── MODIFY PATROL LOG (separate button) ────────────────────────────────
modifyPatrolLogBtn.addEventListener("click", () => {
  modalOverlay.classList.remove("hidden");
  codeInput.value = "";
  codeError.classList.add("hidden");
  codeInput.dataset.mode = "modifyLog";
  setTimeout(() => codeInput.focus(), 50);
});

cancelModal.addEventListener("click", () => {
  modalOverlay.classList.add("hidden");
  delete codeInput.dataset.mode;
});

confirmModal.addEventListener("click", () => {
  const mode = codeInput.dataset.mode || "checkIn";
  delete codeInput.dataset.mode;
  if (mode === "modifyLog") unlockModifyLog();
  else unlock();
});

codeInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const mode = codeInput.dataset.mode || "checkIn";
    delete codeInput.dataset.mode;
    if (mode === "modifyLog") unlockModifyLog();
    else unlock();
  }
});

function unlock() {
  if (codeInput.value === SECRET) {
    isAdmin = true;
    isCheckingIn = true;
    localItemChanges = {};
    localPatrolLeader = "";
    localOuting = null;
    
    modalOverlay.classList.add("hidden");
    adminBtn.classList.add("hidden");
    modifyPatrolLogBtn.classList.add("hidden");
    adminNav.classList.remove("hidden");
    chuckboxSelect.disabled = true;
    patrolLoggerUI.classList.remove("hidden");
    saveBtn.disabled = true;
    
    plActionHead.classList.remove("hidden");
    
    renderComment();
    renderItems();
    renderPatrolLog();
    populateOutingSelect();
    setupPatrolLeaderInputs();
  } else {
    codeError.classList.remove("hidden");
    codeInput.value = "";
    codeInput.focus();
  }
}

function unlockModifyLog() {
  if (codeInput.value === SECRET) {
    isModifyingLog = true;
    
    modalOverlay.classList.add("hidden");
    adminBtn.classList.add("hidden");
    modifyPatrolLogBtn.classList.add("hidden");
    plActionHead.classList.remove("hidden");
    
    renderPatrolLog();
  } else {
    codeError.classList.remove("hidden");
    codeInput.value = "";
    codeInput.focus();
  }
}

// ── SAVE CHECK-IN ─────────────────────────────────────────────────────────
saveBtn.addEventListener("click", async () => {
  if (!validateAllItemsAssigned()) {
    alert("Please assign a status to all items before saving.");
    return;
  }
  
  // Validate patrol leader data
  const outingName = localOuting?.outing || newOutingInput.value.trim();
  if (!localPatrolLeader.trim()) {
    alert("Please enter a patrol leader name.");
    patrolLeaderInput.focus();
    return;
  }
  if (!outingName) {
    alert("Please select an existing outing or create a new one.");
    return;
  }
  
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";
  
  try {
    // Write item statuses to database
    const newStatuses = {
      ...(chuckboxDocData.statuses || {}),
      ...localItemChanges
    };
    await saveChuckboxField({ statuses: newStatuses });
    
    // Write comment if edited
    if (isCheckingIn) {
      const commentText = commentInput.value.trim();
      // Only save if it's not just the auto-populated empty message
      const comment = (commentText && !commentText.startsWith("[Auto-populated from items] All items checked")) ? commentText : "";
      await saveChuckboxField({ comment });
    }
    
    // Write patrol leader - always save if we get here
    const outingName = localOuting?.outing || newOutingInput.value.trim();
    if (localOuting?.id) {
      // Update existing outing
      const leaders = { ...(localOuting.leaders || {}), [currentChuckbox]: localPatrolLeader };
      await updateOuting(localOuting.id, { leaders });
    } else if (outingName) {
      // Create new outing
      await createNewOuting(outingName, localPatrolLeader);
    }
    
    // Reset check-in state
    isCheckingIn = false;
    isAdmin = false;
    localItemChanges = {};
    localPatrolLeader = "";
    localOuting = null;
    isModifyingLog = false;
    
    // Reset UI
    adminBtn.classList.remove("hidden");
    modifyPatrolLogBtn.classList.remove("hidden");
    adminNav.classList.add("hidden");
    chuckboxSelect.disabled = false;
    patrolLoggerUI.classList.add("hidden");
    plActionHead.classList.add("hidden");
    
    saveBtn.textContent = "Save Check-In";
    saveBtn.disabled = true;
    
    // Clear form fields
    patrolLeaderInput.value = "";
    outingSelect.value = "";
    newOutingInput.value = "";
    commentInput.value = "";
    
    renderItems();
    renderPatrolLog();
  } catch (err) {
    alert("Error saving check-in. See console.");
    console.error(err);
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Check-In";
  }
}

);

function validateAllItemsAssigned() {
  const itemsForBox = ITEM_DIRECTORY.filter(it => itemBelongsTo(it, currentChuckbox));
  for (const item of itemsForBox) {
    const status = localItemChanges[item.name]?.status ?? chuckboxDocData?.statuses?.[item.name]?.status;
    if (status === "neutral" || !status) {
      return false;
    }
  }
  return true;
}

// ── CHECK SAVE BUTTON STATE ────────────────────────────────────────────
function checkSaveButtonState() {
  if (!isCheckingIn) return;
  const allItemsAssigned = validateAllItemsAssigned();
  const outingName = localOuting?.outing || newOutingInput.value.trim();
  const hasPatrolData = localPatrolLeader.trim() && outingName;
  saveBtn.disabled = !(allItemsAssigned && hasPatrolData);
}

// ── MODIFY LOG MODE ──────────────────────────────────────────────────────
// (Handled by modifyPatrolLogBtn in header - uses modal-based unlock)

// ── POPULATE OUTING SELECT ───────────────────────────────────────────────
function populateOutingSelect() {
  outingSelect.innerHTML = '<option value="">\u2014 Select Recent Outing \u2014</option>';
  outingsData.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = o.outing;
    outingSelect.appendChild(opt);
  });
}

// ── SETUP PATROL LEADER FORM INPUTS ───────────────────────────────────
function setupPatrolLeaderInputs() {
  // Sync patrol leader input to local state
  patrolLeaderInput.addEventListener("input", () => {
    localPatrolLeader = patrolLeaderInput.value.trim();
    checkSaveButtonState();
  });
  
  // Sync outing select
  outingSelect.addEventListener("change", () => {
    if (outingSelect.value) {
      localOuting = outingsData.find(o => o.id === outingSelect.value) || null;
      newOutingInput.value = localOuting?.outing || "";
      patrolLeaderInput.focus();
    } else {
      localOuting = null;
      newOutingInput.value = "";
    }
    checkSaveButtonState();
  });
  
  // Sync new outing input
  newOutingInput.addEventListener("input", () => {
    if (newOutingInput.value.trim()) {
      localOuting = null;
      outingSelect.value = "";
    }
    checkSaveButtonState();
  });
}

// ── FIRESTORE: CHUCKBOX DOC ──────────────────────────────────────────────
// Doc shape: chuckboxes/{name} = { statuses: { [itemName]: {status, missingCount} }, comment: "", updatedAt: ISOString }
function subscribeToChuckbox() {
  if (unsubChuckbox) unsubChuckbox();
  const ref = doc(db, "chuckboxes", currentChuckbox);

  unsubChuckbox = onSnapshot(ref, async (snap) => {
    if (!snap.exists()) {
      chuckboxDocData = { statuses: {}, comment: "", updatedAt: null };
    } else {
      chuckboxDocData = snap.data();
    }
    renderLastUpdated();
    renderComment();
    renderItems();
    renderPatrolLog();
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
    secret: SECRET
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

  if (isAdmin && isCheckingIn) {
    // Show editor in check-in mode
    commentBox.classList.add("hidden");
    commentEditor.classList.remove("hidden");
    
    // Auto-populate with problematic items
    if (!commentInput.value || commentInput.value.startsWith("[Auto-populated")) {
      commentInput.value = generateAutoComment();
    }
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

// ── AUTO-GENERATE COMMENT FROM PROBLEMATIC ITEMS ──────────────────────
function generateAutoComment() {
  const itemsForBox = ITEM_DIRECTORY.filter(it => itemBelongsTo(it, currentChuckbox));
  const problems = [];
  
  itemsForBox.forEach(item => {
    const state = getItemState(item.name);
    const status = state.status;
    
    // Include items that are not checked and not neutral
    if (status !== "checked" && status !== "neutral") {
      const meta = STATUS_META[status];
      const label = meta?.label || status;
      problems.push(`• ${item.emoji} ${item.name}: ${label}`);
    }
  });
  
  if (problems.length === 0) {
    return "[Auto-populated from items] All items checked ✓";
  }
  
  return "[Auto-populated from items]\n" + problems.join("\n");
}

// ── ITEM GRID WITH CATEGORIES ─────────────────────────────────────────────
function markAllInCategory(category, items) {
  items.forEach(item => {
    localItemChanges[item.name] = { status: "checked", missingCount: 1 };
  });
  checkSaveButtonState();
  renderItems();
}

function getItemState(itemName) {
  if (isCheckingIn && localItemChanges[itemName]) {
    return localItemChanges[itemName];
  }
  const statuses = (chuckboxDocData && chuckboxDocData.statuses) || {};
  return statuses[itemName] || { status: "neutral", missingCount: 1 };
}

function renderItems() {
  itemGrid.innerHTML = "";
  const itemsForBox = ITEM_DIRECTORY.filter(it => itemBelongsTo(it, currentChuckbox));

  // Group by category
  const categorized = {};
  itemsForBox.forEach(item => {
    const cat = item.category || "other";
    if (!categorized[cat]) categorized[cat] = [];
    categorized[cat].push(item);
  });

  // Sort categories by order in CATEGORY_DISPLAY
  const sortedCategories = Object.keys(categorized).sort(
    (a, b) => (CATEGORY_DISPLAY[a]?.order || 99) - (CATEGORY_DISPLAY[b]?.order || 99)
  );

  // Render each category in its own box
  sortedCategories.forEach(category => {
    const catLabel = CATEGORY_DISPLAY[category]?.label || category;
    
    // Create category box container
    const categoryBox = document.createElement("div");
    categoryBox.className = "item-category-box";
    
    // Add category header with "mark all complete" button
    const headerDiv = document.createElement("div");
    headerDiv.className = "item-category-header";
    
    const headerText = document.createElement("span");
    headerText.textContent = catLabel;
    headerDiv.appendChild(headerText);
    
    // Add "mark all as complete" button in check-in mode
    if (isCheckingIn) {
      const markAllBtn = document.createElement("button");
      markAllBtn.className = "btn-mark-all-complete";
      markAllBtn.textContent = "[mark all as complete]";
      markAllBtn.addEventListener("click", () => {
        markAllInCategory(category, categorized[category]);
      });
      headerDiv.appendChild(markAllBtn);
    }
    
    categoryBox.appendChild(headerDiv);
    
    // Create grid for items within this category
    const itemsGrid = document.createElement("div");
    itemsGrid.className = "item-category-grid";
    
    // Render items in category
    categorized[category].forEach(item => {
      const state = getItemState(item.name);
      const meta = STATUS_META[state.status] || STATUS_META.neutral;

      const btn = document.createElement("div");
      btn.className = `item-btn status-${meta.color}` + (isAdmin || isCheckingIn ? " admin-editable" : "");
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

      if (isAdmin || isCheckingIn) {
        btn.addEventListener("click", (e) => {
          if (holdFiredAsTooltip) { holdFiredAsTooltip = false; return; }
          cycleStatus(item);
        });
      }

      itemsGrid.appendChild(btn);
    });
    
    categoryBox.appendChild(itemsGrid);
    itemGrid.appendChild(categoryBox);
  });
}

function cycleStatus(item) {
  const cycle = getCycleFor(item);
  const state = getItemState(item.name);
  const currentStatus = state.status;
  const currentMissingCount = state.missingCount || 1;
  
  // If currently on "missing" and item has multiple quantities, cycle through counts first
  if (currentStatus === "missing" && item.quantity && item.quantity > 1) {
    if (currentMissingCount < item.quantity) {
      // Increment missing count
      localItemChanges[item.name] = { status: "missing", missingCount: currentMissingCount + 1 };
    } else {
      // Move to next status in cycle
      const idx = cycle.indexOf(currentStatus);
      const nextStatus = cycle[(idx + 1) % cycle.length];
      localItemChanges[item.name] = { status: nextStatus, missingCount: 1 };
    }
  } else {
    // Normal status cycling
    const idx = cycle.indexOf(currentStatus);
    const nextStatus = cycle[(idx + 1) % cycle.length];
    let nextMissingCount = 1;
    
    if (nextStatus === "missing" && item.quantity && item.quantity > 1) {
      nextMissingCount = 1; // Start at x1 when entering missing status
    }
    
    localItemChanges[item.name] = { status: nextStatus, missingCount: nextMissingCount };
  }
  
  // Check save button state
  checkSaveButtonState();
  
  renderItems();
}

// ── TOOLTIP: DISABLED (removed per user request) ──────────────────────
function attachTooltipHandlers(btn, item, state, meta) {
  // Tooltips disabled - was: hover (desktop) + hold-to-reveal (mobile)
}

// ── PATROL LEADER LOG (shared outings, per-chuckbox leaders) ─────────────
const outingsCol = collection(db, "outings");

onSnapshot(outingsCol, (snap) => {
  outingsData = snap.docs.map(d => ({ id: d.id, ...normalizeOutingDoc(d.data()) }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  renderPatrolLog();
  if (isCheckingIn) populateOutingSelect();
}, (err) => {
  console.error("Outings listener error:", err);
  patrolLogBody.innerHTML = `<tr><td colspan="3" class="patrol-log-empty">Could not load patrol log.</td></tr>`;
});

function renderPatrolLog() {
  patrolLogBody.innerHTML = "";

  // Show all outings always (so user can see and modify logs per chuckbox)
  const visibleOutings = outingsData;

  if (visibleOutings.length === 0) {
    patrolLogBody.innerHTML = `<tr><td colspan="3" class="patrol-log-empty">No outings logged yet.</td></tr>`;
    if (isModifyingLog) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="3" style="text-align:center; padding:16px;"><button class="btn-secondary" id="doneModifyingBtn">Done Modifying</button></td>`;
      patrolLogBody.appendChild(tr);
      document.getElementById("doneModifyingBtn").addEventListener("click", exitModifyLog);
    }
    return;
  }

  visibleOutings.forEach(o => {
    const leaderName = getLeaderForChuckbox(o, currentChuckbox);
    const tr = document.createElement("tr");

    if (isModifyingLog) {
      // Edit mode for modify log
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
      // View mode - show outing and leader for current chuckbox
      tr.innerHTML = `
        <td>${escHtml(o.outing)}</td>
        <td>${escHtml(leaderName)}</td>
      `;
    }
    patrolLogBody.appendChild(tr);
  });
  
  // Add "Done Modifying" button row at the bottom in modify mode
  if (isModifyingLog) {
    const footerTr = document.createElement("tr");
    footerTr.innerHTML = `<td colspan="3" style="text-align:center; padding:16px;"><button class="btn-secondary" id="doneModifyingBtn">Done Modifying</button></td>`;
    patrolLogBody.appendChild(footerTr);
    document.getElementById("doneModifyingBtn").addEventListener("click", exitModifyLog);
  }
}

async function updateOuting(id, partial) {
  const ref = doc(db, "outings", id);
  await setDoc(ref, { ...partial, secret: SECRET }, { merge: true });
}

async function createNewOuting(outingName, leaderName) {
  const leaders = {};
  CHUCKBOXES.forEach(c => leaders[c] = "");
  leaders[currentChuckbox] = leaderName;
  
  const ref = doc(collection(db, "outings"));
  await setDoc(ref, {
    outing: outingName,
    leaders,
    order: Date.now(),
    secret: SECRET
  });
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

cancelDelete.addEventListener("click", () => {
  confirmOverlay.classList.add("hidden");
  pendingDeleteId = null;
});

// ── EXIT MODIFY LOG ────────────────────────────────────────────────────
function exitModifyLog() {
  isModifyingLog = false;
  adminBtn.classList.remove("hidden");
  modifyPatrolLogBtn.classList.remove("hidden");
  plActionHead.classList.add("hidden");
  renderPatrolLog();
}
confirmDelete.addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  confirmOverlay.classList.add("hidden");
  try {
    await deleteDoc(doc(db, "outings", pendingDeleteId));
    renderPatrolLog();
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
