// -------------------------------------------------------
// IMPORT
// -------------------------------------------------------
import { apiGet } from "./api.js";

let _language = "en";
let _translations = {};

// -------------------------------------------------------
// Load translations from backend
// -------------------------------------------------------
export async function loadLanguage() {
    const data = await apiGet(
        "/api/i18n",
        "Unable to load translations"
    );

    _language = data.language;
    _translations = data.translations;
}

// -------------------------------------------------------
// Get current language
// -------------------------------------------------------
export function getLanguage() {
    return _language;
}

// -------------------------------------------------------
// Translate key
// -------------------------------------------------------
export function t(key) {
    return _translations[key] || key;
}

// -------------------------------------------------------
// Translate DOM elements
// -------------------------------------------------------
export function translatePage() {

    // Page Title
    const pageTitleKey = document.body.dataset.pageTitle;
    if (pageTitleKey) {
        document.title = `${t(pageTitleKey)} - ${t("app.name")}`;
    }

    // Generic Content
    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.dataset.i18n;
        element.textContent = t(key);
    });

    // title
    document.querySelectorAll("[data-i18n-title]").forEach(element => {
        element.title = t(element.dataset.i18nTitle);
    });

    // aria-label
    document.querySelectorAll("[data-i18n-aria-label]").forEach(element => {
        element.setAttribute(
            "aria-label",
            t(element.dataset.i18nAriaLabel)
        );
    });

    // placeholder
    document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
        element.placeholder = t(
            element.dataset.i18nPlaceholder
        );
    });
}
