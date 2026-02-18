import { showToast } from './common.js';

// -----------------------------
// Reload DNS
// -----------------------------
export async function reloadDNS() {
    try {
        // Fetch data
        const res = await fetch(`/api/dns/reload`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
        });

        // Success without JSON
        if (res.status === 204) {
            showToast('DNS reload successfully', true);
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
            const base = `Error reloading DNS`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

        // Success
        showToast(data?.message || 'DNS reload successfully', true);
        return true;

    } catch (err) {
        console.error(err?.message || "Error reloading DNS");
        showToast(err?.message || "Error reloading DNS", false);
    }

    return false;
}

// -----------------------------
// Reload DHCP action
// -----------------------------
export async function reloadDHCP() {
    try {
        // Fetch data
        const res = await fetch(`/api/dhcp/reload`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
        });

        // Success without JSON
        if (res.status === 204) {
            showToast('DHCP reload successfully', true);
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
            throw new Error('Error reloading DHCP: Invalid JSON payload');
        }

        // Check JSON errors
        if (!res.ok) {
            const serverMsg = data?.detail?.message?.trim();
            const base = `Error reloadin DHCP`;
            const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
            err.status = res.status;
            throw err;
        }

        // Success
        showToast(data?.message || 'DHCP reload successfully', true);
        return true;

    } catch (err) {
        console.error(err?.message || "Error reloading DHCP");
        showToast(err?.message || "Error reloading DHCP", false);
    }

    return false;
}
