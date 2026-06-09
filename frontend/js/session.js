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
    document.querySelectorAll(".btn-logout").forEach(btn => {
        btn.addEventListener("click", handleLogout);
    });
});
