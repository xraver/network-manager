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
        document.getElementById("loginError").textContent = data.error;
    }
}
