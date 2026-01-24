let editingHostId = null;
let sortDirection = {};
let lastSort = null; // { colIndex: number, ascending: boolean }
const stringCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

// -----------------------------
// Validate the IPv4 address format
// -----------------------------
function isValidIPv4(ip) {
    if (!ip || !ip.trim()) return true; // empty is allowed
    const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
    return ipv4.test(ip);
}

// -----------------------------
// Validate the IPv6 address format
// -----------------------------
function isValidIPv6(ip) {
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
function isValidMAC(mac) {
  const s = (mac ?? "").trim().toLowerCase().replace(/[\s:\-\.]/g, "");
  // vuoto consentito
  if (s === "") return true;
  return /^[0-9a-f]{12}$/.test(s);
}

// -----------------------------
// LOAD ALL HOSTS INTO THE TABLE
// -----------------------------
async function loadHosts() {
    const res = await fetch("/api/hosts");
    if (!res.ok) {
        showToast("Errore nel caricamento degli host", false);
        return;
    }
    const hosts = await res.json();

    const tbody = document.querySelector("#hosts-table tbody");
    tbody.innerHTML = "";

    hosts.forEach(h => {
        const tr = document.createElement("tr");

        // Name
        const tdName = document.createElement("td");
        const nameVal = (h.name ?? "").toString();
        tdName.textContent = nameVal;
        if (nameVal) tdName.setAttribute("data-value", nameVal.toLowerCase());
        tr.appendChild(tdName);

        // IPv4
        const tdIPv4 = document.createElement("td");
        const ipv4Raw = (h.ipv4 ?? "").trim();
        tdIPv4.textContent = ipv4Raw;
        if (ipv4Raw) tdIPv4.setAttribute("data-value", ipv4Raw);
        tr.appendChild(tdIPv4);

        // IPv6
        const tdIPv6 = document.createElement("td");
        const ipv6Raw = (h.ipv6 ?? "").trim();
        tdIPv6.textContent = ipv6Raw;
        if (ipv6Raw) tdIPv6.setAttribute("data-value", ipv6Raw.toLowerCase());
        tr.appendChild(tdIPv6);

        // MAC
        const tdMAC = document.createElement("td");
        const macRaw = (h.mac ?? "").trim();
        tdMAC.textContent = macRaw;
        const macNorm = macRaw.toLowerCase().replace(/[\s:\-\.]/g, "");
        if (macNorm) tdMAC.setAttribute("data-value", macNorm);
        tr.appendChild(tdMAC);

        // Note
        const tdNote = document.createElement("td");
        const noteVal = (h.note ?? "").toString();
        tdNote.textContent = noteVal;
        if (noteVal) tdNote.setAttribute("data-value", noteVal.toLowerCase());
        tr.appendChild(tdNote);

        // SSL (icon)
        const tdSSL = document.createElement("td");
        const sslEnabled = !!h.ssl_enabled; // 1/true -> true
        if (sslEnabled) {
            tdSSL.innerHTML = "&#10004;";
            tdSSL.setAttribute("data-value", "true");
            tdSSL.setAttribute("aria-label", "SSL attivo");
        } else {
            tdSSL.setAttribute("data-value", "false");
            tdSSL.setAttribute("aria-label", "SSL non attivo");
        }
        tr.appendChild(tdSSL);

        // Actions
        const tdActions = document.createElement("td");
        tdActions.className = "actions";
        tdActions.innerHTML = `
            <span class="edit-btn" onclick="editHost(${Number(h.id)})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#007BFF" aria-hidden="true">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 
                    7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 
                    0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
            </span>
            <span class="delete-btn" onclick="deleteHost(${Number(h.id)})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#0099FF" aria-hidden="true">
                    <path d="M3 6h18v2H3V6zm2 3h14l-1.5 
                    12.5h-11L5 9zm5-6h4l1 1h5v2H4V4h5l1-1z"/>
                </svg>
            </span>
        `;
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
    });

    if (lastSort) {
        sortDirection[lastSort.colIndex] = !lastSort.ascending;
        sortTable(lastSort.colIndex);
    }
}

// -----------------------------
// OPEN POPUP IN EDIT MODE
// -----------------------------
async function editHost(id) {
    const res = await fetch(`/api/hosts/${id}`);
    if (!res.ok) {
        console.error(`Errore nel recupero host ${id}:`, res.status);
        showToast("Errore nel recupero host", false);
        return;
    }
    const host = await res.json();

    // Store the ID of the host being edited
    editingHostId = id;

    // Pre-fill the form fields
    document.getElementById("hostName").value = host.name;
    document.getElementById("hostIPv4").value = host.ipv4 || "";
    document.getElementById("hostIPv6").value = host.ipv6 || "";
    document.getElementById("hostMAC").value = host.mac || "";
    document.getElementById("hostNote").value = host.note || "";
    document.getElementById("hostSSL").checked = !!host.ssl_enabled;

    document.getElementById("addHostModal").style.display = "flex";
}

// -----------------------------
// OPEN POPUP IN CREATE MODE
// -----------------------------
function openAddHostModal() {
    editingHostId = null; // Reset edit mode

    // Clear all fields
    document.getElementById("hostName").value = "";
    document.getElementById("hostIPv4").value = "";
    document.getElementById("hostIPv6").value = "";
    document.getElementById("hostMAC").value = "";
    document.getElementById("hostNote").value = "";
    document.getElementById("hostSSL").checked = false;

    document.getElementById("addHostModal").style.display = "flex";
}

// -----------------------------
// CLOSE POPUP
// -----------------------------
function closeAddHostModal() {
    editingHostId = null; // Always reset edit mode
    document.getElementById("addHostModal").style.display = "none";
}

// -----------------------------
// SAVE HOST (CREATE OR UPDATE)
// -----------------------------
async function saveHost() {
    // Validate required fields
    if (!document.getElementById("hostName").value.trim()) {
        showToast("Name is required", false);
        return; // stop here, do NOT send the request
    }
    // Validate IPv4 format
    if (!isValidIPv4(document.getElementById("hostIPv4").value)) {
        showToast("Invalid IPv4 format", false);
        return;
    }
    // Validate IPv6 format
    if (!isValidIPv6(document.getElementById("hostIPv6").value)) {
        showToast("Invalid IPv6 format", false);
        return;
    }
    // Validate MAC format
    if (!isValidMAC(document.getElementById("hostMAC").value)) {
        showToast("Invalid MAC format", false);
        return;
    }

    const payload = {
        name: document.getElementById("hostName").value,
        ipv4: document.getElementById("hostIPv4").value,
        ipv6: document.getElementById("hostIPv6").value,
        mac: document.getElementById("hostMAC").value,
        note: document.getElementById("hostNote").value,
        ssl_enabled: document.getElementById("hostSSL").checked ? 1 : 0
    };

    try {
        if (editingHostId !== null) {
            // UPDATE EXISTING HOST
            const res = await fetch(`/api/hosts/${editingHostId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`Update failed: ${res.status}`);
            showToast("Host updated successfully");
        } else {
            // CREATE NEW HOST
            const res = await fetch("/api/hosts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`Create failed: ${res.status}`);
            showToast("Host added successfully");
        }

        closeAddHostModal();
        await loadHosts();

    } catch (err) {
        console.error(err);
        showToast("Error while saving host", false);
    }
}

// -----------------------------
// DELETE HOST
// -----------------------------
async function deleteHost(id) {
    try {
        const res = await fetch(`/api/hosts/${id}`, { method: "DELETE" });
        if (!res.ok) {
            throw new Error("Delete failed");
        }
        showToast("Host removed successfully");

    } catch (err) {
        console.error(err);
        showToast("Error while removing host", false);
    }

    await loadHosts();
}

// -----------------------------
// Display a temporary notification message
// -----------------------------
function showToast(message, success = true) {
    const toast = document.getElementById("toast");
    toast.textContent = message;

    toast.style.background = success ? "#28a745" : "#d9534f"; // green / red

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

// -----------------------------
// filter hosts in the table
// -----------------------------
function filterHosts() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const rows = document.querySelectorAll("#hosts-table tbody tr");

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? "" : "none";
    });
}

// -----------------------------
// Clear search on ESC key
// -----------------------------
async function clearSearch() {
    const input = document.getElementById("searchInput");
    input.value = "";
    input.blur();
    await loadHosts();
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
function parseByType(value, type) {
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
function comparator(aParsed, bParsed) {
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
function updateSortUI(table, colIndex, ascending) {
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

// -----------------------------
// Sort the table by column
// -----------------------------
function sortTable(colIndex) {
    const table = document.getElementById("hosts-table");
    if (!table) return;

    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll("tr"));
    const ths = table.querySelectorAll("thead th");
    const type = ths[colIndex]?.dataset?.type || "string";

    // Toggle direction
    sortDirection[colIndex] = !sortDirection[colIndex];
    const ascending = !!sortDirection[colIndex];
    const direction = ascending ? 1 : -1;

    // Pre-parsing per performance
    const parsed = rows.map((row, idx) => {
        const cell = row.children[colIndex];
        const raw = (cell?.getAttribute("data-value") ?? cell?.innerText ?? "").trim();
        return { row, idx, parsed: parseByType(raw, type) };
    });

    parsed.sort((a, b) => {
        const c = comparator(a.parsed, b.parsed);
        return c !== 0 ? c * direction : (a.idx - b.idx); // tie-breaker
    });

    // Re-append in un DocumentFragment (più efficiente)
    const frag = document.createDocumentFragment();
    parsed.forEach(p => frag.appendChild(p.row));
    tbody.appendChild(frag);

    updateSortUI(table, colIndex, ascending);

    lastSort = { colIndex, ascending };
}

/**
 * Opzionale: inizializza aria-sort='none'
 */
function initSortableTable() {
    const table = document.getElementById("hosts-table");
    if (!table) return;
    const ths = table.querySelectorAll("thead th");
    ths.forEach(th => th.setAttribute("aria-sort", "none"));
}

// -----------------------------
// Reset sorting arrows and directions
// -----------------------------
function resetSorting() {
    // azzera lo stato
    sortDirection = {};

    const table = document.getElementById("hosts-table");
    if (!table) return;

    // reset ARIA e classi
    table.querySelectorAll("thead th").forEach(th => {
        th.setAttribute("aria-sort", "none");
        th.classList.remove("is-sorted");
        const arrow = th.querySelector(".sort-arrow");
        if (arrow) arrow.classList.remove("asc", "desc");
    });

    lastSort = null;
}

// -----------------------------
// RELOAD DNS
// -----------------------------
function reloadDNS() {
    // Implement DNS reload logic here
    showToast("DNS reloaded successfully");
}

// -----------------------------
// RELOAD DHCP
// -----------------------------
function reloadDHCP() {
    // Implement DHCP reload logic here
    showToast("DHCP reloaded successfully");
}

// -----------------------------
// INITIAL TABLE LOAD
// -----------------------------
document.addEventListener("DOMContentLoaded", async () => {
    // 1) Init UI sort (aria-sort, arrows)
    initSortableTable();

    // 2) Load data (hosts)
    try {
        await loadHosts();
    } catch (err) {
        console.error("Errore nel caricamento degli host:", err);
        showToast("Errore nel caricamento degli host", false);
    }

    // 3) search bar
    const input = document.getElementById("searchInput");
    if (input) {
        // clean input on load
        input.value = "";

        // live filter for each keystroke
        input.addEventListener("input", filterHosts);

        // Escape management when focus is in the input
        input.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                e.preventDefault();     // evita side-effect (es. chiusure di modali del browser)
                e.stopPropagation();    // evita che arrivi al listener globale
                resetSorting();
                clearSearch();          // svuota input e ricarica tabella (come definito nella tua funzione)
            }
        });
  }

    // 4) global ESC key listener to clear search and reset sorting
    document.addEventListener("keydown", (e) => {
        // Ignore if focus is in a typing field
        const tag = (e.target.tagName || "").toLowerCase();
        const isTypingField = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;

        if (e.key === "Escape" && !isTypingField) {
            e.preventDefault();
            resetSorting();
            clearSearch();
        }
    });
});

