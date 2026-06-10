// ── FIREBASE SETUP ───────────────────────────────────────────────────────────
// TODO: Replace the config below with YOUR Firebase project's config.
// Go to: console.firebase.google.com → Your Project → Project Settings → "Your apps" → SDK setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs,
  deleteDoc, doc, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// ── SECRET CODE ──────────────────────────────────────────────────────────────
const SECRET = "BePrepared";

// ── STATE ────────────────────────────────────────────────────────────────────
let isAdmin      = false;
let pendingCheckin = null; // { id, name } awaiting confirm
let allItems     = [];     // live cache of Firestore docs
let searchFilter = "";

// ── DOM REFS ─────────────────────────────────────────────────────────────────
const adminBtn      = document.getElementById("adminBtn");
const adminNav      = document.getElementById("adminNav");
const adminPanels   = document.getElementById("adminPanels");
const lockBtn       = document.getElementById("lockBtn");
const tabBtns       = document.querySelectorAll(".tab-btn");
const panels        = { checkout: document.getElementById("panel-checkout"),
                        checkin:  document.getElementById("panel-checkin") };

const modalOverlay  = document.getElementById("modalOverlay");
const codeInput     = document.getElementById("codeInput");
const codeError     = document.getElementById("codeError");
const cancelModal   = document.getElementById("cancelModal");
const confirmModal  = document.getElementById("confirmModal");

const confirmOverlay  = document.getElementById("confirmOverlay");
const confirmText     = document.getElementById("confirmText");
const cancelCheckin   = document.getElementById("cancelCheckin");
const confirmCheckinBtn = document.getElementById("confirmCheckin");

const equipBody     = document.getElementById("equipBody");
const itemCount     = document.getElementById("itemCount");
const actionCol     = document.getElementById("actionCol");
const searchInput   = document.getElementById("searchInput");

const equipNameEl   = document.getElementById("equipName");
const equipTypeEl   = document.getElementById("equipType");
const personNameEl  = document.getElementById("personName");
const checkoutBtn   = document.getElementById("checkoutBtn");
const checkoutMsg   = document.getElementById("checkoutMsg");

// ── ADMIN MODAL ──────────────────────────────────────────────────────────────
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
    adminPanels.classList.remove("hidden");
    actionCol.classList.remove("hidden");
    renderTable();
  } else {
    codeError.classList.remove("hidden");
    codeInput.value = "";
    codeInput.focus();
  }
}

// ── LOCK ─────────────────────────────────────────────────────────────────────
lockBtn.addEventListener("click", () => {
  isAdmin = false;
  adminNav.classList.add("hidden");
  adminPanels.classList.add("hidden");
  adminBtn.classList.remove("hidden");
  actionCol.classList.add("hidden");
  searchFilter = "";
  searchInput.value = "";
  renderTable();
});

// ── TAB SWITCHING ────────────────────────────────────────────────────────────
tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    tabBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    Object.entries(panels).forEach(([key, el]) => {
      el.classList.toggle("hidden", key !== tab);
    });
  });
});

// ── SEARCH ───────────────────────────────────────────────────────────────────
searchInput.addEventListener("input", () => {
  searchFilter = searchInput.value.trim().toLowerCase();
  renderTable();
});

// ── CHECKOUT ─────────────────────────────────────────────────────────────────
checkoutBtn.addEventListener("click", async () => {
  const name   = equipNameEl.value.trim();
  const type   = equipTypeEl.value;
  const person = personNameEl.value.trim();

  if (!name || !type || !person) {
    checkoutMsg.style.color = "#C0392B";
    checkoutMsg.textContent = "Please fill in all fields.";
    return;
  }

  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "Saving…";

  try {
    await addDoc(collection(db, "equipment"), {
    name, type, person,
     dateOut: new Date().toISOString(),
     secret: "BePrepared"
});
    equipNameEl.value  = "";
    equipTypeEl.value  = "";
    personNameEl.value = "";
    checkoutMsg.style.color = "#4A7A28";
    checkoutMsg.textContent = `✓ "${name}" checked out successfully.`;
    setTimeout(() => { checkoutMsg.textContent = ""; }, 4000);
  } catch (err) {
    checkoutMsg.style.color = "#C0392B";
    checkoutMsg.textContent = "Error saving. Check your Firebase config.";
    console.error(err);
  }

  checkoutBtn.disabled = false;
  checkoutBtn.textContent = "Record Checkout";
});

// ── CONFIRM CHECK-IN MODAL ────────────────────────────────────────────────────
cancelCheckin.addEventListener("click", () => {
  confirmOverlay.classList.add("hidden");
  pendingCheckin = null;
});

confirmCheckinBtn.addEventListener("click", async () => {
  if (!pendingCheckin) return;
  confirmOverlay.classList.add("hidden");
  try {
    await deleteDoc(doc(db, "equipment", pendingCheckin.id));
  } catch (err) {
    alert("Error checking in item. See console.");
    console.error(err);
  }
  pendingCheckin = null;
});

function triggerCheckin(id, name) {
  pendingCheckin = { id, name };
  confirmText.textContent = `Check in "${name}"? This will remove it from the log.`;
  confirmOverlay.classList.remove("hidden");
}

// ── DATE HELPERS ─────────────────────────────────────────────────────────────
function daysOut(isoStr) {
  const ms = Date.now() - new Date(isoStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── RENDER TABLE ─────────────────────────────────────────────────────────────
function renderTable() {
  equipBody.innerHTML = "";

  let items = allItems;

  // Filter if in check-in mode and search has text
  if (searchFilter) {
    items = items.filter(it =>
      it.name.toLowerCase().includes(searchFilter) ||
      it.person.toLowerCase().includes(searchFilter) ||
      it.type.toLowerCase().includes(searchFilter)
    );
  }

  itemCount.textContent = `${allItems.length} item${allItems.length !== 1 ? "s" : ""}`;

  if (items.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="empty-state">${
      allItems.length === 0 ? "No equipment is currently checked out." : "No items match your search."
    }</td>`;
    equipBody.appendChild(tr);
    return;
  }

  items.forEach(item => {
    const days = daysOut(item.dateOut);
    const ageClass = days >= 14 ? "warn-red" : days >= 8 ? "warn-yellow" : "";

    const tr = document.createElement("tr");
    if (ageClass) tr.classList.add(ageClass);

    const ageSuffix = days >= 14
      ? ` <span style="font-size:0.78rem">(${days}d — overdue!)</span>`
      : days >= 8
        ? ` <span style="font-size:0.78rem">(${days}d)</span>`
        : "";

    tr.innerHTML = `
      <td class="equip-name">${escHtml(item.name)}</td>
      <td><span class="equip-type">${escHtml(item.type)}</span></td>
      <td>${escHtml(item.person)}</td>
      <td class="date-cell">${formatDate(item.dateOut)}${ageSuffix}</td>
      <td>${isAdmin
        ? `<button class="btn-checkin" data-id="${item.id}" data-name="${escHtml(item.name)}">Check In</button>`
        : ""}</td>
    `;

    equipBody.appendChild(tr);
  });

  // Attach check-in listeners
  if (isAdmin) {
    equipBody.querySelectorAll(".btn-checkin").forEach(btn => {
      btn.addEventListener("click", () => triggerCheckin(btn.dataset.id, btn.dataset.name));
    });
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── LIVE LISTENER ────────────────────────────────────────────────────────────
const q = query(collection(db, "equipment"), orderBy("dateOut", "asc"));

onSnapshot(q, (snapshot) => {
  allItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  renderTable();
}, (err) => {
  console.error("Firestore error:", err);
  equipBody.innerHTML = `<tr><td colspan="5" class="empty-state">
    Could not load data. Check your Firebase config in script.js.
  </td></tr>`;
});
