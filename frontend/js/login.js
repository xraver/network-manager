document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    if (!form) return;

    // Un solo AbortController per submit in corso
    let inFlightController = null;

    form.addEventListener('submit', async (e) => {
        // Prevent default form submission
        e.preventDefault();

        // Riferimenti UI
        const currentForm = e.currentTarget;
        const btn      = currentForm.querySelector('.btn-login');
        const userEl   = currentForm.querySelector('#username');
        const passEl   = currentForm.querySelector('#password');
        const errorBox = document.getElementById('loginError'); // può essere fuori dal form

        // Helpers sicuri e localizzati
        const hideError = () => {
            // Pulizia stato precedente
	    if (errorBox && !errorBox.classList.contains('d-none')) {
                errorBox.classList.add('d-none');
                errorBox.textContent = '';
	    }
            userEl?.removeAttribute('aria-invalid');
            passEl?.removeAttribute('aria-invalid');
            userEl?.classList.remove('is-invalid');
            passEl?.classList.remove('is-invalid');
        };

        const showError = (message, { focus = 'username', markUser = false, markPass = false } = {}) => {
            if(errorBox) {
                // textContent = OK (niente HTML injection)
                errorBox.textContent = message ?? 'Errore';
                errorBox.classList.remove('d-none');
    	    }

            // metti invalid sui campi solo se sono vuoti o se credenziali errate
            if (markUser) userEl?.setAttribute('aria-invalid', 'true');
            if (markPass) passEl?.setAttribute('aria-invalid', 'true');
            // in caso di credenziali errate, metti focus
            if (focus === 'username') userEl?.focus();
            else if (focus === 'password') passEl?.focus();

            // aggiungi classe is-invalid se vuoi la resa Bootstrap
            if (markUser) userEl?.classList.add('is-invalid');
            if (markPass) passEl?.classList.add('is-invalid');
        };

        // Pulizia
        hideError();

        // Normalizza input
        const user = userEl?.value?.trim() ?? '';
        const pass = passEl?.value ?? '';

        // Validazione rapida lato client
        if (!user || !pass) {
          showError('Compila tutti i campi.', {
            focus: !user ? 'username' : 'password',
            markUser: !user,
            markPass: !pass
          });
          return;
        }

        // Evita submit multipli
        if (btn?.disabled) return;

        // Annulla eventuale richiesta precedente
        inFlightController?.abort();
        inFlightController = new AbortController();

        // Disabilita UI + spinner
        const originalBtnHTML = btn.innerHTML;
        if(btn) {
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Accesso...
            `;
        }

        try {
            const fetchPromise = fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username: user, password: pass }),
                signal: inFlightController.signal
            });

            // error after 5s?
            // await Promise.race([ fetchPromise, timeout(5000, inFlightController.signal) ]);
            const res = await fetchPromise;

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
                const base = `Error during login`;
                const err = new Error(serverMsg ? `${base}: ${serverMsg}` : base);
                err.status = res.status;
                throw err;
            }

            // Login Success
            // Redirect to main page
            location.assign('/home');
            return;

        } catch (err) {
            // Se è stato abortito, non mostrare errori
            //if (inFlightController?.signal.aborted) return;
            // Errori di rete o eccezioni
            showError(err?.message || 'Connection error, please retry.', { focus: 'username', markUser: true, markPass: true });
        } finally {
            // Ripristina bottone
            if(btn) {
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.innerHTML = originalBtnHTML ?? 'Entra';
            }
            // controller consumato
            inFlightController = null;
        }
    });

    // Reset error on input
    const errorBox = document.getElementById('loginError');
    const userEl = document.getElementById('username');
    const passEl = document.getElementById('password');

    const clearError = () => {
        if (errorBox && !errorBox.classList.contains('d-none')) {
            errorBox.classList.add('d-none');
            errorBox.textContent = '';
        }
        userEl?.removeAttribute('aria-invalid');
        passEl?.removeAttribute('aria-invalid');
        userEl?.classList.remove('is-invalid');
        passEl?.classList.remove('is-invalid');
    };

    userEl?.addEventListener('input', clearError);
    passEl?.addEventListener('input', clearError);
});
