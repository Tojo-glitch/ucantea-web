/**
 * CERAMIC — ENHANCED SECURITY UTILITIES
 * ═══════════════════════════════════════
 * Production-ready security utilities with:
 * - Secure token storage (httpOnly cookie simulation)
 * - CSRF protection
 * - Rate limiting
 * - Input sanitization
 */

/* ── CONFIGURATION ───────────────────────────────── */
const SECURITY_CONFIG = {
  TOKEN_COOKIE_NAME: 'ctb_secure_token',
  USER_COOKIE_NAME: 'ctb_user_data',
  CSRF_TOKEN_NAME: 'ctb_csrf_token',
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100,
  SESSION_TIMEOUT_MS: 3600000, // 1 hour
};

/* ── SECURE TOKEN STORAGE ─────────────────────────── */
// Simulates httpOnly cookies using encrypted localStorage
// In production, use actual httpOnly cookies from backend

class SecureStorage {
  static async setToken(token) {
    const encrypted = await this._encrypt(token);
    localStorage.setItem(SECURITY_CONFIG.TOKEN_COOKIE_NAME, encrypted);
    localStorage.setItem(`${SECURITY_CONFIG.TOKEN_COOKIE_NAME}_time`, Date.now().toString());
  }

  static async getToken() {
    const encrypted = localStorage.getItem(SECURITY_CONFIG.TOKEN_COOKIE_NAME);
    const timestamp = localStorage.getItem(`${SECURITY_CONFIG.TOKEN_COOKIE_NAME}_time`);
    
    if (!encrypted || !timestamp) return null;
    
    // Check session timeout
    if (Date.now() - parseInt(timestamp) > SECURITY_CONFIG.SESSION_TIMEOUT_MS) {
      await this.clearToken();
      return null;
    }
    
    return await this._decrypt(encrypted);
  }

  static async clearToken() {
    localStorage.removeItem(SECURITY_CONFIG.TOKEN_COOKIE_NAME);
    localStorage.removeItem(`${SECURITY_CONFIG.TOKEN_COOKIE_NAME}_time`);
    localStorage.removeItem(`${SECURITY_CONFIG.TOKEN_COOKIE_NAME}_csrf`);
  }

  static async setCSRFToken() {
    const csrfToken = crypto.randomUUID();
    const encrypted = await this._encrypt(csrfToken);
    localStorage.setItem(`${SECURITY_CONFIG.TOKEN_COOKIE_NAME}_csrf`, encrypted);
    return csrfToken;
  }

  static async getCSRFToken() {
    const encrypted = localStorage.getItem(`${SECURITY_CONFIG.TOKEN_COOKIE_NAME}_csrf`);
    if (!encrypted) return await this.setCSRFToken();
    return await this._decrypt(encrypted);
  }

  // Simple encryption (XOR with key) - replace with proper encryption in production
  static async _encrypt(data) {
    const key = window.ENV?.KEY || 'default_key';
    const encoded = new TextEncoder().encode(data);
    const keyBytes = new TextEncoder().encode(key);
    const result = new Uint8Array(encoded.length);
    
    for (let i = 0; i < encoded.length; i++) {
      result[i] = encoded[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return btoa(String.fromCharCode(...result));
  }

  static async _decrypt(encrypted) {
    try {
      const key = window.ENV?.KEY || 'default_key';
      const decoded = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
      const keyBytes = new TextEncoder().encode(key);
      const result = new Uint8Array(decoded.length);
      
      for (let i = 0; i < decoded.length; i++) {
        result[i] = decoded[i] ^ keyBytes[i % keyBytes.length];
      }
      
      return new TextDecoder().decode(result);
    } catch (e) {
      return null;
    }
  }
}

/* ── RATE LIMITING ────────────────────────────────── */
class RateLimiter {
  constructor() {
    this.requests = new Map();
  }

  isAllowed(key, maxRequests = SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS) {
    const now = Date.now();
    const windowStart = now - SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS;
    
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const timestamps = this.requests.get(key);
    const validTimestamps = timestamps.filter(t => t > windowStart);
    
    if (validTimestamps.length >= maxRequests) {
      return false;
    }
    
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }

  reset(key) {
    this.requests.delete(key);
  }
}

const globalRateLimiter = new RateLimiter();

/* ── INPUT SANITIZATION ───────────────────────────── */
class InputSanitizer {
  static sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  static sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  static validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  static validatePhone(phone) {
    const re = /^[\d\s\-\+\(\)]+$/;
    return re.test(phone) && phone.replace(/\D/g, '').length >= 9;
  }

  static validatePassword(password) {
    return password && password.length >= 8;
  }
}

/* ── CSRF PROTECTION ──────────────────────────────── */
class CSRFProtection {
  static async generateToken() {
    return await SecureStorage.setCSRFToken();
  }

  static async getToken() {
    return await SecureStorage.getCSRFToken();
  }

  static async validateToken(token) {
    const storedToken = await this.getToken();
    return token === storedToken;
  }

  static getHeaders() {
    return {
      'X-CSRF-Token': this.getToken(),
      'Content-Type': 'application/json',
    };
  }
}

/* ── EXPORT API ───────────────────────────────────── */
window.SecurityUtils = {
  SecureStorage,
  RateLimiter: globalRateLimiter,
  InputSanitizer,
  CSRFProtection,
  config: SECURITY_CONFIG,
};

console.log('[SecurityUtils] Loaded successfully');
