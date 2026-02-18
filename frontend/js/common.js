// -----------------------------
// Configuration parameters
// -----------------------------
let timeoutToast = 3000; // milliseconds
const stringCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

// -----------------------------
// Validate the IPv4 address format
// -----------------------------
export function isValidIPv4(ip) {
    if (!ip || !ip.trim()) return true; // empty is allowed
    const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
    return ipv4.test(ip);
}

// -----------------------------
// Validate the IPv6 address format
// -----------------------------
export function isValidIPv6(ip) {
    if (!ip || !ip.trim()) return true; // empty is allowed
    // Parser robusto (gestisce '::')
    let s = ip.toLowerCase().trim();
    const dbl = s.indexOf("::");
    let parts = [];
    if (dbl >= 0) {
        const left = s.slice(0, dbl).split(":").filter(Boolean);
        const right = s.slice(dbl + 2).split(":").filter(Boolean);
        const missing = 8 - (left.length + right.length);
        if (missing < 0) return false;
        parts = [...left, ...Array(missing).fill("0"), ...right];
    } else {
        parts = s.split(":");
        if (parts.length !== 8) return false;
    }
    return parts.every(p => /^[0-9a-f]{1,4}$/.test(p));
}

// -----------------------------
// Validate the MAC address format
// -----------------------------
export function isValidMAC(mac) {
  const s = (mac ?? "").trim().toLowerCase().replace(/[\s:\-\.]/g, "");
  // vuoto consentito
  if (s === "") return true;
  return /^[0-9a-f]{12}$/.test(s);
}

// -----------------------------
// Display a temporary notification message
// -----------------------------
export function showToast(message, success = true) {
    const toast = document.getElementById("toast");
    toast.textContent = message;

    toast.style.background = success ? "#28a745" : "#d9534f"; // green / red

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, timeoutToast);
}

/**
 * Parser per tipi di dato:
 * - number: riconosce float, anche con virgole migliaia
 * - date: tenta Date.parse su formati comuni
 * - ipv4: ordina per valore numerico dei 4 ottetti
 * - ipv6: espande '::' e ordina come BigInt 128-bit
 * - mac: normalizza e ordina come BigInt 48-bit
 * - version: ordina semver-like "1.2.10"
 * - string: predefinito (locale-aware, case-insensitive, con numerico)
 */
export function parseByType(value, type) {
    const v = (value ?? "").trim();

    if (v === "") return { type: "empty", value: null };

    switch (type) {
        case "number": {
            // Rimuove separatori di migliaia (spazio, apostrofo, punto prima di gruppi da 3)
            // e converte la virgola decimale in punto.
            const norm = v.replace(/[\s'’\.](?=\d{3}\b)/g, "").replace(",", ".");
            const n = Number(norm);
            return isNaN(n) ? { type: "string", value: v.toLowerCase() } : { type: "number", value: n };
        }

        case "date": {
            let time = Date.parse(v);
            if (isNaN(time)) {
                // prova formato DD/MM/YYYY [HH:mm]
                const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
                if (m) {
                    const [_, d, mo, y, hh = "0", mm = "0"] = m;
                    time = Date.parse(`${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}T${hh.padStart(2,"0")}:${mm.padStart(2,"0")}:00`);
                }
            }
            return isNaN(time) ? { type: "string", value: v.toLowerCase() } : { type: "date", value: time };
        }

        case "ipv4": {
            const m = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
            if (m) {
                const a = +m[1], b = +m[2], c = +m[3], d = +m[4];
                if ([a,b,c,d].every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
                    const num = ((a << 24) | (b << 16) | (c << 8) | d) >>> 0; // 32-bit unsigned
                    return { type: "ipv4", value: num };
                }
            }
            return { type: "string", value: v.toLowerCase() };
        }

        case "ipv6": {
            // Espansione '::' e parsing 8 gruppi hex da 16 bit ? BigInt 128-bit
            let s = v.toLowerCase().trim();
            const dbl = s.indexOf("::");
            let parts = [];
            if (dbl >= 0) {
                const left = s.slice(0, dbl).split(":").filter(Boolean);
                const right = s.slice(dbl + 2).split(":").filter(Boolean);
                const missing = 8 - (left.length + right.length);
                if (missing < 0) return { type: "string", value: v.toLowerCase() };
                parts = [...left, ...Array(missing).fill("0"), ...right];
            } else {
                parts = s.split(":");
                if (parts.length !== 8) return { type: "string", value: v.toLowerCase() };
            }
            if (!parts.every(p => /^[0-9a-f]{1,4}$/.test(p))) {
                return { type: "string", value: v.toLowerCase() };
            }
            let big = 0n;
            for (const p of parts) {
                big = (big << 16n) + BigInt(parseInt(p, 16));
            }
            return { type: "ipv6", value: big };
        }

        case "mac": {
            // Accetta :, -, ., spazi o formato compatto; ordina come BigInt 48-bit
            let s = v.toLowerCase().trim().replace(/[\s:\-\.]/g, "");
            if (!/^[0-9a-f]{12}$/.test(s)) {
                return { type: "string", value: v.toLowerCase() };
            }
            const mac = BigInt("0x" + s);
            return { type: "mac", value: mac };
        }

        case "version": {
            const segs = v.split(".").map(s => (/^\d+$/.test(s) ? Number(s) : s.toLowerCase()));
            return { type: "version", value: segs };
        }

        default:
        case "string":
            return { type: "string", value: v.toLowerCase() };
    }
}

/**
 * Comparatore generico in base al tipo
 */
export function comparator(aParsed, bParsed) {
    // Celle vuote in fondo in asc
    if (aParsed.type === "empty" && bParsed.type === "empty") return 0;
    if (aParsed.type === "empty") return 1;
    if (bParsed.type === "empty") return -1;

    // Se i tipi differiscono (capita se fallback a string), imponi una gerarchia:
    // tipi “numerici” prima delle stringhe
    if (aParsed.type !== bParsed.type) {
        const rank = { number: 0, date: 0, ipv4: 0, ipv6: 0, mac: 0, version: 0, string: 1 };
        return (rank[aParsed.type] ?? 1) - (rank[bParsed.type] ?? 1);
    }

    switch (aParsed.type) {
        case "number":
        case "date":
        case "ipv4":
            return aParsed.value - bParsed.value;

        case "ipv6":
        case "mac": {
            // Confronto BigInt
            if (aParsed.value === bParsed.value) return 0;
            return aParsed.value < bParsed.value ? -1 : 1;
        }

        case "version": {
            const a = aParsed.value, b = bParsed.value;
            const len = Math.max(a.length, b.length);
            for (let i = 0; i < len; i++) {
                const av = a[i] ?? 0;
                const bv = b[i] ?? 0;
                if (typeof av === "number" && typeof bv === "number") {
                    if (av !== bv) return av - bv;
                } else {
                    const as = String(av), bs = String(bv);
                    const cmp = stringCollator.compare(as, bs);
                    if (cmp !== 0) return cmp;
                }
            }
            return 0;
        }

        case "string":
        default:
            return stringCollator.compare(aParsed.value, bParsed.value);
    }
}

/**
 * Aggiorna UI delle frecce e ARIA in thead
 */
export function updateSortUI(table, colIndex, ascending) {
    const ths = table.querySelectorAll("thead th");
    ths.forEach((th, i) => {
        const arrow = th.querySelector(".sort-arrow");
        th.setAttribute("aria-sort", i === colIndex ? (ascending ? "ascending" : "descending") : "none");
        th.classList.toggle("is-sorted", i === colIndex);
        if (arrow) {
            arrow.classList.remove("asc", "desc");
            if (i === colIndex) arrow.classList.add(ascending ? "asc" : "desc");
        }
        // Se usi pulsanti <button>, puoi aggiornare aria-pressed/aria-label qui.
    });
}

/**
 * Sort the table by column
 * @param {number} colIndex - Indice di colonna da ordinare (0-based)
 * @param {{sortDirection: Record<number, boolean>, lastSort: {colIndex:number, ascending:boolean} | null}} state
 * @param {string} [tableId='dataTable']
 */
export function sortTable(colIndex, state, tableId = 'dataTable') {
  const table = document.getElementById(tableId);
  if (!table) return;

  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll('tr'));
  const ths = table.querySelectorAll('thead th');

  // Tipo della colonna (fallback a string)
  const type = ths[colIndex]?.dataset?.type || 'string';

  // Toggle direzione (true = asc, false = desc)
  state.sortDirection[colIndex] = !state.sortDirection[colIndex];
  const ascending = !!state.sortDirection[colIndex];
  const direction = ascending ? 1 : -1;

  // Pre-parsing per performance
  const parsed = rows.map((row, idx) => {
    const cell = row.children[colIndex];
    const raw = (cell?.getAttribute('data-value') ?? cell?.innerText ?? '').trim();
    return { row, idx, parsed: parseByType(raw, type) };
  });

  // Sort con tie-break su indice originale per stabilità
  parsed.sort((a, b) => {
    const c = comparator(a.parsed, b.parsed);
    return c !== 0 ? c * direction : (a.idx - b.idx);
  });

  // Re-append più efficiente
  const frag = document.createDocumentFragment();
  parsed.forEach(p => frag.appendChild(p.row));
  tbody.appendChild(frag);

  // UI/ARIA delle frecce
  updateSortUI(table, colIndex, ascending);

  // Aggiorna lo stato condiviso
  state.lastSort = { colIndex, ascending };
}

/**
 * Reset sorting state & UI
 * @param {{sortDirection: Record<number, boolean>, lastSort: {colIndex:number, ascending:boolean} | null}} state
 * @param {string} [tableId='dataTable']
 */
export function resetSorting(state, tableId = 'dataTable') {
  const table = document.getElementById(tableId);
  if (!table) return;

  // Svuota sortDirection senza riassegnare (così il chiamante vede il cambiamento)
  Object.keys(state.sortDirection).forEach(k => delete state.sortDirection[k]);
  state.lastSort = null;

  // Reset ARIA e classi frecce
  table.querySelectorAll('thead th').forEach(th => {
    th.setAttribute('aria-sort', 'none');
    th.classList.remove('is-sorted');
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.classList.remove('asc', 'desc');
  });
}

/**
 * Opzionale: inizializza aria-sort='none'
 */
export function initSortableTable() {
    const table = document.getElementById("dataTable");
    if (!table) return;
    const ths = table.querySelectorAll("thead th");
    ths.forEach(th => th.setAttribute("aria-sort", "none"));
}