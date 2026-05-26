// -----------------------------
// API Endpoints
// -----------------------------
export const apiMap = {
    hosts: {
        url: "/api/hosts",
        name: "Hosts"
    },
    aliases: {
        url: "/api/aliases",
        name: "Aliases"
    },
    leases: {
        url: "/api/dhcp/leases",
        name: "Leases"
    },
    devices: {
        url: "/api/devices",
        name: "Devices"
    }
};

// -----------------------------
// Fetch Data functions
// -----------------------------
export async function fetchData(api) {
    let items = [];

    // Fetch data
    const res = await fetch(api.url, {
        headers: { Accept: 'application/json' },
    });

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
        items = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
    } catch {
        throw new Error('Invalid JSON payload');
    }

    // Check JSON errors
    if (!res.ok) {
        const serverMsg = data?.detail?.message?.trim();
        const base = `Error loading ${api.name}`;
        const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
        err.status = res.status;
        throw err;
    }
    return items;
}