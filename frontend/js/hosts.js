// Import common js
import { loadModals, isValidIPv4, isValidIPv6, isValidMAC, showToast, sortTable, initSortableTable, resetSorting, filterTable, clearSearch } from './common.js';
// Import services
import { serviceReloadDNS, serviceReloadDHCP, serviceGetHosts, serviceGetHost, serviceCreateHost, serviceUpdateHost, serviceDeleteHost } from './services.js';

// -----------------------------
// State variables
// -----------------------------
let allHosts = [];
let viewHosts = [];
let editingHostId = null;
const sortState = { sortDirection: {}, lastSort: null };

// -----------------------------
// Fetch hosts from API
// -----------------------------
async function fetchHosts () {
    const loader = document.getElementById("loader");
    const dataTable = document.getElementById("dataTable");

    // hide table during loading to avoid flickering and show loader
    dataTable.classList.add("d-none");

    try {
        // Show loader
        loader.style.display = "block";

        // Fetch hosts
        allHosts = await serviceGetHosts();
        viewHosts = [...allHosts];

    } catch (err) {
        console.error(err?.message || "Error loading hosts");
        showToast(err?.message || "Error loading hosts", false);
        allHosts = [];
        viewHosts = [];
        // hide loader and show table
        loader.style.display = "none";
        dataTable.classList.remove("d-none");
    }
}

// -----------------------------
// Update table with current hosts
// -----------------------------
function updateTable () {
    const loader = document.getElementById("loader");
    const dataTable = document.getElementById("dataTable");

    // DOM Reference
    const tbody = document.querySelector("#dataTable tbody");
    if (!tbody) {
        console.warn('Element "#dataTable tbody" not found in DOM.');
        return;
    }

    // Svuota la tabella
    tbody.innerHTML = "";

    // if no hosts, show an empty row
    if (!viewHosts.length) {
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

    viewHosts.forEach(h => {

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
    const { lastSort, sortDirection } = sortState;

    if (lastSort && Number.isInteger(lastSort.colIndex)) {
        sortDirection[lastSort.colIndex] = !lastSort.ascending;
        sortTable(lastSort.colIndex, sortState);
    }

    // hide loader and show table
    loader.style.display = "none";
    dataTable.classList.remove("d-none");

    // apply current search filter
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        const term = searchInput.value.trim().toLowerCase();
        if (term) {
            filterTable(term);
        }
    }
}

// -----------------------------
// Edit Host: load data and pre-fill the form
// -----------------------------
async function editHost(id) {
    // Clear form first
    clearAddHostForm();

    try {
        const data = await serviceGetHost(id);

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

    } catch (err) {
        console.error(err?.message || "Error loading host");
        showToast(err?.message || "Error loading host", false);
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

    try {
        let result;

        if (editingHostId !== null) {
            // Update
            result = await serviceUpdateHost(editingHostId, hostData);
        } else {
            // Create
            result = await serviceCreateHost(hostData);
        }

        const msg = (typeof result === 'object' && result?.message)
            ? result.message
            : editingHostId !== null
                ? 'Host updated successfully'
                : 'Host created successfully';

        showToast(msg, true);

        return true;

    } catch (err) {
        console.error(err?.message || "Error saving host");
        showToast(err?.message || "Error saving host", false);
    }

    return false;

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
        showToast('Host id not valid for delete', false);
        return;
    }

    try {
        const result = await serviceDeleteHost(id);

        const msg = (typeof result === 'object' && result?.message)
            ? result.message
            : 'Host deleted successfully';

        showToast(msg, true);

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
            const result = await serviceReloadDNS();
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
            const result = await serviceReloadDHCP();
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
    input.addEventListener("input", (e) => {
        const term = e.target.value.trim().toLowerCase();
        filterTable(term);
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

    // Button event delegation (Escape, Enter, Space)
    const isEscape = e.key === 'Escape';
    const isEnter = e.key === 'Enter';
    const isSpace = e.key === ' ';

    if (!isEscape && !isEnter && !isSpace) return;

    // ESC delegation: clear search and reset sorting
    if (isEscape) {
        // Ignore if focus is in a typing field
        const tag = (e.target.tagName || "").toLowerCase();
        const isTypingField =
            tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
        const isSearchInput = e.target.id === "searchInput";

        // ESC should clear search and reset sorting only if not focused on a typing field, or if focused on the search input (to allow quick clearing of search)
        if (!isTypingField || isSearchInput) {
            // Prevent default form submission
            e.preventDefault();             // evita side-effect (es. chiusure di modali del browser)
            resetSorting(sortState);
            clearSearch();                  // svuota input e ricarica tabella (come definito nella tua funzione)
            viewHosts = [...allHosts];
            updateTable();                  // aggiorna tabella
        }
        return;
    }

    // Enter / Space delegation
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
