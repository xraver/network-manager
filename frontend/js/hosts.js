// Import common js
import { isValidIPv4, isValidIPv6, isValidMAC, showToast, sortTable, initSortableTable, resetSorting } from './common.js';
import { reloadDNS, reloadDHCP } from './services.js';

// -----------------------------
// State variables
// -----------------------------
let editingHostId = null;
const sortState = { sortDirection: {}, lastSort: null };

// -----------------------------
// Load all hosts into the table
// -----------------------------
async function loadHosts() {
    let hosts = [];
    try {
        // Fetch data
        const res = await fetch(`/api/hosts`, {
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
            hosts = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

        } catch {
            throw new Error('Invalid JSON payload');
        }

        // Check JSON errors
        if (!res.ok) {
            const serverMsg = data?.detail?.message?.trim();
            const base = `Error loading hosts`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

    } catch (err) {
        console.error(err?.message || "Error loading hosts");
        showToast(err?.message || "Error loading hosts", false);
        hosts = [];
    }

    // DOM Reference
    const tbody = document.querySelector("#dataTable tbody");
    if (!tbody) {
        console.warn('Element "#dataTable tbody" not found in DOM.');
        return;
    }

    // Svuota la tabella
    tbody.innerHTML = "";

    // if no hosts, show an empty row
    if (!hosts.length) {
        const trEmpty = document.createElement("tr");
        const tdEmpty = document.createElement("td");
        tdEmpty.colSpan = 7;
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
    document.getElementById("hostNote").value = data.note ?? "";
    document.getElementById("hostSSL").checked = !!data.ssl_enabled;
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
            note:  document.getElementById('hostNote').value.trim(),
            ssl_enabled: document.getElementById('hostSSL').checked ? 1 : 0
        };

        const ok = await saveHost(data);
        if (ok !== false) {
            // close modal and reload hosts
            closeAddHostModal();
            await loadHosts();
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
        await loadHosts();
        return true;

    } catch (err) {
        console.error(err?.message || "Error deleting host");
        showToast(err?.message || "Error deleting host", false);
    }

    return false;
}

// -----------------------------
// filter hosts in the table
// -----------------------------
function filterHosts() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const rows = document.querySelectorAll("#dataTable tbody tr");

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
  async reloadDns(e, el) { reloadDNS(); },

  // Reload DHCP
  async reloadDhcp(e, el) { reloadDHCP(); },
};

// -----------------------------
// DOMContentLoaded: initialize everything
// -----------------------------
document.addEventListener("DOMContentLoaded", async () => {

    // Init UI sort (aria-sort, arrows)
    initSortableTable();

    // Load data (hosts)
    try {
        await loadHosts();
    } catch (err) {
        console.error(err?.message || "Error loading hosts");
        showToast(err?.message || "Error loading hosts", false);
    }

    // search bar
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
                resetSorting(sortState);
                clearSearch();          // svuota input e ricarica tabella (come definito nella tua funzione)
                filterHosts('');        // ripristina tabella
            }
        });
    }

    // global ESC key listener to clear search and reset sorting
    document.addEventListener("keydown", (e) => {
        // Ignore if focus is in a typing field
        const tag = (e.target.tagName || "").toLowerCase();
        const isTypingField =
            tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;

        if (e.key === "Escape" && !isTypingField) {
            // Prevent default form submission
            e.preventDefault();
            resetSorting(sortState);
            clearSearch();
            filterHosts('');
        }
    });

    // Modal show/hidden events to prepare/reset the form
    const modalEl = document.getElementById('addHostModal');
    if (modalEl) {

        // store who opened the modal
        let lastTriggerEl = null;

        // When shown, determine Add or Edit mode
        modalEl.addEventListener('show.bs.modal', async (ev) => {
            lastTriggerEl = ev.relatedTarget; // trigger (Add o Edit)
            const formEl = document.getElementById('addHostForm');

            // Security check
            if (!formEl) return;

            // check Add or Edit mode
            const idAttr = lastTriggerEl?.getAttribute?.('data-host-id');
            const id = idAttr ? Number(idAttr) : null;

            if (Number.isFinite(id)) {
                // Edit Mode
                try {
                    await editHost(id);
                } catch (err) {
                    showToast(err?.message || "Error loading host for edit", false);
                    // Close modal
                    const closeOnShown = () => {
                        closeAddHostModal(lastTriggerEl);
                        modalEl.removeEventListener('shown.bs.modal', closeOnShown);
                    };
                    modalEl.addEventListener('shown.bs.modal', closeOnShown);
                }
            } else {
                // Add Mode
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
                    active.blur();
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

    // Button event delegation (click)
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
            console.error(err?.message || 'Action error');
            showToast(err?.message || 'Action error', false);
        }
    });

    // Button event delegation (Enter, Space)
    document.addEventListener('keydown', async (e) => {
        const isEnter = e.key === 'Enter';
        const isSpace = e.key === ' ' || e.key === 'Spacebar';
        if (!isEnter && !isSpace) return;

        const el = e.target.closest('[data-action]');
        if (!el) return;

        // Space/Enter
        if (el.tagName === 'BUTTON') return;
        // Trigger click event
        el.click();
    });

    // Submit Form
    const form = document.getElementById('addHostForm');
    if (form) {
        form.addEventListener('submit', handleAddHostSubmit);
    }

    // Submit Sort
    const headers = document.querySelectorAll('thead th');
    headers.forEach((th) => {
        if (th.dataset.sortable === 'false') return;
        th.addEventListener('click', () => sortTable(th.cellIndex, sortState));
    });
});
