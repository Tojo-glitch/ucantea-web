/**
 * CERAMIC — API ADAPTER (js/api.js)
 * ══════════════════════════════════
 * ไฟล์นี้ทำหน้าที่เป็น interface กลาง
 * เปลี่ยน BACKEND ด้านล่างเพื่อ switch ระหว่าง
 *   - MODE: 'supabase'  → Production (GitHub Pages + Supabase)
 *   - MODE: 'mock'      → Local preview (no backend)
 *   - MODE: 'gas'       → Legacy (Google Apps Script)
 */

const BACKEND_MODE = 'supabase'; // 'supabase' | 'mock' | 'gas'

/* ── CONFIG ─────────────────────────────────────────── */
const SUPABASE_URL  = 'https://itjzvcbuzyywgwdfjonp.supabase.co';  // ← เปลี่ยน
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anp2Y2J1enl5d2d3ZGZqb25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjYxMjQsImV4cCI6MjA5MDQ0MjEyNH0.U0wkJYwL4elzcAazlqm9uq4tk9JPOUD6CoIND61lLO0';                     // ← เปลี่ยน
const GAS_URL       = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec'; // ← ถ้าใช้ GAS

/* ── SUPABASE CLIENT (lightweight, no SDK) ───────────── */
const sb = {
  headers: {
    'apikey': SUPABASE_ANON,
    'Authorization': `Bearer ${SUPABASE_ANON}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  },

  async query(table, params = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    if (params.select)  url += `select=${params.select}&`;
    if (params.eq)      Object.entries(params.eq).forEach(([k,v]) => url += `${k}=eq.${v}&`);
    if (params.order)   url += `order=${params.order}&`;
    if (params.limit)   url += `limit=${params.limit}&`;
    const res = await fetch(url, { headers: sb.headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: sb.headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async update(table, data, eq) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    Object.entries(eq).forEach(([k,v]) => url += `${k}=eq.${v}&`);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: sb.headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Auth via Supabase Auth API
  async signUp(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { ...sb.headers, 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { ...sb.headers, 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async signOut(accessToken) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { ...sb.headers, 'Authorization': `Bearer ${accessToken}` },
    });
  },

  async resetPassword(email) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: { ...sb.headers },
      body: JSON.stringify({ email }),
    });
    return res.json();
  },
};

/* ── SHA256 ──────────────────────────────────────────── */
async function _sha256(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ── GAS HELPER ──────────────────────────────────────── */
function _gasCall(action, params) {
  return new Promise((resolve, reject) => {
    const url = `${GAS_URL}?action=${action}`;
    fetch(url, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(r => r.json())
      .then(resolve)
      .catch(reject);
  });
}

/* ── MOCK DATA ───────────────────────────────────────── */
const _mockDelay = (ms = 800) => new Promise(r => setTimeout(r, ms));
const _mockUsers = [
  { id: 'u1', phone: '0812345678', email: 'demo@ceramic.co', name: 'Khun Demo', points: 245, tier: 'Silver' },
];

/* ── STORAGE: UPLOAD SLIP (ฟังก์ชันที่เพิ่มให้ใหม่) ────────── */
async function uploadSlip(file) {
  if (!file) return null;
  const fileName = `${Date.now()}_${file.name}`;
  const filePath = `${SUPABASE_URL}/storage/v1/object/slips/${fileName}`;

  const response = await fetch(filePath, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type': file.type
    },
    body: file
  });

  if (response.ok) {
    return `${SUPABASE_URL}/storage/v1/object/public/slips/${fileName}`;
  }
  return null;
}
 
/* ══════════════════════════════════════════════════════
   PUBLIC API (window.API)
   ─── ทุก function return Promise<{success, ...}>
══════════════════════════════════════════════════════ */
window.API = {

  /* ── AUTH: LOGIN ─────────────────────────────────── */
  async login({ phone, hashedPassword }) {
    if (BACKEND_MODE === 'supabase') {
      // ใน Supabase เราใช้ email = phone@ceramic.internal เป็น key
      const pseudoEmail = `${phone}@ceramic.internal`;
      const password    = hashedPassword; // ใช้ hash เป็น password
      const data = await sb.signIn(pseudoEmail, password);

      if (data.error) return { success: false, message: 'Incorrect phone or password' };

      // ดึง profile จาก members table
      const members = await sb.query('members', { eq: { auth_id: data.user.id }, select: '*' });
      const member  = members[0];
      if (!member) return { success: false, message: 'Account not found' };

      const user = {
        id: member.id, authId: data.user.id,
        name: member.name, phone: member.phone,
        email: member.email, points: member.points,
        tier: member.tier, token: data.access_token,
      };
      localStorage.setItem('ctb_user', JSON.stringify(user));
      localStorage.setItem('ctb_token', data.access_token);
      return { success: true, user };
    }

    if (BACKEND_MODE === 'gas') {
      return _gasCall('processAuth', { phone, hashedPassword, mode: 'login' });
    }

    // MOCK
    await _mockDelay();
    const u = _mockUsers.find(x => x.phone === phone);
    if (!u) return { success: false, message: 'No account found with this phone number' };
    const user = { ...u, token: 'mock_' + Date.now() };
    localStorage.setItem('ctb_user', JSON.stringify(user));
    return { success: true, user };
  },

  /* ── AUTH: REGISTER ──────────────────────────────── */
  async register({ phone, email, name, hashedPassword }) {
    if (BACKEND_MODE === 'supabase') {
      const pseudoEmail = `${phone}@ceramic.internal`;
      const data = await sb.signUp(pseudoEmail, hashedPassword);
      if (data.error) {
        if (data.error.message?.includes('already registered'))
          return { success: false, message: 'An account with this phone already exists' };
        return { success: false, message: data.error.message };
      }

      // Create member profile
      const member = await sb.insert('members', {
        auth_id: data.user.id, phone, email, name,
        points: 50, tier: 'Bronze',
      });

      const user = {
        id: member[0].id, authId: data.user.id,
        name, phone, email, points: 50,
        tier: 'Bronze', token: data.access_token,
      };
      localStorage.setItem('ctb_user', JSON.stringify(user));
      localStorage.setItem('ctb_token', data.access_token);
      return { success: true, user };
    }

    if (BACKEND_MODE === 'gas') {
      return _gasCall('processAuth', { phone, email, displayName: name, hashedPassword, mode: 'register' });
    }

    // MOCK
    await _mockDelay(1000);
    const exists = _mockUsers.find(x => x.phone === phone || x.email === email);
    if (exists) return { success: false, message: 'Phone or email already registered' };
    const user = { id: 'u_'+Date.now(), phone, email, name, points: 50, tier: 'Bronze', token: 'mock_'+Date.now() };
    _mockUsers.push(user);
    localStorage.setItem('ctb_user', JSON.stringify(user));
    return { success: true, user };
  },

  /* ── AUTH: FORGOT PASSWORD ───────────────────────── */
  async forgotPassword(email) {
    if (BACKEND_MODE === 'supabase') {
      await sb.resetPassword(email);
      return { success: true };
    }
    if (BACKEND_MODE === 'gas') {
      return _gasCall('sendPasswordResetEmail', email);
    }
    await _mockDelay(1000);
    return { success: true };
  },

  /* ── AUTH: LOGOUT ────────────────────────────────── */
  async logout(user) {
    if (BACKEND_MODE === 'supabase' && user?.token) {
      try { await sb.signOut(user.token); } catch(e) {}
    }
    localStorage.removeItem('ctb_user');
    localStorage.removeItem('ctb_token');
    return { success: true };
  },

  /* ── PROFILE: UPDATE ─────────────────────────────── */
  async updateProfile({ token, field, value }) {
    const user = JSON.parse(localStorage.getItem('ctb_user') || '{}');

    if (BACKEND_MODE === 'supabase') {
      const update = {};
      update[field] = value;
      await sb.update('members', update, { auth_id: user.authId });
    }
    if (BACKEND_MODE === 'gas') {
      return _gasCall('updateMemberProfile', { token, field, value });
    }

    // Update local cache
    user[field] = value;
    localStorage.setItem('ctb_user', JSON.stringify(user));
    await _mockDelay(600);
    return { success: true };
  },

  /* ── MENU ────────────────────────────────────────── */
  async getMenu() {
    if (BACKEND_MODE === 'supabase') {
      const [products, categories, customization] = await Promise.all([
        sb.query('menu_items',   { select: '*', eq: { is_available: true }, order: 'sort_order' }),
        sb.query('categories',   { select: '*', eq: { is_active: true }, order: 'sort_order' }),
        sb.query('customization', { select: '*', limit: 1 }),
      ]);
      return { products, categories, customization: customization[0] || {} };
    }
    if (BACKEND_MODE === 'gas') {
      return _gasCall('getMenuData', {});
    }
    await _mockDelay(500);
    return { products: window.MENUS || [] };
  },

  /* ── ORDER: CREATE ───────────────────────────────── */
  async createOrder({ items, total, branch, type, userId, promoCode, disc }) {
    if (BACKEND_MODE === 'supabase') {
      const order = await sb.insert('orders', {
        user_id:      userId || null,
        items:        JSON.stringify(items),
        total_amount: total,
        branch_id:    branch.id,
        branch_name:  branch.name,
        order_type:   type,
        payment_method: 'transfer',
        promo_code:   promoCode || null,
        discount:     disc || 0,
        status:       'PENDING',
      });
      return { success: true, id: order[0].id };
    }
    if (BACKEND_MODE === 'gas') {
      return _gasCall('processCheckout', { items, totalAmount: total, paymentMethod: 'transfer', source: 'CLIENT' });
    }
    await _mockDelay(1200);
    return { success: true, id: 'CTB-' + Date.now().toString(36).toUpperCase() };
  },

  /* ── ORDER: STATUS ───────────────────────────────── */
  async getOrderStatus(orderId) {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', { eq: { id: orderId }, select: '*' });
      const o = orders[0];
      if (!o) return { success: false };
      return { success: true, status: o.status, etaMins: 10 };
    }
    if (BACKEND_MODE === 'gas') {
      return _gasCall('getOrderStatus', orderId);
    }
    await _mockDelay(300);
    return { success: true, status: 'preparing', etaMins: 8 };
  },

  /* ── ORDER: HISTORY ──────────────────────────────── */
  async getOrderHistory(userId) {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', {
        eq: { user_id: userId },
        select: '*',
        order: 'created_at.desc',
      });
      return { success: true, data: orders };
    }
    if (BACKEND_MODE === 'gas') {
      const ids = JSON.parse(localStorage.getItem('ctb_order_history') || '[]');
      return _gasCall('getClientOrderHistory', ids);
    }
    return { success: true, data: [] };
  },
};
