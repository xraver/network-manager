// -------------------------------------------------------
// IMPORT
// -------------------------------------------------------
import { showToast } from './common.js';
import { apiCheck, reloadDNS, reloadDHCP, doBackup, doRestore, checkHealth } from './services.js';

// -------------------------------------------------------
// RESTORE MODAL OPEN/CLOSE
// -------------------------------------------------------
function openRestoreModal() {
    const modal = document.getElementById('restoreModal');
    const input = document.getElementById('restoreBackupId');
    if (!modal) return;

    modal.style.display = 'flex';
    if (input) {
        input.value = input.value?.trim() ?? '';
        setTimeout(() => input.focus(), 50);
    }
}

function closeRestoreModal() {
    const modal = document.getElementById('restoreModal');
    if (modal) modal.style.display = 'none';
}

// -------------------------------------------------------
// HEALTH MODAL OPEN/CLOSE + RENDER (usa checkHealth())
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

    // Usa checkHealth() per ottenere il payload health
    Promise.resolve()
      .then(() => checkHealth())
      .then((data) => {
          // Se checkHealth ritorna true o {message}, non abbiamo i dettagli: mostra un messaggio
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
    // Backup
    startBackup: async (e, el) => {
        const btn = el;

        if (!btn) return;

        const label = btn.querySelector('.label');
        const originalLabel = label?.textContent ?? '';

        btn.disabled = true;
        label.textContent = ' Exporting…';

        try {
            const result = await doBackup();
            const msg = (typeof result === 'object' && result?.message)
                        ? result.message
                        : 'Backup compleated successfully';
            showToast(msg, true);
        } catch (err) {
            showToast(err?.message || "Error performing backup", false);
        } finally {
            label.textContent = originalLabel;
            btn.disabled = false;
        }
    },
    // Restore
    startRestore: async (e, el) => {
        const btn = el;
        const input = document.getElementById('restoreBackupId');
        const modal = document.getElementById('restoreModal');

        if (!btn || !input) return;

        const id = input.value.trim();
        if (!id) {
            showToast('Specify a Backup ID', false);
            input.focus();
            return;
        }

        const label = btn.querySelector('.label');
        const originalLabel = label?.textContent ?? '';

        btn.disabled = true;
        label.textContent = ' Restoring…';

        try {
            const result = await doRestore();
            const msg = (typeof result === 'object' && result?.message)
                        ? result.message
                        : 'Restore completed successfully';
            showToast(msg, true);
            // Close modal and reset input
            if (modal) modal.style.display = 'none';
            input.value = '';
        } catch (err) {
            showToast(err?.message || "Error performing restore", false);
        } finally {
            label.textContent = originalLabel;
            btn.disabled = false;
        }
    },
    openRestoreModal,       // managed by boostrap
    closeRestoreModal,      // managed by boostrap
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
    // Check API status
    apiCheck: async () => {
        const result = await apiCheck();
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
        closeRestoreModal();
        closeHealthModal();
    }
});

const restoreModal = document.getElementById('restoreModal');
if (restoreModal) {
    restoreModal.addEventListener('click', (e) => {
        if (e.target === restoreModal) closeRestoreModal();
    });
}

// -------------------------------------------------------
// KICKOFF
// -------------------------------------------------------
apiCheck();
