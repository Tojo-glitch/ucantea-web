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
  // สร้าง function เล็กๆ สำหรับดึง headers จะได้อัปเดต token ได้ตลอด
  get headers() {
    const adminToken = localStorage.getItem('ctb_admin_token');
    const clientToken = localStorage.getItem('ctb_token'); // ของฝั่งลูกค้า
    
    // ใช้ Admin Token ก่อน (ถ้ามี), ถ้าไม่มีค่อยใช้ Client Token, ถ้าไม่มีเลยค่อยใช้ Anon Key
    const tokenToUse = adminToken || clientToken || SUPABASE_ANON;
    
    return {
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    };
  },

  async query(table, params = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    if (params.select)  url += `select=${encodeURIComponent(params.select)}&`;
    if (params.eq)      Object.entries(params.eq).forEach(([k,v]) => url += `${k}=eq.${v}&`);
    if (params.neq)     Object.entries(params.neq).forEach(([k,v]) => url += `${k}=neq.${v}&`);
    if (params.order)   url += `order=${params.order}&`;
    if (params.limit)   url += `limit=${params.limit}&`;
    const res = await fetch(url, { headers: sb.headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

async insert(table, data) {
    const headerData = sb.headers; // ดูค่า Headers
    console.log("Sending POST to:", table, "Headers:", headerData); // 🟢 เช็คตรงนี้ใน Console
    
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST', 
      headers: headerData, 
      body: JSON.stringify(data),
    });
    
    if (!res.ok) {
        const errorText = await res.text();
        console.error("Supabase Insert Error:", errorText); // 🟢 ดู Error จริงๆ ว่ามันด่าว่าอะไร
        throw new Error(errorText);
    }
    return res.json();
  },

  async update(table, data, eq) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    Object.entries(eq).forEach(([k,v]) => url += `${k}=eq.${v}&`);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: sb.headers, // <--- ตรงนี้ใช้ Anon Key เดิม
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async delete(table, eq) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    Object.entries(eq).forEach(([k,v]) => url += `${k}=eq.${v}&`);
    const res = await fetch(url, { method: 'DELETE', headers: sb.headers });
    if (!res.ok) throw new Error(await res.text());
    return true;
  },

  async signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { ...sb.headers, 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async signUp(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST', headers: { ...sb.headers, 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { ...sb.headers, 'Authorization': `Bearer ${token}` },
    });
  },

  async resetPassword(email) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST', headers: sb.headers, body: JSON.stringify({ email }),
    });
    return res.json();
  },

/* ── POS & STAFF AUTH ─────────────────────────────── */
  async verifyManagerPin(pin) {
    if (BACKEND_MODE === 'supabase') {
      const hashed = await _sha256(pin + 'CTB_SALT_2025');
      // ค้นหาพนักงานที่รหัสผ่านตรง และต้องมี Role เป็น MANAGER หรือ ADMIN เท่านั้น
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
    // Mock Data
    await _delay(300);
    if(pin === '9999') return { success: true, managerName: 'Admin' };
    return { success: false, message: 'Invalid PIN' };
  },
};
/* ── HELPERS ───────────────────────────────────────── */
const _delay = (ms = 600) => new Promise(r => setTimeout(r, ms));

async function _sha256(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ── STORAGE: UPLOAD SLIP ──────────────────────────── */
async function uploadSlip(file) {
  if (!file) return null;
  const fileName = `${Date.now()}_${file.name.replace(/\s/g,'_')}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/slips/${fileName}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}`, 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/slips/${fileName}`;
}

/* ── MOCK DATA ─────────────────────────────────────── */
const _mockUsers = [
  { id: 'u1', phone: '0812345678', email: 'demo@ceramic.co', name: 'Khun Demo', points: 245, tier: 'Silver', token: 'mock_tok' },
];
const _mockMembers = [
  { id: 'm1', name: 'Khun Demo', phone: '0812345678', email: 'demo@ceramic.co', tier: 'Silver', points: 245, is_active: true, total_orders: 12, created_at: new Date(Date.now()-86400000*30).toISOString() },
  { id: 'm2', name: 'Khun Test', phone: '0899999999', email: 'test@ceramic.co', tier: 'Gold', points: 612, is_active: true, total_orders: 34, created_at: new Date(Date.now()-86400000*60).toISOString() },
  { id: 'm3', name: 'Khun New', phone: '0811111111', email: 'new@ceramic.co', tier: 'Bronze', points: 50, is_active: true, total_orders: 1, created_at: new Date().toISOString() },
];
const _mockOrders = [
  { id: 'CTB-A1B2', branch_name: 'Main Branch — Siam', total_amount: 240, status: 'PENDING', order_type: 'pickup', items: JSON.stringify([{name:'White Peach Oolong',qty:2,price:120,options:{sweetness:'regular',ice:'regular ice'}}]), payment_method: 'transfer', created_at: new Date().toISOString() },
  { id: 'CTB-C3D4', branch_name: 'Thonglor Branch', total_amount: 110, status: 'PREPARING', order_type: 'delivery', items: JSON.stringify([{name:'Hojicha Latte',qty:1,price:110,options:{sweetness:'50%',ice:'less ice'}}]), payment_method: 'transfer', delivery_address: '55 Sukhumvit Soi 55', created_at: new Date(Date.now()-600000).toISOString() },
  { id: 'CTB-E5F6', branch_name: 'Main Branch — Siam', total_amount: 335, status: 'READY', order_type: 'preorder', items: JSON.stringify([{name:'Taro Milk Tea',qty:1,price:105,options:{sweetness:'extra',ice:'no ice'}},{name:'Yuzu Matcha',qty:1,price:125,options:{sweetness:'regular',ice:'less ice'}},{name:'Brown Sugar Boba',qty:1,price:105,options:{sweetness:'extra',ice:'extra ice'}}]), payment_method: 'transfer', created_at: new Date(Date.now()-1200000).toISOString() },
  { id: 'CTB-G7H8', branch_name: 'Ari Branch', total_amount: 120, status: 'COMPLETED', order_type: 'pickup', items: JSON.stringify([{name:'White Peach Oolong',qty:1,price:120,options:{sweetness:'regular',ice:'regular ice'}}]), payment_method: 'transfer', created_at: new Date(Date.now()-86400000).toISOString() },
];
const _mockMenu = [
  { id: 'm1', category_id: 'c1', name: 'White Peach Oolong', description: 'Single-origin Alishan oolong, cold-steeped 8 hrs with white peach', price: 120, is_available: true, is_bestseller: true, is_new: false, sort_order: 1 },
  { id: 'm2', category_id: 'c1', name: 'Hojicha Latte', description: 'Roasted Japanese green tea with oat milk foam', price: 110, is_available: true, is_bestseller: true, is_new: false, sort_order: 2 },
  { id: 'm3', category_id: 'c1', name: 'Yuzu Matcha', description: 'Ceremonial grade matcha, fresh yuzu citrus', price: 125, is_available: true, is_bestseller: false, is_new: true, sort_order: 3 },
  { id: 'm4', category_id: 'c2', name: 'Lychee Rose', description: 'Taiwan black tea with lychee and dried rose petals', price: 115, is_available: true, is_bestseller: false, is_new: true, sort_order: 1 },
  { id: 'm5', category_id: 'c2', name: 'Brown Sugar Boba', description: 'Freshly made tapioca pearls in tiger milk tea', price: 105, is_available: true, is_bestseller: true, is_new: false, sort_order: 2 },
  { id: 'm6', category_id: 'c3', name: 'Assam Milk Tea', description: 'Bold Assam with house-made brown sugar syrup', price: 95, is_available: false, is_bestseller: true, is_new: false, sort_order: 1 },
];
const _mockCats = [
  { id: 'c1', name: 'Signature Tea', sort_order: 1, is_active: true },
  { id: 'c2', name: 'Seasonal', sort_order: 2, is_active: true },
  { id: 'c3', name: 'Classic', sort_order: 3, is_active: true },
];

/* ══════════════════════════════════════════════════════
   window.API — public interface
   All functions return Promise<{success, ...}>
══════════════════════════════════════════════════════ */
window.API = {
    // ดึงรายชื่อสาขาทั้งหมดที่เปิดอยู่
  async getBranches() {
    if (BACKEND_MODE === 'supabase') {
      const branches = await sb.query('branches', { eq: { is_open: true }, select: '*', order: 'sort_order' });
      return { success: true, data: branches };
    }
    // Mock
    return { success: true, data: [{id:'BR001', name:'Main Branch — Siam'}, {id:'BR002', name:'Thonglor Branch'}] };
  },

  // ล็อกอินพนักงานหน้าร้าน POS
  async staffLogin(username, pin) {
    if (BACKEND_MODE === 'supabase') {
      // ทำการ Hash PIN ให้ตรงกับที่บันทึกในฐานข้อมูล
      const hashed = await _sha256(pin + 'CTB_SALT_2025');
      
      const res = await sb.query('staff', { 
        eq: { username: username, password_hash: hashed, is_active: true }, 
        select: 'id, username, name, role' 
      });
      
      if (res && res.length > 0) {
        return { success: true, staff: res[0] };
      }
      return { success: false, message: 'Username หรือ PIN ไม่ถูกต้อง / บัญชีถูกระงับ' };
    }
    
    // Mock
    await _delay(500);
    if(username === 'staff1' && pin === '1234') {
      return { success: true, staff: { id: 's1', username: 'staff1', name: 'Cashier 1', role: 'STAFF' }};
    }
    return { success: false, message: 'Invalid credentials' };
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
  
  /* ── AUTH ─────────────────────────────────────────── */
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
    await _delay();
    const u = _mockUsers.find(x => x.phone === phone);
    if (!u) return { success: false, message: 'No account found' };
    const user = { ...u };
    localStorage.setItem('ctb_user', JSON.stringify(user));
    return { success: true, user };
  },

  async register({ phone, email, name, hashedPassword }) {
    if (BACKEND_MODE === 'supabase') {
      const pseudoEmail = `${phone}@ceramic.internal`;
      const data = await sb.signUp(pseudoEmail, hashedPassword);
      if (data.error) return { success: false, message: data.error.message };
      const member = await sb.insert('members', { auth_id: data.user.id, phone, email, name, points: 50, tier: 'Bronze' });
      const user = { id: member[0].id, authId: data.user.id, name, phone, email, points: 50, tier: 'Bronze', token: data.access_token };
      localStorage.setItem('ctb_user', JSON.stringify(user));
      return { success: true, user };
    }
    await _delay(1000);
    const user = { id: 'u_'+Date.now(), phone, email, name, points: 50, tier: 'Bronze', token: 'mock_'+Date.now() };
    localStorage.setItem('ctb_user', JSON.stringify(user));
    return { success: true, user };
  },

  async forgotPassword(email) {
    if (BACKEND_MODE === 'supabase') { await sb.resetPassword(email); }
    await _delay(800);
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
    await _delay(400);
    return { success: true };
  },

  /* ── HR & ONBOARDING ────────────────────────────── */
  
  // 1. Admin สร้างตั๋วเชิญพนักงานใหม่
  async inviteStaff(data) {
    if (BACKEND_MODE === 'supabase') {
      const res = await sb.insert('staff', {
        username: data.username,
        email: data.email,
        name: data.name,
        role: data.role,
        onboarding_status: 'PENDING'
      });
      return { success: true, staff: res[0] };
    }
    return { success: true };
  },

  // 2. อัปโหลดเอกสาร / ลายเซ็น เข้า Bucket 'hr_docs'
  async uploadHrDoc(fileOrBlob, fileName) {
    if (BACKEND_MODE === 'supabase') {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/hr_docs/${fileName}`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}`, 'Content-Type': fileOrBlob.type || 'image/png' },
        body: fileOrBlob,
      });
      if (!res.ok) throw new Error('Upload failed');
      return `${SUPABASE_URL}/storage/v1/object/public/hr_docs/${fileName}`;
    }
    return 'https://via.placeholder.com/150';
  },

  // 3. พนักงานกดยืนยันการสมัคร (อัปเดตข้อมูล)
  async completeOnboarding(staffId, data) {
    if (BACKEND_MODE === 'supabase') {
      const passHash = await _sha256(data.password + 'CTB_SALT_2025');
      const pinHash = await _sha256(data.pin + 'CTB_SALT_2025');
      
      await sb.update('staff', {
        password_hash: passHash,
        pos_pin_hash: pinHash,
        id_card_url: data.idCardUrl,
        signature_url: data.signatureUrl,
        onboarding_status: 'COMPLETED'
      }, { id: staffId });
      return { success: true };
    }
    return { success: true };
  },

  /* ── ADMIN: SECURE LOGIN (ใช้ Supabase Auth) ────────────────────────── */
  async adminSecureLogin(email, password) {
    if (BACKEND_MODE === 'supabase') {
      // 1. ยิงไปที่ระบบ Authentication ของ Supabase โดยตรง (ปลอดภัย 100%)
      const res = await sb.signIn(email, password);
      
      if (res.error) {
        return { success: false, message: res.error.message || 'Invalid email or password' };
      }

      // 2. ล็อกอินสำเร็จ ได้ Token มา
      const adminUser = {
        id: res.user.id,
        email: res.user.email,
        token: res.access_token
      };

      // 3. เก็บ Token ไว้ใช้ดึงข้อมูล (ในระบบจริงควรเก็บใน HttpOnly Cookie แต่ LocalStorage ก็พอใช้ได้เบื้องต้น)
      localStorage.setItem('ctb_admin_token', res.access_token);
      localStorage.setItem('ctb_admin_user', JSON.stringify(adminUser));

      // **สำคัญมาก:** อัปเดต Headers ของ sb object ให้ใช้ Token ของ Admin แทน Anon Key
      // เพื่อให้สามารถทะลุ RLS policy ที่อนุญาตเฉพาะ Admin ได้
      sb.headers['Authorization'] = `Bearer ${res.access_token}`;

      return { success: true, admin: adminUser };
    }
    
    // MOCK DATA
    await _delay(800);
    if (email === 'admin@test.com' && password === '123456') {
      return { success: true, admin: { email: 'admin@test.com' } };
    }
    return { success: false, message: 'Invalid credentials.' };
  },

  /* ── ORDERS ───────────────────────────────────────── */
  async getAdminOrders() {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', { select: '*', order: 'created_at.desc', limit: 100 });
      return { success: true, data: orders };
    }
    await _delay(300);
    return { success: true, data: _mockOrders };
  },

  async updateOrderStatus(orderId, newStatus) {
    if (BACKEND_MODE === 'supabase') {
      await sb.update('orders', { status: newStatus }, { id: orderId });
    } else {
      const o = _mockOrders.find(x => x.id === orderId);
      if (o) o.status = newStatus;
    }
    await _delay(200);
    return { success: true };
  },

  /* ── ORDER CREATE (client) ────────────────────────── */
  async createOrder({ items, total, branch, type, userId, promoCode, disc, address, contactPhone, pickupTime }) {
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
        status: params.status || 'PENDING',
        delivery_address: address || null,
        delivery_phone: contactPhone || null,
        pickup_time: pickupTime || null,
      });
      return { success: true, id: order[0].id };
    }
    await _delay(1200);
    return { success: true, id: 'CTB-' + Date.now().toString(36).toUpperCase() };
  },

  async getOrderStatus(orderId) {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', { eq: { id: orderId }, select: '*' });
      const o = orders[0]; if (!o) return { success: false };
      return { success: true, status: o.status, etaMins: 10 };
    }
    await _delay(300);
    return { success: true, status: 'preparing', etaMins: 8 };
  },

  async getOrderHistory(userId) {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', { eq: { user_id: userId }, select: '*', order: 'created_at.desc' });
      return { success: true, data: orders };
    }
    return { success: true, data: [] };
  },

  /* ── KDS ORDERS ───────────────────────────────────── */
  async getKdsOrders() {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', { select: '*', order: 'created_at.asc', limit: 50 });
      return { success: true, data: orders.filter(o => ['PENDING','CONFIRMED','PREPARING'].includes(o.status)) };
    }
    await _delay(300);
    return { success: true, data: _mockOrders.filter(o => o.status !== 'COMPLETED') };
  },

  /* ── MEMBERS ──────────────────────────────────────── */
  async getAdminMembers() {
    if (BACKEND_MODE === 'supabase') {
      const members = await sb.query('members', { select: '*', order: 'created_at.desc' });
      return { success: true, data: members };
    }
    await _delay(300);
    return { success: true, data: _mockMembers };
  },

  async updateMemberPoints(memberId, newPoints) {
    if (BACKEND_MODE === 'supabase') {
      await sb.update('members', { points: newPoints }, { id: memberId });
    }
    await _delay(400);
    return { success: true };
  },

  /** Full member update: name, email, tier, points, is_active */
  async updateMemberFull(memberId, data) {
    if (BACKEND_MODE === 'supabase') {
      await sb.update('members', data, { id: memberId });
    } else {
      const m = _mockMembers.find(x => x.id === memberId);
      if (m) Object.assign(m, data);
    }
    await _delay(400);
    return { success: true };
  },

  async getMemberByPhone(phone) {
    if (BACKEND_MODE === 'supabase') {
      const res = await sb.query('members', { eq: { phone }, select: '*' });
      if (res && res.length > 0) return { success: true, member: res[0] };
      return { success: false, message: 'Member not found' };
    }
    await _delay(300);
    const m = _mockMembers.find(x => x.phone === phone);
    return m ? { success: true, member: m } : { success: false, message: 'Member not found' };
  },

  /* ── MENU ─────────────────────────────────────────── */
  async getMenu() {
    if (BACKEND_MODE === 'supabase') {
      const [products, categories, addons] = await Promise.all([
        sb.query('menu_items',  { select: '*', order: 'sort_order' }),
        sb.query('categories',  { select: '*', eq: { is_active: true }, order: 'sort_order' }),
        sb.query('addons',      { select: '*', eq: { is_active: true }, order: 'sort_order' }),
      ]);
      return {
        products,
        categories,
        customization: {
          sweetness: ['0%','25%','50%','Regular','Extra'],
          ice:       ['No ice','Less ice','Regular ice','Extra ice'],
          addons,
        },
      };
    }
    await _delay(500);
    // Build MENUS-compatible format from mock
    const items = _mockMenu.map(m => ({
      ...m,
      id: m.id, cat: _mockCats.find(c => c.id === m.category_id)?.name || 'Other',
      hot: m.is_bestseller, nw: m.is_new, ltd: false,
      rating: '4.8', rev: '200',
    }));
    return {
      products: items,
      categories: _mockCats,
      customization: {
        sweetness: ['0%','25%','50%','Regular','Extra'],
        ice: ['No ice','Less ice','Regular ice','Extra ice'],
        addons: [
          { id:'a1', name:'Snow Cheese Foam', price:25 },
          { id:'a2', name:'Brown Sugar Boba', price:15 },
          { id:'a3', name:'Grass Jelly',      price:10 },
          { id:'a4', name:'Lychee Jelly',     price:15 },
          { id:'a5', name:'Oat Milk Upgrade', price:15 },
        ],
      },
    };
  },

  async addMenuItem(data) {
    if (BACKEND_MODE === 'supabase') {
      const res = await sb.insert('menu_items', data);
      return { success: true, item: res[0] };
    }
    const item = { id: 'm_'+Date.now(), ...data, is_available: true };
    _mockMenu.push(item);
    return { success: true, item };
  },

  async updateMenuItem(id, data) {
    if (BACKEND_MODE === 'supabase') {
      await sb.update('menu_items', data, { id });
    } else {
      const m = _mockMenu.find(x => x.id === id);
      if (m) Object.assign(m, data);
    }
    return { success: true };
  },

  async updateMenuAvailability(id, isAvailable) {
    if (BACKEND_MODE === 'supabase') {
      await sb.update('menu_items', { is_available: isAvailable }, { id });
    } else {
      const m = _mockMenu.find(x => x.id === id);
      if (m) m.is_available = isAvailable;
    }
    return { success: true };
  },

  /* ── PROMO CODES ──────────────────────────────────── */
  async getPromos() {
    if (BACKEND_MODE === 'supabase') {
      const promos = await sb.query('promo_codes', { select: '*', order: 'created_at.desc' });
      return { success: true, data: promos };
    }
    await _delay(300);
    const stored = localStorage.getItem('ctb_promos_admin');
    return { success: true, data: stored ? JSON.parse(stored) : [] };
  },

  async addPromo(data) {
    if (BACKEND_MODE === 'supabase') {
      const res = await sb.insert('promo_codes', {
        code: data.code, type: data.type, value: data.value,
        min_order: data.min_order || 0,
        max_uses: data.max_uses || null,
        expires_at: data.expires_at || null,
        description: data.description || '',
        is_active: true,
        used_count: 0,
      });
      return { success: true, promo: res[0] };
    }
    return { success: true };
  },

  async updatePromo(id, data) {
    if (BACKEND_MODE === 'supabase') {
      await sb.update('promo_codes', data, { id });
    }
    return { success: true };
  },

  async deletePromo(id) {
    if (BACKEND_MODE === 'supabase') {
      await sb.delete('promo_codes', { id });
    }
    return { success: true };
  },

  /** Validate promo for client use */
  async validatePromoCode({ code, subtotal }) {
    if (BACKEND_MODE === 'supabase') {
      const promos = await sb.query('promo_codes', { eq: { code: code.toUpperCase(), is_active: true }, select: '*' });
      const p = promos[0];
      if (!p) return { valid: false, message: 'Invalid promo code' };
      if (p.expires_at && new Date(p.expires_at) < new Date()) return { valid: false, message: 'Code has expired' };
      if (p.max_uses && p.used_count >= p.max_uses) return { valid: false, message: 'Code limit reached' };
      if (subtotal < (p.min_order || 0)) return { valid: false, message: `Min order ฿${p.min_order}` };
      const discount = p.type === 'percent' ? Math.round(subtotal * p.value / 100) : p.value;
      return { valid: true, discountAmount: discount, description: p.description };
    }
    // Mock
    await _delay(400);
    const codes = { 'NEW10': { pct: 10 }, 'CERAMIC50': { flat: 50 }, 'FREESHIP': { flat: 20 } };
    const promo = codes[code.toUpperCase()];
    if (!promo) return { valid: false, message: 'Invalid code' };
    const discount = promo.flat || Math.round(subtotal * promo.pct / 100);
    return { valid: true, discountAmount: discount, description: 'Discount applied' };
  },

  /* ── STORE STATUS ─────────────────────────────────── */
  async setStoreStatus(isOpen) {
    if (BACKEND_MODE === 'supabase') {
      // Uses a store_config table (optional — add to schema)
      try {
        await sb.update('store_config', { value: String(isOpen) }, { key: 'is_open' });
      } catch(e) {
        // Table may not exist — silently fall back to localStorage only
      }
    }
    localStorage.setItem('ctb_shop_open', String(isOpen));
    return { success: true };
  },

  async getStoreStatus() {
    if (BACKEND_MODE === 'supabase') {
      try {
        const res = await sb.query('store_config', { eq: { key: 'is_open' }, select: '*' });
        if (res && res[0]) return { isOpen: res[0].value === 'true' };
      } catch(e) {}
    }
    const stored = localStorage.getItem('ctb_shop_open');
    return { isOpen: stored === null ? true : stored === 'true' };
  },
};

/* ── BACKWARD COMPAT (client uses window.MENUS) ─────── */
// Populate MENUS global for client-side mock rendering
if (typeof MENUS === 'undefined') {
  window.MENUS = [
    {id:'m1',cat:'Signature Tea',name:'White Peach Oolong',desc:'Single-origin Alishan oolong, cold-steeped 8 hrs with white peach',price:120,hot:true,nw:false,ltd:false,rating:'4.9',rev:'1.2k',today:'82 cups'},
    {id:'m2',cat:'Signature Tea',name:'Hojicha Latte',desc:'Roasted Japanese green tea with oat milk foam',price:110,hot:true,nw:false,ltd:false,rating:'4.8',rev:'980',today:'67 cups'},
    {id:'m3',cat:'Signature Tea',name:'Yuzu Matcha',desc:'Ceremonial grade matcha, fresh yuzu citrus',price:125,hot:false,nw:true,ltd:false,rating:'4.9',rev:'240'},
    {id:'m4',cat:'Seasonal',name:'Lychee Rose',desc:'Taiwan black tea with lychee and dried rose petals',price:115,hot:false,nw:true,ltd:true,rating:'4.9',rev:'180',today:'Limited'},
    {id:'m5',cat:'Seasonal',name:'Brown Sugar Boba',desc:'Freshly made tapioca pearls in tiger milk tea',price:105,hot:true,nw:false,ltd:false,rating:'4.7',rev:'2.1k'},
    {id:'m6',cat:'Classic',name:'Longjing Green',desc:'Premium Dragon Well, delicate and grassy',price:130,hot:false,nw:false,ltd:false,rating:'4.8',rev:'560'},
    {id:'m7',cat:'Classic',name:'Assam Milk Tea',desc:'Bold Assam with house-made brown sugar syrup',price:95,hot:true,nw:false,ltd:false,rating:'4.6',rev:'3.2k'},
    {id:'m8',cat:'Classic',name:'Taro Milk Tea',desc:'Rich taro paste, oat milk, brown sugar boba',price:105,hot:true,nw:false,ltd:false,rating:'4.8',rev:'4.1k'},
  ];
}
