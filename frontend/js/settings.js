// Import common js
import { loadModals, showToast, clearSearch, showConfirmModal, handleReload } from './common.js';
// Import services
import { serviceGetConfigs, serviceGetConfig, serviceUpdateConfig, serviceResetConfig, serviceRestartApp, serviceIsAlive } from './services.js';

// -----------------------------
// State variables
// -----------------------------
let allConfigs = [];
let viewConfigs = [];
let editingConfigKey = null;

// -----------------------------
// Get config value from form based on visible input
// -----------------------------
function getConfigValueFromForm() {

    const boolGroup   = document.getElementById("configValueBoolGroup");
    const rangeGroup  = document.getElementById("configValueRangeGroup");
    const selectGroup = document.getElementById("configValueSelectGroup");
    const textInput   = document.getElementById("configValue");

    const boolInput   = document.getElementById("configValueBool");
    const rangeInput  = document.getElementById("configValueRange");
    const selectInput = document.getElementById("configValueSelect");

    // Boolean
    if (!boolGroup.classList.contains("d-none")) {
        return boolInput.checked;
    }

    // Range int
    if (!rangeGroup.classList.contains("d-none")) {
        return Number(rangeInput.value);
    }

    // Range group with allowed values (select)
    if (!selectGroup.classList.contains("d-none")) {
        const select = selectInput;
        const value = select.value;
        const type = select.dataset.type || "string";

        if (type === "integer") return Number(value);
        if (type === "boolean") return value === "true";

        return value;
    }

    // Text (default)
    return typeof textInput.value === "string"
        ? textInput.value.trim()
        : textInput.value;
}

// -----------------------------
// Fetch configs from API
// -----------------------------
async function fetchConfigs () {
    const loader = document.getElementById("loader");
    const dataTable = document.getElementById("dataTable");

    // hide table during loading to avoid flickering and show loader
    dataTable.classList.add("d-none");

    try {
        // Show loader
        loader.style.display = "block";

        // Fetch configs
        allConfigs = await serviceGetConfigs();
        viewConfigs = [...allConfigs];

    } catch (err) {
        console.error(err?.message || "Error loading configs");
        showToast(err?.message || "Error loading configs", false);
        allConfigs = [];
        viewConfigs = [];
        // hide loader and show table
        loader.style.display = "none";
        dataTable.classList.remove("d-none");
    }
}

// -----------------------------
// Toggle group rows visibility
// -----------------------------
function toggleGroup(groupKey) {

    const rows = document.querySelectorAll(
        `tr[data-parent-group="${groupKey}"]`
    );

    const groupRow = document.querySelector(
        `tr[data-group="${groupKey}"]`
    );

    const icon = groupRow?.querySelector("i");

    const isHidden = rows.length > 0 && rows[0].classList.contains("d-none");

    // toggle rows
    rows.forEach(row => {
        if (isHidden) {
            row.classList.remove("d-none");
        } else {
            row.classList.add("d-none");
        }
    });

    // toggle icon
    if (icon) {
        if (isHidden) {
            icon.classList.remove("bi-folder");
            icon.classList.add("bi-folder2-open");
        } else {
            icon.classList.remove("bi-folder2-open");
            icon.classList.add("bi-folder");
        }
    }
}

// -----------------------------
// Expand groups
// -----------------------------
function expandAllGroups() {
    document.querySelectorAll('tr[data-parent-group]')
        .forEach(row => row.classList.remove("d-none"));

    document.querySelectorAll('tr[data-group] i')
        .forEach(icon => {
            icon.classList.remove("bi-folder");
            icon.classList.add("bi-folder2-open");
        });
}

// -----------------------------
// Collapse groups
// -----------------------------
function collapseAllGroups() {
    document.querySelectorAll('tr[data-parent-group]')
        .forEach(row => row.classList.add("d-none"));

    document.querySelectorAll('tr[data-group] i')
        .forEach(icon => {
            icon.classList.remove("bi-folder2-open");
            icon.classList.add("bi-folder");
        });
}

// -----------------------------
// Polling to check if the system restarted properly
// -----------------------------
function startReconnectPolling(button, originalHtmlButton) {

    if (!button) return;

    const maxAttempts = 30; // 1 minuto
    let attempts = 0;

    const interval = setInterval(async () => {

        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(interval);
            showToast("Server did not come back online", false);
            button.innerHTML = originalHtmlButton;
            button.disabled = false;
            return;
        }

        try {
            // prova endpoint leggero
            const isUp = await serviceIsAlive();

            if (isUp) {

                clearInterval(interval);

                showToast("Application is back online", true);

                setTimeout(() => location.reload(), 500);

            }
        } catch (err) {
            console.log("Waiting for server...");
        }

    }, 2000); // check every 2 seconds
}

// -----------------------------
// Restart application
// -----------------------------
async function restartApp(button) {
    const confirmed = await showConfirmModal("Restart the application?");
    if (!confirmed) return;

    const originalHtmlButton = button.innerHTML;

    const ok = await handleReload(
        button,
        serviceRestartApp,
        "Application is restarting...",
        "Error restarting application",
        "Restarting...",
        true
    );

    if (ok !== false) {
        startReconnectPolling(button, originalHtmlButton);
    }
}

// -----------------------------
// Update table with current configs
// -----------------------------
function updateTable () {
    const loader = document.getElementById("loader");
    const dataTable = document.getElementById("dataTable");
    const searchInput = document.getElementById("searchInput");
    const term = searchInput?.value?.trim().toLowerCase();
    const hasSearch = !!term;
    const expandBtn = document.getElementById("expandAllBtn");
    const collapseBtn = document.getElementById("collapseAllBtn");

    expandBtn?.toggleAttribute("disabled", hasSearch);
    collapseBtn?.toggleAttribute("disabled", hasSearch);
    if (hasSearch) {
        expandBtn?.setAttribute("title", "Disabled during search");
        collapseBtn?.setAttribute("title", "Disabled during search");
    } else {
        expandBtn?.setAttribute("title", "Expand all groups");
        collapseBtn?.setAttribute("title", "Collapse all groups");
    }

    // DOM Reference
    const tbody = document.querySelector("#dataTable tbody");
    if (!tbody) {
        console.warn('Element "#dataTable tbody" not found in DOM.');
        return;
    }

    // Svuota la tabella
    tbody.innerHTML = "";

    // if no configs, show an empty row
    if (!viewConfigs.length) {
        const trEmpty = document.createElement("tr");
        const tdEmpty = document.createElement("td");
        tdEmpty.colSpan = 7;
        tdEmpty.textContent = "No configs available.";
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

    // Group configs by group_name
    const grouped = {};
    viewConfigs.forEach(c => {
        const group = (c.group_name || "other").toLowerCase();
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(c);
    });

    Object.keys(grouped)
        .sort()
        .forEach(group => {

        // GROUP HEADER ROW
        const trGroup = document.createElement("tr");
        const tdGroup = document.createElement("td");
        const groupKey = group;

        let rows = grouped[group];

        if (term) {
            rows = rows.filter(c => {
                return (
                    (c.key ?? "").toString().toLowerCase().includes(term) ||
                    (c.value ?? "").toString().toLowerCase().includes(term) ||
                    (c.description ?? "").toString().toLowerCase().includes(term)
                );
            });
        }

        // skip group if no result
        if (term && rows.length === 0) return;

        // GROUP HEADER
        tdGroup.colSpan = 7;
        trGroup.className = "table-group-header";
        trGroup.setAttribute("data-group", groupKey);
        tdGroup.innerHTML = term
            ? '<i class="bi bi-folder2-open"></i>'
            : '<i class="bi bi-folder"></i>';
        tdGroup.appendChild(
            document.createTextNode(
                " " + group.charAt(0).toUpperCase() + group.slice(1)
            )
        );
        trGroup.appendChild(tdGroup);
        frag.appendChild(trGroup);

        // ROWS del gruppo
        rows.forEach(c => {

            const tr = document.createElement("tr");
            tr.setAttribute("data-parent-group", groupKey);

            // show only filtered keys
            if (!term) {
                tr.classList.add("d-none");
            }

            // Key
            {
                const td = document.createElement("td");
                const val = (c.key ?? "").toString();
                td.textContent = val;
                if (val) td.setAttribute("data-value", val.toLowerCase());
                tr.appendChild(td);
            }

            // Value
            {
                const td = document.createElement("td");
                const raw = (c.value ?? "").toString().trim();
                td.textContent = raw;
                if (raw) td.setAttribute("data-value", raw);
                tr.appendChild(td);
            }

            // Description
            {
                const td = document.createElement("td");
                const raw = (c.description ?? "").toString().trim();
                td.textContent = raw;
                if (raw) td.setAttribute("data-value", raw);
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
                editSpan.title = "Edit config";
                editSpan.setAttribute("aria-label", "Edit config");
                editSpan.setAttribute("data-bs-toggle", "modal");
                editSpan.setAttribute("data-bs-target", "#editConfigModal");
                editSpan.setAttribute("data-action", "edit");
                editSpan.setAttribute("data-config-key", String(c.key));
                {
                    const i = document.createElement("i");
                    i.className = "bi bi-pencil-fill icon icon-action";
                    i.setAttribute("aria-hidden", "true");
                    editSpan.appendChild(i);
                }

                // Reset Button
                const resetSpan = document.createElement("span");
                resetSpan.className = "action-icon";
                resetSpan.setAttribute("role", "button");
                resetSpan.tabIndex = 0;
                resetSpan.title = "Reset to default value";
                resetSpan.setAttribute("aria-label", "Reset to default value");
                resetSpan.setAttribute("data-action", "reset");
                resetSpan.setAttribute("data-config-key", String(c.key));
                {
                    const i = document.createElement("i");
                    i.className = "bi bi-arrow-counterclockwise icon icon-action";
                    i.setAttribute("aria-hidden", "true");
                    resetSpan.appendChild(i);
                }

                td.appendChild(editSpan);
                td.appendChild(resetSpan);
                tr.appendChild(td);
            }

            frag.appendChild(tr);
        });
    });

    // publish all rows
    tbody.appendChild(frag);

    // hide loader and show table
    loader.style.display = "none";
    dataTable.classList.remove("d-none");
}

// -----------------------------
// Edit Config: load data and pre-fill the form
// -----------------------------
async function editConfig(key) {
    // Clear form first
    clearEditConfigForm();

    try {
        const data = await serviceGetConfig(key);

        // Store the ID of the config being edited
        editingConfigKey = key;

        // Static fields
        document.getElementById("configKey").value = data.key ?? "";
        document.getElementById("configDescription").value = data.description ?? "";

        // Value elements (Text)
        const valueInput = document.getElementById("configValue");
        const valueGroup = valueInput.closest(".mb-2");

        // Value elements (Booleans)
        const boolGroup = document.getElementById("configValueBoolGroup");
        const boolInput = document.getElementById("configValueBool");

        // Group for select (allowed values)
        const selectGroup = document.getElementById("configValueSelectGroup");
        const selectInput = document.getElementById("configValueSelect");

        // Value elements (range)
        const rangeGroup = document.getElementById("configValueRangeGroup");
        const rangeInput = document.getElementById("configValueRange");
        const rangeDisplay = document.getElementById("configValueRangeDisplay");

        // Value field
        if (data.type === "boolean") {
            // Boolean
            const boolValue = data.value === true;
            boolInput.checked = boolValue;

            // Update value required
            boolInput.required = false;
            rangeInput.required = false;
            selectInput.required = false;
            valueInput.required = false;

            // Update View on slider change
            boolGroup.classList.remove("d-none");
            rangeGroup.classList.add("d-none");
            selectGroup.classList.add("d-none");
            valueGroup.classList.add("d-none");

        } else if (data.allowed !== undefined) {

            // Range: Select (allowed values)

            // svuota select
            selectInput.innerHTML = "";

            selectInput.dataset.type = data.type;

            // popola opzioni
            data.allowed.forEach(v => {
                const opt = document.createElement("option");
                opt.value = v;
                opt.textContent = v;

                if (String(v) === String(data.value)) {
                    opt.selected = true;
                }

                selectInput.appendChild(opt);
            });

            // Update value required
            boolInput.required = false;
            rangeInput.required = false;
            selectInput.required = true;
            valueInput.required = false;

            // Update View on slider change
            boolGroup.classList.add("d-none");
            rangeGroup.classList.add("d-none");
            selectGroup.classList.remove("d-none");
            valueGroup.classList.add("d-none");

        } else if (data.min !== undefined && data.max !== undefined) {

            // Range: Slider
            rangeInput.min = data.min;
            rangeInput.max = data.max;
            rangeInput.value = data.value ?? data.min;

            rangeDisplay.textContent = String(rangeInput.value);

            // aggiorna display quando sposti slider
            rangeInput.oninput = () => {
                rangeDisplay.textContent = String(rangeInput.value);
            };

            // Update value required
            boolInput.required = false;
            rangeInput.required = true;
            selectInput.required = false;
            valueInput.required = false;

            // Update View on slider change
            boolGroup.classList.add("d-none");
            rangeGroup.classList.remove("d-none");
            selectGroup.classList.add("d-none");
            valueGroup.classList.add("d-none");

        } else {
            // Text
            valueInput.value = data.value ?? "";

            // Update value required
            boolInput.required = false;
            rangeInput.required = false;
            selectInput.required = false;
            valueInput.required = true;

            // Update View on slider change
            boolGroup.classList.add("d-none");
            rangeGroup.classList.add("d-none");
            selectGroup.classList.add("d-none");
            valueGroup.classList.remove("d-none");
        }

    } catch (err) {
        console.error(err?.message || "Error loading config");
        showToast(err?.message || "Error loading config", false);
    }
}

// -----------------------------
// Save config
// -----------------------------
async function saveConfig(configData) {
    // Validate Value
    switch (typeof configData.value) {
        case "string":
            if (!configData.value.trim()) {
                showToast("Configuration value is required", false);
                return false;
            }
            break;

        case "boolean":
            break;

        case "number":
            if (isNaN(configData.value)) {
                showToast("Invalid numeric value", false);
                return false;
            }
            break;

        default:
            showToast("Invalid configuration value", false);
            return false;
    }

    try {
        let result;

        // Update
        result = await serviceUpdateConfig(editingConfigKey, configData);
        const msg = (typeof result === 'object' && result?.message)
            ? result.message
            : 'Config updated successfully';

        showToast(msg, true);

        return true;

    } catch (err) {
        console.error(err?.message || "Error updating config");
        showToast(err?.message || "Error updating config", false);
    }

    return false;

}

// -----------------------------
// Prepare add config form
// -----------------------------
function clearEditConfigForm() {
    // reset edit mode
    editingConfigKey = null;
    // reset form fields
    document.getElementById('editConfigForm')?.reset();
}

// -----------------------------
// Close popup
// -----------------------------
async function closeEditConfigModal() {
    const modalEl = document.getElementById('editConfigModal');
    const modal = bootstrap.Modal.getInstance(modalEl)
               || bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.hide();
}

// -----------------------------
// Handle Edit config form submit
// -----------------------------
async function handleEditConfigSubmit(e) {
    // Prevent default form submission
    e.preventDefault();

    try {
        // Retrieve form data
        const data = {
            key:    document.getElementById('configKey').value.trim(),
            value:  getConfigValueFromForm(),
        };

        const ok = await saveConfig(data);
        if (ok !== false) {
            // close modal and reload configs
            closeEditConfigModal();
            await fetchConfigs();
            updateTable();
            return true
        }

    } catch (err) {
        console.error(err?.message || "Error saving config");
        showToast(err?.message || "Error saving config", false);
    }

    return false;
}

// -----------------------------
// Handle reset config action
// -----------------------------
async function handleResetConfig(e, el) {
    // Prevent default action
    e.preventDefault();

    // Get config ID
    const key = el.dataset.configKey;
    if (typeof key !== "string" || key.length === 0) {
        showToast('Configuration key not valid for reset', false);
        return;
    }

    // Confirm requested
    const confirmed = await showConfirmModal("Reset this configuration?");
    if (!confirmed) return;

    try {
        const result = await serviceResetConfig(key);

        const msg = (typeof result === 'object' && result?.message)
            ? result.message
            : 'Config reset to default successfully';

        showToast(msg, true);

        // Reload configs
        await fetchConfigs();
        updateTable();

        return true;

    } catch (err) {
        console.error(err?.message || "Error resetting config to default");
        showToast(err?.message || "Error resetting config to default", false);
    }

    return false;
}

// -----------------------------
// Action Handlers
// -----------------------------
const actionHandlers = {
    // Reset config
    reset: (e, el) => {
        handleResetConfig(e, el);
    },
    // Edit config
    edit: () => {
        // handled by bootstrap modal show event
    },
    // Reload DHCP
    restartApp: async (e, el) => {
        await restartApp(el)
    },
}

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

    // Load data (configs)
    try {
        await fetchConfigs();
        updateTable();
    } catch (err) {
        console.error(err?.message || "Error loading configs");
        showToast(err?.message || "Error loading configs", false);
    }

    initUI();
    initEvents();
}

// -----------------------------
// UI INIT
// -----------------------------
function initUI() {
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
        updateTable();
    });
}

// -----------------------------
// MODAL LIFECYCLE (ADD / EDIT)
// -----------------------------
function initModalLifecycle() {

    // Modal show/hidden events to prepare/reset the form
    const modalEl = document.getElementById('editConfigModal');
    if (!modalEl) return;

    // store who opened the modal
    let lastTriggerEl = null;

    // When shown, determine Add or Edit mode
    modalEl.addEventListener('show.bs.modal', async (ev) => {
        lastTriggerEl = ev.relatedTarget; // trigger (Add o Edit)

        // check Add or Edit mode based on presence of data-config-id in the trigger element
        const key = lastTriggerEl?.dataset?.configKey;

        if (typeof key === "string" && key.length > 0) {
            // EDIT MODE
            try {
                await editConfig(key);
            } catch (err) {
                showToast(err?.message || "Error loading config", false);
                // Close modal
                modalEl.addEventListener('shown.bs.modal', () => {
                    closeEditConfigModal(lastTriggerEl);
                }, { once: true });
            }
        } else {
            console.warn("Invalid Configuration Key for edit");
            closeEditConfigModal();
            return;
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
        clearEditConfigForm();
        // pulizia ref del trigger
        lastTriggerEl = null;
    });
}

// -----------------------------
// GLOBAL EVENTS INIT
// -----------------------------
function initEvents() {
    document.addEventListener('click', handleActionClick);
    document.addEventListener('keydown', handleKeyboard);
    document.addEventListener('submit', handleForms);
    document.addEventListener("click", (e) => {
        const groupRow = e.target.closest('tr[data-group]');
        if (!groupRow || !groupRow.dataset.group) return;

        const groupKey = groupRow.dataset.group;
        toggleGroup(groupKey);
    });
    document.getElementById("expandAllBtn")
        ?.addEventListener("click", expandAllGroups);
    document.getElementById("collapseAllBtn")
        ?.addEventListener("click", collapseAllGroups);
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

    // ESC delegation: clear search
    if (isEscape) {
        // Ignore if focus is in a typing field
        const tag = (e.target.tagName || "").toLowerCase();
        const isTypingField =
            tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
        const isSearchInput = e.target.id === "searchInput";

        // ESC should clear search only if not focused on a typing field, or if focused on the search input (to allow quick clearing of search)
        if (!isTypingField || isSearchInput) {
            // Prevent default form submission
            e.preventDefault();             // evita side-effect (es. chiusure di modali del browser)
            clearSearch();                  // svuota input e ricarica tabella (come definito nella tua funzione)
            viewConfigs = [...allConfigs];
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
    if (e.target.id === 'editConfigForm') {
        handleEditConfigSubmit(e);
    }
}
