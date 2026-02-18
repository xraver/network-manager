// Import common js
import { showToast, sortTable, initSortableTable, resetSorting } from './common.js';
import { reloadDNS, reloadDHCP } from './services.js';

// -----------------------------
// State variables
// -----------------------------
let editingAliasId = null;
const sortState = { sortDirection: {}, lastSort: null };

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
    const tbody = document.querySelector("#dataTable tbody");
    if (!tbody) {
        console.warn('Element "#dataTable tbody" not found in DOM.');
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
            sortTable(lastSort.colIndex, sortState);
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
// filter aliases in the table
// -----------------------------
function filterAliases() {
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
    await loadAliases();
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

    // Load data (aliases)
    try {
        await loadAliases();
    } catch (err) {
        console.error(err?.message || "Error loading aliases");
        showToast(err?.message || "Error loading aliases:", false);
    }

    // search bar
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
    const modalEl = document.getElementById('addAliasModal');
    if (modalEl) {

        // store who opened the modal
        let lastTriggerEl = null;

        // When shown, determine Add or Edit mode
        modalEl.addEventListener('show.bs.modal', async (ev) => {
            lastTriggerEl = ev.relatedTarget; // trigger (Add o Edit)
            const formEl = document.getElementById('addAliasForm');

            // Security check
            if (!formEl) return;

            // check Add or Edit mode
            const idAttr = lastTriggerEl?.getAttribute?.('data-alias-id');
            const id = idAttr ? Number(idAttr) : null;

            if (Number.isFinite(id)) {
                // Edit Mode
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
                    active.blur();
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
    const form = document.getElementById('addAliasForm');
    if (form) {
        form.addEventListener('submit', handleAddAliasSubmit);
    }

    // Submit Sort
    const headers = document.querySelectorAll('thead th');
    headers.forEach((th) => {
        if (th.dataset.sortable === 'false') return;
        th.addEventListener('click', () => sortTable(th.cellIndex, sortState));
    });
});
