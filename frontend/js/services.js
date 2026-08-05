// import api
import { apiRequest, apiGet, apiPost, apiDownload, apiUpload } from './api.js';

// -------------------------------------------------------
// Check Abount
// -------------------------------------------------------
export async function serviceIsAlive() {
    try {
        const r = await fetch('/about', { cache: "no-store" });
        return r.ok;
    } catch {
        return false;
    }
}

// -------------------------------------------------------
// Check Health
// -------------------------------------------------------
export async function serviceCheckHealth() {
    return await apiGet("/api/health", "Error performing health check");
}

// -----------------------------
// Reload DNS
// -----------------------------
export async function serviceReloadDNS() {
    return await apiPost(
        "/api/dns/reload",
        null,
        "Error reloading DNS"
    );
}

// -----------------------------
// Reload DHCP action
// -----------------------------
export async function serviceReloadDHCP() {
    return await apiPost(
        "/api/dhcp/reload",
        null,
        "Error reloading DHCP"
    );
}

// -----------------------------
// Get DHCP Leaseses
// -----------------------------
export async function serviceGetDHCPLeases() {
    return await apiGet("/api/dhcp/leases", "Error loading DHCP leases");
}

// -----------------------------
// Get a single DHCP Leases
// -----------------------------
export async function serviceGetDHCPLease(id) {
    return await apiRequest(
        `/api/dhcp/leases/${id}`,
        { method: "GET" },
        `Error loading host ${id}`
    );
}

// -----------------------------
// Delete DHCP Lease
// -----------------------------
export async function serviceDeleteDHCPLease(id) {
    return await apiRequest(
        `/api/dhcp/leases/${id}`,
        { method: "DELETE" },
        "Error deleting host"
    );
}

// -----------------------------
// Get Hosts
// -----------------------------
export async function serviceGetHosts() {
    return await apiGet("/api/hosts", "Error loading hosts");
}

// -----------------------------
// Get a single host
// -----------------------------
export async function serviceGetHost(id) {
    return await apiRequest(
        `/api/hosts/${id}`,
        { method: "GET" },
        `Error loading host ${id}`
    );
}

// -----------------------------
// Create a new host
// -----------------------------
export async function serviceCreateHost(hostData) {
    return await apiRequest(
        "/api/hosts",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(hostData)
        },
        "Error creating host"
    );
}

// -----------------------------
// Update an host
// -----------------------------
export async function serviceUpdateHost(id, hostData) {
    return await apiRequest(
        `/api/hosts/${id}`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(hostData)
        },
        "Error updating host"
    );
}

// -----------------------------
// Delete Hosts
// -----------------------------
export async function serviceDeleteHost(id) {
    return await apiRequest(
        `/api/hosts/${id}`,
        { method: "DELETE" },
        "Error deleting host"
    );
}

// -----------------------------
// Get Aliases
// -----------------------------
export async function serviceGetAliases() {
    return await apiGet("/api/aliases", "Error loading aliases");
}

// -----------------------------
// Get a single alias
// -----------------------------
export async function serviceGetAlias(id) {
    return await apiRequest(
        `/api/aliases/${id}`,
        { method: "GET" },
        `Error loading alias ${id}`
    );
}

// -----------------------------
// Create a new alias
// -----------------------------
export async function serviceCreateAlias(aliasData) {
    return await apiRequest(
        "/api/aliases",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(aliasData)
        },
        "Error creating alias"
    );
}

// -----------------------------
// Update an alias
// -----------------------------
export async function serviceUpdateAlias(id, aliasData) {
    return await apiRequest(
        `/api/aliases/${id}`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(aliasData)
        },
        "Error updating alias"
    );
}

// -----------------------------
// Delete Alias
// -----------------------------
export async function serviceDeleteAlias(id) {
    return await apiRequest(
        `/api/aliases/${id}`,
        { method: "DELETE" },
        "Error deleting alias"
    );
}

// -----------------------------
// Get Devices
// -----------------------------
export async function serviceGetDevices() {
    return await apiGet("/api/devices", "Error loading Devices");
}

// -------------------------------------------------------
// Create a Backup
// -------------------------------------------------------
export async function serviceBackupCreate() {
    return await apiPost(
        "/api/backup/create",
        null,
        "Error performing backup"
    );

}

// -------------------------------------------------------
// Fetch Backups list
// -------------------------------------------------------
export async function serviceBackupList() {
    return await apiGet("/api/backup/list", "Error fetching backups");
}

// -------------------------------------------------------
// Restore a Backup
// -------------------------------------------------------
export async function serviceBackupRestore(id) {
    return await apiPost(
        "/api/backup/restore",
        { backup_id: id },
        "Error performing restore"
    );
}

// -------------------------------------------------------
// Delete a Backup
// -------------------------------------------------------
export async function serviceDeleteBackup(id) {
    return await apiPost(
        "/api/backup/delete",
        { backup_id: id },
        "Error performing delete"
    );
}

// -------------------------------------------------------
// Download a Backup
// -------------------------------------------------------
export async function serviceDownloadBackup(id) {
    const res = await apiDownload(
        `/api/backup/download/${encodeURIComponent(id)}`,
        "Error downloading backup"
    );

    const blob = await res.blob();

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = id;
    document.body.appendChild(a);
    a.click();

    a.remove();
    window.URL.revokeObjectURL(url);
}

// -------------------------------------------------------
// Upload a Backup
// -------------------------------------------------------
export async function serviceUploadBackup(file) {
    const data = await apiUpload(
        "/api/backup/upload",
        file,
        "Error uploading backup"
    );

    if (data?.status === 'success') {
        return data?.message
            ? { message: data.message, backup_id: data.backup_id }
            : true;
    }

    return false;
}

// -----------------------------
// Get the list of configuration parameters
// -----------------------------
export async function serviceGetConfigs() {
    return await apiGet("/api/settings", "Error loading configuration parameters");
}

// -----------------------------
// Get a single configuration parameter
// -----------------------------
export async function serviceGetConfig(key) {
    return await apiRequest(
        `/api/settings/${key}`,
        { method: "GET" },
        `Error loading configuration ${key}`
    );
}

// -----------------------------
// Update a configuration parameter
// -----------------------------
export async function serviceUpdateConfig(key, configData) {
    return await apiRequest(
        `/api/settings/${key}`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(configData)
        },
        "Error updating configuration parameter"
    );
}

// -----------------------------
// Reset a configuration parameter to its default value
// -----------------------------
export async function serviceResetConfig(key) {
    return await apiPost(
        `/api/settings/${key}/reset`,
        null,
        "Error restoring default value"
    );
}

// -----------------------------
// Reset a configuration parameter to its default value
// -----------------------------
export async function serviceRestartApp(key) {
    return await apiPost(
        "/api/restart",
        null,
        "Error restarting application"
    );
}

// -----------------------------
// Get Logs
// -----------------------------
export async function serviceGetLogs(type) {
    const res = await fetch(`/api/logs?type=${type}`);

    if (!res.ok) {
        throw new Error(await res.text());
    }

    return await res.text();
}
