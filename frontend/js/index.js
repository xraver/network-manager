// -------------------------------------------------------
// IMPORT
// -------------------------------------------------------
import { showToast } from './common.js';
import { apiCheck, reloadDNS, reloadDHCP, doBackup, doRestore } from './services.js';

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
    if (e.key === 'Escape') closeRestoreModal();
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
