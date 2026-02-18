// -----------------------------
// Configuration parameters
// -----------------------------
let timeoutToast = 3000; // milliseconds

// -----------------------------
// State variables
// -----------------------------
let editingAliasId = null;
let sortDirection = {};
let lastSort = null; // { colIndex: number, ascending: boolean }
const stringCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

// -----------------------------
// Load all aliases into the table
// -----------------------------
async function loadAliases() {
    let aliases = [];
    try {
        // Fetch data
        const res = await fetch(`/api/aliases`, {
            headers: { Accept: 'application/json' },
        });

        // Check content-type to avoid parsing errors
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            const err = new Error(`${res.status}: ${res.statusText}`);
            err.status = res.status;
            throw err;
        }

        // Check JSON
        let data;
        try {
            data = await res.json();
            aliases = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

        } catch {
            throw new Error('Invalid JSON payload');
        }

        // Check JSON errors
        if (!res.ok) {
            const serverMsg = data?.detail?.message?.trim();
            const base = `Error loading aliases`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

    } catch (err) {
        console.error(err?.message || "Error loading aliases");
        showToast(err?.message || "Error loading aliase", false);
        aliases = [];
    }

    // DOM Reference
    const tbody = document.querySelector("#hosts-table tbody");
    if (!tbody) {
        console.warn('Element "#hosts-table tbody" not found in DOM.');
        return;
    }

    // Svuota la tabella
    tbody.innerHTML = "";

    // if no aliases, show an empty row
    if (!aliases.length) {
        const trEmpty = document.createElement("tr");
        const tdEmpty = document.createElement("td");
        tdEmpty.colSpan = 7;
        tdEmpty.textContent = "No alias available.";
        tdEmpty.style.textAlign = "center";
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        return;
    }

    // fragment per performance
    const frag = document.createDocumentFragment();

    aliases.forEach(h => {
        const tr = document.createElement("tr");

        // Name
        {
            const td = document.createElement("td");
            const val = (h.name ?? "").toString();
            td.textContent = val;
            if (val) td.setAttribute("data-value", val.toLowerCase());
            tr.appendChild(td);
        }

        // Target
        {
            const td = document.createElement("td");
            const val = (h.target ?? "").toString();
            td.textContent = val;
            if (val) td.setAttribute("data-value", val.toLowerCase());
            tr.appendChild(td);
        }

        // Note
        {
            const td = document.createElement("td");
            const val = (h.note ?? "").toString();
            td.textContent = val;
            if (val) td.setAttribute("data-value", val.toLowerCase());
            tr.appendChild(td);
        }

        // SSL (icon)
        {
            const td = document.createElement("td");
            const sslEnabled = !!h.ssl_enabled;
            td.setAttribute("data-value", sslEnabled ? "true" : "false");
            td.setAttribute("aria-label", sslEnabled ? "SSL attivo" : "SSL non attivo");
            td.style.textAlign = "center";
            td.style.verticalAlign = "middle";
            if (sslEnabled) {
                const icon = document.createElement("i");
                icon.className = "bi bi-shield-lock-fill icon icon-static";
                icon.setAttribute("aria-hidden", "true");
                td.appendChild(icon);
            }
            tr.appendChild(td);
        }

    // Actions
    {
        const td = document.createElement("td");
        td.className = "actions";
        td.style.textAlign = "center";
        td.style.verticalAlign = "middle";

        const id = Number(h.id);

        // Usa elementi reali invece di innerHTML con entity
        const editSpan = document.createElement("span");
        editSpan.className = "action-icon";
        editSpan.setAttribute("role", "button");
        editSpan.tabIndex = 0;
        editSpan.title = "Edit alias";
        editSpan.setAttribute("aria-label", "Edit alias");
        editSpan.setAttribute("data-bs-toggle", "modal");
        editSpan.setAttribute("data-bs-target", "#addAliasModal");
        editSpan.setAttribute("data-action", "edit");
        editSpan.setAttribute("data-alias-id", String(id));
        {
            const i = document.createElement("i");
            i.className = "bi bi-pencil-fill icon icon-action";
            i.setAttribute("aria-hidden", "true");
            editSpan.appendChild(i);
        }

        const delSpan = document.createElement("span");
        delSpan.className = "action-icon";
        delSpan.setAttribute("role", "button");
        delSpan.tabIndex = 0;
        delSpan.title = "Delete alias";
        delSpan.setAttribute("aria-label", "Delete alias");
        delSpan.setAttribute("data-action", "delete");
        delSpan.setAttribute("data-alias-id", String(id));
        {
            const i = document.createElement("i");
            i.className = "bi bi-trash-fill icon icon-action";
            i.setAttribute("aria-hidden", "true");
            delSpan.appendChild(i);
        }

        td.appendChild(editSpan);
        td.appendChild(delSpan);
        tr.appendChild(td);
    }

    frag.appendChild(tr);
    });

    // publish all rows
    tbody.appendChild(frag);

    // apply last sorting
    if (typeof lastSort === "object" && lastSort && Array.isArray(sortDirection)) {
        if (Number.isInteger(lastSort.colIndex)) {
            sortDirection[lastSort.colIndex] = !lastSort.ascending;
            sortTable(lastSort.colIndex);
        }
    }
}

// -----------------------------
// Edit Alias: load data and pre-fill the form
// -----------------------------
async function editAlias(id) {
    // Clear form first
    clearAddAliasForm();

    // Fetch alias
    const res = await fetch(`/api/aliases/${id}`, {
        headers: { Accept: 'application/json' },
    });

    // Check content-type to avoid parsing errors
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const err = new Error(`Fetch failed for alias ${id}: ${res.statusText}`);
        err.status = res.status;
        throw err;
    }

    // Check JSON
    let data;
    try {
        data = await res.json();
    } catch {
        throw new Error(`Fetch failed for alias ${id}: Invalid JSON payload`);
    }

    // Check JSON errors
    if (!res.ok) {
        const serverMsg = data?.detail?.message?.trim();
        const base = `Fetch failed for alias ${id}`;
        const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
        err.status = res.status;
        throw err;
    }

    // Store the ID of the alias being edited
    editingAliasId = id;

    // Pre-fill the form fields
    document.getElementById("aliasName").value = data.name ?? "";
    document.getElementById("aliasTarget").value = data.target ?? "";
    document.getElementById("aliasNote").value = data.note ?? "";
    document.getElementById("aliasSSL").checked = !!data.ssl_enabled;
}

// -----------------------------
// Save alias (CREATE OR UPDATE)
// -----------------------------
async function saveAlias(aliasData) {
    // Validate alias
    if (!aliasData.name.trim()) {
        showToast("Alias is required", false);
        return false;
    }
    // Validate Target
    if (!aliasData.target.trim()) {
        showToast("Target is required", false);
        return false;
    }

    if (editingAliasId !== null) {
        // Update existing alias
        const res = await fetch(`/api/aliases/${editingAliasId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aliasData)
        });

        // Success without JSON
        if (res.status === 204) {
            showToast('Alias updated successfully', true);
            return true;
        }

        // Check content-type to avoid parsing errors
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            const err = new Error(`${res.status}: ${res.statusText}`);
            err.status = res.status;
            throw err;
        }

        // Check JSON
        let data;
        try {
            data = await res.json();
        } catch {
            throw new Error('Invalid JSON payload');
        }

        // Check JSON errors
        if (!res.ok) {
            const serverMsg = data?.detail?.message?.trim();
            const base = `Error updating alias`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

        // Success
        showToast(data?.message || 'Alias updated successfully', true);
        return true;

    } else {
        // Create new alias
        const res = await fetch(`/api/aliases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aliasData)
        });

        // Success without JSON
        if (res.status === 204) {
            showToast('Alias created successfully', true);
            return true;
        }

        // Check content-type to avoid parsing errors
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            const err = new Error(`${res.status}: ${res.statusText}`);
            err.status = res.status;
            throw err;
        }

        // Check JSON
        let data;
        try {
            data = await res.json();
        } catch {
            throw new Error('Invalid JSON payload');
        }

        // Check JSON errors
        if (!res.ok) {
            const serverMsg = data?.detail?.message?.trim();
            const base = `Error adding alias`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

        // Success
        showToast(data?.message || 'Alias created successfully', true);
        return true
    }
}

// -----------------------------
// Prepare add alias form
// -----------------------------
function clearAddAliasForm() {
    // reset edit mode
    editingAliasId = null;
    // reset form fields
    document.getElementById('addAliasForm')?.reset();
}

// -----------------------------
// Close popup
// -----------------------------
async function closeAddAliasModal() {
    const modalEl = document.getElementById('addAliasModal');
    const modal = bootstrap.Modal.getInstance(modalEl)
               || bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.hide();
}

// -----------------------------
// Handle Add alias form submit
// -----------------------------
async function handleAddAliasSubmit(e) {
    // Prevent default form submission
    e.preventDefault();

    try {
        // Retrieve form data
        const data = {
            name:  document.getElementById('aliasName').value.trim(),
            target: document.getElementById('aliasTarget').value.trim(),
            note:   document.getElementById('aliasNote').value.trim(),
            ssl_enabled: document.getElementById('aliasSSL').checked ? 1 : 0
        };

        const ok = await saveAlias(data);
        if (ok !== false) {
            // close modal and reload aliases
            closeAddAliasModal();
            await loadAliases();
            return true
        }

    } catch (err) {
        console.error(err?.message || "Error saving alias");
        showToast(err?.message || "Error saving alias", false);
    }

    return false;
}

// -----------------------------
// Handle delete alias action
// -----------------------------
async function handleDeleteAlias(e, el) {
    // Prevent default action
    e.preventDefault();

    // Get alias ID
    const id = Number(el.dataset.aliasId);
    if (!Number.isFinite(id)) {
        console.warn('Delete: alias id not valid for delete:', id);
        showToast('Alias id not valid for delete', false);
        return;
    }

    // Execute delete
    try {
        // Fetch data
        const res = await fetch(`/api/aliases/${id}`, {
            method: 'DELETE',
            headers: { 'Accept': 'application/json' },
        });

        // Check content-type to avoid parsing errors
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            const err = new Error(`${res.status}: ${res.statusText}`);
            err.status = res.status;
            throw err;
        }

        // Check JSON
        let data;
        try {
            data = await res.json();
        } catch {
            throw new Error('Invalid JSON payload');
        }

        // Check JSON errors
        if (!res.ok) {
            const serverMsg = data?.detail?.message?.trim();
            const base = `Error deleting alias`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

        // Success
        showToast(data?.message || 'Alias deleted successfully', true);

        // Reload aliases
        await loadAliases();
        return true;

    } catch (err) {
        console.error(err?.message || "Error deleting alias");
        showToast(err?.message || "Error deleting alias", false);
    }

    return false;
}

// -----------------------------
// Handle reload DNS action
// -----------------------------
async function handleReloadDNS() {
    try {
        // Fetch data
        const res = await fetch(`/api/dns/reload`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
        });

        // Success without JSON
        if (res.status === 204) {
            showToast('DNS reload successfully', true);
            return true;
        }

        // Check content-type to avoid parsing errors
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            const err = new Error(`${res.status}: ${res.statusText}`);
            err.status = res.status;
            throw err;
        }

        // Check JSON
        let data;
        try {
            data = await res.json();
        } catch {
            throw new Error('Invalid JSON payload');
        }

        // Check JSON errors
        if (!res.ok) {
            const serverMsg = data?.detail?.message?.trim();
            const base = `Error reloading DNS`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

        // Success
        showToast(data?.message || 'DNS reload successfully', true);
        return true;

    } catch (err) {
        console.error(err?.message || "Error reloading DNS");
        showToast(err?.message || "Error reloading DNS", false);
    }

    return false;
}

// -----------------------------
// Handle reload DHCP action
// -----------------------------
async function handleReloadDHCP() {
    try {
        // Fetch data
        const res = await fetch(`/api/dhcp/reload`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
        });

        // Success without JSON
        if (res.status === 204) {
            showToast('DHCP reload successfully', true);
            return true;
        }

        // Check content-type to avoid parsing errors
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            const err = new Error(`${res.status}: ${res.statusText}`);
            err.status = res.status;
            throw err;
        }

        // Check JSON
        let data;
        try {
            data = await res.json();
        } catch {
            throw new Error('Error reloading DHCP: Invalid JSON payload');
        }

        // Check JSON errors
        if (!res.ok) {
            const serverMsg = data?.detail?.message?.trim();
            const base = `Error reloadin DHCP`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

        // Success
        showToast(data?.message || 'DHCP reload successfully', true);
        return true;

    } catch (err) {
        console.error(err?.message || "Error reloading DHCP");
        showToast(err?.message || "Error reloading DHCP", false);
    }

    return false;
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
    }, timeoutToast);
}

// -----------------------------
// filter aliases in the table
// -----------------------------
function filterAliases() {
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
    await loadAliases();
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
// Action Handlers
// -----------------------------
const actionHandlers = {
  async delete(e, el) { handleDeleteAlias(e, el); },

  // edit is handled by bootstrap modal show event
  edit(e, el) {
    // no-op o log
  },

  // Reload DNS
  async reloadDns()  { handleReloadDNS();  },

  // Reload DHCP
  async reloadDhcp() { handleReloadDHCP(); },
};

// -----------------------------
// DOMContentLoaded: initialize everything
// -----------------------------
document.addEventListener("DOMContentLoaded", async () => {
    // 1) Init UI sort (aria-sort, arrows)
    initSortableTable();

    // 2) Load data (aliases)
    try {
        await loadAliases();
    } catch (err) {
        console.error("Error loading aliases:", err);
        showToast("Error loading aliases:", false);
    }

    // 3) search bar
    const input = document.getElementById("searchInput");
    if (input) {
        // clean input on load
        input.value = "";
        // live filter for each keystroke
        input.addEventListener("input", filterAliases);
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
        const isTypingField =
            tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;

        if (e.key === "Escape" && !isTypingField) {
            // Prevent default form submission
            e.preventDefault();
            resetSorting();
            clearSearch();
        }
    });

    // 5) Modal show/hidden events to prepare/reset the form
    const modalEl = document.getElementById('addAliasModal');
    if (modalEl) {

        // store who opened the modal
        let lastTriggerEl = null;

        // When shown, determine Add or Edit mode
        modalEl.addEventListener('show.bs.modal', async (ev) => {
            const lastTriggerEl = ev.relatedTarget; // trigger (Add o Edit)
            const formEl = document.getElementById('addAliasForm');

            // Security check
            if (!formEl) return;

            // check Add or Edit mode
            const idAttr = lastTriggerEl?.getAttribute?.('data-alias-id');
            const id = idAttr ? Number(idAttr) : null;

            if (Number.isFinite(id)) {
                // Edit Mode
                console.log("Modal in EDIT mode for alias ID:", id);
                try {
                    await editAlias(id);
                } catch (err) {
                    showToast(err?.message || "Error loading alias for edit", false);
                    // Close modal
                    const closeOnShown = () => {
                        closeAddAliasModal(lastTriggerEl);
                        modalEl.removeEventListener('shown.bs.modal', closeOnShown);
                    };
                    modalEl.addEventListener('shown.bs.modal', closeOnShown);
                }
            } else {
                // Add Mode
                console.log("Modal in CREATE mode");
                clearAddAliasForm();
                // Set focus to the first input field when modal is shown
                const focusOnShown = () => {
                    document.getElementById('aliasName')?.focus({ preventScroll: true });
                    modalEl.removeEventListener('shown.bs.modal', focusOnShown);
                };
                modalEl.addEventListener('shown.bs.modal', focusOnShown);
            }
        });

        // When hiding, restore focus to the trigger element
        modalEl.addEventListener('hide.bs.modal', () => {
            const active = document.activeElement;
            if (active && modalEl.contains(active)) {
                if (lastTriggerEl && typeof lastTriggerEl.focus === 'function') {
                    lastTriggerEl.focus({ preventScroll: true });
                } else {
                    active.blur(); // fallback: evita warning A11Y
                }
            }
        });

        // When hidden, reset the form
        modalEl.addEventListener('hidden.bs.modal', () => {
            // reset form fields
            clearAddAliasForm();
            // pulizia ref del trigger
            lastTriggerEl = null;
        });
    }

    // 6) Button event delegation (click and keydown)
    {
        // Click event
        document.addEventListener('click', async (e) => {
            const el = e.target.closest('[data-action]');
            if (!el) return;

            const action = el.dataset.action;
            const handler = actionHandlers[action];
            if (!handler) return;

            // Execute handler
            try {
                await handler(e, el);
            } catch (err) {
                console.error(err?.message || 'Action error', false);
                showToast(err?.message || 'Action error', false);
            }
        });

        // Keydown (Enter, Space) for accessibility
        document.addEventListener('keydown', async (e) => {
            const isEnter = e.key === 'Enter';
            const isSpace = e.key === ' ' || e.key === 'Spacebar';
            if (!isEnter && !isSpace) return;

            const el = e.target.closest('[data-action]');
            if (!el) return;

            // Trigger click event
            el.click();
        });
    }
});
