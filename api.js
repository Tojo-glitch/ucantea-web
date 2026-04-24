/**
 * CERAMIC — API ADAPTER (js/api.js) — EXTENDED
 * ══════════════════════════════════════════════
 * Adds admin-specific functions to window.API
 * Load after the base api.js (or replace it)
 */

const BACKEND_MODE = 'supabase'; // 'supabase' | 'mock'

const SUPABASE_URL  = window.ENV?.URL  || '';
const SUPABASE_ANON = window.ENV?.KEY  || '';
const GAS_URL       = '';

/* ── SUPABASE CLIENT ───────────────────────────────── */
const sb = {
  // ฟังก์ชันนี้ดึง Headers (สังเกตตัว H ต้องพิมพ์ใหญ่)
  getHeaders() {
    const adminToken = localStorage.getItem('ctb_admin_token');
    const clientToken = localStorage.getItem('ctb_token');
    const tokenToUse = adminToken || clientToken || SUPABASE_ANON;
    return {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${tokenToUse}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };
  },

  async query(table, params = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    if (params.select)  url += `select=${encodeURIComponent(params.select)}&`;
    if (params.eq)      Object.entries(params.eq).forEach(([k,v]) => url += `${k}=eq.${v}&`);
    if (params.neq)     Object.entries(params.neq).forEach(([k,v]) => url += `${k}=neq.${v}&`);
    if (params.order)   url += `order=${params.order}&`;
    if (params.limit)   url += `limit=${params.limit}&`;
    const res = await fetch(url, { headers: sb.getHeaders() }); // 👈 เรียกฟังก์ชันแบบมีวงเล็บ
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST', 
      headers: sb.getHeaders(), // 👈 เรียกฟังก์ชันแบบมีวงเล็บ
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
      headers: sb.getHeaders(), // 👈 เรียกฟังก์ชันแบบมีวงเล็บ
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async delete(table, eq) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    Object.entries(eq).forEach(([k,v]) => url += `${k}=eq.${v}&`);
    const res = await fetch(url, { 
      method: 'DELETE', 
      headers: sb.getHeaders() // 👈 เรียกฟังก์ชันแบบมีวงเล็บ
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  },

  async signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', 
      headers: { ...sb.getHeaders(), 'apikey': SUPABASE_ANON }, // 👈 เรียกฟังก์ชันแบบมีวงเล็บ
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async signUp(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST', 
      headers: { ...sb.getHeaders(), 'apikey': SUPABASE_ANON }, // 👈 เรียกฟังก์ชันแบบมีวงเล็บ
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { ...sb.getHeaders(), 'Authorization': `Bearer ${token}` }, // 👈 เรียกฟังก์ชันแบบมีวงเล็บ
    });
  },

  async resetPassword(email) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST', 
      headers: sb.getHeaders(), // 👈 เรียกฟังก์ชันแบบมีวงเล็บ
      body: JSON.stringify({ email }),
    });
    return res.json();
  },
};

/* ── HELPERS ───────────────────────────────────────── */
const _delay = (ms = 600) => new Promise(r => setTimeout(r, ms));

// Use environment variable for salt or generate secure random salt
const CTB_SALT = window.ENV?.SALT || 'CTB_SALT_2025'; // TODO: Move to environment variable in production

async function _sha256(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/**
 * Secure password hashing with PBKDF2 (recommended for new implementations)
 * @param {string} password - Plain text password
 * @param {string} salt - Salt string
 * @returns {Promise<string>} - Hashed password
 */
async function _hashPasswordSecure(password, salt = CTB_SALT) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
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
}

/* ── MOCK DATA ─────────────────────────────────────── */
const _mockUsers = [
  { id: 'u1', phone: '0812345678', email: 'demo@ceramic.co', name: 'Khun Demo', points: 245, tier: 'Silver', token: 'mock_tok' },
];
const _mockMembers = [
  { id: 'm1', name: 'Khun Demo', phone: '0812345678', email: 'demo@ceramic.co', tier: 'Silver', points: 245, is_active: true, total_orders: 12, created_at: new Date(Date.now()-86400000*30).toISOString() },
  { id: 'm2', name: 'Khun Test', phone: '0899999999', email: 'test@ceramic.co', tier: 'Gold', points: 612, is_active: true, total_orders: 34, created_at: new Date(Date.now()-86400000*60).toISOString() }
];
const _mockOrders = [];
const _mockMenu = [];
const _mockCats = [];

/* ══════════════════════════════════════════════════════
   window.API — public interface
   All functions return Promise<{success, ...}>
══════════════════════════════════════════════════════ */
window.API = {
   async uploadSlip(file) {
    if (!file) return null;
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/slips/${fileName}`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}`, 'Content-Type': file.type },
      body: file,
    });
    if (!res.ok) throw new Error('Upload slip failed');
    return `${SUPABASE_URL}/storage/v1/object/public/slips/${fileName}`;
  },
  // ดึงข้อมูลพนักงานและชื่อสาขาในครั้งเดียว
  async getStaffOnboardingInfo(staffId) {
    if (BACKEND_MODE === 'supabase') {
      const staffRes = await sb.query('staff', { eq: { id: staffId }, select: '*' });
      if (!staffRes || staffRes.length === 0) return { success: false, message: 'Staff not found' };
      
      const staff = staffRes[0];
      const branchRes = await sb.query('branches', { eq: { id: staff.branch_id }, select: 'name' });
      
      return { 
        success: true, 
        staff: staff, 
        branchName: branchRes.length > 0 ? branchRes[0].name : 'Unknown Branch' 
      };
    }
    return { success: true, staff: { name: 'Test' }, branchName: 'Main Branch' };
  },

  // ดึงรายชื่อสาขาทั้งหมด
  async getBranches() {
    if (BACKEND_MODE === 'supabase') {
     const branches = await sb.query('branches', { select: 'id, name', order: 'sort_order' });
      return { success: true, data: branches };
    }
    return { success: true, data: [{id:'BR001', name:'Main Branch — Siam'}] };
  },

  // ตรวจสอบรหัส Manager
  async verifyManagerPin(pin) {
    if (BACKEND_MODE === 'supabase') {
      const hashed = await _sha256(pin + CTB_SALT);
      const res = await sb.query('staff', { 
        eq: { password_hash: hashed, is_active: true }, 
        select: 'id, name, role' 
      });
      const user = res[0];
      if (user && (user.role === 'MANAGER' || user.role === 'ADMIN')) {
        return { success: true, managerName: user.name };
      }
     return { success: false, message: 'Invalid credentials' };
    }
    return { success: false, message: 'Invalid PIN' };
  },

  /* ── HR & ONBOARDING ────────────────────────────── */
  async inviteStaff(data) {
    if (BACKEND_MODE === 'supabase') {
      try {
        const res = await sb.insert('staff', {
          username: data.username,
          email: data.email,
          name: data.name,
          role: data.role,
          branch_id: data.branch_id,
          onboarding_status: 'PENDING'
        });
        if (res && res.length > 0) return { success: true, staff: res[0] };
        return { success: false, message: 'บันทึกไม่ได้' };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }
    return { success: true, staff: { id: 'temp_id_'+Date.now() } };
  },

  async uploadHrDoc(fileOrBlob, fileName) {
    if (BACKEND_MODE === 'supabase') {
      const cleanFileName = Date.now() + '_' + fileName.replace(/[^a-zA-Z0-9.]/g, '_'); 
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/hr_docs/${cleanFileName}`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}`, 'Content-Type': fileOrBlob.type || 'image/png' },
        body: fileOrBlob,
      });
      if (!res.ok) throw new Error('Upload failed');
      return `${SUPABASE_URL}/storage/v1/object/public/hr_docs/${cleanFileName}`;
    }
    return 'https://via.placeholder.com/150';
  },

  // 🟢 ฟังก์ชันนี้สมบูรณ์แล้ว! ข้อมูลครบทุกช่อง 🟢
  async completeOnboarding(staffId, data) {
    if (BACKEND_MODE === 'supabase') {
      const passHash = await _sha256(data.password + CTB_SALT);
      const pinHash = await _sha256(data.pin + CTB_SALT);
      
      const updateData = {
        name: data.fullName,
        username: data.username,
        nickname: data.nickname,
        id_number: data.idNum,
        phone: data.phone,
        emergency_contact: data.emergency,
        bank_name: data.bankName,
        bank_account: data.bankAcc,
        bank_book_url: data.bankBookUrl,
        password_hash: passHash,
        pos_pin_hash: pinHash,
        id_card_url: data.idCardUrl,
        signature_url: data.signatureUrl,
        onboarding_status: 'COMPLETED'
      };

      await sb.update('staff', updateData, { id: staffId });
      return { success: true };
    }
    return { success: true };
  },

  /* ── ADMIN: SECURE LOGIN ────────────────────────── */
  async adminSecureLogin(email, password) {
    if (BACKEND_MODE === 'supabase') {
      const res = await sb.signIn(email, password);
      if (res.error) return { success: false, message: res.error.message };

      const adminUser = { id: res.user.id, email: res.user.email, token: res.access_token };
      localStorage.setItem('ctb_admin_token', res.access_token);
      localStorage.setItem('ctb_admin_user', JSON.stringify(adminUser));

      return { success: true, admin: adminUser };
    }
    return { success: false, message: 'Invalid credentials.' };
  },

  /* ── CUSTOMER AUTH ─────────────────────────────────────────── */
  async login({ phone, hashedPassword }) {
    if (BACKEND_MODE === 'supabase') {
      const pseudoEmail = `${phone}@ceramic.internal`;
      const data = await sb.signIn(pseudoEmail, hashedPassword);
      if (data.error) return { success: false, message: 'Incorrect credentials' };
      const members = await sb.query('members', { eq: { auth_id: data.user.id }, select: '*' });
      const member = members[0];
      if (!member) return { success: false, message: 'Account not found' };
      const user = { id: member.id, authId: data.user.id, name: member.name, phone: member.phone, email: member.email, points: member.points, tier: member.tier, token: data.access_token };
      localStorage.setItem('ctb_user', JSON.stringify(user));
      localStorage.setItem('ctb_token', data.access_token);
      return { success: true, user };
    }
    return { success: false, message: 'No account found' };
  },

async register({ phone, email, name, hashedPassword }) {
    if (BACKEND_MODE === 'supabase') {
      try {
        const pseudoEmail = `${phone}@ceramic.internal`;
        
        // 1. สร้างบัญชีใน Auth
        const authData = await sb.signUp(pseudoEmail, hashedPassword);
        
        // เช็คว่าพังตอนสร้างบัญชีไหม
        if (authData.error) {
          // แจ้ง Error ชัดๆ ให้ลูกค้ารู้ (เช่น อีเมลซ้ำ, รหัสสั้นไป)
          return { success: false, message: authData.error.message || authData.error.msg || 'Registration failed' };
        }

        // ดึง ID ของ User ที่เพิ่งสมัคร
        const authId = authData.user ? authData.user.id : (authData.id || null);
        const token = authData.session ? authData.session.access_token : (authData.access_token || 'no_token');

        if (!authId) {
          throw new Error("Supabase Auth ไม่ส่ง User ID กลับมา");
        }

        // 2. บันทึกข้อมูลลงตาราง members
        const memberPayload = { 
          auth_id: authId, 
          phone: phone, 
          email: email, 
          name: name, 
          points: 50, 
          tier: 'Bronze' 
        };
        
        await sb.insert('members', memberPayload);

        // 3. สร้าง Object ผู้ใช้สำหรับบันทึกลง LocalStorage
        const user = { 
          id: authId, // ใช้ authId เป็นตัวอ้างอิงไปก่อน
          authId: authId, 
          name: name, 
          phone: phone, 
          email: email, 
          points: 50, 
          tier: 'Bronze', 
          token: token 
        };
        
        localStorage.setItem('ctb_user', JSON.stringify(user));
        localStorage.setItem('ctb_token', token);
        
        return { success: true, user: user };

      } catch (err) {
        console.error("🔥 Register Flow Error:", err);
        return { success: false, message: err.message || 'System error during registration.' };
      }
    }
    
    // สำหรับโหมด Mock (เทสในคอม)
    return { success: true };
  },

  async forgotPassword(email) {
    if (BACKEND_MODE === 'supabase') await sb.resetPassword(email);
    return { success: true };
  },

  async logout(user) {
    if (BACKEND_MODE === 'supabase' && user?.token) {
      try { await sb.signOut(user.token); } catch(e) {}
    }
    localStorage.removeItem('ctb_user'); localStorage.removeItem('ctb_token');
    return { success: true };
  },

  async updateProfile({ token, field, value }) {
    const user = JSON.parse(localStorage.getItem('ctb_user') || '{}');
    if (BACKEND_MODE === 'supabase' && user.authId) {
      const update = {}; update[field] = value;
      await sb.update('members', update, { auth_id: user.authId });
    }
    user[field] = value;
    localStorage.setItem('ctb_user', JSON.stringify(user));
    return { success: true };
  },

  /* ── ORDERS ───────────────────────────────────────── */
  async getAdminOrders() {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', { select: '*', order: 'created_at.desc', limit: 100 });
      return { success: true, data: orders };
    }
    return { success: true, data: [] };
  },

  async updateOrderStatus(orderId, newStatus) {
    if (BACKEND_MODE === 'supabase') {
      await sb.update('orders', { status: newStatus }, { id: orderId });
    }
    return { success: true };
  },

  // 🟢 เพิ่ม slipUrl เข้าไปใน parameter { ... }
  async createOrder({ items, total, branch, type, userId, promoCode, disc, address, contactPhone, pickupTime, status, slipUrl }) {
    if (BACKEND_MODE === 'supabase') {
      const order = await sb.insert('orders', {
        user_id: userId || null,
        items: JSON.stringify(items),
        total_amount: total,
        branch_id: branch?.id || null,
        branch_name: branch?.name || null,
        order_type: type,
        payment_method: 'transfer',
        promo_code: promoCode || null,
        discount: disc || 0,
        status: status || 'PENDING',
        delivery_address: address || null,
        delivery_phone: contactPhone || null,
        pickup_time: pickupTime || null,
        slip_url: slipUrl || null, // 🟢 ใส่ตรงนี้
        source: 'CLIENT'
      });
      return { success: true, id: order[0].id };
    }
    return { success: true, id: 'CTB-' + Date.now().toString(36).toUpperCase() };
  },

  async getOrderStatus(orderId) {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', { eq: { id: orderId }, select: '*' });
      const o = orders[0]; if (!o) return { success: false };
      return { success: true, status: o.status, etaMins: 10 };
    }
    return { success: true, status: 'preparing' };
  },

  async getOrderHistory(userId) {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', { eq: { user_id: userId }, select: '*', order: 'created_at.desc' });
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

  /* ── MEMBERS ──────────────────────────────────────── */
  async getAdminMembers() {
    if (BACKEND_MODE === 'supabase') {
      const members = await sb.query('members', { select: '*', order: 'created_at.desc' });
      return { success: true, data: members };
    }
    return { success: true, data: [] };
  },

  async updateMemberPoints(memberId, newPoints) {
    if (BACKEND_MODE === 'supabase') {
      await sb.update('members', { points: newPoints }, { id: memberId });
    }
    return { success: true };
  },

  async updateMemberFull(memberId, data) {
    if (BACKEND_MODE === 'supabase') {
      await sb.update('members', data, { id: memberId });
    }
    return { success: true };
  },

  async getMemberByPhone(phone) {
    if (BACKEND_MODE === 'supabase') {
      const res = await sb.query('members', { eq: { phone }, select: '*' });
      if (res && res.length > 0) return { success: true, member: res[0] };
      return { success: false, message: 'Member not found' };
    }
    return { success: false };
  },

  /* ── MENU & PROMOS & SETTINGS ─────────────────────── */
  async getMenu() {
    if (BACKEND_MODE === 'supabase') {
      const [products, categories, addons] = await Promise.all([
        sb.query('menu_items',  { select: '*', order: 'sort_order' }),
        sb.query('categories',  { select: '*', eq: { is_active: true }, order: 'sort_order' }),
        sb.query('addons',      { select: '*', eq: { is_active: true }, order: 'sort_order' }),
      ]);
      return {
        products, categories, customization: {
          sweetness: ['0%','25%','50%','Regular','Extra'],
          ice: ['No ice','Less ice','Regular ice','Extra ice'],
          addons,
        },
      };
    }
    return { products: [], categories: [] };
  },

  async getPromos() {
    if (BACKEND_MODE === 'supabase') {
      const promos = await sb.query('promo_codes', { select: '*', order: 'created_at.desc' });
      return { success: true, data: promos };
    }
    return { success: true, data: [] };
  },

  async setStoreStatus(isOpen) {
    localStorage.setItem('ctb_shop_open', String(isOpen));
    return { success: true };
  },

  /* ── STAFF MANAGEMENT (สำหรับหน้า Admin) ───────────────────────── */
  // 1. ดึงรายชื่อพนักงานทั้งหมดมาโชว์ในหน้า Admin
  async getStaff() {
    if (BACKEND_MODE === 'supabase') {
      try {
        // ดึงพนักงานทั้งหมด
        const staffList = await sb.query('staff', { select: '*', order: 'created_at.desc' });
        // ดึงสาขามาเพื่อแปลง branch_id เป็นชื่อสาขา
        const branches = await sb.query('branches', { select: 'id, name' });
        
        const branchMap = {};
        branches.forEach(b => branchMap[b.id] = b.name);

        // เอาชื่อสาขาไปผูกกับพนักงาน
        const enrichedStaff = staffList.map(s => ({
          ...s,
          branch_name: branchMap[s.branch_id] || 'ไม่ทราบสาขา'
        }));

        return { success: true, data: enrichedStaff };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }
    return { success: true, data: [] }; // Mock
  },

  // 2. อัปเดตข้อมูลพนักงาน (เช่น ระงับสิทธิ์, เปลี่ยน Role) จากหน้า Admin
  async updateStaff(id, data) {
    if (BACKEND_MODE === 'supabase') {
      await sb.update('staff', data, { id });
      return { success: true };
    }
    return { success: true };
  },

  /* ── POS LOGIN (สำหรับหน้า POS) ──────────────────────────────── */
  // 3. ล็อกอินเข้า POS โดยเช็คจากตาราง staff
  async staffLogin(username, pin) {
    if (BACKEND_MODE === 'supabase') {
      // ทำการเข้ารหัส PIN 4 หลักที่พนักงานกดหน้าจอ POS
      const hashedPin = await _sha256(pin + CTB_SALT);
      
      // ค้นหาในตาราง staff ว่ามี Username และ PIN ตรงกันไหม + ต้อง Active อยู่
      const res = await sb.query('staff', { 
        eq: { username: username, pos_pin_hash: hashedPin, is_active: true }, 
        select: 'id, username, name, role, branch_id' 
      });
      
      if (res && res.length > 0) {
        return { success: true, staff: res[0] };
      }
      return { success: false, message: 'Username หรือ PIN ไม่ถูกต้อง / บัญชีถูกระงับ' };
    }
    return { success: false, message: 'Invalid credentials' };
  },

  async getStoreStatus() {
    const stored = localStorage.getItem('ctb_shop_open');
    return { isOpen: stored === null ? true : stored === 'true' };
  },

  /* ── PROMOS & VALIDATION ────────────────────────── */
  async validatePromoCode({ code, subtotal }) {
    if (BACKEND_MODE === 'supabase') {
      try {
        const promos = await sb.query('promo_codes', { 
          eq: { code: code.toUpperCase(), is_active: true }, 
          select: '*' 
        });
        
        if (!promos || promos.length === 0) {
          return { success: false, message: 'Invalid promo code' };
        }
        
        const promo = promos[0];
        const now = new Date().toISOString();
        
        // Check validity period
        if (promo.valid_from && promo.valid_from > now) {
          return { success: false, message: 'Promo code not yet valid' };
        }
        if (promo.valid_until && promo.valid_until < now) {
          return { success: false, message: 'Promo code expired' };
        }
        
        // Check minimum order
        if (promo.min_order && subtotal < promo.min_order) {
          return { 
            success: false, 
            message: `Minimum order ${promo.min_order} THB required` 
          };
        }
        
        // Calculate discount
        let discount = 0;
        if (promo.discount_type === 'percent') {
          discount = Math.min(subtotal * (promo.discount_value / 100), promo.max_discount || 999999);
        } else if (promo.discount_type === 'fixed') {
          discount = Math.min(promo.discount_value, subtotal);
        }
        
        return { 
          success: true, 
          discount: Math.round(discount),
          finalAmount: subtotal - discount,
          promo: promo
        };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }
    return { success: true, discount: 0, finalAmount: subtotal };
  },

  /* ── ANALYTICS TRACKING ─────────────────────────── */
  async track(eventData) {
    if (BACKEND_MODE === 'supabase') {
      try {
        await sb.insert('analytics_events', {
          event_name: eventData.event,
          user_id: eventData.userId || null,
          session_id: eventData.sessionId || null,
          page_url: eventData.url || window.location.pathname,
          metadata: JSON.stringify(eventData.data || {}),
          created_at: new Date().toISOString()
        });
        return { success: true };
      } catch (err) {
        console.warn('Analytics tracking failed:', err);
        return { success: false };
      }
    }
    return { success: true };
  },

  /* ── LOYALTY POINTS ─────────────────────────────── */
  async updatePoints({ userId, points }) {
    if (BACKEND_MODE === 'supabase') {
      try {
        const currentMember = await sb.query('members', { 
          eq: { id: userId }, 
          select: 'points' 
        });
        
        if (currentMember && currentMember.length > 0) {
          const newPoints = (currentMember[0].points || 0) + points;
          await sb.update('members', { points: Math.max(0, newPoints) }, { id: userId });
          return { success: true, points: Math.max(0, newPoints) };
        }
        return { success: false, message: 'Member not found' };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }
    return { success: true, points: points };
  },

  /* ── CMS BANNERS ────────────────────────────────── */
  async getBanners() {
    if (BACKEND_MODE === 'supabase') {
      try {
        const banners = await sb.query('banners', { 
          select: '*', 
          eq: { is_active: true },
          order: 'sort_order,created_at.desc'
        });
        return { success: true, data: banners };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }
    return { success: true, data: [] };
  },

  /* ── REAL-TIME SSE BASE URL ─────────────────────── */
  SSE_BASE: SUPABASE_URL + '/rest/v1',

  /* ── NOTIFICATIONS ──────────────────────────────── */
  async sendNotification({ userId, title, message, type }) {
    if (BACKEND_MODE === 'supabase') {
      try {
        await sb.insert('notifications', {
          user_id: userId,
          title: title,
          message: message,
          type: type || 'info',
          is_read: false,
          created_at: new Date().toISOString()
        });
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }
    return { success: true };
  },

  async getNotifications(userId) {
    if (BACKEND_MODE === 'supabase') {
      try {
        const notifs = await sb.query('notifications', {
          eq: { user_id: userId },
          select: '*',
          order: 'created_at.desc',
          limit: 20
        });
        return { success: true, data: notifs };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }
    return { success: true, data: [] };
  },

  async markNotificationRead(notificationId) {
    if (BACKEND_MODE === 'supabase') {
      await sb.update('notifications', { is_read: true }, { id: notificationId });
    }
    return { success: true };
  }
};
