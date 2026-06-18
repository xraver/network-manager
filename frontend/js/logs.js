// Import common js
import { loadModals, showToast, showConfirmModal, handleReload } from './common.js';
// Import services
import { serviceReloadDNS, serviceReloadDHCP, serviceRestartApp, serviceIsAlive, serviceGetLogs } from './services.js';

// -----------------------------
// State variables
// -----------------------------
const logViewer = document.getElementById("logViewer");
const loader = document.getElementById("loader");
let selectedLogType = "app";
let live = true;
let requestId = 0;
let loading = false;
let selectedRows = new Set();
let lastSelectedRowId = null;

// -----------------------------
// load logs from backend
// -----------------------------
async function loadLogs() {
    const type = selectedLogType;
    const previousScroll = logViewer.scrollTop;
    const previousHeight = logViewer.scrollHeight;

    const isNearBottom =
        previousHeight - previousScroll <= logViewer.clientHeight + 50;

    // return in case of concurrent requests
    if (loading) return;
    loading = true;
    const currentRequest = ++requestId;

    loader.style.display = "block";

    try {
        const data = await serviceGetLogs(type);

        // Check concurrency
        if (currentRequest !== requestId) return;

        // Fetch Logs
        renderLogs(data, isNearBottom, previousScroll, previousHeight);

    } catch (err) {
        logViewer.textContent = err.message || "Errore loading logs";
    } finally {
        loader.style.display = "none";
        loading = false;
    }
}

// -----------------------------
// shows logs in the table
// -----------------------------
function renderLogs(text, isNearBottom, previousScroll, previousHeight) {

    const lines = text.split("\n");
    const fragment = document.createDocumentFragment();

    lines.forEach((line, index) => {
        const div = document.createElement("div");

        if (line.includes("ERROR")) div.classList.add("log-error");
        else if (line.includes("WARN")) div.classList.add("log-warn");
        else div.classList.add("log-info");

        //div.textContent = line;

        const match = line.match(
            /^(\S+)\s+(INFO|WARN|ERROR)\s+\[([^\]]+)\]\s+(.*)$/
        );

        if (match) {
            const [, date, level, source, msg] = match;

            // define rowID as combination of the log
            const rowId = `${date}|${level}|${source}|${msg}`;

            div.dataset.index = index;
            div.dataset.rowId = rowId;

            div.classList.add("log-row");

            // single click select effect
            div.addEventListener("click", (e) => {

                // Shift = interval
                if (e.shiftKey && lastSelectedRowId !== null) {

                    const rows = Array.from(
                        document.querySelectorAll(".log-row")
                    );

                    const currentIndex = Number(div.dataset.index);

                    const lastRow = rows.find(
                        r => r.dataset.rowId === lastSelectedRowId
                    );

                    if (lastRow) {

                        const lastIndex = Number(lastRow.dataset.index);

                        const start = Math.min(lastIndex, currentIndex);
                        const end   = Math.max(lastIndex, currentIndex);

                        for (let i = start; i <= end; i++) {

                            const row = rows[i];
                            row.classList.add("selected");

                            selectedRows.add(row.dataset.rowId);
                        }
                    }

                    return;
                }

                // Ctrl = add/remove
                if (e.ctrlKey) {

                    if (selectedRows.has(rowId)) {
                        selectedRows.delete(rowId);
                        div.classList.remove("selected");
                    } else {
                        selectedRows.add(rowId);
                        div.classList.add("selected");
                    }

                } else {

                    // Single line
                    selectedRows.clear();

                    document
                        .querySelectorAll(".log-row.selected")
                        .forEach(r => r.classList.remove("selected"));

                    selectedRows.add(rowId);
                    div.classList.add("selected");
                }

                lastSelectedRowId = rowId;
            });


            // right click to copy logs
            div.addEventListener("contextmenu", async (e) => {

                e.preventDefault();

                // se la riga non è selezionata la seleziono
                if (!selectedRows.has(rowId)) {

                    selectedRows.clear();

                    document
                        .querySelectorAll(".log-row.selected")
                        .forEach(r => r.classList.remove("selected"));

                    selectedRows.add(rowId);
                    div.classList.add("selected");
                }

                await copySelectedLogs();
            });

            div.innerHTML =
                `<span class="log-date">${date}</span>
                <span class="log-level">${level}</span>
                <span class="log-source">${source}</span>
                <span class="log-msg">${msg}</span>`;

            // restore old selection
            if (selectedRows.has(rowId)) {
                div.classList.add("selected");
            }
        }

        fragment.appendChild(div);
    });

    // update view
    logViewer.innerHTML = "";
    logViewer.appendChild(fragment);


    if (isNearBottom) {
        // "tail -f"
        logViewer.scrollTop = logViewer.scrollHeight;
    } else {
        // restore old scroll position
        const newHeight = logViewer.scrollHeight;
        if (newHeight < previousHeight) {
            // log rotation o reset
            logViewer.scrollTop = 0;
        } else {
            const diff = newHeight - previousHeight;
            logViewer.scrollTop = previousScroll + diff;
        }
    }
}

// -----------------------------
// copy logs
// -----------------------------
async function copySelectedLogs() {

    const rows = Array.from(document.querySelectorAll(".log-row"));

    const selectedTexts = rows
        .filter(row => selectedRows.has(row.dataset.rowId))
        .map(row => row.textContent.trim());

    if (!selectedTexts.length) {
        showToast("No rows selected", false);
        return;
    }

    try {

        await navigator.clipboard.writeText(
            selectedTexts.join("\n")
        );

        showToast(
            `${selectedTexts.length} log(s) copied`,
            true
        );

    } catch (err) {

        showToast(
            "Error copying logs",
            false
        );
    }
}

// -----------------------------
// update dropdown menu
// -----------------------------
function updateDropdownUI(value) {
    const button = document.getElementById("logTypeBtn");

    document
        .querySelectorAll('#logTypeDropdown .dropdown-item')
        .forEach(item => {

            const active = item.dataset.value === value;

            item.classList.toggle('active', active);

            if (active) {
                button.innerHTML =
                    `<i class="bi bi-file-text me-1"></i> ${item.textContent}`;
            }
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
async function handleRestartApp(button) {
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
// Action Handlers
// -----------------------------
const actionHandlers = {
    // Refresh Logs
    refreshLogs: (e, el) => {
        loadLogs();
    },
    // Copy Logs
    //copyLogs(e, el) => {
    //    copySelectedLogs();
    //},
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
    // Reload DHCP
    restartApp: async (e, el) => {
        await handleRestartApp(el)
    },
};

// -----------------------------
// DOMContentLoaded: bootstrap app
// -----------------------------
document.addEventListener("DOMContentLoaded", async () => {
    initApp();
    loadLogs();
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

    initEvents();
    initDropdown();

    // auto refresh (tipo tail -f)
    setInterval(() => {
        if (live) loadLogs();
    }, 5000);
}

// -----------------------------
// GLOBAL EVENTS INIT
// -----------------------------
function initEvents() {

    document.addEventListener('click', handleActionClick);

    const liveToggle = document.getElementById("liveToggle");
    if (liveToggle) {
        liveToggle.addEventListener("change", (e) => {
            live = e.target.checked;
        });
    }
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
// Init dropdown menu
// -----------------------------
function initDropdown() {

    // restore previouse selection
    const saved = localStorage.getItem("logType");
    if (saved) {
        selectedLogType = saved;
    }

    // Update Dropdown menu
    updateDropdownUI(selectedLogType);

    document.querySelectorAll('#logTypeDropdown .dropdown-item')
        .forEach(item => {

            item.addEventListener('click', e => {

                e.preventDefault();

                selectedLogType = item.dataset.value;

                updateDropdownUI(selectedLogType);

                localStorage.setItem("logType", selectedLogType);

                loadLogs();
            });

        });
}
