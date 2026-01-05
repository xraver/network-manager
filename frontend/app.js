let editingHostId = null;
let sortDirection = {};

// -----------------------------
// Validate the IP address format
// -----------------------------
function isValidIP(ip) {
    if (!ip || !ip.trim()) return true; // empty is allowed

    const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
    const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1)$/;

    return ipv4.test(ip) || ipv6.test(ip);
}

// -----------------------------
// LOAD ALL HOSTS INTO THE TABLE
// -----------------------------
async function loadHosts() {
    const res = await fetch("/api/hosts");
    const hosts = await res.json();

    const tbody = document.querySelector("#hosts-table tbody");
    tbody.innerHTML = "";

    hosts.forEach(h => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${h.name}</td>
            <td>${h.ipv4 || ""}</td>
            <td>${h.ipv6 || ""}</td>
            <td>${h.mac || ""}</td>
            <td>${h.note || ""}</td>
            <td>${h.ssl_enabled ? "&#10004;" : ""}</td>
            <td class="actions">
                <span class="edit-btn" onclick="editHost(${h.id})">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#007BFF">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 
                        7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 
                        0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                </span>

                <span class="delete-btn" onclick="deleteHost(${h.id})">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#0099FF">
                        <path d="M3 6h18v2H3V6zm2 3h14l-1.5 
                        12.5h-11L5 9zm5-6h4l1 1h5v2H4V4h5l1-1z"/>
                    </svg>
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// -----------------------------
// OPEN POPUP IN EDIT MODE
// -----------------------------
async function editHost(id) {
    const res = await fetch(`/api/hosts/${id}`);
    const host = await res.json();

    // Store the ID of the host being edited
    editingHostId = id;

    // Pre-fill the form fields
    document.getElementById("hostName").value = host.name;
    document.getElementById("hostIPv4").value = host.ipv4 || "";
    document.getElementById("hostIPv6").value = host.ipv6 || "";
    document.getElementById("hostMAC").value = host.mac || "";
    document.getElementById("hostNote").value = host.note || "";
    document.getElementById("hostSSL").checked = host.ssl_enabled === 1;

    document.getElementById("addHostModal").style.display = "flex";
}

// -----------------------------
// OPEN POPUP IN CREATE MODE
// -----------------------------
function openAddHostModal() {
    editingHostId = null; // Reset edit mode

    // Clear all fields
    document.getElementById("hostName").value = "";
    document.getElementById("hostIPv4").value = "";
    document.getElementById("hostIPv6").value = "";
    document.getElementById("hostMAC").value = "";
    document.getElementById("hostNote").value = "";
    document.getElementById("hostSSL").checked = false;

    document.getElementById("addHostModal").style.display = "flex";
}

// -----------------------------
// CLOSE POPUP
// -----------------------------
function closeAddHostModal() {
    editingHostId = null; // Always reset edit mode
    document.getElementById("addHostModal").style.display = "none";
}

// -----------------------------
// SAVE HOST (CREATE OR UPDATE)
// -----------------------------
async function saveHost() {
    // Validate required fields
    if (!document.getElementById("hostName").value.trim()) {
        showToast("Name is required", false);
        return; // stop here, do NOT send the request
    }
    // Validate IP format
    if (!isValidIP(document.getElementById("hostIPv4").value)) {
        showToast("Invalid IPv4 format", false);
        return;
    }
    if (!isValidIP(document.getElementById("hostIPv6").value)) {
        showToast("Invalid IPv6 format", false);
        return;
    }

    const payload = {
        name: document.getElementById("hostName").value,
        ipv4: document.getElementById("hostIPv4").value,
        ipv6: document.getElementById("hostIPv6").value,
        mac: document.getElementById("hostMAC").value,
        note: document.getElementById("hostNote").value,
        ssl_enabled: document.getElementById("hostSSL").checked ? 1 : 0
    };

    try {
        if (editingHostId !== null) {
            // UPDATE EXISTING HOST
            await fetch(`/api/hosts/${editingHostId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            showToast("Host updated successfully");
        } else {
            // CREATE NEW HOST
            await fetch("/api/hosts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            showToast("Host added successfully");
        }

        closeAddHostModal();
        loadHosts();

    } catch (err) {
        console.error(err);
        showToast("Error while saving host", false);
    }
}

// -----------------------------
// DELETE HOST
// -----------------------------
async function deleteHost(id) {
    try {
        const res = await fetch(`/api/hosts/${id}`, { method: "DELETE" });

        if (!res.ok) {
            throw new Error("Delete failed");
        }

        showToast("Host removed successfully");

    } catch (err) {
        console.error(err);
        showToast("Error while removing host", false);
    }

    loadHosts();
}

// -----------------------------
// Display a temporary notification message
// -----------------------------
function showToast(message, success = true) {
    const toast = document.getElementById("toast");
    toast.textContent = message;

    toast.style.background = success ? "#28a745" : "#d9534f"; // green / red

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

// -----------------------------
// filter hosts in the table
// -----------------------------
function filterHosts() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const rows = document.querySelectorAll("#hosts-table tbody tr");

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? "" : "none";
    });
}

// -----------------------------
// Clear search on ESC key
// -----------------------------
function clearSearch() {
    const input = document.getElementById("searchInput");
    input.value = "";
    input.blur();
    loadHosts();
}

// -----------------------------
// Sort the table by column
// -----------------------------
function sortTable(colIndex) {
    const table = document.getElementById("hosts-table");
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const headers = table.querySelectorAll("th .sort-arrow");

    // Toggle direction
    sortDirection[colIndex] = !sortDirection[colIndex];
    const direction = sortDirection[colIndex] ? 1 : -1;

    // Reset all arrows
    headers.forEach(h => h.textContent = "");

    // Set arrow for current column
    headers[colIndex].textContent = direction === 1 ? "▲" : "▼";

    rows.sort((a, b) => {
        const A = a.children[colIndex].innerText.toLowerCase();
        const B = b.children[colIndex].innerText.toLowerCase();

        // Numeric sort if both values are numbers
        const numA = parseFloat(A);
        const numB = parseFloat(B);

        if (!isNaN(numA) && !isNaN(numB)) {
            return (numA - numB) * direction;
        }

        return A.localeCompare(B) * direction;
    });

    rows.forEach(row => tbody.appendChild(row));
}

// -----------------------------
// Reset sorting arrows and directions
// -----------------------------
function resetSorting() {
    // Svuota tutte le direzioni salvate
    sortDirection = {};

    // Rimuove tutte le frecce dalle colonne
    const arrows = document.querySelectorAll("th .sort-arrow");
    arrows.forEach(a => a.textContent = "");
}

// -----------------------------
// Login function
// -----------------------------
async function handleLogin(e) {
    e.preventDefault();

    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value;

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            username: user,
            password: pass
        })
    });

    const data = await res.json();

    if (data.status === "ok") {
        window.location.href = "/hosts";
    } else {
        document.getElementById("loginError").textContent = "Wrong credentials";
    }
}

// -----------------------------
// Logout function
// -----------------------------
async function handleLogout() {
    await fetch("/api/logout", {
        method: "POST",
        credentials: "include"
    });

    window.location.href = "/login";
}

// -----------------------------
// INITIAL TABLE LOAD
// -----------------------------
loadHosts();
document.getElementById("searchInput").value = "";

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        resetSorting();  
        clearSearch();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
    }
});
