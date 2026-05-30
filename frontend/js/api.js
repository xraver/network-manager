// -------------------------------------------------------
// API CORE - Generic request wrapper
// -------------------------------------------------------
export async function apiRequest(
    url,
    {
        method = 'GET',
        headers = {},
        body = null,
    } = {},
    errorPrefix = 'Request error'
) {
    let res;

    try {
        res = await fetch(url, {
            method,
            headers: {
                'Accept': 'application/json',
                ...headers
            },
            body
        });
    } catch (err) {
        throw new Error(
            `${errorPrefix}: network error${err?.message ? `: ${err.message}` : ''}`,
            { cause: err }
        );
    }

    // 204 No Content
    if (res.status === 204) {
        return true;
    }

    // Content-Type check
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const err = new Error(
            `${errorPrefix}: ${res.status} ${res.statusText || 'Unexpected response'}`
        );
        err.status = res.status;
        throw err;
    }

    // Parse JSON
    let data;
    try {
        data = await res.json();
    } catch {
        throw new Error(`${errorPrefix}: Invalid JSON payload`);
    }

    // Handle HTTP error
    if (!res.ok) {
        const serverMsg =
            data?.detail?.message?.trim()
            || (typeof data?.detail === 'string' ? data.detail.trim() : '')
            || data?.message?.trim()
            || data?.error?.message?.trim()
            || (typeof data?.error === 'string' ? data.error.trim() : '');

        const err = new Error(
            `${errorPrefix}${serverMsg ? `: ${serverMsg}` : ''}`
        );
        err.status = res.status;
        throw err;
    }

    return data;
}

// -------------------------------------------------------
// API Get
// -------------------------------------------------------
export function apiGet(url, errorPrefix = 'Fetch error') {
    return apiRequest(url, { method: 'GET' }, errorPrefix);
}

// -------------------------------------------------------
// API Post
// -------------------------------------------------------
export function apiPost(url, payload, errorPrefix = 'Request error') {
    return apiRequest(
        url,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        },
        errorPrefix
    );
}

// -------------------------------------------------------
// API Download
// -------------------------------------------------------
export async function apiDownload(url, errorPrefix = 'Download error') {
    let res;

    try {
        res = await fetch(url);
    } catch (err) {
        throw new Error(`${errorPrefix}: network error`);
    }

    const contentType = res.headers.get("content-type") || "";

    // JSON message (error)
    if (contentType.includes("application/json")) {
        let data;

        try {
            data = await res.json();
        } catch {
            throw new Error(`${errorPrefix}: Invalid error payload`);
        }

        const msg =
            data?.detail?.message ||
            data?.message ||
            errorPrefix;

        throw new Error(`${errorPrefix}: ${msg}`);
    }

    // File
    if (!res.ok) {
        throw new Error(
            `${errorPrefix}: ${res.status} ${res.statusText || ''}`.trim()
        );
    }

    return res;
}

// -------------------------------------------------------
// API Upload (multipart/form-data)
// -------------------------------------------------------
export async function apiUpload(url, file, errorPrefix = "Upload error") {
    try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(url, {
            method: "POST",
            body: formData
        });

        if (!res.ok) {
            let err;
            try {
                err = await res.json();
            } catch {
                throw new Error(errorPrefix);
            }

            const msg =
                err?.detail?.message ||
                err?.message ||
                errorPrefix;

            throw new Error(msg);
        }

        return await res.json();

    } catch (err) {
        console.error(err);
        throw new Error(err.message || errorPrefix);
    }
}
