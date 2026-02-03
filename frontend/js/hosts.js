// -----------------------------
// Configuration parameters
// -----------------------------
let timeoutToast = 3000; // milliseconds

// -----------------------------
// State variables
// -----------------------------
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
    let hosts = [];
    try {
        const res = await fetch("/api/hosts");
        if (!res.ok) {
            const err = new Error(`Error loading hosts: ${res.status} ${res.statusText}`);
            err.status = res.status;
            throw err;
        }
        // check content-type to avoid parsing errors
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            throw new Error("Answer is not JSON");
        }

        // parse data
        const data = await res.json();
        hosts = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        // debug log
        //console.log("Hosts:", hosts);

    } catch (err) {
        console.error(err?.message || "Error loading hosts");
        showToast(err?.message || "Error loading hosts", false);
        hosts = [];
    }

    // DOM Reference
    const tbody = document.querySelector("#hosts-table tbody");
    if (!tbody) {
        console.warn('Element "#hosts-table tbody" not found in DOM.');
    return;
    }

    // Svuota la tabella
    tbody.innerHTML = "";

    // if no hosts, show an empty row
    if (!hosts.length) {
        const trEmpty = document.createElement("tr");
        const tdEmpty = document.createElement("td");
        tdEmpty.colSpan = 6;
        tdEmpty.textContent = "No hosts available.";
        tdEmpty.style.textAlign = "center";
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        return;
    }

    // fragment per performance
    const frag = document.createDocumentFragment();

    hosts.forEach(h => {
        const tr = document.createElement("tr");

        // Name
        {
            const td = document.createElement("td");
            const val = (h.name ?? "").toString();
            td.textContent = val;
            if (val) td.setAttribute("data-value", val.toLowerCase());
            tr.appendChild(td);
        }

        // IPv4
        {
            const td = document.createElement("td");
            const raw = (h.ipv4 ?? "").toString().trim();
            td.textContent = raw;
            if (raw) td.setAttribute("data-value", raw);
            tr.appendChild(td);
        }

        // IPv6
        {
            const td = document.createElement("td");
            const raw = (h.ipv6 ?? "").toString().trim();
            td.textContent = raw;
            if (raw) td.setAttribute("data-value", raw.toLowerCase());
            tr.appendChild(td);
        }

        // MAC
        {
            const td = document.createElement("td");
            const raw = (h.mac ?? "").toString().trim();
            td.textContent = raw;
            const norm = raw.toLowerCase().replace(/[\s:\-\.]/g, "");
            if (norm) td.setAttribute("data-value", norm);
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
        editSpan.title = "Edit host";
        editSpan.setAttribute("aria-label", "Edit host");
        editSpan.setAttribute("data-bs-toggle", "modal");
        editSpan.setAttribute("data-bs-target", "#addHostModal");
        editSpan.setAttribute("data-action", "edit");
        editSpan.setAttribute("data-host-id", String(id));
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
        delSpan.title = "Delete host";
        delSpan.setAttribute("aria-label", "Delete host");
        delSpan.setAttribute("data-action", "delete");
        delSpan.setAttribute("data-host-id", String(id));
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
// Edit HOST: load data and pre-fill the form
// -----------------------------
async function editHost(id) {
    // Clear form first
    clearAddHostForm();

    try {
        const res = await fetch(`/api/hosts/${id}`);
        if (!res.ok) throw new Error(`Fetch failed for host ${id}: ${res.status}`);

        const host = await res.json();

        // Store the ID of the host being edited
        editingHostId = id;

        // Pre-fill the form fields
        document.getElementById("hostName").value = host.name ?? "";
        document.getElementById("hostIPv4").value = host.ipv4 ?? "";
        document.getElementById("hostIPv6").value = host.ipv6 ?? "";
        document.getElementById("hostMAC").value = host.mac ?? "";
        document.getElementById("hostNote").value = host.note ?? "";
        document.getElementById("hostSSL").checked = !!host.ssl_enabled;

    }  catch(err) {
        throw err;
    }
}

// -----------------------------
// SAVE HOST (CREATE OR UPDATE)
// -----------------------------
async function saveHost(hostData) {
    // Validate required fields
    if (!hostData.name.trim()) {
        showToast("Name is required", false);
        return false;
    }
    // Validate IPv4 format
    if (!isValidIPv4(hostData.ipv4)) {
        showToast("Invalid IPv4 format", false);
        return false;
    }
    // Validate IPv6 format
    if (!isValidIPv6(hostData.ipv6)) {
        showToast("Invalid IPv6 format", false);
        return false;
    }
    // Validate MAC format
    if (!isValidMAC(hostData.mac)) {
        showToast("Invalid MAC format", false);
        return false;
    }

    try {
        if (editingHostId !== null) {
            // UPDATE EXISTING HOST
            const res = await fetch(`/api/hosts/${editingHostId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(hostData)
            });
            if (res.ok) {
                showToast("Host updated successfully");
            } else {
                throw new Error(`Update failed: ${res.status}`);
            }
        } else {
            // CREATE NEW HOST
            const res = await fetch("/api/hosts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(hostData)
            });
            if (res.ok) {
                showToast("Host added successfully", true);
            } else {
                throw new Error(`Create failed: ${res.status}`);
            }
        }
    } catch (err) {
        console.error("Error saving host:", err);
        throw err;
    }
    return true;
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
        console.error("Error deleting host:", err);
        throw err;
    }
    await loadHosts();
}

// -----------------------------
// PREPARE ADD HOST FORM
// -----------------------------
function clearAddHostForm() {
    // reset edit mode
    editingHostId = null;
    // reset form fields
    document.getElementById('addHostForm')?.reset();
}

// -----------------------------
// CLOSE POPUP
// -----------------------------
async function closeAddHostModal() {
    const modalEl = document.getElementById('addHostModal');
    const modal = bootstrap.Modal.getInstance(modalEl)
               || bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.hide();
}

// -----------------------------
// Handle Add Host Form Submit
// -----------------------------
async function handleAddHostSubmit(e) {
    // Prevent default form submission
    e.preventDefault();
    // Retrieve form data
    const hostData = {
        name:  document.getElementById('hostName').value.trim(),
        ipv4:  document.getElementById('hostIPv4').value.trim(),
        ipv6:  document.getElementById('hostIPv6').value.trim(),
        mac:   document.getElementById('hostMAC').value.trim(),
        note:  document.getElementById('hostNote').value.trim(),
        ssl_enabled: document.getElementById('hostSSL').checked ? 1 : 0
    };

    try {
        const ok = await saveHost(hostData);
        if (ok !== false) {
            // close modal and reload hosts
            closeAddHostModal();
            await loadHosts();
        }
    } catch (err) {
        console.error("Error saving host:", err);
        showToast("Error saving host", false);
    }
    return false;
}

// -----------------------------
// Handle delete host action
// -----------------------------
async function handleDeleteHost(e, el) {
    // Prevent default action
    e.preventDefault();
    // Get host ID
    const id = Number(el.dataset.hostId);
    if (!Number.isFinite(id)) {
        console.warn('Delete: host id not valid for delete:', id);
        showToast('Host id not valid for delete', false);
        return;
    }

    // Execute delete
    try {
        deleteHost(id);
    } catch (err) {
        console.error("Error deleting host:", err);
        showToast("Error deleting host", false);
    }
}

// -----------------------------
// Handle reload DNS action
// -----------------------------
async function handleReloadDNS() {
    try {
        const res = await fetch(`/api/dns/reload`, { method: "POST" });
        if (!res.ok) {
            const err = new Error(`Error reloading DNS: ${res.status} ${res.statusText}`);
            err.status = res.status;
            throw err;
        }
        // check content-type to avoid parsing errors
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            throw new Error("Answer is not JSON");
        }

        const data = await res.json();
        if(data.code !== "DNS_RELOAD_OK"){
            const err = new Error(`Error reloading DNS: ${data.message}`);
            err.status = data.code;
            throw err;
        }

        //console.info("DNS Reload:", data);
        showToast(data.message, true);

    } catch (err) {
        console.error(err?.message || "Error reloading DNS");
        showToast(err?.message || "Error reloading DNS", false);
    }
}

// -----------------------------
// Handle reload DHCP action
// -----------------------------
async function handleReloadDHCP() {
    try {
        const res = await fetch(`/api/dhcp/reload`, { method: "POST" });
        if (!res.ok) {
            const err = new Error(`Error reloading DHCP: ${res.status} ${res.statusText}`);
            err.status = res.status;
            throw err;
        }
        // check content-type to avoid parsing errors
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            throw new Error("Answer is not JSON");
        }

        const data = await res.json();
        if(data.code !== "DHCP_RELOAD_OK"){
            const err = new Error(`Error reloading DHCP: ${data.message}`);
            err.status = data.code;
            throw err;
        }

        //console.info("DHCP Reload:", data);
        showToast(data.message, true);

    } catch (err) {
        console.error(err?.message || "Error reloading DHCP");
        showToast(err?.message || "Error reloading DHCP", false);
    }
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
// Action Handlers
// -----------------------------
const actionHandlers = {
  async delete(e, el) { handleDeleteHost(e, el); },

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

    // 2) Load data (hosts)
    try {
        await loadHosts();
    } catch (err) {
        console.error("Error loading hosts:", err);
        showToast("Error loading hosts:", false);
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
    const modalEl = document.getElementById('addHostModal');
    if (modalEl) {

        // store who opened the modal
        let lastTriggerEl = null;

        // When shown, determine Add or Edit mode
        modalEl.addEventListener('show.bs.modal', async (ev) => {
            const lastTriggerEl = ev.relatedTarget; // trigger (Add o Edit)
            const formEl = document.getElementById('addHostForm');

            // Security check
            if (!formEl) return;

            // check Add or Edit mode
            const idAttr = lastTriggerEl?.getAttribute?.('data-host-id');
            const id = idAttr ? Number(idAttr) : null;

            if (Number.isFinite(id)) {
                // Edit Mode
                console.log("Modal in EDIT mode for host ID:", id);
                try {
                    await editHost(id);
                } catch (err) {
                    console.error("Error loading host for edit:", err);
                    showToast("Error loading host for edit", false);
                    // Close modal
                    const closeOnShown = () => {
                        closeAddHostModal(lastTriggerEl);
                        modalEl.removeEventListener('shown.bs.modal', closeOnShown);
                    };
                    modalEl.addEventListener('shown.bs.modal', closeOnShown);
                }
            } else {
                // Add Mode
                console.log("Modal in CREATE mode");
                clearAddHostForm();
                // Set focus to the first input field when modal is shown
                const focusOnShown = () => {
                    document.getElementById('hostName')?.focus({ preventScroll: true });
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
            clearAddHostForm();
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
