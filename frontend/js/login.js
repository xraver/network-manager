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

            // Parse JSON resiliente
            let data = {};
            try {
                data = await res.json();
            } catch {
                // Se il server non risponde con JSON valido
                data = { status: 'error', error: 'Risposta non valida dal server.' };
            }

            // Gestione HTTP non-OK come errore
            if (!res.ok) {
                // Usa messaggio server se presente, altrimenti status
                const errMsg = (typeof data?.error === 'string' && data.error.trim())
                    ? data.error.trim()
                    : `Errore ${res.status} durante il login.`;
                throw new Error(errMsg);
            }

            // Gestione logica dell'API
            if (data?.status === 'ok') {
                // Redirect alla pagina host
                location.assign('/hosts');
                return;
            } else {
                const msg = (typeof data?.error === 'string' && data.error.trim())
                    ? data.error.trim()
                    : 'Credenziali non valide.';
                // Credenziali errate -> metti focus su username, marca entrambi
                showError(msg, { focus: 'username', markUser: true, markPass: true });
                return;
            }
        } catch (err) {
          // Se è stato abortito, non mostrare errori
          //if (inFlightController?.signal.aborted) return;
          // Errori di rete o eccezioni
          const msg = err?.message || 'Errore di connessione. Riprova.';
          // Se è un timeout personalizzato, messaggio ad hoc
          if (msg === 'Timeout di rete') {
               showError('Il server non risponde. Riprova tra poco.', { focus: 'username' });
          } else {
              showError(msg, { focus: 'username' });
          }
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
