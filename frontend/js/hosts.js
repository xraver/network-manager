// -------------------------------------------------------
// IMPORT
// -------------------------------------------------------
import { loadModals, isValidIPv4, isValidIPv6, isValidMAC, showToast, sortTable, initSortableTable, resetSorting, handleSearch, filterTable, clearSearch, handleReload } from './common.js';
import { serviceReloadDNS, serviceReloadDHCP, serviceGetHosts, serviceGetHost, serviceCreateHost, serviceUpdateHost, serviceDeleteHost } from './services.js';
import { loadLanguage, translatePage, t } from "./i18n.js";
import { getBackendMessage } from "./backendMessages.js";

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
    const tableWrapper = document.getElementById("tableWrapper");

    // hide table during loading to avoid flickering and show loader
    tableWrapper.classList.add("d-none");

    try {
        // Show loader
        loader.classList.remove("d-none");

        // Fetch hosts
        allHosts = await serviceGetHosts();
        viewHosts = [...allHosts];

    } catch (err) {
        console.error(err?.message || t("hosts.list.error"));
        showToast(err?.message || t("hosts.list.error"), false);
        allHosts = [];
        viewHosts = [];
        // hide loader and show table
        tableWrapper.classList.remove("d-none");
    }
    finally {
        // Hide loader
        loader.classList.add("d-none");
    }
}

// -----------------------------
// Update table with current hosts
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

    // if no hosts, show an empty row
    if (!viewHosts.length) {
        const trEmpty = document.createElement("tr");
        const tdEmpty = document.createElement("td");
        tdEmpty.colSpan = 6;
        tdEmpty.textContent = t("hosts.empty");
        tdEmpty.style.textAlign = "center";
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        // hide loader and show table
        loader.classList.add("d-none");
        tableWrapper.classList.remove("d-none");
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
            const wrapperSslIcon = document.createElement("span");
            const sslIcon = document.createElement("i");
            let description = "";
            if (sslEnabled) {
                sslIcon.className = "bi bi-shield-lock-fill icon icon-static";
                description = t("hosts.ssl.enabled");
                wrapperSslIcon.setAttribute("title", description);
                wrapperSslIcon.setAttribute("aria-label", description);
            } else {
                sslIcon.className = "bi bi-shield-lock-fill icon icon-static icon-placeholder";
                sslIcon.setAttribute("aria-hidden", "true");
            }
            wrapperSslIcon.appendChild(sslIcon);
            td.appendChild(wrapperSslIcon);

            //
            // visibility icon
            //
            const ext = (h.visibility ?? "").toString();
            const wrapperVisibilityIcon = document.createElement("span");
            const visibilityIcon = document.createElement("i");
            let iconClass = "";
            switch (ext) {
                case "0":
                    // Only local (A record internally resolved)
                    description = t("hosts.visibility.local.description");
                    iconClass = "bi bi-hdd-network";
                    break;

                case "1":
                    // Local and external (A record internally resolved, A externally)
                    description = t("hosts.visibility.global.description");
                    iconClass = "bi bi-globe2";
                    break;

                case "2":
                    // CNAME -> DDNS / external_name
                    description = t("hosts.visibility.alias.description");
                    iconClass = "bi bi-link-45deg";
                    break;
            }
            if (iconClass) {
                visibilityIcon.className = iconClass + " icon icon-static";
                wrapperVisibilityIcon.setAttribute("title", description);
                wrapperVisibilityIcon.setAttribute("aria-label", description);
                wrapperVisibilityIcon.appendChild(visibilityIcon);
                td.appendChild(wrapperVisibilityIcon);
            }
            if (ext) td.setAttribute("data-value", ext);
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
            const editText = t("hosts.edit");
            editSpan.className = "action-icon";
            editSpan.setAttribute("role", "button");
            editSpan.tabIndex = 0;
            editSpan.title = editText;
            editSpan.setAttribute("aria-label", editText);
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
            const deleteText = t("hosts.delete");
            delSpan.className = "action-icon";
            delSpan.setAttribute("role", "button");
            delSpan.tabIndex = 0;
            delSpan.title = deleteText;
            delSpan.setAttribute("aria-label", deleteText);
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
    loader.classList.add("d-none");
    tableWrapper.classList.remove("d-none");

    // apply current search filter
    const term =
        document.getElementById('searchInput')?.value ||
        document.getElementById('searchInputMobile')?.value;
    if (term?.trim()) {
        handleSearch(term, filterTable);
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
        console.error(err?.message || t("hosts.loaded.error"));
        showToast(err?.message || t("hosts.loaded.error"), false);
    }
}

// -----------------------------
// Save host (CREATE OR UPDATE)
// -----------------------------
async function saveHost(hostData) {
    // Validate hostname
    if (!hostData.name.trim()) {
        showToast(t("validation.name.required"), false);
        return false;
    }
    // Validate IPv4 format
    if (!isValidIPv4(hostData.ipv4)) {
        showToast(t("validation.ipv4.invalid"), false);
        return false;
    }
    // Validate IPv6 format
    if (!isValidIPv6(hostData.ipv6)) {
        showToast(t("validation.ipv6.invalid"), false);
        return false;
    }
    // Validate MAC format
    if (!isValidMAC(hostData.mac)) {
        showToast(t("validation.mac.invalid"), false);
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

        const msg = getBackendMessage(
            result,
            editingHostId !== null
                ? "hosts.updated.ok"
                : "hosts.created.ok"
        );

        showToast(msg, true);

        return true;

    } catch (err) {

        const msg = getBackendMessage(
            err,
            editingHostId !== null
                ? "hosts.updated.error"
                : "hosts.created.error"
        );

        showToast(msg, false);
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
        console.error(
            err?.message ||
            (editingHostId !== null
                ? t("hosts.updated.error")
                : t("hosts.created.error"))
        );

        showToast(
            err?.message ||
            (editingHostId !== null
                ? t("hosts.updated.error")
                : t("hosts.created.error")),
            false
        );
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
        showToast(t("hosts.delete.invalid_id"), false);
        return;
    }

    try {
        const result = await serviceDeleteHost(id);
        const msg = getBackendMessage(result, "hosts.deleted.ok");
        showToast(msg, true);

        // Reload hosts
        await fetchHosts();
        updateTable();

        return true;

    } catch (err) {
        console.error(err?.message || t("hosts.deleted.error"));
        showToast(err?.message || t("hosts.deleted.error"), false);
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
    reloadDns: async (e, el) => {
        await handleReload(
            el,
            serviceReloadDNS,
            t("dns.reload.ok"),
            t("dns.reload.error"),
            t("dns.reload.progress")
        );
    },
    // Reload DHCP
    reloadDhcp: async (e, el) => {
        await handleReload(
            el,
            serviceReloadDHCP,
            t("dhcp.reload.ok"),
            t("dhcp.reload.error"),
            t("dhcp.reload.progress")
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

    // Loading translation
    try {
        await loadLanguage();
    } catch (err) {
        console.error(err?.message || t("app.translation.error"));
        showToast(t("app.translation.error"), false);
    }

    // Load modals (Bootstrap 5 requires JS initialization for dynamic content)
    try {
        await loadModals();
    } catch (err) {
        console.error(err?.message || t("app.modals.error"));
        showToast(t("app.modals.error"), false);
    }

    // Translate page
    translatePage();

    // Load data (hosts)
    try {
        await fetchHosts();
        updateTable();
    } catch (err) {
        console.error(err?.message || t("hosts.list.error"));
        showToast(err?.message || t("hosts.list.error"), false);
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
        const id = Number(lastTriggerEl?.dataset?.hostId);

        if (Number.isFinite(id)) {
            // EDIT MODE
            try {
                await editHost(id);
            } catch (err) {
                showToast(err?.message || t("hosts.loaded.error"), false);
                // Close modal
                modalEl.addEventListener('shown.bs.modal', () => {
                    closeAddHostModal();
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
        console.error(err?.message || t("app.action.error"));
        showToast(err?.message || t("app.action.error"), false);
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
