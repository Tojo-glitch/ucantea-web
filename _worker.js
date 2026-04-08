export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ถ้า Browser เรียกขอไฟล์ /env-config.js
    if (url.pathname === '/env-config.js') {
      // สร้างเนื้อหาไฟล์ JS ขึ้นมาใหม่ พร้อมใส่ค่าจาก Environment Variables
      const js = `
window.ENV = {
  URL: "${env.SUPABASE_URL || ''}",
  KEY: "${env.SUPABASE_ANON_KEY || ''}"
};
      `.trim();
      
      return new Response(js, {
        headers: { 'Content-Type': 'application/javascript' },
      });
    }

    // ถ้าเรียกไฟล์อื่นๆ (index.html, รูปภาพ, api.js) ให้ส่งไฟล์ปกติจาก GitHub ไป
    return env.ASSETS.fetch(request);
  },
};
