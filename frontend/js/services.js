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
    const data = await apiPost(
        "/api/dns/reload",
        null,
        "Error reloading DNS"
    );

    return data?.message ? { message: data.message } : true;
}

// -----------------------------
// Reload DHCP action
// -----------------------------
export async function serviceReloadDHCP() {
    const data = await apiPost(
        "/api/dhcp/reload",
        null,
        "Error reloading DHCP"
    );

    return data?.message ? { message: data.message } : true;
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
    const data = await apiRequest(
        `/api/dhcp/leases/${id}`,
        { method: "DELETE" },
        "Error deleting host"
    );

    return data?.message ? { message: data.message } : true;
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
    const data = await apiRequest(
        "/api/hosts",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(hostData)
        },
        "Error creating host"
    );

    return data?.message ? { message: data.message } : true;
}

// -----------------------------
// Update an host
// -----------------------------
export async function serviceUpdateHost(id, hostData) {
    const data = await apiRequest(
        `/api/hosts/${id}`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(hostData)
        },
        "Error updating host"
    );

    return data?.message ? { message: data.message } : true;
}

// -----------------------------
// Delete Hosts
// -----------------------------
export async function serviceDeleteHost(id) {
    const data = await apiRequest(
        `/api/hosts/${id}`,
        { method: "DELETE" },
        "Error deleting host"
    );

    return data?.message ? { message: data.message } : true;
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
    const data = await apiRequest(
        "/api/aliases",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(aliasData)
        },
        "Error creating alias"
    );

    return data?.message ? { message: data.message } : true;
}

// -----------------------------
// Update an alias
// -----------------------------
export async function serviceUpdateAlias(id, aliasData) {
    const data = await apiRequest(
        `/api/aliases/${id}`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(aliasData)
        },
        "Error updating alias"
    );

    return data?.message ? { message: data.message } : true;
}

// -----------------------------
// Delete Alias
// -----------------------------
export async function serviceDeleteAlias(id) {
    const data = await apiRequest(
        `/api/aliases/${id}`,
        { method: "DELETE" },
        "Error deleting alias"
    );

    return data?.message ? { message: data.message } : true;
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
    const data = await apiPost(
        "/api/backup/create",
        null,
        "Error performing backup"
    );

    if (data.status === 'success') {
        return data?.message ? { message: data.message } : true;
    }

    if (data.status === 'partial') {
        return data?.message
            ? { message: data.message, partial: true }
            : { partial: true };
    }

    return false;
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
    const data = await apiPost(
        "/api/backup/restore",
        { backup_id: id },
        "Error performing restore"
    );

    if (data.status === 'success') {
        return data?.message ? { message: data.message } : true;
    }

    if (data.status === 'partial') {
        return data?.message
            ? { message: data.message, partial: true }
            : { partial: true };
    }

    return false;
}

// -------------------------------------------------------
// Delete a Backup
// -------------------------------------------------------
export async function serviceDeleteBackup(id) {
    const data = await apiPost(
        "/api/backup/delete",
        { backup_id: id },
        "Error performing delete"
    );

    return data?.message ? { message: data.message } : true;
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
    const data = await apiRequest(
        `/api/settings/${key}`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(configData)
        },
        "Error updating configuration parameter"
    );

    return data?.message ? { message: data.message } : true;
}

// -----------------------------
// Reset a configuration parameter to its default value
// -----------------------------
export async function serviceResetConfig(key) {
    const data = await apiPost(
        `/api/settings/${key}/reset`,
        null,
        "Error restoring default value"
    );

    return data?.message ? { message: data.message } : true;
}

// -----------------------------
// Reset a configuration parameter to its default value
// -----------------------------
export async function serviceRestartApp(key) {
    const data = await apiPost(
        "/api/restart",
        null,
        "Error restarting application"
    );

    return data?.message ? { message: data.message } : true;
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
