/**
 * CERAMIC — API ADAPTER (api.js)
 * ══════════════════════════════════════════════
 * Fixed: Auth Headers (400) & Analytics Spam (404)
 */

const BACKEND_MODE  = 'supabase'; // 'supabase' | 'mock'
const SUPABASE_URL  = window.ENV?.URL || '';
const SUPABASE_ANON = window.ENV?.KEY || '';

// SSE base for realtime fallback
window.API = window.API || {};
window.API.SSE_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : null;

const _isDev = window.isDev || location.hostname === 'localhost' || location.search.includes('debug=1');
const TIMEOUT = 12000;

/* ── HELPERS ─────────────────────────────────────── */
function _log(...a)  { if (_isDev) console.log(...a); }
function _warn(...a) { if (_isDev) console.warn(...a); }
function _err(...a)  { if (_isDev) console.error(...a); }

async function _fetch(url, opts = {}) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Request timed out — กรุณาตรวจสอบการเชื่อมต่อ');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function _sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── SUPABASE CLIENT ─────────────────────────────── */
const sb = {
  getHeaders() {
    const tok = localStorage.getItem('ctb_admin_token') || localStorage.getItem('ctb_token') || SUPABASE_ANON;
    return {
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${tok}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    };
  },

  // ใช้สำหรับ Auth Endpoint โดยเฉพาะ เพื่อป้องกัน Token ตีกัน (สาเหตุของ Error 400)
  getAuthHeaders() {
    return {
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type':  'application/json',
    };
  },

  async query(table, p = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    if (p.select) url += `select=${encodeURIComponent(p.select)}&`;
    if (p.eq)  Object.entries(p.eq).forEach(([k,v]) => url += `${k}=eq.${encodeURIComponent(v)}&`);
    if (p.neq) Object.entries(p.neq).forEach(([k,v]) => url += `${k}=neq.${encodeURIComponent(v)}&`);
    if (p.order) url += `order=${p.order}&`;
    if (p.limit) url += `limit=${p.limit}&`;
    const res = await _fetch(url, { headers: sb.getHeaders() });
    if (!res.ok) { const t = await res.text(); throw new Error(`[${table}] ${res.status} ${t}`); }
    return res.json();
  },

  async insert(table, data) {
    const res = await _fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST', headers: sb.getHeaders(), body: JSON.stringify(data),
    });
    // แนบ status code ไปด้วยเพื่อให้ catch จับ 404 ได้
    if (!res.ok) { const t = await res.text(); throw new Error(`[insert ${table}] ${res.status} ${t}`); }
    return res.json();
  },

  async update(table, data, eq) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    Object.entries(eq).forEach(([k,v]) => url += `${k}=eq.${encodeURIComponent(v)}&`);
    const res = await _fetch(url, { method: 'PATCH', headers: sb.getHeaders(), body: JSON.stringify(data) });
    if (!res.ok) { const t = await res.text(); throw new Error(`[update ${table}] ${res.status} ${t}`); }
    return res.json();
  },

  async delete(table, eq) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    Object.entries(eq).forEach(([k,v]) => url += `${k}=eq.${encodeURIComponent(v)}&`);
    const res = await _fetch(url, { method: 'DELETE', headers: sb.getHeaders() });
    if (!res.ok) { const t = await res.text(); throw new Error(`[delete ${table}] ${res.status} ${t}`); }
    return true;
  },

  async signIn(email, password) {
    const res = await _fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: sb.getAuthHeaders(), body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data };
    return data;
  },

  async signUp(email, password) {
    const res = await _fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST', headers: sb.getAuthHeaders(), body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { _err('SignUp failed:', data); return { error: data }; }
    return data;
  },

  async signOut(token) {
    await _fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST', headers: { ...sb.getAuthHeaders(), 'Authorization': `Bearer ${token}` },
    }).catch(() => {});
  },

  async resetPassword(email) {
    const res = await _fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST', headers: sb.getAuthHeaders(), body: JSON.stringify({ email }),
    });
    return res.json();
  },
};

/* ══════════════════════════════════════════════════════
   window.API — public interface
══════════════════════════════════════════════════════ */
window.API = {

  SSE_BASE: SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : null,

  /* ── STORAGE ──────────────────────────────────── */
  async uploadSlip(file) {
    if (!file) return null;
    const ext      = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}_slip.${ext}`;
    const tok      = localStorage.getItem('ctb_token') || SUPABASE_ANON;
    const res = await _fetch(`${SUPABASE_URL}/storage/v1/object/slips/${fileName}`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${tok}`, 'Content-Type': file.type || 'image/jpeg' },
      body: file,
    });
    if (!res.ok) throw new Error('อัปโหลดสลิปไม่สำเร็จ — กรุณาลองใหม่');
    return `${SUPABASE_URL}/storage/v1/object/public/slips/${fileName}`;
  },

  async uploadHrDoc(fileOrBlob, fileName) {
    if (BACKEND_MODE !== 'supabase') return 'https://via.placeholder.com/150';
    const cleanName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const res = await _fetch(`${SUPABASE_URL}/storage/v1/object/hr_docs/${cleanName}`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}`, 'Content-Type': fileOrBlob.type || 'image/png' },
      body: fileOrBlob,
    });
    if (!res.ok) throw new Error('Upload failed');
    return `${SUPABASE_URL}/storage/v1/object/public/hr_docs/${cleanName}`;
  },

  /* ── AUTH — CUSTOMER ──────────────────────────── */
  async login({ phone, hashedPassword }) {
    if (BACKEND_MODE === 'supabase') {
      try {
        const data = await sb.signIn(`${phone}@ceramic.internal`, hashedPassword);
        if (data.error) return { success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
        const members = await sb.query('members', { eq: { auth_id: data.user.id }, select: '*' });
        const member  = members[0];
        if (!member) return { success: false, message: 'ไม่พบบัญชีผู้ใช้' };
        const user = {
          id: member.id, authId: data.user.id,
          name: member.name, phone: member.phone, email: member.email,
          points: member.points || 0, tier: member.tier || 'Bronze',
          token: data.access_token,
        };
        localStorage.setItem('ctb_user', JSON.stringify(user));
        localStorage.setItem('ctb_token', data.access_token);
        return { success: true, user };
      } catch (err) { _err('[login]', err); return { success: false, message: err.message }; }
    }
    return { success: false, message: 'ไม่พบบัญชี' };
  },

  async register({ phone, email, name, hashedPassword }) {
    if (BACKEND_MODE === 'supabase') {
      try {
        const authData = await sb.signUp(`${phone}@ceramic.internal`, hashedPassword);
        _log('Auth response:', authData);
        if (authData.error) return { success: false, message: authData.error.message || 'สมัครสมาชิกไม่สำเร็จ' };

        const authId = authData?.user?.id || authData?.id || authData?.data?.user?.id;
        const token  = authData?.access_token || authData?.session?.access_token || 'no_token';

        if (!authId) throw new Error('Supabase ไม่ส่ง User ID — กรุณาปิด "Confirm email" ใน Auth → Providers → Email');

        await sb.insert('members', { auth_id: authId, phone, email, name, points: 50, tier: 'Bronze' });

        const user = { id: authId, authId, name, phone, email, points: 50, tier: 'Bronze', token };
        localStorage.setItem('ctb_user', JSON.stringify(user));
        localStorage.setItem('ctb_token', token);
        return { success: true, user };
      } catch (err) {
        _err('[register]', err);
        return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการสมัคร' };
      }
    }
    return { success: true, user: { id: 'mock', name, phone, email, points: 50, tier: 'Bronze', token: 'mock' } };
  },

  async forgotPassword(email) {
    if (BACKEND_MODE === 'supabase') await sb.resetPassword(email);
    return { success: true };
  },

  async logout(user) {
    if (BACKEND_MODE === 'supabase' && user?.token) try { await sb.signOut(user.token); } catch(e) {}
    localStorage.removeItem('ctb_user');
    localStorage.removeItem('ctb_token');
    return { success: true };
  },

  async updateProfile({ field, value }) {
    const user = JSON.parse(localStorage.getItem('ctb_user') || '{}');
    if (BACKEND_MODE === 'supabase' && user.authId) {
      const upd = {}; upd[field] = value;
      await sb.update('members', upd, { auth_id: user.authId }).catch(_err);
    }
    user[field] = value;
    localStorage.setItem('ctb_user', JSON.stringify(user));
    return { success: true };
  },

  async updatePoints({ userId, points }) {
    if (BACKEND_MODE === 'supabase') {
      await sb.update('members', { points }, { auth_id: userId }).catch(_err);
    }
    return { success: true };
  },

  /* ── AUTH — ADMIN ─────────────────────────────── */
  async adminSecureLogin(email, password) {
    if (BACKEND_MODE === 'supabase') {
      try {
        const res = await sb.signIn(email, password);
        if (res.error) return { success: false, message: res.error.message || 'เข้าสู่ระบบไม่ได้' };
        const admin = { id: res.user.id, email: res.user.email, token: res.access_token };
        localStorage.setItem('ctb_admin_token', res.access_token);
        localStorage.setItem('ctb_admin_user', JSON.stringify(admin));
        return { success: true, admin };
      } catch (err) { _err('[adminLogin]', err); return { success: false, message: err.message }; }
    }
    return { success: false, message: 'Invalid credentials.' };
  },

  /* ── ORDERS ───────────────────────────────────── */
  async createOrder({
    items, total, branch, type, userId, promoCode, disc, slipUrl, status,
    delivery_address, delivery_phone, pickup_time
  }) {
    if (BACKEND_MODE === 'supabase') {
      const order = await sb.insert('orders', {
        user_id: userId || null, items: JSON.stringify(items),
        total_amount: total, branch_id: branch?.id || null, branch_name: branch?.name || null,
        order_type: type, payment_method: 'transfer',
        promo_code: promoCode || null, discount: disc || 0,
        status: status || 'PENDING',
        delivery_address: delivery_address || null,
        delivery_phone:   delivery_phone   || null,
        pickup_time:      pickup_time      || null,
        slip_url: slipUrl || null, source: 'CLIENT',
      });
      if (!order?.[0]) throw new Error('Order insert returned empty');
      return { success: true, id: order[0].id, queue_number: order[0].queue_number };
    }
    return { success: true, id: 'CTB-' + Date.now().toString(36).toUpperCase() };
  },

  async getOrderStatus(orderId) {
    if (BACKEND_MODE === 'supabase') {
      const rows = await sb.query('orders', { eq: { id: orderId }, select: '*' });
      const o = rows[0]; if (!o) return { success: false };
      return { success: true, status: o.status, eta: o.eta_minutes ? `${o.eta_minutes} min` : null };
    }
    return { success: true, status: 'preparing' };
  },

  async updateOrderStatus(orderId, newStatus) {
    if (BACKEND_MODE === 'supabase') await sb.update('orders', { status: newStatus }, { id: orderId });
    return { success: true };
  },

  async getOrderHistory(userId) {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', { eq: { user_id: userId }, select: '*', order: 'created_at.desc' });
      return { success: true, data: orders };
    }
    return { success: true, data: [] };
  },

  async getAdminOrders() {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', { select: '*', order: 'created_at.desc', limit: 100 });
      return { success: true, data: orders };
    }
    return { success: true, data: [] };
  },

  async getKdsOrders() {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', { select: '*', order: 'created_at.asc', limit: 50 });
      return { success: true, data: orders.filter(o => ['PENDING','CONFIRMED','PREPARING'].includes(o.status)) };
    }
    return { success: true, data: [] };
  },

  /* ── MENU ─────────────────────────────────────── */
  async getMenu() {
    if (BACKEND_MODE === 'supabase') {
      const [products, categories, addons] = await Promise.all([
        sb.query('menu_items', { select: '*', order: 'sort_order' }),
        sb.query('categories', { select: '*', eq: { is_active: true }, order: 'sort_order' }),
        sb.query('addons',     { select: '*', eq: { is_active: true }, order: 'sort_order' }),
      ]);
      return { products, categories, customization: {
        sweetness: ['0%','25%','50%','Regular','Extra'],
        ice: ['No ice','Less ice','Regular ice','Extra ice'],
        addons,
      }};
    }
    return { products: [], categories: [] };
  },

  async getBanners() {
    if (BACKEND_MODE === 'supabase') {
      try {
        const banners = await sb.query('banners', { select: '*', eq: { is_active: true }, order: 'sort_order', limit: 5 });
        return { success: true, banners };
      } catch (err) { return { success: false, banners: [] }; }
    }
    return { success: true, banners: [] };
  },

  /* ── ANALYTICS TRACKING ───────────────────────── */
  async track(payload) {
    if (BACKEND_MODE === 'supabase' && payload) {
      // ดักไม่ให้ยิงซ้ำ ถ้ารู้ว่า 404 (ไม่มี Table) ไปแล้ว
      if (window._disableTracking) return { success: false };
      
      sb.insert('analytics_events', {
        event_name: payload.event, user_id: payload.userId || null,
        session_id: payload.session || null, branch_id: payload.branch || null,
        properties: JSON.stringify(payload), created_at: new Date().toISOString(),
      }).catch(e => {
        // ถ้าระบบบอกว่า 404 Not found แปลว่ายังไม่ได้สร้าง Table
        if (e.message.includes('404')) {
            window._disableTracking = true; // ปิดการส่ง Track จนกว่าจะ Refresh หน้าต่าง
        }
        _warn('[track]', e.message);
      });
    }
    return { success: true };
  },

  /* ── PROMOS ───────────────────────────────────── */
  async getPromos() {
    if (BACKEND_MODE === 'supabase') {
      const promos = await sb.query('promo_codes', { select: '*', order: 'created_at.desc' });
      return { success: true, data: promos };
    }
    return { success: true, data: [] };
  },

  /* ── BRANCHES ─────────────────────────────────── */
  async getBranches() {
    if (BACKEND_MODE === 'supabase') {
      const branches = await sb.query('branches', { select: 'id, name', order: 'sort_order' });
      return { success: true, data: branches };
    }
    return { success: true, data: [{ id: 'BR001', name: 'Main Branch — Siam' }] };
  },

  /* ── STORE STATUS ─────────────────────────────── */
  async getStoreStatus() {
    const s = localStorage.getItem('ctb_shop_open');
    return { isOpen: s === null ? true : s === 'true' };
  },
  async setStoreStatus(isOpen) {
    localStorage.setItem('ctb_shop_open', String(isOpen));
    return { success: true };
  },

  /* ── MEMBERS (admin) ──────────────────────────── */
  async getAdminMembers() {
    if (BACKEND_MODE === 'supabase') {
      const members = await sb.query('members', { select: '*', order: 'created_at.desc' });
      return { success: true, data: members };
    }
    return { success: true, data: [] };
  },
  async getMemberByPhone(phone) {
    if (BACKEND_MODE === 'supabase') {
      const res = await sb.query('members', { eq: { phone }, select: '*' });
      if (res?.length) return { success: true, member: res[0] };
      return { success: false, message: 'ไม่พบสมาชิก' };
    }
    return { success: false };
  },
  async updateMemberPoints(memberId, newPoints) {
    if (BACKEND_MODE === 'supabase') await sb.update('members', { points: newPoints }, { id: memberId });
    return { success: true };
  },
  async updateMemberFull(memberId, data) {
    if (BACKEND_MODE === 'supabase') await sb.update('members', data, { id: memberId });
    return { success: true };
  },

  /* ── STAFF ────────────────────────────────────── */
  async getStaff() {
    if (BACKEND_MODE === 'supabase') {
      try {
        const [staffList, branches] = await Promise.all([
          sb.query('staff', { select: '*', order: 'created_at.desc' }),
          sb.query('branches', { select: 'id, name' }),
        ]);
        const map = {}; branches.forEach(b => map[b.id] = b.name);
        return { success: true, data: staffList.map(s => ({ ...s, branch_name: map[s.branch_id] || 'ไม่ทราบสาขา' })) };
      } catch (err) { return { success: false, message: err.message }; }
    }
    return { success: true, data: [] };
  },
  async updateStaff(id, data) {
    if (BACKEND_MODE === 'supabase') await sb.update('staff', data, { id });
    return { success: true };
  },
  async getStaffOnboardingInfo(staffId) {
    if (BACKEND_MODE === 'supabase') {
      const staffRes = await sb.query('staff', { eq: { id: staffId }, select: '*' });
      if (!staffRes?.length) return { success: false, message: 'ไม่พบพนักงาน' };
      const staff = staffRes[0];
      const branchRes = await sb.query('branches', { eq: { id: staff.branch_id }, select: 'name' });
      return { success: true, staff, branchName: branchRes[0]?.name || 'Unknown' };
    }
    return { success: true, staff: { name: 'Test' }, branchName: 'Main Branch' };
  },
  async inviteStaff(data) {
    if (BACKEND_MODE === 'supabase') {
      try {
        const res = await sb.insert('staff', {
          username: data.username, email: data.email, name: data.name,
          role: data.role, branch_id: data.branch_id, onboarding_status: 'PENDING',
        });
        if (res?.length) return { success: true, staff: res[0] };
        return { success: false, message: 'บันทึกไม่ได้' };
      } catch (err) { return { success: false, message: err.message }; }
    }
    return { success: true, staff: { id: 'temp_' + Date.now() } };
  },
  async completeOnboarding(staffId, data) {
    if (BACKEND_MODE === 'supabase') {
      const [passHash, pinHash] = await Promise.all([
        _sha256(data.password + 'CTB_SALT_2025'),
        _sha256(data.pin + 'CTB_SALT_2025'),
      ]);
      await sb.update('staff', {
        name: data.fullName, username: data.username, nickname: data.nickname,
        id_number: data.idNum, phone: data.phone, emergency_contact: data.emergency,
        bank_name: data.bankName, bank_account: data.bankAcc, bank_book_url: data.bankBookUrl,
        password_hash: passHash, pos_pin_hash: pinHash,
        id_card_url: data.idCardUrl, signature_url: data.signatureUrl,
        onboarding_status: 'COMPLETED',
      }, { id: staffId });
      return { success: true };
    }
    return { success: true };
  },

  async staffLogin(username, pin) {
    if (BACKEND_MODE === 'supabase') {
      const hash = await _sha256(pin + 'CTB_SALT_2025');
      const res = await sb.query('staff', {
        eq: { username, pos_pin_hash: hash, is_active: true },
        select: 'id, username, name, role, branch_id',
      });
      if (res?.length) return { success: true, staff: res[0] };
      return { success: false, message: 'Username หรือ PIN ไม่ถูกต้อง / บัญชีถูกระงับ' };
    }
    return { success: false, message: 'Invalid credentials' };
  },

  async verifyManagerPin(pin) {
    if (BACKEND_MODE === 'supabase') {
      const hash = await _sha256(pin + 'CTB_SALT_2025');
      const res = await sb.query('staff', { eq: { pos_pin_hash: hash, is_active: true }, select: 'id, name, role' });
      const u = res?.[0];
      if (u && ['MANAGER','ADMIN'].includes(u.role)) return { success: true, managerName: u.name };
      return { success: false, message: 'รหัสไม่ถูกต้อง' };
    }
    return { success: false, message: 'Invalid PIN' };
  },
};
