// Import common js
import { loadModals, isValidIPv4, isValidIPv6, isValidMAC, showToast, sortTable, initSortableTable, resetSorting, filterData, clearSearch } from './common.js';
import { reloadDNS, reloadDHCP } from './services.js';
import { apiMap, fetchData } from './api.js';

// -----------------------------
// State variables
// -----------------------------
let hostsList = [];
let editingHostId = null;
const sortState = { sortDirection: {}, lastSort: null };

// -----------------------------
// Fetch hosts from API
// -----------------------------
async function fetchHosts () {
    const loader = document.getElementById("loader");
    const container = document.getElementById("devices-container");
    const dataTable = document.getElementById("dataTable");

    // hide table during loading to avoid flickering and show loader
    dataTable.classList.add("d-none");

    try {
        // Show loader
        loader.style.display = "block";

        // Fetch hosts
        hostsList = await fetchData(apiMap.hosts);

    } catch (err) {
        console.error(err?.message || "Error loading hosts");
        showToast(err?.message || "Error loading hosts", false);
        hostsList = [];
        // hide loader and show table
        loader.style.display = "none";
        dataTable.classList.remove("d-none");
    }
}

// -----------------------------
// Update table with current hosts
// -----------------------------
function updateTable () {

    // DOM Reference
    const tbody = document.querySelector("#dataTable tbody");
    if (!tbody) {
        console.warn('Element "#dataTable tbody" not found in DOM.');
        return;
    }

    // Svuota la tabella
    tbody.innerHTML = "";

    // if no hosts, show an empty row
    if (!hostsList.length) {
        const trEmpty = document.createElement("tr");
        const tdEmpty = document.createElement("td");
        tdEmpty.colSpan = 7;
        tdEmpty.textContent = "No hosts available.";
        tdEmpty.style.textAlign = "center";
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        // hide loader and show table
        loader.style.display = "none";
        dataTable.classList.remove("d-none");
        return;
    }

    // fragment per performance
    const frag = document.createDocumentFragment();

    hostsList.forEach(h => {

        const id = Number(h.id);
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

        // MAC
        {
            const td = document.createElement("td");
            const raw = (h.mac ?? "").toString().trim();
            td.textContent = raw;
            const norm = raw.toLowerCase().replace(/[\s:\-\.]/g, "");
            if (norm) td.setAttribute("data-value", norm);
            tr.appendChild(td);
        }

        // Description
        {
            const td = document.createElement("td");
            const val = (h.description ?? "").toString();
            td.textContent = val;
            if (val) td.setAttribute("data-value", val.toLowerCase());
            tr.appendChild(td);
        }

        // Options (icons)
        {
            const td = document.createElement("td");
            td.style.textAlign = "center";
            td.style.verticalAlign = "middle";

            //
            // SSL icon
            //
            const sslEnabled = !!h.ssl_enabled;
            td.setAttribute("data-value", sslEnabled ? "true" : "false");
            td.setAttribute("aria-label", sslEnabled ? "SSL attivo" : "SSL non attivo");
            const icon = document.createElement("i");
            if (sslEnabled) {
                icon.className = "bi bi-shield-lock-fill icon icon-static";
                icon.setAttribute("aria-hidden", "true");
                icon.setAttribute("title", "SSL certificate enabled");
            } else {
                icon.className = "bi bi-shield-lock-fill icon icon-static icon-placeholder";
                icon.setAttribute("aria-hidden", "true");
            }
            td.appendChild(icon);

            //
            // visibility icon
            //
            const ext = (h.visibility ?? "").toString();
            let aria = "";
            let iconClass = "";
            switch (ext) {
                case "0":
                    // Only local (A record internally resolved)
                    aria = "Only local (A record internally resolved)";
                    iconClass = "bi bi-hdd-network";
                    break;

                case "1":
                    // Local and external (A record internally resolved, A externally)
                    aria = "Internal and external are identical";
                    iconClass = "bi bi-globe2";
                    break;

                case "2":
                    // CNAME -> DDNS / external_name
                    aria = "External is a CNAME to external_name";
                    iconClass = "bi bi-link-45deg";
                    break;
            }
            if (iconClass) {
                const icon = document.createElement("i");
                icon.className = iconClass + " icon icon-static";
                icon.setAttribute("aria-hidden", "true");
                icon.setAttribute("title", aria);
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

            // Edit Button
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

            // Delete Button
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
            sortTable(lastSort.colIndex, sortState);
        }
    }

    // hide loader and show table
    loader.style.display = "none";
    dataTable.classList.remove("d-none");
}

// -----------------------------
// Edit Host: load data and pre-fill the form
// -----------------------------
async function editHost(id) {
    // Clear form first
    clearAddHostForm();

    // Fetch host
    const res = await fetch(`/api/hosts/${id}`, {
        headers: { Accept: 'application/json' },
    });

    // Check content-type to avoid parsing errors
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const err = new Error(`Fetch failed for host ${id}: ${res.statusText}`);
        err.status = res.status;
        throw err;
    }

    // Check JSON
    let data;
    try {
        data = await res.json();
    } catch {
        throw new Error(`Fetch failed for host ${id}: Invalid JSON payload`);
    }

    // Check JSON errors
    if (!res.ok) {
        const serverMsg = data?.detail?.message?.trim();
        const base = `Fetch failed for host ${id}`;
        const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
        err.status = res.status;
        throw err;
    }

    // Store the ID of the host being edited
    editingHostId = id;

    // Pre-fill the form fields
    document.getElementById("hostName").value = data.name ?? "";
    document.getElementById("hostIPv4").value = data.ipv4 ?? "";
    document.getElementById("hostIPv6").value = data.ipv6 ?? "";
    document.getElementById("hostMAC").value = data.mac ?? "";
    document.getElementById("hostDescription").value = data.description ?? "";
    document.getElementById("hostSSL").checked = !!data.ssl_enabled;
    if (data.visibility == 2) {
        document.getElementById("hostVisibilityAlias").checked = true;
    } else if (data.visibility == 1){
        document.getElementById("hostVisibilityGlobal").checked = true;
    } else {
        document.getElementById("hostVisibilityLocal").checked = true;
    }
}

// -----------------------------
// Save host (CREATE OR UPDATE)
// -----------------------------
async function saveHost(hostData) {
    // Validate hostname
    if (!hostData.name.trim()) {
        showToast("Hostname is required", false);
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

    if (editingHostId !== null) {
        // Update existing host
        const res = await fetch(`/api/hosts/${editingHostId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hostData)
        });

        // Success without JSON
        if (res.status === 204) {
            showToast('Host updated successfully', true);
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
            const base = `Error updating host`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

        // Success
        showToast(data?.message || 'Host updated successfully', true);
        return true;

    } else {
        // Create new host
        const res = await fetch(`/api/hosts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hostData)
        });

        // Success without JSON
        if (res.status === 204) {
            showToast('Host created successfully', true);
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
            const base = `Error adding host`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

        // Success
        showToast(data?.message || 'Host created successfully', true);
        return true
    }
}

// -----------------------------
// Prepare add host form
// -----------------------------
function clearAddHostForm() {
    // reset edit mode
    editingHostId = null;
    // reset form fields
    document.getElementById('addHostForm')?.reset();
}

// -----------------------------
// Close popup
// -----------------------------
async function closeAddHostModal() {
    const modalEl = document.getElementById('addHostModal');
    const modal = bootstrap.Modal.getInstance(modalEl)
               || bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.hide();
}

// -----------------------------
// Handle Add host form submit
// -----------------------------
async function handleAddHostSubmit(e) {
    // Prevent default form submission
    e.preventDefault();

    try {
        // Retrieve form data
        const data = {
            name:  document.getElementById('hostName').value.trim(),
            ipv4:  document.getElementById('hostIPv4').value.trim(),
            ipv6:  document.getElementById('hostIPv6').value.trim(),
            mac:   document.getElementById('hostMAC').value.trim(),
            description:  document.getElementById('hostDescription').value.trim(),
            ssl_enabled: document.getElementById('hostSSL').checked ? 1 : 0,
            visibility: Number(
                document.querySelector('input[name="hostVisibility"]:checked')?.value ?? 0
            )
        };

        const ok = await saveHost(data);
        if (ok !== false) {
            // close modal and reload hosts
            closeAddHostModal();
            await fetchHosts();
            updateTable();
            return true
        }

    } catch (err) {
        console.error(err?.message || "Error saving host");
        showToast(err?.message || "Error saving host", false);
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
        // Fetch data
        const res = await fetch(`/api/hosts/${id}`, {
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
            const base = `Error deleting host`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

        // Success
        showToast(data?.message || 'Host deleted successfully', true);

        // Reload hosts
        await fetchHosts();
        updateTable();
        return true;

    } catch (err) {
        console.error(err?.message || "Error deleting host");
        showToast(err?.message || "Error deleting host", false);
    }

    return false;
}

// -----------------------------
// Action Handlers
// -----------------------------
const actionHandlers = {
    // Delete host
    delete: (e, el) => {
        handleDeleteHost(e, el);
    },
    // Edit host
    edit: () => {
        // handled by bootstrap modal show event
    },
    // Reload DNS
    reloadDns: async () => {
        try {
            const result = await reloadDNS();
            const msg = (typeof result === 'object' && result?.message)
                        ? result.message
                        : 'DNS reload successfully';
            showToast(msg, true);
        } catch (err) {
            showToast(err?.message || "Error reloading DNS", false);
        }
    },
    // Reload DHCP
    reloadDhcp: async () => {
        try {
            const result = await reloadDHCP();
            const msg = (typeof result === 'object' && result?.message)
                        ? result.message
                        : 'DHCP reload successfully';
            showToast(msg, true);
        } catch (err) {
            showToast(err?.message || "Error reloading DHCP", false);
        }
    },
};

// -----------------------------
// DOMContentLoaded: bootstrap app
// -----------------------------
document.addEventListener("DOMContentLoaded", async () => {
    await initApp();
});

// -----------------------------
// APP INIT
// -----------------------------
async function initApp() {

    // Load modals (Bootstrap 5 requires JS initialization for dynamic content)
    try {
        await loadModals();
    } catch (err) {
        console.error(err?.message || "Error loading modals");
        showToast(err?.message || "Error loading modals", false);
    }

    // Load data (hosts)
    try {
        await fetchHosts();
        updateTable();
    } catch (err) {
        console.error(err?.message || "Error loading hosts");
        showToast(err?.message || "Error loading hosts", false);
    }

    initUI();
    initEvents();
}

// -----------------------------
// UI INIT
// -----------------------------
function initUI() {
    // Init UI sort (aria-sort, arrows)
    initSortableTable();
    initSearch();
    initModalLifecycle();
}

// -----------------------------
// SEARCH
// -----------------------------
function initSearch() {
    // search bar
    const input = document.getElementById("searchInput");
    if (!input) return;

    // clean input on load
    input.value = "";
    // live filter for each keystroke
    input.addEventListener("input", filterData);
    // Escape management when focus is in the input
    input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            e.preventDefault();       // evita side-effect (es. chiusure di modali del browser)
            e.stopPropagation();      // evita che arrivi al listener globale
            resetSorting(sortState);
            clearSearch();            // svuota input e ricarica tabella (come definito nella tua funzione)
            updateTable();            // aggiorna tabella
            filterData('');           // ripristina tabella
        }
    });
}

// -----------------------------
// MODAL LIFECYCLE (ADD / EDIT)
// -----------------------------
function initModalLifecycle() {

    // Modal show/hidden events to prepare/reset the form
    const modalEl = document.getElementById('addHostModal');
    if (!modalEl) return;

    // store who opened the modal
    let lastTriggerEl = null;

    // When shown, determine Add or Edit mode
    modalEl.addEventListener('show.bs.modal', async (ev) => {
        lastTriggerEl = ev.relatedTarget; // trigger (Add o Edit)

        // check Add or Edit mode based on presence of data-host-id in the trigger element
        const id = Number(lastTriggerEl?.dataset?.hostId);

        if (Number.isFinite(id)) {
            // EDIT MODE
            try {
                await editHost(id);
            } catch (err) {
                showToast(err?.message || "Error loading host", false);
                // Close modal
                modalEl.addEventListener('shown.bs.modal', () => {
                    closeAddHostModal(lastTriggerEl);
                }, { once: true });
            }
        } else {
            // ADD MODE
            clearAddHostForm();
            // Set focus to the first input field when modal is shown
            modalEl.addEventListener('shown.bs.modal', () => {
                document.getElementById('hostName')?.focus({ preventScroll: true });
            }, { once: true });
        }
    });

    // When hiding, restore focus to the trigger element
    modalEl.addEventListener('hide.bs.modal', () => {
        const active = document.activeElement;
        if (active && modalEl.contains(active)) {
            lastTriggerEl?.focus?.({ preventScroll: true }) || active.blur();
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

// -----------------------------
// GLOBAL EVENTS INIT
// -----------------------------
function initEvents() {
    document.addEventListener('click', handleActionClick);
    document.addEventListener('click', handleSortClick);
    document.addEventListener('keydown', handleKeyboard);
    document.addEventListener('submit', handleForms);
}

// -----------------------------
// CLICK (DATA-ACTION)
// -----------------------------
async function handleActionClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;
    const handler = actionHandlers[action];
    if (!handler) return;

    // Execute handler
    try {
        await handler(e, el);
    } catch (err) {
        console.error(err?.message || 'Action error');
        showToast(err?.message || 'Action error', false);
    }
}

// -----------------------------
// KEYBOARD (ESC + accessibility)
// -----------------------------
function handleKeyboard(e) {
    // Ignore if focus is in a typing field
    const tag = (e.target.tagName || "").toLowerCase();
    const isTypingField =
        tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;

    // global ESC key listener to clear search and reset sorting
    if (e.key === "Escape" && !isTypingField) {
        // Prevent default form submission
        e.preventDefault();       // evita side-effect (es. chiusure di modali del browser)
        resetSorting(sortState);
        clearSearch();            // svuota input e ricarica tabella (come definito nella tua funzione)
        updateTable();            // aggiorna tabella
        filterData('');           // ripristina tabella
    }

    // Button event delegation (Enter, Space)
    const isEnter = e.key === 'Enter';
    const isSpace = e.key === ' ';
    if (!isEnter && !isSpace) return;

    const el = e.target.closest('[data-action]');
    if (!el) return;

    // Space/Enter
    if (el.tagName === 'BUTTON') return;
    // Trigger click event
    el.click();
}

// -----------------------------
// FORM SUBMIT (delegation)
// -----------------------------
function handleForms(e) {
    if (e.target.id === 'addHostForm') {
        handleAddHostSubmit(e);
    }
}

// -----------------------------
// SORT CLICK
// -----------------------------
function handleSortClick(e) {
    const th = e.target.closest('th[data-sortable="true"]');
    if (!th) return;

    if (th.dataset.sortable === 'false') return;

    const colIndex = Number(th.dataset.sort);
    if (!Number.isInteger(colIndex)) return;

    sortTable(colIndex, sortState);
}
