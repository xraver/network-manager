// -------------------------------------------------------
// IMPORT
// -------------------------------------------------------
import { loadModals, showToast, showConfirmModal, handleReload } from './common.js';
import { serviceIsAlive, serviceCheckHealth , serviceReloadDNS, serviceReloadDHCP, serviceBackupCreate, serviceBackupList, serviceBackupRestore, serviceDeleteBackup, serviceDownloadBackup, serviceUploadBackup } from './services.js';
import { loadLanguage, translatePage, t } from "./i18n.js";
import { getBackendMessage } from "./backendMessages.js";

// -------------------------------------------------------
// Localize health status for display in the UI
// -------------------------------------------------------
function localizeHealthStatus(status) {
    const norm = String(status || "").toLowerCase();

    switch (norm) {
        case "healthy":
            return t("health.status.healthy");

        case "degraded":
            return t("health.status.degraded");

        case "unhealthy":
            return t("health.status.unhealthy");

        default:
            return t("health.status.unknown");
    }
}

// -------------------------------------------------------
// BACKUP MODAL OPEN/CLOSE
// -------------------------------------------------------
async function openBackupModal() {

    const modal = document.getElementById('backupModal');
    if (!modal) return;
    modal.style.display = 'flex';

    const tbody = document.getElementById("backupList");
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center text-muted">
                ${t("backup.loading")}
            </td>
        </tr>
    `;

    // Refresh backup list
    try {
        const result = await serviceBackupList();
        renderBackupList(result);
    } catch (err) {
        const msg = getBackendMessage(
            err,
            "backup.refresh_error"
        );
        showToast(msg, false);
    }
}

function closeBackupModal() {
    const modal = document.getElementById('backupModal');
    if (modal) modal.style.display = 'none';
}

// -------------------------------------------------------
// Manage Backup List Rendering (usa fetchData() con apiMap.backups)
// -------------------------------------------------------
export async function serviceCheckAbout() {
    const pills = document.querySelectorAll('.btn-api');

    if (!pills.length) return false;

    const ok = await serviceIsAlive();

    pills.forEach(pill => {

        if (ok) {
            pill.textContent = t("header.api_status_online");
            pill.classList.remove('btn-outline-primary');
            pill.classList.add('btn-primary');

        } else {
            pill.textContent = t("header.api_status_offline");
        }
    });

    return ok;
}

// -------------------------------------------------------
// Manage Backup List Rendering (usa fetchData() con apiMap.backups)
// -------------------------------------------------------
function renderBackupList(data) {
    const tbody = document.getElementById("backupList");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!data?.backups || !Array.isArray(data.backups) || data.backups.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    ${t("backup.empty")}
                </td>
            </tr>
        `;
        return;
    }

    data.backups.sort((a, b) =>
        new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );

    data.backups.forEach((b, index) => {
        const tr = document.createElement("tr");
        const formattedDate = new Date(b.created_at).toLocaleString();
        const formattedSize = (b.size_bytes / 1024).toFixed(2) + " KB";

        // radio
        const tdRadio = document.createElement("td");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "backupSelect";
        radio.value = b.name;
        radio.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll("#backupList tr")
                .forEach(r => r.classList.remove("table-active"));

            tr.classList.add("table-active");
        });
        tdRadio.appendChild(radio);

        // name
        const tdName = document.createElement("td");
        tdName.textContent = b.name;

        // date
        const tdDate = document.createElement("td");
        tdDate.textContent = formattedDate;

        // size
        const tdSize = document.createElement("td");
        tdSize.textContent = formattedSize;
        tdSize.classList.add("text-end");

        // actions
        const tdActions = document.createElement("td");
        tdActions.classList.add("text-end");
        // download button
        const downloadBtn = document.createElement("button");
        const downloadText = t("backup.download.file");
        downloadBtn.className = "btn btn-sm btn-outline-primary me-2";
        downloadBtn.title = downloadText;
        downloadBtn.innerHTML = `<i class="bi bi-download"></i>`;
        downloadBtn.setAttribute("aria-label", downloadText);
        downloadBtn.setAttribute("data-action", "downloadBackup");
        downloadBtn.setAttribute("data-id", b.name);
        tdActions.appendChild(downloadBtn);
        // delete button
        const deleteBtn = document.createElement("button");
        const deleteText = t("backup.delete.file");
        deleteBtn.className = "btn btn-sm btn-outline-danger";
        deleteBtn.title = deleteText;
        deleteBtn.innerHTML = `<i class="bi bi-trash-fill"></i>`;
        deleteBtn.setAttribute("aria-label", deleteText);
        deleteBtn.setAttribute("data-action", "deleteBackup");
        deleteBtn.setAttribute("data-id", b.name);
        tdActions.appendChild(deleteBtn);

        // Append all columns
        tr.append(tdRadio, tdName, tdDate, tdSize, tdActions);

        if (index === 0) {
            radio.checked = true;
            tr.classList.add("table-active");
        }

        // click su tutta la riga = selezione radio
        tr.addEventListener("click", () => {
            radio.checked = true;

            // highlight selected row
            document.querySelectorAll("#backupList tr")
                .forEach(r => r.classList.remove("table-active"));

            tr.classList.add("table-active");
        });

        tbody.appendChild(tr);
    });
}

function getSelectedBackup() {
    const selected = document.querySelector('input[name="backupSelect"]:checked');
    return selected ? selected.value : null;
}

// -------------------------------------------------------
// HEALTH MODAL OPEN/CLOSE + RENDER
// -------------------------------------------------------
function openHealthModal() {
    const modal = document.getElementById('healthModal');
    const loadingEl = document.getElementById('healthLoading');
    const contentEl = document.getElementById('healthContent');
    const errorEl = document.getElementById('healthError');
    const badgeEl = document.getElementById('healthStatusBadge');
    const updatedAtEl = document.getElementById('healthUpdatedAt');
    const summaryEl = document.getElementById('healthSummary');
    //const rawJsonEl = document.getElementById('healthRawJson');

    if (!modal) return;

    // Reset UI
    modal.style.display = 'flex';
    loadingEl?.classList?.remove('d-none');
    contentEl?.classList?.add('d-none');
    errorEl?.classList?.add('d-none');
    if (summaryEl) summaryEl.innerHTML = '';
    //if (rawJsonEl) rawJsonEl.textContent = '';
    if (badgeEl) {
        badgeEl.className = 'badge rounded-pill bg-secondary';
        badgeEl.textContent = '—';
    }
    if (updatedAtEl) updatedAtEl.textContent = '';

    // Usa serviceCheckHealth() per ottenere il payload health
    Promise.resolve()
      .then(() => serviceCheckHealth())
      .then((data) => {
          // Verify that the response contains health details
          const isDetailed =
              data && typeof data === 'object' &&
              ('status' in data || 'latency_ms' in data || 'database' in data);

          if (!isDetailed) {
              throw new Error(t("health.details_unavailable"));
          }

          renderHealth(data);
          loadingEl?.classList?.add('d-none');
          contentEl?.classList?.remove('d-none');
      })
      .catch((err) => {
          loadingEl?.classList?.add('d-none');
          errorEl?.classList?.remove('d-none');
          showToast(err?.message || t("health.error"), false);
          console.error(err);
      });
}

function closeHealthModal() {
    const modal = document.getElementById('healthModal');
    if (modal) modal.style.display = 'none';
}

function setHealthBadge(status) {
    const badgeEl = document.getElementById('healthStatusBadge');
    if (!badgeEl) return;

    const norm = String(status || '').toLowerCase();

    let cls = 'bg-secondary';

    if (norm === 'healthy') {
        cls = 'bg-success';
    } else if (norm === 'degraded') {
        cls = 'bg-warning text-dark';
    } else if (norm === 'unhealthy') {
        cls = 'bg-danger';
    }

    badgeEl.className = `badge rounded-pill ${cls}`;
    badgeEl.textContent = localizeHealthStatus(norm);
}

function renderHealth(data) {
    const summaryEl = document.getElementById('healthSummary');
    //const rawJsonEl = document.getElementById('healthRawJson');
    const updatedAtEl = document.getElementById('healthUpdatedAt');

    const status = data?.status ?? 'unknown';
    const latency = data?.latency_ms;
    const db = data?.database ?? {};
    const dbStatus = db?.status ?? 'unknown';
    const dbVersion = db?.version ?? '—';
    const dbTables = (typeof db?.tables === 'number') ? db.tables : '—';
    const dbSize = (typeof db?.size_mb === 'number') ? `${db.size_mb} MB` : '—';

    setHealthBadge(status);
    if (updatedAtEl) {
        const now = new Date();
        updatedAtEl.textContent = `${t("health.updated_at")} ${now.toLocaleTimeString()}`;
    }

    const rows = [
        { label: t("health.status"), value: localizeHealthStatus(status) },
        { label: t("health.latency"), value: (typeof latency === "number") ? `${latency} ms` : "—" },
        { label: t("health.db_status"), value: localizeHealthStatus(dbStatus) },
        { label: t("health.db_version"), value: dbVersion },
        { label: t("health.db_tables"), value: dbTables },
        { label: t("health.db_size"), value: dbSize },
    ];

    if (summaryEl) {
        for (const r of rows) {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <span class="text-muted">${r.label}</span>
                <strong>${r.value}</strong>
            `;
            summaryEl.appendChild(li);
        }
    }

    //if (rawJsonEl) {
    //    rawJsonEl.textContent = JSON.stringify(data, null, 2);
    //}
}

// -------------------------------------------------------
// Action Handlers
// -------------------------------------------------------
const actionHandlers = {
    // Create Backup
    startBackup: async (e, el) => {
        const btn = el;

        if (!btn) return;

        const label = btn.querySelector('.label');
        const originalLabel = label?.textContent ?? '';

        btn.disabled = true;
        label.textContent = t("backup.create.progress");

        try {
            const result = await serviceBackupCreate();
            const success = result?.status !== 'partial';
            const msg = getBackendMessage(
                        result,
                        success
                            ? "backup.create_ok"
                            : "backup.create_partial"
                    );
            showToast(msg, success);
        } catch (err) {
            const msg = getBackendMessage(
                err,
                "backup.create_error"
            );
            showToast(msg, false);
        } finally {
            label.textContent = originalLabel;
            btn.disabled = false;
        }
        // Refresh backup list
        try {
            const result = await serviceBackupList();
            renderBackupList(result);
        } catch (err) {
            const msg = getBackendMessage(
                err,
                "backup.refresh_error"
            );
            showToast(msg, false);
        }
    },
    // Restore Backup
    startRestore: async (e, el) => {
        const btn = el;
        //const modal = document.getElementById('backupModal');

        const id = getSelectedBackup();
        if (!id) {
            showToast(t("backup.select"), false);
            return;
        }

        const label = btn.querySelector('.label');
        const originalLabel = label?.textContent ?? '';

        btn.disabled = true;
        label.textContent = t("backup.restore.progress");

        try {
            const result = await serviceBackupRestore(id);
            const success = result?.status !== 'partial';
            const msg = getBackendMessage(
                        result,
                        success
                            ? "backup.restore_ok"
                            : "backup.restore_partial"
                    );
            showToast(msg, success);
            // Close modal
            //if (modal) modal.style.display = 'none';
        } catch (err) {
            const msg = getBackendMessage(
                err,
                "backup.restore_error"
            );
            showToast(msg, false);
        } finally {
            label.textContent = originalLabel;
            btn.disabled = false;
        }
    },
    // Delete Backup
    deleteBackup: async (e, el) => {

        e.stopPropagation();

        const id = el.dataset.id;
        if (!id) return;

        const confirmed = await showConfirmModal(t("backup.delete_confirm").replace("{id}", id));
        if (!confirmed) return;

        try {
            const result = await serviceDeleteBackup(id);
            const msg = getBackendMessage(
                        result,
                        "backup.delete_ok"
                    );
            showToast(msg, true);
        } catch (err) {
            const msg = getBackendMessage(
                err,
                "backup.delete_error"
            );
            showToast(msg, false);
        }
        // Refresh backup list
        try {
            const result = await serviceBackupList();
            renderBackupList(result);
        } catch (err) {
            const msg = getBackendMessage(
                err,
                "backup.refresh_error"
            );
            showToast(msg, false);
        }
    },
    refreshBackupList: async () => {
        try {
            const result = await serviceBackupList();
            const msg = getBackendMessage(
                result,
                "backup.refresh_ok"
            );
            showToast(msg, true);
            renderBackupList(result);
        } catch (err) {
            const msg = getBackendMessage(
                err,
                "backup.refresh_error"
            );
            showToast(msg, false);
        }
    },
    // Download Backup
    downloadBackup: async (e, el) => {
        e.stopPropagation();

        const id = el.dataset.id;
        if (!id) return;

        try {
            const result = await serviceDownloadBackup(id);

            const msg = (typeof result === 'object' && result?.message)
                ? result.message
                : t("backup.download_ok");

            showToast(msg, true);

        } catch (err) {
            console.error(err);
            showToast(err?.message || t("backup.download_error"), false);
        }
    },
    // Upload Backup
    uploadBackup: async (e, el) => {
        const input = document.getElementById('backupUploadInput');
        if (!input?.files?.length) {
            showToast(t("backup.select_file"), false);
            return;
        }

        const file = input.files[0];

        const icon = el.querySelector('.icon');
        const originalClass = icon?.className;

        el.disabled = true;
        if (icon) {
            icon.className = "spinner-border spinner-border-sm icon";
        }

        try {
            const result = await serviceUploadBackup(file);

            const msg = (result?.message)
                ? result.message
                : t("backup.update_ok");

            showToast(msg, true);
            input.value = '';
        } catch (err) {
            showToast(err?.message || t("backup.update_error"), false);
        } finally {
            if (icon && originalClass) {
                icon.className = originalClass;
            }
            el.disabled = false;
        }
        // refresh backup list
        try {
            const result = await serviceBackupList();
            renderBackupList(result);
        } catch (err) {
            const msg = getBackendMessage(
                err,
                "backup.refresh_error"
            );
            showToast(msg, false);
        }
    },
    openBackupModal,       // managed by boostrap
    closeBackupModal,      // managed by boostrap
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
    // Check API status
    apiCheck: async () => {
        const result = await serviceCheckAbout();
        if(result) {
            showToast(t("health.update.ok"), true);
        } else {
            showToast(t("health.update.error"), false);
        }
    },
    // Health
    openHealthModal: (e) => {
        if (e?.preventDefault) e.preventDefault();
        openHealthModal();
    },
    closeHealthModal: () => {
        closeHealthModal();
    }
};

// -----------------------------
// DOMContentLoaded: initialize everything
// -----------------------------
document.addEventListener("DOMContentLoaded", async () => {

    // Load modals (Bootstrap 5 requires JS initialization for dynamic content)
    try {
        await loadModals();
    } catch (err) {
        console.error(err?.message || t("app.modals.error"));
        showToast(t("app.modals.error"), false);
    }

    // translate modals
    translatePage();

    // Init Backup Modal (backdrop click to close)
    initBackupModal();
});

// -------------------------------------------------------
// Global Click Delegation
// -------------------------------------------------------
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
        console.error(err?.message || t("app.action.error"));
        showToast(err?.message || t("app.action.error"), false);
    }
});

// -------------------------------------------------------
// MODAL: ESC + BACKDROP CLOSE
// -------------------------------------------------------
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeBackupModal();
        closeHealthModal();
    }
});

// -------------------------------------------------------
// Init Backup Modal (backdrop click to close)
// -------------------------------------------------------
function initBackupModal() {
    const backupModal = document.getElementById('backupModal');
    if (!backupModal) return;

    backupModal.addEventListener('click', (e) => {
        if (e.target === backupModal) closeBackupModal();
    });
}

// -------------------------------------------------------
// Periodic API Check
// -------------------------------------------------------
async function periodicTest() {
    await serviceCheckAbout();
    setTimeout(periodicTest, 10000);
}

// Loading translation
try {
    await loadLanguage();
} catch (err) {
    console.error(err?.message || t("app.translation.error"));
    showToast(t("app.translation.error"), false);
}

// Translate page
translatePage();

// Periodic Test
periodicTest();
