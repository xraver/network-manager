
// -----------------------------
// Login function (UX migliorata)
// -----------------------------
async function handleLogin(e) {
    // Prevent default form submission
    e.preventDefault();

    // Riferimenti UI
    const form = document.getElementById("loginForm");
    const btn = form.querySelector(".btn-login");
    const userEl = document.getElementById("username");
    const passEl = document.getElementById("password");
    const errorBox = document.getElementById("loginError");

    // Pulizia stato precedente
    errorBox.classList.add("d-none");
    errorBox.textContent = "";
    userEl.removeAttribute("aria-invalid");
    passEl.removeAttribute("aria-invalid");

    // Normalizza input
    const user = userEl.value.trim();
    const pass = passEl.value;

    // Evita submit multipli
    if (btn.disabled) return;

    // Disabilita UI + spinner
    const originalBtnHTML = btn.innerHTML;
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Accesso...
    `;

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username: user, password: pass })
        });

        // Prova a leggere JSON in modo resiliente
        let data = {};
        try {
            data = await res.json();
        } catch {
            // Se il server non risponde con JSON valido
            data = { status: "error", error: "Risposta non valida dal server." };
        }

        // Gestione HTTP non-OK come errore
        if (!res.ok) {
            const errMsg = data?.error || `Errore ${res.status} durante il login.`;
            throw new Error(errMsg);
        }

        // Gestione logica dell'API
        if (data.status === "ok") {
            // Redirect alla pagina host
            window.location.href = "/hosts";
            return;
        } else {
            const msg = data.error || "Credenziali non valide.";
            showError(msg, { highlight: true });
            return;
        }
    } catch (err) {
        // Errori di rete o eccezioni
        const msg = err?.message || "Errore di connessione. Riprova.";
        showError(msg, { highlight: true });
    } finally {
        // Ripristina il bottone
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
        btn.innerHTML = originalBtnHTML;
    }

    // ---- helpers locali ----
    function showError(message, opts = {}) {
        errorBox.textContent = message;
        errorBox.classList.remove("d-none");
        // evidenziazione campi e focus
        if (opts.highlight) {
            // metti invalid sui campi solo se sono vuoti o se credenziali errate
            if (!user) userEl.setAttribute("aria-invalid", "true");
            if (!pass) passEl.setAttribute("aria-invalid", "true");
            // in caso di credenziali errate, metti focus allo username
            userEl.focus();
            // opzionale: aggiungi classe is-invalid se vuoi la resa Bootstrap
            // userEl.classList.add("is-invalid");
            // passEl.classList.add("is-invalid");
        }
    }
}

// (Opzionale) Reset errore on input: nasconde alert quando l’utente modifica i campi
document.addEventListener("DOMContentLoaded", () => {
    const errorBox = document.getElementById("loginError");
    const userEl = document.getElementById("username");
    const passEl = document.getElementById("password");

    function clearError() {
        if (!errorBox.classList.contains("d-none")) {
            errorBox.classList.add("d-none");
            errorBox.textContent = "";
        }
        userEl.removeAttribute("aria-invalid");
        passEl.removeAttribute("aria-invalid");
        // userEl.classList.remove("is-invalid");
        // passEl.classList.remove("is-invalid");
    }

    userEl.addEventListener("input", clearError);
    passEl.addEventListener("input", clearError);
});
