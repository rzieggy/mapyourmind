"use strict";
// Settings, opened with ⌘, or the sidebar: four global choices for new
// elements, styled like the style panel. They live in preferences.json beside
// the document store, never in a document, and the model checks every value
// before using it. Existing elements never change; Tab and Enter still inherit
// from their source.
const builtInSettings = { fontFamily: "Excalifont", sloppiness: 1, sw: 1.8, fontSize: 19 };
async function saveDefaults(next) {
  M.setDefaults(next);
  try {
    await native("savePreferences", { preferences: M.getDefaults() });
  } catch (e) {
    toast(e.message);
  }
}
function settingValue(key) {
  return M.getDefaults().global?.[key] ?? builtInSettings[key];
}
// A built-in value is stored as no setting at all, so the file only ever holds
// real choices and Reset all has something to do only when one exists.
async function chooseSetting(key, value) {
  const global = { ...M.getDefaults().global, [key]: value };
  if (value === builtInSettings[key]) delete global[key];
  await saveDefaults(Object.keys(global).length ? { global } : {});
  syncSettingsPanel();
}
function syncSettingsPanel() {
  for (const b of $("modalBody").querySelectorAll("[data-setting] button"))
    b.setAttribute(
      "aria-pressed",
      String(b.dataset.value === String(settingValue(b.parentElement.dataset.setting))),
    );
  if ($("resetDefaults")) $("resetDefaults").disabled = !M.getDefaults().global;
}
function settingsChoices(key, buttons) {
  return `<div class="stroke-choice-group${key === "fontFamily" ? " font-tiles" : ""}" data-setting="${key}" role="group">${buttons}</div>`;
}
function defaultsPanel() {
  if ($("modal").open) closeModal();
  const strokes = Object.fromEntries(strokeChoices),
    svg = ([value, label, path, width]) =>
      `<button type="button" data-value="${value}" title="${label}" aria-label="${label}"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round"/></svg></button>`;
  showModal(
    `<h2>Settings</h2><p>These apply to new elements only. Everything already on a board keeps its look.</p>
    <div class="settings-list">
      <div class="settings-row stacked"><span>Font</span>${settingsChoices(
        "fontFamily",
        fontChoices
          .map(
            ([value, label, family]) =>
              `<button type="button" data-value="${value}" title="${value}" aria-label="${value}" style="font-family:${family.replace(/"/g, "'")} !important"><span class="font-sample" style="font-family:${family.replace(/"/g, "'")} !important">Aa</span><span class="font-name" style="font-family:${family.replace(/"/g, "'")} !important">${label}</span></button>`,
          )
          .join(""),
      )}</div>
      <div class="settings-row"><span>Sloppiness</span>${settingsChoices("sloppiness", strokes.sloppiness.map(svg).join(""))}</div>
      <div class="settings-row"><span>Stroke width</span>${settingsChoices("sw", strokes.strokeWidth.map(svg).join(""))}</div>
      <div class="settings-row stacked"><span>Default font size</span>${settingsChoices(
        "fontSize",
        labelChoices[0][1]
          .map(
            ([value, label, glyph, size]) =>
              `<button type="button" data-value="${value}" title="${label}" aria-label="${label}"><span class="choice-glyph" style="font-size:${size}px">${glyph}</span></button>`,
          )
          .join(""),
      )}</div>
    </div>
    <div class="actions"><button id="resetDefaults" class="secondary">Reset all</button><button data-close class="primary">Done</button></div>`,
  );
  for (const group of $("modalBody").querySelectorAll("[data-setting]"))
    for (const b of group.querySelectorAll("button"))
      b.onclick = () => {
        const key = group.dataset.setting;
        chooseSetting(key, key === "fontFamily" ? b.dataset.value : Number(b.dataset.value));
      };
  $("resetDefaults").onclick = async () => {
    await saveDefaults({});
    syncSettingsPanel();
  };
  syncSettingsPanel();
}
