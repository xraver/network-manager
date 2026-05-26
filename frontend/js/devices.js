// Import common js
import { loadModals, isValidIPv4, isValidIPv6, isValidMAC, showToast, sortTable, initSortableTable, resetSorting } from './common.js';
import { reloadDNS, reloadDHCP } from './services.js';

// -----------------------------
// State variables
// -----------------------------
let editingHostId = null;
const sortState = { sortDirection: {}, lastSort: null };

// -----------------------------
// Load all devices into the table
// -----------------------------
async function loadDevices() {
    let devices = [];
    const loader = document.getElementById("loader");
    const container = document.getElementById("devices-container");
    const dataTable = document.getElementById("dataTable");

    // hide table during loading to avoid flickering and show loader
    dataTable.classList.add("d-none");

    try {
        // Show loader
        loader.style.display = "block";

        // Fetch data
        const res = await fetch(`/api/devices`, {
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
            devices = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

        } catch {
            throw new Error('Invalid JSON payload');
        }

        // Check JSON errors
        if (!res.ok) {
            const serverMsg = data?.detail?.message?.trim();
            const base = `Error loading devices`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

    } catch (err) {
        console.error(err?.message || "Error loading devices");
        showToast(err?.message || "Error loading devices", false);
        devices = [];
        // hide loader and show table
        loader.style.display = "none";
        dataTable.classList.remove("d-none");
    }

    // DOM Reference
    const tbody = document.querySelector("#dataTable tbody");
    if (!tbody) {
        console.warn('Element "#dataTable tbody" not found in DOM.');
        return;
    }

    // Svuota la tabella
    tbody.innerHTML = "";

    // if no devices, show an empty row
    if (!devices.length) {
        const trEmpty = document.createElement("tr");
        const tdEmpty = document.createElement("td");
        tdEmpty.colSpan = 7;
        tdEmpty.textContent = "No devices available.";
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

    devices.forEach(d => {

        //const mixedId = d.id;
        //const id = mixedId.slice(2);
        const id = d.id;
        let type = 0;

        // Static or Dynamic?
        if (id.startsWith("s-")) {
            // static → delete su DB
            type = 1;
        } else if (id.startsWith("d-")) {
            type = 2;
        } else {
            console.error("loadDevices: unknown device type:", id);
            showToast("loadDevices: unknown device type:", false);
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

            if(type == 1) {
              td.appendChild(editSpan);
            } else if (type == 2) {
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

    let fetchUrl = "";
    let host = false;

    // Clear form first
    clearAddHostForm();

    if (id !== null) {
        // Static or Dynamic?
        if (id.startsWith("s-")) {
            // static
            fetchUrl = `/api/hosts/${id.slice(2)}`;
            host = true;
        } else if (id.startsWith("d-")) {
            // dynamic
            fetchUrl = `/api/dhcp/leases/${id.slice(2)}`;
            host = false;
        } else {
            throw new Error("Invalid Device ID format for edit");
        }
        id = Number(id.slice(2));
    } else {
        throw new Error("Invalid Device ID for edit");
    }

    // Fetch host
    const res = await fetch(fetchUrl, {
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

    if(host) {
        // Store the ID of the host being edited
        editingHostId = id;
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
            await loadDevices();
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
    // Prevent default action
    e.preventDefault();

    // Get device ID
    const id = el.dataset.deviceId;

    if (!id) {
        console.warn('Delete: device id not valid for delete:', id);
        showToast('Device id not valid for delete', false);
        return;
    }

    let deleteUrl = "";

    // Static or Dynamic?
    if (id.startsWith("s-")) {
        // static → delete su DB
        deleteUrl = `/api/hosts/${id.slice(2)}`
    } else if (id.startsWith("d-")) {
        // dynamic → delete su DHCP server
        deleteUrl = `/api/dhcp/leases/${id.slice(2)}`
    } else {
        console.error("Delete: unknown device type:", id);
        showToast("Delete: unknown device type:", false);
        return;
    }

    // Execute delete
    try {
        // Fetch data
        const res = await fetch(deleteUrl, {
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
            const base = `Error deleting device`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

        // Success
        showToast(data?.message || 'Device deleted successfully', true);

        // Reload devices
        await loadDevices();
        return true;

    } catch (err) {
        console.error(err?.message || "Error deleting device");
        showToast(err?.message || "Error deleting device", false);
    }

    return false;
}

// -----------------------------
// filter devices in the table
// -----------------------------
function filterDevices() {
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
    await loadDevices();
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

    // Load data (devices)
    try {
        await loadDevices();
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
    // search bar
    const input = document.getElementById("searchInput");
    if (!input) return;

    // clean input on load
    input.value = "";
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
        filterDevices('');        // ripristina tabella
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
