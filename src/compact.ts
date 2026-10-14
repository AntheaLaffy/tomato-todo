const storageKey = "tomato.compactMode";
let enabled = false;
try {
  enabled = localStorage.getItem(storageKey) === "1";
} catch {}

export function compactModeEnabled() {
  return enabled;
}

function applyCompactMode() {
  document.documentElement.dataset.compactMode = String(enabled);
}

export function setCompactMode(value: boolean) {
  // Persist before applying so a failed write cannot look like a saved choice.
  localStorage.setItem(storageKey, value ? "1" : "0");
  enabled = value;
  applyCompactMode();
}

applyCompactMode();
