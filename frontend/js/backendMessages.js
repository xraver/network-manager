// -------------------------------------------------------
// IMPORT
// -------------------------------------------------------
import { t } from "./i18n.js";

const CODE_MAP = {
    // APP
    APP_RESTARTING: "app.restart.progress",

    // Hosts
	HOSTS_GET_ERROR: "hosts.list.error",
	HOST_GET_ERROR: "hosts.loaded.error",
    HOST_ADDED: "hosts.created.ok",
    HOST_ADD_ERROR: "hosts.created.error",
    HOST_UPDATED: "hosts.updated.ok",
    HOST_UPDATE_ERROR: "hosts.updated.error",
    HOST_DELETED: "hosts.deleted.ok",
    HOST_DELETE_ERROR: "hosts.deleted.error",
    HOST_NOT_FOUND: "hosts.not.found",
    HOST_ALREADY_PRESENT: "hosts.already.present",

    // Aliases
	ALIASES_GET_ERROR: "aliases.list.error",
	ALIAS_GET_ERROR: "aliases.loaded.error",
    ALIAS_ADDED: "aliases.created.ok",
    ALIAS_ADD_ERROR: "aliases.created.error",
    ALIAS_UPDATED: "aliases.updated.ok",
    ALIAS_UPDATE_ERROR: "aliases.updated.error",
    ALIAS_DELETED: "aliases.deleted.ok",
    ALIAS_DELETE_ERROR: "aliases.deleted.error",
    ALIAS_NOT_FOUND: "aliases.not.found",
    ALIAS_ALREADY_PRESENT: "aliases.already.present",

    // DNS
    DNS_RELOAD_OK: "dns.reload.ok",
    DNS_RELOAD_ERROR: "dns.reload.error",

    // DHCP
    DHCP_RELOAD_OK: "dhcp.reload.ok",
    DHCP_RELOAD_ERROR: "dhcp.reload.error",
	DHCP_LEASES_ERROR: "dhcp.leases.list.error",
	DHCP_LEASE_ERROR: "dhcp.leases.loaded.error",
	DHCP_LEASE_DELETED: "dhcp.leases.deleted.ok",
	DHCP_LEASE_DELETE_ERROR: "dhcp.leases.deleted.error",
	DHCP_LEASE_NOT_FOUND: "dhcp.leases.not.found",

    BACKUP_CREATED: "backup.create_ok",
    BACKUP_CREATE_PARTIAL: "backup.create_partial",
    BACKUP_CREATE_ERROR: "backup.create_error",
    BACKUP_RESTORED: "backup.restore_ok",
    BACKUP_RESTORE_PARTIAL: "backup.restore_partial",
    BACKUP_RESTORE_ERROR: "backup.restore_error",
    BACKUP_DELETED: "backup.delete_ok",
    BACKUP_DELETE_ERROR: "backup.delete_error",
    BACKUP_NOT_FOUND: "backup.not.found",

    // Settings
    CONFIGS_GET_ERROR: "settings.list.error",
    CONFIG_GET_ERROR: "settings.loaded.error",
    CONFIG_UPDATED: "settings.updated.ok",
    CONFIG_UPDATE_ERROR: "settings.updated.error",
    CONFIG_RESTORED: "settings.restored.ok",
    CONFIG_RESTORED_ERROR: "settings.restored.error",
    CONFIG_NOT_FOUND: "settings.not.found",
};

export function getBackendMessage(result, fallbackKey = null) {

    const i18nKey = CODE_MAP[result?.code];

    if (i18nKey) {
        return t(i18nKey);
    }

    if (result?.message) {
        return result.message;
    }

    return fallbackKey ? t(fallbackKey) : "";
}
