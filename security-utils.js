/**
 * Security Utilities Module
 * Handles XSS prevention, input sanitization, and secure DOM manipulation
 */

// Load DOMPurify from CDN if not already present
if (typeof DOMPurify === 'undefined') {
    console.warn('DOMPurify not loaded. Loading from CDN...');
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js';
    script.integrity = 'sha512-V4wHMqE3iUplOjH+DfXJ9GmF8+YtZqLzQyZpKlYzS5yQxQyQyQyQyQyQyQyQyQyQyQyQyQyQyQyQyQyQyQyQyQ';
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
}

window.SecurityUtils = {
    /**
     * Sanitize HTML string to prevent XSS
     * @param {string} dirty - Untrusted HTML string
     * @returns {string} - Clean HTML string
     */
    sanitizeHTML: function(dirty) {
        if (!dirty) return '';
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(dirty);
        }
        // Fallback: strip tags if DOMPurify isn't loaded yet
        const tmp = document.createElement('div');
        tmp.textContent = dirty;
        return tmp.innerHTML;
    },

    /**
     * Safe set innerHTML using DOMPurify
     * @param {HTMLElement} element - Target element
     * @param {string} html - HTML content
     */
    setInnerHTML: function(element, html) {
        if (!element) return;
        element.innerHTML = this.sanitizeHTML(html);
    },

    /**
     * Safe text content setter (prevents HTML injection)
     * @param {HTMLElement} element - Target element
     * @param {string} text - Text content
     */
    setTextContent: function(element, text) {
        if (!element) return;
        element.textContent = text;
    },

    /**
     * Generate a secure random salt
     * @returns {string} - Hex encoded random salt
     */
    generateSalt: function() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Securely hash password with salt
     * @param {string} password - Plain text password
     * @param {string} salt - Salt string
     * @returns {Promise<string>} - Hashed password
     */
    hashPassword: async function(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            enc.encode(password + salt),
            { name: "PBKDF2" },
            false,
            ["deriveBits"]
        );
        
        const bits = await crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt: enc.encode(salt),
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            256
        );
        
        return Array.from(new Uint8Array(bits))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    /**
     * Validate input against XSS patterns
     * @param {string} input - User input
     * @returns {boolean} - True if safe
     */
    validateInput: function(input) {
        if (!input) return true;
        const dangerousPatterns = [
            /<script\b/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /data:text\/html/i
        ];
        return !dangerousPatterns.some(pattern => pattern.test(input));
    }
};

// Auto-initialize event delegation for data-action attributes
document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', (e) => {
        const actionElement = e.target.closest('[data-action]');
        if (actionElement) {
            const action = actionElement.dataset.action;
            const handler = window.ActionHandlers?.[action];
            if (handler) {
                e.preventDefault();
                handler(e, actionElement);
            } else {
                console.warn(`No handler found for action: ${action}`);
            }
        }
    });
});
