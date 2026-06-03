// -------------------------------------------------------
// IMPORT
// -------------------------------------------------------
import { loadModals, showToast, showConfirmModal } from './common.js';
import { serviceIsAlive, serviceCheckHealth , serviceReloadDNS, serviceReloadDHCP, serviceBackupCreate, serviceBackupList, serviceBackupRestore, serviceDeleteBackup, serviceDownloadBackup, serviceUploadBackup } from './services.js';

// -------------------------------------------------------
// BACKUP MODAL OPEN/CLOSE
// -------------------------------------------------------
async function openBackupModal() {

    const modal = document.getElementById('backupModal');
    if (!modal) return;
    modal.style.display = 'flex';

    const tbody = document.getElementById("backupList");
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    Loading backups...
                </td>
            </tr>
        `;
    }

    // Refresh backup list
    try {
        const result = await serviceBackupList();
        renderBackupList(result);
    } catch (err) {
        showToast(err?.message || "Error refreshing backup list", false);
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
    const pill = document.getElementById('api-pill');
    if (!pill) return;

    const ok = await serviceIsAlive();

    if (ok) {
        pill.textContent = 'API OK';
        pill.classList.remove('btn-outline-primary');
        pill.classList.add('btn-primary');
    } else {
        pill.textContent = 'API OFFLINE';
    }

    return ok;
}

// -------------------------------------------------------
// Manage Backup List Rendering (usa fetchData() con apiMap.backups)
// -------------------------------------------------------
function renderBackupList(data) {
    const tbody = document.getElementById("backupList");
    tbody.innerHTML = "";

    if (!data?.backups || !Array.isArray(data.backups) || data.backups.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    No backups available
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
        downloadBtn.className = "btn btn-sm btn-outline-primary me-2";
        downloadBtn.title = "Download backup";
        downloadBtn.innerHTML = `<i class="bi bi-download text-primary"></i>`;
        downloadBtn.setAttribute("data-action", "downloadBackup");
        downloadBtn.setAttribute("data-id", b.name);
        tdActions.appendChild(downloadBtn);
        // delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-sm btn-outline-danger";
        deleteBtn.title = "Delete backup";
        deleteBtn.innerHTML = `<i class="bi bi-trash-fill text-danger"></i>`;
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
          // Se serviceCheckHealth ritorna true o {message}, non abbiamo i dettagli: mostra un messaggio
          const isDetailed =
              data && typeof data === 'object' &&
              ('status' in data || 'latency_ms' in data || 'database' in data);

          if (!isDetailed) {
              throw new Error('Health details not available');
          }

          renderHealth(data);
          loadingEl?.classList?.add('d-none');
          contentEl?.classList?.remove('d-none');
      })
      .catch((err) => {
          loadingEl?.classList?.add('d-none');
          errorEl?.classList?.remove('d-none');
          showToast(err?.message || 'Error while fetching health status', false);
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
    if (norm === 'ok' || norm === 'healthy' || norm === 'up') cls = 'bg-success';
    if (norm === 'warn' || norm === 'warning' || norm === 'degraded') cls = 'bg-warning text-dark';
    if (norm === 'down' || norm === 'error' || norm === 'fail' || norm === 'critical') cls = 'bg-danger';

    badgeEl.className = `badge rounded-pill ${cls}`;
    badgeEl.textContent = norm || 'unknown';
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
        updatedAtEl.textContent = `Updated at ${now.toLocaleTimeString()}`;
    }

    const rows = [
        { label: 'Status', value: status },
        { label: 'Latency', value: (typeof latency === 'number') ? `${latency} ms` : '—' },
        { label: 'DB Status', value: dbStatus },
        { label: 'DB Version', value: dbVersion },
        { label: 'DB Tables', value: dbTables },
        { label: 'DB Size', value: dbSize },
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
        const modal = document.getElementById('backupModal');

        if (!btn) return;

        const label = btn.querySelector('.label');
        const originalLabel = label?.textContent ?? '';

        btn.disabled = true;
        label.textContent = ' Exporting…';

        try {
            const result = await serviceBackupCreate();
            const msg = (typeof result === 'object' && result?.message)
                        ? result.message
                        : 'Backup completed successfully';
            showToast(msg, !result?.partial);
        } catch (err) {
            showToast(err?.message || "Error performing backup", false);
        } finally {
            label.textContent = originalLabel;
            btn.disabled = false;
        }
        // Refresh backup list
        try {
            const result = await serviceBackupList();
            renderBackupList(result);
        } catch (err) {
            showToast(err?.message || "Error refreshing backup list", false);
        }
    },
    // Restore Backup
    startRestore: async (e, el) => {
        const btn = el;
        const modal = document.getElementById('backupModal');

        const id = getSelectedBackup();
        if (!id) {
            showToast('Select a backup', false);
            return;
        }

        const label = btn.querySelector('.label');
        const originalLabel = label?.textContent ?? '';

        btn.disabled = true;
        label.textContent = ' Restoring…';

        try {
            const result = await serviceBackupRestore(id);
            const msg = (typeof result === 'object' && result?.message)
                        ? result.message
                        : 'Restore completed successfully';
            showToast(msg, !result?.partial);
            // Close modal
            //if (modal) modal.style.display = 'none';
        } catch (err) {
            showToast(err?.message || "Error performing restore", false);
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

        const confirmed = await showConfirmModal(`Delete backup "${id}" ?`);
        if (!confirmed) return;

        try {
            const result = await serviceDeleteBackup(id);

            const msg = (typeof result === 'object' && result?.message)
                ? result.message
                : 'Backup deleted successfully';

            showToast(msg, true);
        } catch (err) {
            console.error(err);
            showToast(err?.message || "Error deleting backup", false);
        }
        // Refresh backup list
        try {
            const result = await serviceBackupList();
            renderBackupList(result);
        } catch (err) {
            showToast(err?.message || "Error refreshing backup list", false);
        }
    },
    refreshBackupList: async () => {
        try {
            const result = await serviceBackupList();
            const msg = (typeof result === 'object' && result?.message)
                        ? result.message
                        : 'Backup list refreshed successfully';
            showToast(msg, true);
            renderBackupList(result);
        } catch (err) {
            showToast(err?.message || "Error refreshing backup list", false);
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
                : 'Backup downloaded successfully';

            showToast(msg, true);

        } catch (err) {
            console.error(err);
            showToast(err?.message || "Error downloading backup", false);
        }
    },
    // Upload Backup
    uploadBackup: async (e, el) => {
        const input = document.getElementById('backupUploadInput');
        if (!input?.files?.length) {
            showToast("Select a file first", false);
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
                : 'Backup uploaded successfully';

            showToast(msg, true);

            console.log("Uploaded backup ID:", result?.backup_id);

            input.value = '';
        } catch (err) {
            showToast(err?.message || "Error uploading backup", false);
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
            showToast(err?.message || "Error refreshing backup list", false);
        }
    },
    openBackupModal,       // managed by boostrap
    closeBackupModal,      // managed by boostrap
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
    // Check API status
    apiCheck: async () => {
        const result = await serviceCheckAbout();
        if(result) {
            showToast('API status updated succesfully', true);
        } else {
            showToast('Error updating API status', false);
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
        console.error(err?.message || "Error loading modals");
        showToast(err?.message || "Error loading modals", false);
    }

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

    try {
        await handler(e, el);
    } catch (err) {
        console.error(err?.message || 'Action error');
        showToast(err?.message || 'Action error', false);
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

periodicTest();
