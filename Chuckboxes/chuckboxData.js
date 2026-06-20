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
  { name: "Camp Stove",          emoji: "🔥" },
  { name: "Big Pot",             emoji: "🍲" },
  { name: "Big Pot Lid",         emoji: "⭕" },
  { name: "Medium Pot",          emoji: "🍲" },
  { name: "Medium Pot Lid",      emoji: "⭕" },
  { name: "Small Pot",           emoji: "🍲" },
  { name: "Small Pot Lid",       emoji: "⭕" },
  { name: "Pan",                 emoji: "🍳" },
  { name: "Plates",              emoji: "🍽️", quantity: 5 },
  { name: "Cutting Board",       emoji: "🔪" },
  { name: "Knife",               emoji: "🗡️", quantity: 2 },
  { name: "Tongs",               emoji: "🥢" },
  { name: "Large Spoon",         emoji: "🥄" },
  { name: "Ladle",               emoji: "🥣" },
  { name: "Can Opener",          emoji: "🔧" },
  { name: "Spatula",             emoji: "🍳" },
  { name: "Sanitization Tabs",   emoji: "💊", type: "consumable" },
  { name: "Paper Towels",        emoji: "🧻", type: "consumable" },
  { name: "Aluminum Foil",       emoji: "🥡", type: "consumable" },
  { name: "Cooking Spray",       emoji: "🧴", type: "consumable" },
  { name: "Vegetable Oil",       emoji: "🫗", type: "consumable" },
  { name: "Salt",                emoji: "🧂", type: "consumable" },
  { name: "Pepper",              emoji: "🧂", type: "consumable" },
  { name: "Cinnamon",            emoji: "🟤" },
  { name: "Hot Glove",           emoji: "🧤", quantity: 2 },
];

// ── STATUS DEFINITIONS ───────────────────────────────────────────────
// Order matters — this is the cycle order admins click through.
// `consumableOnly: true` statuses only apply to type:"consumable" items.
// `quantityOnly: true` statuses only apply to items with quantity > 1.

export const STATUS_CYCLE_REGULAR    = ["checked", "damaged", "missing"];
export const STATUS_CYCLE_CONSUMABLE = ["checked", "low", "empty"];

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
  }
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
