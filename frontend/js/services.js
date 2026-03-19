// -------------------------------------------------------
// API Health Check
// -------------------------------------------------------
export async function apiCheck() {
    const pill = document.getElementById('api-pill');
    if (!pill) return;

    try {
        const r = await fetch('/api/health');
        if (r.ok) {
            pill.textContent = 'API OK';
            pill.classList.remove('btn-outline-primary');
            pill.classList.add('btn-primary');
            return true;
        } else {
            pill.textContent = `API ${r.status}`;
            return false;
        }
    } catch {
        pill.textContent = 'API OFFLINE';
        return false;
    }
}

// -----------------------------
// Reload DNS
// -----------------------------
export async function reloadDNS() {
    let res;
    try {
        // Fetch data
        res = await fetch('/api/dns/reload', {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
        });
    } catch (err) {
        const msg = 'Network error while reloading DNS' + (err?.message ? `: ${err.message}` : '');
        throw new Error(msg, { cause: err });
    }

    // Success without JSON
    if (res.status === 204) {
        return true;
    }

    // Check content-type to avoid parsing errors
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const err = new Error(`Error reloading DNS: ${res.status}: ${res.statusText || 'Unexpected response'}`);
        err.status = res.status;
        throw err;
    }

    // Check JSON
    let data = {};
    try {
        data = await res.json();
    } catch {
        throw new Error('Error reloading DNS: Invalid JSON payload');
    }

    // Check JSON errors
    if (!res.ok) {
        const serverMsg =
            data?.detail?.message?.trim()
            || (typeof data?.detail === 'string' ? data.detail.trim() : '')
            || data?.message?.trim()
            || data?.error?.message?.trim()
            || (typeof data?.error === 'string' ? data.error.trim() : '');
        const err = new Error('Error reloading DNS' + (serverMsg ? `: ${serverMsg}` : ''));
        err.status = res.status;
        throw err;
    }

    if (res.ok && (data.status === 'success' || data.code === 'DNS_RELOAD_OK')) {
        // Success
        return data?.message ? { message: data.message } : true;
    } else {
        // Failed with JSON error message
        return data?.message ? { message: data.message } : false;
    }
}

// -----------------------------
// Reload DHCP action
// -----------------------------
export async function reloadDHCP() {
    let res;
    try {
        // Fetch data
        res = await fetch(`/api/dhcp/reload`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
        });
    } catch (err) {
        const msg = 'Network error while reloading DHCP' + (err?.message ? `: ${err.message}` : '');
        throw new Error(msg, { cause: err });
    }

    // Success without JSON
    if (res.status === 204) {
        return true;
    }

    // Check content-type to avoid parsing errors
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const err = new Error(`Error reloading DHCP: ${res.status}: ${res.statusText || 'Unexpected response'}`);
        err.status = res.status;
        throw err;
    }

    // Check JSON
    let data = {};
    try {
        data = await res.json();
    } catch {
        throw new Error('Error reloading DHCP: Invalid JSON payload');
    }

    // Check JSON errors
    if (!res.ok) {
        const serverMsg =
            data?.detail?.message?.trim()
            || (typeof data?.detail === 'string' ? data.detail.trim() : '')
            || data?.message?.trim()
            || data?.error?.message?.trim()
            || (typeof data?.error === 'string' ? data.error.trim() : '');
        const err = new Error('Error reloading DHCP' + (serverMsg ? `: ${serverMsg}` : ''));
        err.status = res.status;
        throw err;
    }

    if (res.ok && (data.status === 'success' || data.code === 'DHCP_RELOAD_OK')) {
        // Success
        return data?.message ? { message: data.message } : true;
    } else {
        // Failed with JSON error message
        return data?.message ? { message: data.message } : false;
    }
}

// -------------------------------------------------------
// Execute Backup
// -------------------------------------------------------
export async function doBackup() {
    let res;

    try {
        // Fetch data
        res = await fetch(`/api/backup`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
        });

    } catch (err) {
        const msg = 'Network error while performing backup' + (err?.message ? `: ${err.message}` : '');
        throw new Error(msg, { cause: err });
    }

    // Success without JSON
    if (res.status === 204) {
        return true;
    }

    // Check content-type to avoid parsing errors
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const err = new Error(`Error performing backup: ${res.status}: ${res.statusText || 'Unexpected response'}`);
        err.status = res.status;
        throw err;
    }

    // Check JSON
    let data = {};
    try {
        data = await res.json();
    } catch {
        throw new Error('Error performing backup: Invalid JSON payload');
    }

    // Check JSON errors
    if (!res.ok) {
        const serverMsg =
            data?.detail?.message?.trim()
            || (typeof data?.detail === 'string' ? data.detail.trim() : '')
            || data?.message?.trim()
            || data?.error?.message?.trim()
            || (typeof data?.error === 'string' ? data.error.trim() : '');
        const err = new Error('Error performing backup' + (serverMsg ? `: ${serverMsg}` : ''));
        err.status = res.status;
        throw err;
    }

    if (res.ok && (data.status === 'success' || data.code === 'BACKUP_OK')) {
        // Success
        return data?.message ? { message: data.message } : true;
    } else {
        // Failed with JSON error message
        return data?.message ? { message: data.message } : false;
    }
}

// -------------------------------------------------------
// Execute Restore
// -------------------------------------------------------
export async function doRestore(id) {
    let res;

    try {
        // Fetch data
        res = await fetch(`/api/restore`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
            body: JSON.stringify({ backup_id: id })
        });

    } catch (err) {
        const msg = 'Network error while performing restore' + (err?.message ? `: ${err.message}` : '');
        throw new Error(msg, { cause: err });
    }

    // Success without JSON
    if (res.status === 204) {
        return true;
    }

    // Check content-type to avoid parsing errors
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const err = new Error(`Error performing restore: ${res.status}: ${res.statusText || 'Unexpected response'}`);
        err.status = res.status;
        throw err;
    }

    // Check JSON
    let data = {};
    try {
        data = await res.json();
    } catch {
        throw new Error('Error performing restore: Invalid JSON payload');
    }

    // Check JSON errors
    if (!res.ok) {
        const serverMsg =
            data?.detail?.message?.trim()
            || (typeof data?.detail === 'string' ? data.detail.trim() : '')
            || data?.message?.trim()
            || data?.error?.message?.trim()
            || (typeof data?.error === 'string' ? data.error.trim() : '');
        const err = new Error('Error performing restore' + (serverMsg ? `: ${serverMsg}` : ''));
        err.status = res.status;
        throw err;
    }

    if (res.ok && (data.status === 'success' || data.code === 'RESTORE_OK')) {
        // Success
        return data?.message ? { message: data.message } : true;
    } else {
        // Failed with JSON error message
        return data?.message ? { message: data.message } : false;
    }
}

// -------------------------------------------------------
// Check Health
// -------------------------------------------------------
export async function checkHealth() {
    let res;

    try {
        // Fetch data
        res = await fetch(`/api/health`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

    } catch (err) {
        const msg = 'Network error while performing health check' + (err?.message ? `: ${err.message}` : '');
        throw new Error(msg, { cause: err });
    }

    // Success without JSON
    if (res.status === 204) {
        return true;
    }

    // Check content-type to avoid parsing errors
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const err = new Error(`Error performing health check: ${res.status}: ${res.statusText || 'Unexpected response'}`);
        err.status = res.status;
        throw err;
    }

    // Check JSON
    let data = {};
    try {
        data = await res.json();
    } catch {
        throw new Error('Error performing health check: Invalid JSON payload');
    }

    // Check JSON errors
    if (!res.ok) {
        const serverMsg =
            data?.detail?.message?.trim()
            || (typeof data?.detail === 'string' ? data.detail.trim() : '')
            || data?.message?.trim()
            || data?.error?.message?.trim()
            || (typeof data?.error === 'string' ? data.error.trim() : '');
        const err = new Error('Error performing health check' + (serverMsg ? `: ${serverMsg}` : ''));
        err.status = res.status;
        throw err;
    }

    return (data ?? []);
}
