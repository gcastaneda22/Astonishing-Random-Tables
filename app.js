// ---- Configure your menu here ----
// Native <select> supports one true grouping level (<optgroup>).
// We simulate a top-level category header with a disabled <option>.
const TABLE_TREE = [
  {
    label: "Magic & Miscellany",
    sections: [
      {
        label: "Scrolls",
        tables: [
          { name: "Spell Scroll Level", path: "tables/magic/scrolls/spell_scroll_level.json" },
          { name: "Cantrip Level Scrolls", path: "tables/magic/scrolls/cantrip_scrolls.json" },
          { name: "1st-Level Spell Scrolls", path: "tables/magic/scrolls/level1_scrolls.json" },
          { name: "2nd-Level Spell Scrolls", path: "tables/magic/scrolls/level2_scrolls.json" },
          { name: "3rd-Level Spell Scrolls", path: "tables/magic/scrolls/level3_scrolls.json" },
          { name: "4th-Level Spell Scrolls", path: "tables/magic/scrolls/level4_scrolls.json" },
          { name: "5th-Level Spell Scrolls", path: "tables/magic/scrolls/level5_scrolls.json" },
          { name: "6th-Level Spell Scrolls", path: "tables/magic/scrolls/level6_scrolls.json" },
          { name: "7th-Level Spell Scrolls", path: "tables/magic/scrolls/level7_scrolls.json" },
          { name: "8th-Level Spell Scrolls", path: "tables/magic/scrolls/level8_scrolls.json" },
          { name: "9th-Level Spell Scrolls", path: "tables/magic/scrolls/level9_scrolls.json" },
          { name: "Unexpected Spell Scroll Results", path: "tables/magic/scrolls/unexpected_results.json" },
          { name: "Transmuted Damage Types", path: "tables/magic/scrolls/transmuted_damage_types.json" },
        ],
      },
      {
        label: "Potions",
        tables: []
      },
      {
        label: "Items with Personality",
        tables: []
      },
      {
        label: "Personalities in Items",
        tables: []
      },
    ],
  },
];

// ---- App code ----
let tables = [];
let currentTable = null;
let history = [];

/* Utilities */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseDice(diceStr) {
  // supports "1d6", "2d20", etc.
  const m = /^(\d+)d(\d+)$/.exec((diceStr || "").trim());
  if (!m) return null;
  return { n: Number(m[1]), die: Number(m[2]) };
}

/* return object { total, rolls } */
function rollDice(dice) {
  const { n, die } = dice;
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(randInt(1, die));
  const total = rolls.reduce((s, v) => s + v, 0);
  return { total, rolls };
}

// Supports TWO table formats:
// A) Classic list:
//    { dice: "1d6", entries: ["...", "...", ...] }
// B) Range-based (supports ranges AND single rolls):
//    { dice: "1d100", entries: [{min:1,max:5,text:"..."}, ...] }
function pickEntry(table) {
  const dice = parseDice(table.dice);
  let r = null;      // if dice -> object {total,rolls} else null
  if (dice) r = rollDice(dice);

  const first = table.entries?.[0];

  // Case A: entries are strings (old style)
  if (typeof first === "string") {
    if (r === null) {
      const idx = randInt(0, table.entries.length - 1);
      return {
        roll: `— (uniform)`,
        text: table.entries[idx],
        diceBreakdown: null
      };
    }
    // use total as index (1-based)
    const idx = Math.min(Math.max(r.total - 1, 0), table.entries.length - 1);
    return {
      roll: `${r.total} (${table.dice})`,
      text: table.entries[idx],
      diceBreakdown: r.rolls
    };
  }

  // Case B: entries are objects with min/max/text (range style)
  if (r === null) {
    const idx = randInt(0, table.entries.length - 1);
    const e = table.entries[idx];
    return {
      roll: `— (uniform)`,
      text: e?.text ?? String(e),
      diceBreakdown: null
    };
  }

  const match = table.entries.find(e =>
    e && typeof e === "object" &&
    typeof e.min === "number" &&
    typeof e.max === "number" &&
    r.total >= e.min && r.total <= e.max
  );

  return {
    roll: `${r.total} (${table.dice})`,
    text: match ? (match.text ?? "—") : "No matching entry for that roll.",
    diceBreakdown: r.rolls
  };
}

/* load json tables from TABLE_TREE */
async function loadTables() {
  const loaded = [];

  for (const cat of TABLE_TREE) {
    for (const section of cat.sections) {
      for (const item of section.tables) {
        const res = await fetch(item.path);
        if (!res.ok) {
          console.warn(`Failed to load ${item.path} (skipping)`);
          continue;
        }
        const t = await res.json();

        // metadata used by UI
        t._path = item.path;
        t._displayName = item.name || t.name || item.name;
        t._category = cat.label;
        t._section = section.label;

        loaded.push(t);
      }
    }
  }

  return loaded;
}

/* UI rendering */
function renderSelect() {
  const sel = document.getElementById("tableSelect");
  sel.innerHTML = "";

  const INDENT = "\u00A0\u00A0\u00A0\u00A0";
  const INDENT_DEEP = "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0";

  for (const cat of TABLE_TREE) {
    // Level 1: top category header (disabled divider)
    const catHeader = document.createElement("option");
    catHeader.textContent = cat.label.toUpperCase();
    catHeader.disabled = true;
    catHeader.value = "";
    sel.appendChild(catHeader);

    // Level 2: sections as optgroups (bold label in most browsers)
    for (const section of cat.sections) {
      const group = document.createElement("optgroup");
      group.label = INDENT + section.label;

      // Level 3: tables as options (indented)
      for (const item of section.tables) {
        const opt = document.createElement("option");
        opt.value = item.path;
        opt.textContent = INDENT_DEEP + item.name;
        group.appendChild(opt);
      }

      sel.appendChild(group);
    }
  }

  sel.addEventListener("change", () => {
    currentTable = tables.find(t => t._path === sel.value) || null;
    renderCurrentTableHeader();
    document.getElementById("output").textContent = "Ready to roll.";
  });

  // Default selection to first real table in the tree
  const firstPath = TABLE_TREE?.[0]?.sections?.[0]?.tables?.[0]?.path ?? null;
  if (firstPath) {
    sel.value = firstPath;
    currentTable = tables.find(t => t._path === firstPath) || null;
    renderCurrentTableHeader();
    document.getElementById("output").textContent = "Ready to roll.";
  } else {
    renderCurrentTableHeader();
  }
}

function renderCurrentTableHeader() {
  document.getElementById("tableName").textContent = currentTable?._displayName ?? "—";
  document.getElementById("rollInfo").textContent =
    currentTable?.dice ? `Dice: ${currentTable.dice}` : "";
}

function formatDiceBreakdown(rolls) {
  if (!rolls || !rolls.length) return "";
  return ` [${rolls.join(" + ")}]`;
}

/* History handling */
function addHistoryEntry({ tableName, rollText, rollInfo, diceBreakdown }) {
  const entry = {
    id: Date.now() + "-" + Math.floor(Math.random() * 9999),
    tableName,
    rollText,
    rollInfo,
    diceBreakdown,
    time: new Date().toISOString()
  };
  history.unshift(entry); // newest first
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  if (history.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "No rolls yet.";
    list.appendChild(li);
    return;
  }

  for (const item of history) {
    const li = document.createElement("li");
    li.className = "history-item";

    const meta = document.createElement("div");
    meta.className = "meta";
    const tableEl = document.createElement("div");
    tableEl.className = "table";
    tableEl.textContent = item.tableName;

    const timeEl = document.createElement("div");
    timeEl.className = "time";
    timeEl.textContent = new Date(item.time).toLocaleString();

    const textEl = document.createElement("div");
    textEl.className = "text";
    const diceStr = item.diceBreakdown ? formatDiceBreakdown(item.diceBreakdown) : "";
    textEl.textContent = `${item.rollInfo} — ${item.rollText}${diceStr}`;

    meta.appendChild(tableEl);
    meta.appendChild(timeEl);
    meta.appendChild(textEl);

    const actions = document.createElement("div");
    actions.className = "actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "small-btn secondary";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(`${item.tableName}\n${item.rollInfo} — ${item.rollText}${diceStr}`);
    });

    const rerollBtn = document.createElement("button");
    rerollBtn.className = "small-btn";
    rerollBtn.textContent = "Reroll";
    rerollBtn.addEventListener("click", () => {
      const tbl = tables.find(t => t._displayName === item.tableName) || currentTable;
      if (!tbl) return;
      const result = pickEntry(tbl);
      displayResult(tbl, result);
      addHistoryEntry({
        tableName: tbl._displayName,
        rollText: result.text,
        rollInfo: result.roll,
        diceBreakdown: result.diceBreakdown
      });
    });

    actions.appendChild(copyBtn);
    actions.appendChild(rerollBtn);

    li.appendChild(meta);
    li.appendChild(actions);

    list.appendChild(li);
  }
}

/* UI wiring */
function wireButtons() {
  document.getElementById("rollBtn").addEventListener("click", () => {
    if (!currentTable) {
      document.getElementById("output").textContent = "Please pick a table first.";
      return;
    }
    const times = Math.max(1, Number(document.getElementById("timesInput").value) || 1);
    for (let i = 0; i < times; i++) {
      const result = pickEntry(currentTable);
      displayResult(currentTable, result);
      addHistoryEntry({
        tableName: currentTable._displayName,
        rollText: result.text,
        rollInfo: result.roll,
        diceBreakdown: result.diceBreakdown
      });
    }
  });

  document.getElementById("copyBtn").addEventListener("click", async () => {
    const out = document.getElementById("output").textContent;
    const info = document.getElementById("rollInfo").textContent;
    const name = document.getElementById("tableName").textContent;
    await navigator.clipboard.writeText(`${name}\n${info}\n${out}`);
  });

  document.getElementById("randomTableBtn").addEventListener("click", () => {
    if (!tables.length) return;
    const idx = randInt(0, tables.length - 1);
    currentTable = tables[idx];
    // update select UI to match
    const sel = document.getElementById("tableSelect");
    sel.value = currentTable._path;
    renderCurrentTableHeader();
    document.getElementById("output").textContent = `Selected random table: ${currentTable._displayName}`;
  });

  document.getElementById("clearHistoryBtn").addEventListener("click", () => {
    history = [];
    renderHistory();
  });

  // Enter key triggers roll (when using select or times input)
  const enterTargets = [document.getElementById("tableSelect"), document.getElementById("timesInput")];
  enterTargets.forEach(el => {
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        document.getElementById("rollBtn").click();
      }
    });
  });
}

/* Display helper */
function displayResult(table, result) {
  const diceStr = result.diceBreakdown ? formatDiceBreakdown(result.diceBreakdown) : "";
  document.getElementById("output").textContent = `${result.text}${diceStr}`;
  document.getElementById("rollInfo").textContent = `Roll: ${result.roll}`;
  document.getElementById("tableName").textContent = table._displayName || "—";
}

/* Init */
(async function init() {
  try {
    tables = await loadTables();
    if (!tables || tables.length === 0) {
      console.warn("No tables loaded.");
    }
    renderSelect();
    wireButtons();
    renderHistory();
  } catch (err) {
    console.error(err);
    document.getElementById("output").textContent =
      "Error loading tables. Check the console and make sure your JSON paths are correct.";
  }
})();