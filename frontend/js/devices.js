// Import common js
import { loadModals, isValidIPv4, isValidIPv6, isValidMAC, showToast, sortTable, initSortableTable, resetSorting, handleSearch, filterTable, clearSearch, handleReload } from './common.js';
// Import services
import { serviceReloadDNS, serviceReloadDHCP, serviceGetDHCPLeases, serviceGetDHCPLease, serviceDeleteDHCPLease, serviceGetDevices, serviceGetHost, serviceCreateHost, serviceUpdateHost, serviceDeleteHost } from './services.js';

// -----------------------------
// State variables
// -----------------------------
let allDevices = [];
let viewDevices = [];
let editingHostId = null;
const sortState = { sortDirection: {}, lastSort: null };

// -----------------------------
// Fetch hosts from API
// -----------------------------
async function fetchDevices () {
    const loader = document.getElementById("loader");
    const tableWrapper = document.getElementById("tableWrapper");

    // hide table during loading to avoid flickering and show loader
    tableWrapper.classList.add("d-none");

    try {
        // Show loader
        loader.style.display = "block";

        // Fetch devices
        allDevices  = await serviceGetDevices();
        viewDevices = [...allDevices];

    } catch (err) {
        console.error(err?.message || "Error loading devices");
        showToast(err?.message || "Error loading devices", false);
        allDevices = [];
        viewDevices = [];
        // hide loader and show table
        loader.style.display = "none";
        tableWrapper.classList.remove("d-none");
    }
}

// -----------------------------
// Update table with current devices
// -----------------------------
function updateTable () {
    const loader = document.getElementById("loader");
    const tableWrapper = document.getElementById("tableWrapper");

    // DOM Reference
    const tbody = document.querySelector("#dataTable tbody");
    if (!tbody) {
        console.warn('Element "#dataTable tbody" not found in DOM.');
        return;
    }

    // Svuota la tabella
    tbody.innerHTML = "";

    // if no devices, show an empty row
    if (!viewDevices.length) {
        const trEmpty = document.createElement("tr");
        const tdEmpty = document.createElement("td");
        tdEmpty.colSpan = 7;
        tdEmpty.textContent = "No devices available.";
        tdEmpty.style.textAlign = "center";
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        // hide loader and show table
        loader.style.display = "none";
        tableWrapper.classList.remove("d-none");
        return;
    }

    // fragment per performance
    const frag = document.createDocumentFragment();

    viewDevices.forEach(d => {

        const id = d.id;
        let type = 0;

        // Static or Dynamic?
        if (id.startsWith("s-")) {
            // static → delete su DB
            type = 1;
        } else if (id.startsWith("d-")) {
            type = 2;
        } else {
            console.error("updateTable: unknown device type:", id);
            showToast("updateTable: unknown device type:", false);
        }

        const tr = document.createElement("tr");

        // IP Address
        {
            const td = document.createElement("td");
            const raw = (d.ipv4 ?? "").toString().trim();
            td.textContent = raw;
            if (raw) td.setAttribute("data-value", raw);
            tr.appendChild(td);
        }

        // MAC
        {
            const td = document.createElement("td");
            const raw = (d.mac ?? "").toString().trim();
            td.textContent = raw;
            const norm = raw.toLowerCase().replace(/[\s:\-\.]/g, "");
            if (norm) td.setAttribute("data-value", norm);
            tr.appendChild(td);
        }

        // Hostname
        {
            const td = document.createElement("td");
            const val = (d.name ?? "").toString();
            td.textContent = val;
            if (val) td.setAttribute("data-value", val.toLowerCase());
            tr.appendChild(td);
        }

        // Description
        {
            const td = document.createElement("td");
            const val = (d.description ?? "").toString();
            td.textContent = val;
            if (val) td.setAttribute("data-value", val.toLowerCase());
            tr.appendChild(td);
        }

        // State Icon
        {
            const td = document.createElement("td");
            td.style.textAlign = "center";
            td.style.verticalAlign = "middle";

            const val = (d.dhcp_state ?? "").toString();
            let aria = "";
            let iconClass = "";
            switch (val) {
                case "static":
                    // Static device
                    aria = "Device is static";
                    iconClass = "bi bi-gear-fill";
                    break;

                case "active":
                    // DHCP active lease
                    aria = "DHCP lease is active";
                    iconClass = "bi bi-check-circle-fill";
                    break;

                case "expired":
                    // DHCP expired lease
                    aria = "DHCP lease is expired";
                    iconClass = "bi bi-clock-history";
                    break;

                case "released":
                    // DHCP released lease
                    aria = "DHCP lease is released";
                    iconClass = "bi bi-box-arrow-in-right";
                    break;

                case "declined":
                    // DHCP declined lease
                    aria = "DHCP lease is declined";
                    iconClass = "bi bi-x-octagon-fill";
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

        // Active
        {
            const td = document.createElement("td");
            td.style.textAlign = "center";
            td.style.verticalAlign = "middle";

            const active = !!d.active;
            td.setAttribute("data-value", active ? "true" : "false");
            td.setAttribute("aria-label", active ? "device active" : "device not active");
            const icon = document.createElement("i");
            if (active) {
                icon.className = "bi bi-circle-fill text-success icon icon-static";
                icon.setAttribute("aria-hidden", "true");
                icon.setAttribute("title", "Device is active");
            } else {
                icon.className = "bi bi-circle-fill text-danger icon icon-static";
                icon.setAttribute("aria-hidden", "true");
                icon.setAttribute("title", "Device is not active");
            }
            td.appendChild(icon);
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
            editSpan.setAttribute("data-device-id", String(id));
            {
                const i = document.createElement("i");
                i.className = "bi bi-pencil-fill icon icon-action";
                i.setAttribute("aria-hidden", "true");
                editSpan.appendChild(i);
            }

            // Add Button
            const addSpan = document.createElement("span");
            addSpan.className = "action-icon";
            addSpan.setAttribute("role", "button");
            addSpan.tabIndex = 0;
            addSpan.title = "Add static lease";
            addSpan.setAttribute("aria-label", "Add static lease");
            addSpan.setAttribute("data-bs-toggle", "modal");
            addSpan.setAttribute("data-bs-target", "#addHostModal");
            addSpan.setAttribute("data-action", "add");
            addSpan.setAttribute("data-device-id", String(id));
            {
                const i = document.createElement("i");
                i.className = "bi bi-plus-circle icon icon-action";
                i.setAttribute("aria-hidden", "true");
                addSpan.appendChild(i);
            }

            // Delete Button
            const delSpan = document.createElement("span");
            delSpan.className = "action-icon";
            delSpan.setAttribute("role", "button");
            delSpan.tabIndex = 0;
            delSpan.title = "Delete device";
            delSpan.setAttribute("aria-label", "Delete device");
            delSpan.setAttribute("data-action", "delete");
            delSpan.setAttribute("data-device-id", String(id));
            {
                const i = document.createElement("i");
                i.className = "bi bi-trash-fill icon icon-action";
                i.setAttribute("aria-hidden", "true");
                delSpan.appendChild(i);
            }

            if (type === 1) {
              td.appendChild(editSpan);
            } else if (type === 2) {
              td.appendChild(addSpan);
            } else {
            }
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
    tableWrapper.classList.remove("d-none");

    // apply current search filter
    const term =
        document.getElementById('searchInput')?.value ||
        document.getElementById('searchInputMobile')?.value;
    if (term) {
        handleSearch(term, filterTable);
    }
}

// -----------------------------
// Edit Host: load data and pre-fill the form
// -----------------------------
async function editHost(id) {

    let host = false;

    // Clear form first
    clearAddHostForm();

    // host or lease
    if (id !== null) {
        // Static or Dynamic?
        if (id.startsWith("s-")) {
            // static
            host = true;
        } else if (id.startsWith("d-")) {
            // dynamic
            host = false;
        } else {
            throw new Error("Invalid Device ID format for edit");
        }
        id = Number(id.slice(2));
    } else {
        throw new Error("Invalid Device ID for edit");
    }

    try {
        let data;

        if(host){
            data = await serviceGetHost(id);

            // Store the ID of the host being edited
            editingHostId = id;
        } else {
            data = await serviceGetDHCPLease(id);
        }

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
        console.error(err?.message || "Error loading device");
        showToast(err?.message || "Error loading device", false);
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
            await fetchDevices();
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
// Handle delete device action
// -----------------------------
async function handleDeleteDevice(e, el) {

    let host = false;

    // Prevent default action
    e.preventDefault();

    // Get device ID
    let id = el.dataset.deviceId;

    if (!id) {
        console.warn('Delete: device id not valid for delete:', id);
        showToast('Device id not valid for delete', false);
        return;
    }

    // host or lease
    if (id !== null) {
        // Static or Dynamic?
        if (id.startsWith("s-")) {
            // static
            host = true;
        } else if (id.startsWith("d-")) {
            // dynamic
            host = false;
        } else {
            throw new Error("Invalid Device ID format for edit");
        }
        id = Number(id.slice(2));
    } else {
        throw new Error("Invalid Device ID for edit");
    }

    try {
       if(host){
            const result = await serviceDeleteHost(id);

        } else {
            const result = await serviceDeleteDHCPLease(id);
        }

        const msg = (typeof result === 'object' && result?.message)
            ? result.message
            : 'Host deleted successfully';

        showToast(msg, true);

        // Reload devices
        await fetchDevices();
        updateTable();

        return true;

    } catch (err) {
        console.error(err?.message || "Error deleting device");
        showToast(err?.message || "Error deleting device", false);
    }

    return false;
}

// -----------------------------
// Action Handlers
// -----------------------------
const actionHandlers = {
    // Delete device
    delete: (e, el) => {
        handleDeleteDevice(e, el);
    },
    // Edit host
    edit: () => {
        // handled by bootstrap modal show event
    },
    // Reload DNS
    reloadDns: async (e, el) => {
        await handleReload(
            el,
            serviceReloadDNS,
            "DNS reload successfully",
            "Error reloading DNS",
            "Reloading DNS..."
        );
    },
    // Reload DHCP
    reloadDhcp: async (e, el) => {
        await handleReload(
            el,
            serviceReloadDHCP,
            "DHCP reload successfully",
            "Error reloading DHCP",
            "Reloading DHCP..."
        );
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

    // Load data (devices)
    try {
        await fetchDevices();
        updateTable();
    } catch (err) {
        console.error(err?.message || "Error loading devices");
        showToast(err?.message || "Error loading devices", false);
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

    ["searchInput", "searchInputMobile"].forEach(id => {

        const input = document.getElementById(id);

        if (!input) return;

        // clean input on load
        input.value = "";

        // live filter
        input.addEventListener("input", (e) => {
            handleSearch(e.target.value, filterTable);
        });
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
        const id = lastTriggerEl?.dataset?.deviceId ?? null;

        if (id !== null) {
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
        const isSearchInput =
            e.target.id === "searchInput" || e.target.id === "searchInputMobile";

        // ESC should clear search and reset sorting only if not focused on a typing field, or if focused on the search input (to allow quick clearing of search)
        if (!isTypingField || isSearchInput) {
            // Prevent default form submission
            e.preventDefault();             // evita side-effect (es. chiusure di modali del browser)
            resetSorting(sortState);
            clearSearch();                  // svuota input e ricarica tabella (come definito nella tua funzione)
            viewDevices = [...allDevices];
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
