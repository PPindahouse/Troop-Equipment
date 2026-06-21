// ══════════════════════════════════════════════════════════════════════
// CHUCKBOX ITEM DIRECTORY
// ══════════════════════════════════════════════════════════════════════
// This is the ONLY place you need to edit to add, remove, or change items.
//
// Fields per item:
//   name        — Item name (string, required)
//   emoji       — Emoji shown on the button (string, required)
//   type        — "consumable" or "" (blank = regular item)
//   quantity    — number > 1, or "" (blank = quantity of 1)
//   category    — "consumable", "utensil", "cooking", or "other" (for organizing display)
//   application — array of chuckbox names this item belongs to,
//                 or [] / omitted = appears in ALL chuckboxes
//
// CHUCKBOX NAMES (must match exactly): "Cobra", "Egg", "Moose", "Scorpion", "Adult"
//
// EXAMPLES:
//   Make an item exclusive to one box:
//     { name: "Adult Coffee Press", emoji: "☕", application: ["Adult"] }
//
//   Make an item exclusive to two boxes:
//     { name: "Griddle", emoji: "🍳", application: ["Cobra", "Moose"] }
//
//   Add a consumable with a custom low/empty meaning:
//     { name: "Dish Soap", emoji: "🧴", type: "consumable" }
//
//   Add a regular item with multiple units:
//     { name: "Lantern", emoji: "🏮", quantity: 3 }
// ══════════════════════════════════════════════════════════════════════

export const CHUCKBOXES = ["Cobra", "Egg", "Moose", "Scorpion", "Adult"];

export const ITEM_DIRECTORY = [
  // ── CONSUMABLES ────────────────────────────────────────────
  { name: "Liquid Soap",         emoji: "🧴", type: "consumable", category: "consumable" },
  { name: "Sponge",              emoji: "🧽", type: "consumable", category: "consumable" },
  { name: "Steel Wool",          emoji: "✨", type: "consumable", category: "consumable" },
  { name: "Sanitization Tabs",   emoji: "💊", type: "consumable", category: "consumable" },
  { name: "Paper Towels",        emoji: "🧻", type: "consumable", category: "consumable" },
  { name: "Aluminum Foil",       emoji: "🥡", type: "consumable", category: "consumable" },
  { name: "Cooking Spray",       emoji: "🧴", type: "consumable", category: "consumable" },
  { name: "Vegetable Oil",       emoji: "🫗", type: "consumable", category: "consumable" },
  { name: "Salt",                emoji: "🧂", type: "consumable", category: "consumable" },
  { name: "Pepper",              emoji: "🧂", type: "consumable", category: "consumable" },
  { name: "Old Bay Seasoning",   emoji: "🌿", type: "consumable", category: "consumable" },
  { name: "Cinnamon",            emoji: "🟤", type: "consumable", category: "consumable" },

  // ── UTENSILS ───────────────────────────────────────────────
  { name: "Vegetable Peeler",    emoji: "🔪", category: "utensil" },
  { name: "Knife",               emoji: "🗡️", quantity: 2, category: "utensil" },
  { name: "Tongs",               emoji: "🥢", category: "utensil" },
  { name: "Large Spoon",         emoji: "🥄", category: "utensil" },
  { name: "Slotted Spoon",       emoji: "🥄", category: "utensil" },
  { name: "Ladle",               emoji: "🥣", category: "utensil" },
  { name: "Can Opener",          emoji: "🔧", category: "utensil" },
  { name: "Spatula",             emoji: "🍳", category: "utensil" },

  // ── COOKING ────────────────────────────────────────────────
  { name: "Camp Stove",          emoji: "🔥", category: "cooking" },
  { name: "Pan Handle",          emoji: "🔥", category: "cooking" },
  { name: "Cutting Board",       emoji: "🔪", category: "cooking" },
  { name: "Big Pot",             emoji: "🍲", category: "cooking" },
  { name: "Big Pot Lid",         emoji: "⭕", category: "cooking" },
  { name: "Medium Pot",          emoji: "🍲", category: "cooking" },
  { name: "Medium Pot Lid",      emoji: "⭕", category: "cooking" },
  { name: "Small Pot",           emoji: "🍲", category: "cooking" },
  { name: "Small Pot Lid",       emoji: "⭕", category: "cooking" },
  { name: "Pan",                 emoji: "🍳", category: "cooking" },
  { name: "Cast Iron Griddle",   emoji: "🔲", category: "cooking" },
  { name: "Colander",            emoji: "🫧", category: "cooking" },
  { name: "Plates",              emoji: "🍽️", quantity: 5, category: "cooking" },

  // ── OTHER ──────────────────────────────────────────────────
  { name: "Propane Hose",        emoji: "🔗", category: "other" },
  { name: "Measuring Cup",       emoji: "📏", category: "other" },
  { name: "Hot Glove",           emoji: "🧤", quantity: 2, category: "other" },
  { name: "Picnic Table Cover",  emoji: "🛋️", category: "other" },
  { name: "Fire Blanket",        emoji: "🔴", category: "other" },
];

// ── STATUS DEFINITIONS ───────────────────────────────────────────────
// Order matters — this is the cycle order admins click through.
// During check-in, items start at "neutral" and must be cycled to another status.
// Neutral is NOT persisted to the database.

export const STATUS_CYCLE_REGULAR    = ["neutral", "checked", "damaged", "missing"];
export const STATUS_CYCLE_CONSUMABLE = ["neutral", "checked", "low", "empty"];

export const STATUS_META = {
  checked: {
    label: "Checked",
    color: "checked",
    describe: (item) => `${item.name} is correctly present in the box.`
  },
  low: {
    label: "Low",
    color: "low",
    describe: (item) => `${item.name} is present but running low — consider restocking soon.`
  },
  empty: {
    label: "Empty",
    color: "empty",
    describe: (item) => `${item.name} is out and needs to be restocked before the next outing.`
  },
  damaged: {
    label: "Damaged",
    color: "damaged",
    describe: (item) => `${item.name} is in the box but damaged — check before relying on it.`
  },
  missing: {
    label: "Missing",
    color: "missing",
    describe: (item) => item.quantity && item.quantity > 1
      ? `At least one ${item.name} is missing from the box.`
      : `${item.name} is missing from the box.`
  },
  neutral: {
    label: "Needs Check",
    color: "neutral",
    describe: (item) => `${item.name} needs to be checked and assigned a status.`
  }
};

// ── CATEGORY DEFINITIONS ───────────────────────────────────
export const CATEGORY_DISPLAY = {
  consumable: { label: "Consumables", order: 1 },
  utensil: { label: "Utensils", order: 2 },
  cooking: { label: "Cooking Items", order: 3 },
  other: { label: "Other", order: 4 }
};

// Builds the display label for a missing-with-quantity item, e.g. "Missing x2"
export function missingLabel(item, missingCount) {
  if (item.quantity && item.quantity > 1) {
    return `Missing x${missingCount || 1}`;
  }
  return "Missing";
}

// Returns true if `item` belongs to `chuckboxName`
export function itemBelongsTo(item, chuckboxName) {
  if (!item.application || item.application.length === 0) return true;
  return item.application.includes(chuckboxName);
}

// Returns the correct status cycle array for an item
export function getCycleFor(item) {
  return item.type === "consumable" ? STATUS_CYCLE_CONSUMABLE : STATUS_CYCLE_REGULAR;
}
