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
// DOMContentLoaded: initialize everything
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
    }
});
