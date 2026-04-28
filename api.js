/**
 * api.js
 * CERAMIC API ADAPTER
 * FULL FIX + Production Hardening
 * Ready to Deploy
 *
 * Version: 2.0.0
 */

(function () {
  'use strict';

  /* ======================================================
     ENV
  ====================================================== */
  const BACKEND_MODE = 'supabase';
  const ENV = window.ENV || {};

  const SUPABASE_URL = ENV.URL || '';
  const SUPABASE_KEY = ENV.KEY || '';

  const DEBUG =
    window.isDev === true ||
    location.hostname === 'localhost' ||
    location.search.includes('debug=1');

  const TIMEOUT = 12000;
  const RETRY = 1;

  /* ======================================================
     LOGGER
  ====================================================== */
  const log = (...a) => DEBUG && console.log('[API]', ...a);
  const warn = (...a) => DEBUG && console.warn('[API]', ...a);
  const err = (...a) => DEBUG && console.error('[API]', ...a);

  /* ======================================================
     SAFE STORAGE
  ====================================================== */
  const storage = {
    get(key, fallback = null) {
      try {
        const val = localStorage.getItem(key);
        if (val == null) return fallback;
        return JSON.parse(val);
      } catch {
        return fallback;
      }
    },

    getRaw(key, fallback = null) {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(
          key,
          typeof value === 'string' ? value : JSON.stringify(value)
        );
      } catch (e) {
        warn('storage set fail', key, e);
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
  };

  /* ======================================================
     HELPERS
  ====================================================== */
  function success(data = {}) {
    return { success: true, ...data };
  }

  function fail(message = 'Unknown error', extra = {}) {
    return { success: false, message, ...extra };
  }

  async function sha256(str) {
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(str)
    );

    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function getToken() {
    return (
      storage.getRaw('ctb_admin_token') ||
      storage.getRaw('ctb_token') ||
      SUPABASE_KEY
    );
  }

  function headers(extra = {}) {
    return {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...extra
    };
  }

  async function request(url, options = {}, retry = RETRY) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);

    try {
      const res = await fetch(url, {
        ...options,
        signal: ctrl.signal
      });

      return res;
    } catch (e) {
      if (retry > 0) {
        return request(url, options, retry - 1);
      }

      if (e.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ======================================================
     SUPABASE CORE
  ====================================================== */
  const sb = {
    async query(table, p = {}) {
      let url = `${SUPABASE_URL}/rest/v1/${table}?`;

      if (p.select) url += `select=${encodeURIComponent(p.select)}&`;

      if (p.eq) {
        Object.entries(p.eq).forEach(([k, v]) => {
          url += `${k}=eq.${encodeURIComponent(v)}&`;
        });
      }

      if (p.order) url += `order=${p.order}&`;
      if (p.limit) url += `limit=${p.limit}&`;

      const res = await request(url, { headers: headers() });

      if (!res.ok) throw new Error(await res.text());

      return await res.json();
    },

   // ใน api (9).js ส่วนของ sb.insert
async insert(table, data) {
  console.log('Sending data to:', table, data); // เช็กว่าข้อมูลที่จะส่งหน้าตาเป็นยังไง
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Supabase Error:', errorText); // ดูว่า Supabase ด่าเราว่าอะไร
      throw new Error(errorText);
    }
    return true;
  } catch (e) {
    console.error('Fetch Error:', e);
    throw e;
  }
}

    async update(table, data, eq = {}) {
      let url = `${SUPABASE_URL}/rest/v1/${table}?`;

      Object.entries(eq).forEach(([k, v]) => {
        url += `${k}=eq.${encodeURIComponent(v)}&`;
      });

      const res = await request(url, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(data)
      });

      if (!res.ok) throw new Error(await res.text());

      return await res.json();
    }

    async delete(table, eq = {}) {
      let url = `${SUPABASE_URL}/rest/v1/${table}?`;

      Object.entries(eq).forEach(([k, v]) => {
        url += `${k}=eq.${encodeURIComponent(v)}&`;
      });

      const res = await request(url, {
        method: 'DELETE',
        headers: headers()
      });

      if (!res.ok) throw new Error(await res.text());

      return true;
    },

    async signIn(email, password) {
      const res = await request(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ email, password })
        }
      );

      const data = await res.json();
      if (!res.ok) return { error: data };

      return data;
    },

    async signUp(email, password) {
      const res = await request(
        `${SUPABASE_URL}/auth/v1/signup`,
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ email, password })
        }
      );
    
      const data = await res.json();
    
      if (!res.ok) {
        throw new Error(data?.msg || data?.error_description || 'Signup failed');
      }
    
      return data;
    },

    async signOut(token) {
      await request(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          ...headers(),
          Authorization: `Bearer ${token}`
        }
      });
    }
  };

  /* ======================================================
     API
  ====================================================== */
  window.API = {
    SSE_BASE: SUPABASE_URL
      ? `${SUPABASE_URL}/functions/v1`
      : null,

    /* ================= AUTH ================= */

    async login({ phone, hashedPassword }) {
      try {
        const email = `${phone}@ceramic.app`;

        const data = await sb.signIn(email, hashedPassword);

        if (data.error) {
          return fail('เข้าสู่ระบบไม่สำเร็จ');
        }

        const rows = await sb.query('members', {
          eq: { auth_id: data.user.id },
          select: '*'
        });

        const user = rows[0];

        if (!user) return fail('ไม่พบบัญชี');

        const session = {
          id: user.id,
          authId: data.user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          points: user.points || 0,
          tier: user.tier || 'Bronze',
          token: data.access_token
        };

        storage.set('ctb_user', session);
        storage.set('ctb_token', data.access_token);

        return success({ user: session });
      } catch (e) {
        err(e);
        return fail(e.message);
      }
    },

    async register({ phone, email, name, hashedPassword }) {
  try {
    const pseudo = `${phone}@ceramic.app`;
    const auth = await sb.signUp(pseudo, hashedPassword);

    // ตรวจสอบว่ามี error จาก Supabase หรือไม่
    if (auth.error) {
      // ถ้าซ้ำ
      if (auth.error.code === 'user_already_exists' ||
          auth.error.message?.includes('already registered')) {
        return fail('เบอร์นี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ');
      }
      return fail(auth.error.message || 'สมัครสมาชิกไม่สำเร็จ');
    }

    const authId = auth?.user?.id || auth?.id || auth?.data?.user?.id;
    if (!authId) {
      return fail('สมัครสมาชิกไม่สำเร็จ');
    }

    await sb.insert('members', {
      auth_id: authId,
      phone,
      email,
      name,
      points: 50,
      tier: 'Bronze'
    });

    return success();
  } catch (e) {
    return fail(e.message);
  }
},

    async logout() {
      try {
        const token = storage.getRaw('ctb_token');

        if (token) await sb.signOut(token);
      } catch {}

      storage.remove('ctb_user');
      storage.remove('ctb_token');
      storage.remove('ctb_admin_user');
      storage.remove('ctb_admin_token');

      return success();
    },

    /* ================= ORDERS ================= */

    async createOrder(payload) {
      try {
        const rows = await sb.insert('orders', {
          user_id: payload.userId || null,
          items: JSON.stringify(payload.items || []),
          total_amount: payload.total || 0,
          branch_id: payload.branch?.id || null,
          branch_name: payload.branch?.name || null,
          order_type: payload.type || 'pickup',
          payment_method: 'transfer',
          promo_code: payload.promoCode || null,
          discount: payload.disc || 0,
          status: payload.status || 'PENDING',
          delivery_address:
            payload.delivery_address || null,
          delivery_phone:
            payload.delivery_phone || null,
          pickup_time:
            payload.pickup_time || null,
          slip_url: payload.slipUrl || null,
          source: 'CLIENT'
        });

        const order = rows?.[0];

        return success({
          id: order?.id,
          queue_number: order?.queue_number
        });
      } catch (e) {
        return fail(e.message);
      }
    },

    async getOrderHistory(userId) {
      try {
        const data = await sb.query('orders', {
          eq: { user_id: userId },
          select: '*',
          order: 'created_at.desc'
        });

        return success({ data });
      } catch (e) {
        return fail(e.message);
      }
    },

    async updateOrderStatus(id, status) {
      try {
        await sb.update(
          'orders',
          { status },
          { id }
        );

        return success();
      } catch (e) {
        return fail(e.message);
      }
    },

    /* ================= MENU ================= */

    async getMenu() {
      try {
        const [products, categories, addons] =
          await Promise.all([
            sb.query('menu_items', {
              select: '*',
              order: 'sort_order'
            }),
            sb.query('categories', {
              select: '*',
              eq: { is_active: true },
              order: 'sort_order'
            }),
            sb.query('addons', {
              select: '*',
              eq: { is_active: true },
              order: 'sort_order'
            })
          ]);

        return {
          products,
          categories,
          customization: {
            sweetness: [
              '0%',
              '25%',
              '50%',
              'Regular',
              'Extra'
            ],
            ice: [
              'No ice',
              'Less ice',
              'Regular ice',
              'Extra ice'
            ],
            addons
          }
        };
      } catch (e) {
        return {
          products: [],
          categories: [],
          customization: {}
        };
      }
    },

    async getPromos() {
      try {
        const data = await sb.query('promo_codes', {
          select: '*',
          order: 'created_at.desc'
        });

        return success({ data });
      } catch (e) {
        return fail(e.message);
      }
    },

    async getBanners() {
      try {
        const banners = await sb.query('banners', {
          select: '*',
          eq: { is_active: true },
          order: 'sort_order',
          limit: 5
        });

        return success({ banners });
      } catch {
        return success({ banners: [] });
      }
    },

    async getBranches() {
      try {
        const data = await sb.query('branches', {
          select: 'id,name',
          order: 'sort_order'
        });

        return success({ data });
      } catch (e) {
        return fail(e.message);
      }
    },

    /* ================= MEMBERS ================= */

    async updatePoints({ userId, points }) {
      try {
        await sb.update(
          'members',
          { points },
          { auth_id: userId }
        );

        return success();
      } catch (e) {
        return fail(e.message);
      }
    },

    async getMemberByPhone(phone) {
      try {
        const rows = await sb.query('members', {
          eq: { phone },
          select: '*'
        });

        if (!rows.length) return fail('ไม่พบสมาชิก');

        return success({ member: rows[0] });
      } catch (e) {
        return fail(e.message);
      }
    },

    /* ================= STAFF ================= */

    async staffLogin(username, pin) {
      try {
        const hash = await sha256(
          pin + 'CTB_SALT_2025'
        );

        const rows = await sb.query('staff', {
          eq: {
            username,
            pos_pin_hash: hash,
            is_active: true
          },
          select:
            'id,username,name,role,branch_id'
        });

        if (!rows.length) {
          return fail('PIN ไม่ถูกต้อง');
        }

        return success({ staff: rows[0] });
      } catch (e) {
        return fail(e.message);
      }
    },

    async verifyManagerPin(pin) {
      try {
        const hash = await sha256(
          pin + 'CTB_SALT_2025'
        );

        const rows = await sb.query('staff', {
          eq: {
            pos_pin_hash: hash,
            is_active: true
          },
          select: 'id,name,role'
        });

        const u = rows[0];

        if (
          u &&
          ['MANAGER', 'ADMIN'].includes(u.role)
        ) {
          return success({
            managerName: u.name
          });
        }

        return fail('ไม่ผ่านสิทธิ์');
      } catch (e) {
        return fail(e.message);
      }
    },

    /* ================= STORE ================= */

    async getStoreStatus() {
      const s = storage.getRaw('ctb_shop_open');

      return {
        isOpen: s == null ? true : s === 'true'
      };
    },

    async setStoreStatus(isOpen) {
      storage.set(
        'ctb_shop_open',
        String(isOpen)
      );

      return success();
    },

    /* ================= UTIL ================= */

    async track(payload) {
      try {
        await sb.insert('analytics_events', {
          event_name: payload.event,
          properties: JSON.stringify(payload),
          created_at:
            new Date().toISOString()
        });
      } catch {}

      return success();
    },

    async hash(text) {
      return sha256(text);
    }
  };

  log('API Loaded v2.0.0');
})();
