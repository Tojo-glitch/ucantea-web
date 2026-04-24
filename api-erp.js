/**
 * CERAMIC — ERP & ADVANCED POS MODULE
 * ═══════════════════════════════════════════════════════════════
 * Full ERP System: Inventory, Procurement, Accounting, HR, Analytics
 * Load AFTER api.js - extends window.API with enterprise features
 */

/* ═══════════════════════════════════════════════════════════════
   INVENTORY MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

window.API = window.API || {};

// ── INVENTORY CORE ────────────────────────────────────────────
window.API.Inventory = {
  /**
   * Get current stock levels for all items
   * @param {string} branchId - Optional branch filter
   */
  async getStockLevels(branchId = null) {
    if (BACKEND_MODE === 'supabase') {
      let params = { select: '*', order: 'updated_at.desc' };
      if (branchId) params.eq = { branch_id: branchId };
      
      const stock = await sb.query('inventory_stock', params);
      return { success: true, data: stock };
    }
    return { success: true, data: [] };
  },

  /**
   * Get low stock alerts
   * @param {number} threshold - Minimum quantity alert level
   */
  async getLowStockAlerts(threshold = 10) {
    if (BACKEND_MODE === 'supabase') {
      const stock = await sb.query('inventory_stock', { 
        select: '*, products(name)', 
        order: 'quantity.asc' 
      });
      const lowStock = stock.filter(item => item.quantity <= threshold);
      return { success: true, data: lowStock, threshold };
    }
    return { success: true, data: [], threshold };
  },

  /**
   * Update stock quantity
   * @param {string} itemId - Product/item ID
   * @param {number} quantity - New quantity
   * @param {string} reason - Adjustment reason (SALE, RECEIPT, DAMAGE, TRANSFER)
   */
  async updateStock(itemId, quantity, reason, branchId = null) {
    if (BACKEND_MODE === 'supabase') {
      const adjustment = {
        item_id: itemId,
        quantity_change: quantity,
        reason: reason,
        branch_id: branchId,
        created_at: new Date().toISOString()
      };
      
      // Log adjustment
      await sb.insert('inventory_adjustments', adjustment);
      
      // Update current stock
      const eq = { item_id: itemId };
      if (branchId) eq.branch_id = branchId;
      
      const current = await sb.query('inventory_stock', { eq });
      if (current && current.length > 0) {
        const newQty = Math.max(0, current[0].quantity + quantity);
        await sb.update('inventory_stock', { quantity: newQty }, eq);
      } else {
        await sb.insert('inventory_stock', { 
          item_id: itemId, 
          branch_id: branchId, 
          quantity: Math.max(0, quantity) 
        });
      }
      
      return { success: true, newQuantity: quantity };
    }
    return { success: true };
  },

  /**
   * Stock transfer between branches
   */
  async transferStock(fromBranch, toBranch, itemId, quantity, notes = '') {
    if (BACKEND_MODE === 'supabase') {
      // Deduct from source
      await this.updateStock(itemId, -quantity, 'TRANSFER_OUT', fromBranch);
      
      // Add to destination
      await this.updateStock(itemId, quantity, 'TRANSFER_IN', toBranch);
      
      // Log transfer
      await sb.insert('inventory_transfers', {
        from_branch_id: fromBranch,
        to_branch_id: toBranch,
        item_id: itemId,
        quantity: quantity,
        notes: notes,
        status: 'COMPLETED'
      });
      
      return { success: true };
    }
    return { success: true };
  },

  /**
   * Get inventory valuation report
   */
  async getValuationReport(branchId = null) {
    if (BACKEND_MODE === 'supabase') {
      let eq = {};
      if (branchId) eq.branch_id = branchId;
      
      const stock = await sb.query('inventory_stock', { 
        eq, 
        select: '*, products(cost_price, name)' 
      });
      
      const valuation = stock.reduce((acc, item) => {
        const costPrice = item.products?.cost_price || 0;
        acc.totalValue += item.quantity * costPrice;
        acc.items.push({
          ...item,
          value: item.quantity * costPrice,
          costPrice
        });
        return acc;
      }, { totalValue: 0, items: [], branchId });
      
      return { success: true, data: valuation };
    }
    return { success: true, data: { totalValue: 0, items: [] } };
  }
};

/* ═══════════════════════════════════════════════════════════════
   PROCUREMENT & SUPPLIER MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

window.API.Procurement = {
  /**
   * Get all suppliers
   */
  async getSuppliers() {
    if (BACKEND_MODE === 'supabase') {
      const suppliers = await sb.query('suppliers', { 
        select: '*', 
        order: 'name.asc' 
      });
      return { success: true, data: suppliers };
    }
    return { success: true, data: [] };
  },

  /**
   * Create purchase order
   */
  async createPurchaseOrder(supplierId, items, branchId, expectedDate, notes = '') {
    if (BACKEND_MODE === 'supabase') {
      const po = await sb.insert('purchase_orders', {
        supplier_id: supplierId,
        branch_id: branchId,
        items: JSON.stringify(items),
        total_amount: items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0),
        status: 'PENDING',
        expected_delivery_date: expectedDate,
        notes: notes,
        created_by: localStorage.getItem('ctb_admin_user') ? JSON.parse(localStorage.getItem('ctb_admin_user')).id : null
      });
      
      return { success: true, id: po[0].id };
    }
    return { success: true, id: 'PO-' + Date.now() };
  },

  /**
   * Receive purchase order (update inventory)
   */
  async receivePurchaseOrder(poId, receivedItems = null) {
    if (BACKEND_MODE === 'supabase') {
      const poList = await sb.query('purchase_orders', { 
        eq: { id: poId }, 
        select: '*' 
      });
      
      if (!poList || poList.length === 0) {
        return { success: false, message: 'PO not found' };
      }
      
      const po = poList[0];
      const items = receivedItems || JSON.parse(po.items);
      
      // Update inventory for each item
      for (const item of items) {
        await window.API.Inventory.updateStock(
          item.product_id, 
          item.quantity, 
          'PURCHASE_RECEIPT',
          po.branch_id
        );
      }
      
      // Update PO status
      await sb.update('purchase_orders', { 
        status: 'RECEIVED',
        received_date: new Date().toISOString()
      }, { id: poId });
      
      return { success: true };
    }
    return { success: true };
  },

  /**
   * Get pending purchase orders
   */
  async getPendingPOs() {
    if (BACKEND_MODE === 'supabase') {
      const pos = await sb.query('purchase_orders', { 
        eq: { status: 'PENDING' },
        select: '*, suppliers(name)',
        order: 'created_at.desc'
      });
      return { success: true, data: pos };
    }
    return { success: true, data: [] };
  }
};

/* ═══════════════════════════════════════════════════════════════
   ACCOUNTING & FINANCIAL REPORTS
   ═══════════════════════════════════════════════════════════════ */

window.API.Accounting = {
  /**
   * Get daily sales summary
   */
  async getDailySales(date, branchId = null) {
    if (BACKEND_MODE === 'supabase') {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      let eq = { 
        created_at: `gte.${startOfDay.toISOString()}`,
        created_at: `lte.${endOfDay.toISOString()}`
      };
      if (branchId) eq.branch_id = branchId;
      
      const orders = await sb.query('orders', { 
        eq, 
        select: '*' 
      });
      
      const summary = orders.reduce((acc, order) => {
        acc.totalOrders++;
        acc.totalRevenue += order.total_amount || 0;
        acc.byType[order.order_type] = (acc.byType[order.order_type] || 0) + 1;
        acc.byPayment[order.payment_method] = (acc.byPayment[order.payment_method] || 0) + 1;
        return acc;
      }, { 
        totalOrders: 0, 
        totalRevenue: 0, 
        byType: {}, 
        byPayment: {},
        date 
      });
      
      return { success: true, data: summary };
    }
    return { success: true, data: { totalOrders: 0, totalRevenue: 0, byType: {}, byPayment: {} } };
  },

  /**
   * Get monthly P&L summary
   */
  async getMonthlyPL(year, month) {
    if (BACKEND_MODE === 'supabase') {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      // Get revenue
      const orders = await sb.query('orders', {
        eq: {
          created_at: `gte.${startDate.toISOString()}`,
          created_at: `lte.${endDate.toISOString()}`
        },
        select: 'total_amount, status'
      });
      
      const revenue = orders
        .filter(o => o.status !== 'CANCELLED')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);
      
      // Get COGS (from inventory adjustments)
      const adjustments = await sb.query('inventory_adjustments', {
        eq: {
          created_at: `gte.${startDate.toISOString()}`,
          created_at: `lte.${endDate.toISOString()}`
        },
        select: '*'
      });
      
      const cogs = adjustments
        .filter(a => ['SALE'].includes(a.reason))
        .reduce((sum, a) => sum + Math.abs(a.quantity) * (a.cost_price || 0), 0);
      
      // Get expenses
      const expenses = await sb.query('expenses', {
        eq: {
          date: `gte.${startDate.toISOString()}`,
          date: `lte.${endDate.toISOString()}`
        },
        select: 'amount'
      });
      
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      
      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - totalExpenses;
      
      return {
        success: true,
        data: {
          year,
          month,
          revenue,
          cogs,
          grossProfit,
          expenses: totalExpenses,
          netProfit,
          margin: revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : 0
        }
      };
    }
    return { 
      success: true, 
      data: { year, month, revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, margin: 0 } 
    };
  },

  /**
   * Record expense
   */
  async recordExpense(category, amount, description, date, branchId = null, receiptUrl = null) {
    if (BACKEND_MODE === 'supabase') {
      await sb.insert('expenses', {
        category: category,
        amount: amount,
        description: description,
        date: date,
        branch_id: branchId,
        receipt_url: receiptUrl,
        created_by: localStorage.getItem('ctb_admin_user') ? JSON.parse(localStorage.getItem('ctb_admin_user')).id : null
      });
      return { success: true };
    }
    return { success: true };
  },

  /**
   * Get cash flow statement
   */
  async getCashFlow(startDate, endDate) {
    if (BACKEND_MODE === 'supabase') {
      // Cash In (from orders)
      const orders = await sb.query('orders', {
        eq: {
          created_at: `gte.${startDate.toISOString()}`,
          created_at: `lte.${endDate.toISOString()}`,
          status: 'COMPLETED'
        },
        select: 'total_amount, payment_method, created_at'
      });
      
      const cashIn = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      
      // Cash Out (expenses)
      const expenses = await sb.query('expenses', {
        eq: {
          date: `gte.${startDate.toISOString()}`,
          date: `lte.${endDate.toISOString()}`
        },
        select: 'amount'
      });
      
      const cashOut = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      
      return {
        success: true,
        data: {
          startDate,
          endDate,
          cashIn,
          cashOut,
          netCashFlow: cashIn - cashOut
        }
      };
    }
    return { success: true, data: { cashIn: 0, cashOut: 0, netCashFlow: 0 } };
  }
};

/* ═══════════════════════════════════════════════════════════════
   HR & PAYROLL MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

window.API.HR = {
  /**
   * Get staff attendance records
   */
  async getAttendance(staffId, startDate, endDate) {
    if (BACKEND_MODE === 'supabase') {
      let eq = {
        date: `gte.${startDate}`,
        date: `lte.${endDate}`
      };
      if (staffId) eq.staff_id = staffId;
      
      const records = await sb.query('attendance', { 
        eq, 
        select: '*',
        order: 'date.desc'
      });
      return { success: true, data: records };
    }
    return { success: true, data: [] };
  },

  /**
   * Record attendance (clock in/out)
   */
  async recordAttendance(staffId, type, timestamp = null) {
    if (BACKEND_MODE === 'supabase') {
      const now = timestamp || new Date().toISOString();
      const date = now.split('T')[0];
      
      // Check if already recorded today
      const existing = await sb.query('attendance', {
        eq: { staff_id: staffId, date: date },
        select: '*'
      });
      
      if (type === 'CLOCK_IN') {
        if (existing && existing.length > 0) {
          return { success: false, message: 'Already clocked in today' };
        }
        
        await sb.insert('attendance', {
          staff_id: staffId,
          date: date,
          clock_in: now,
          status: 'PRESENT'
        });
      } else if (type === 'CLOCK_OUT') {
        if (!existing || existing.length === 0) {
          return { success: false, message: 'No clock-in record found' };
        }
        
        await sb.update('attendance', {
          clock_out: now
        }, { staff_id: staffId, date: date });
      }
      
      return { success: true };
    }
    return { success: true };
  },

  /**
   * Calculate payroll for period
   */
  async calculatePayroll(staffId, periodStart, periodEnd) {
    if (BACKEND_MODE === 'supabase') {
      // Get staff info
      const staffList = await sb.query('staff', {
        eq: staffId ? { id: staffId } : { is_active: true },
        select: '*'
      });
      
      const payroll = [];
      
      for (const staff of staffList) {
        // Get attendance
        const attendance = await this.getAttendance(staff.id, periodStart, periodEnd);
        
        const workDays = attendance.data.filter(a => a.status === 'PRESENT').length;
        const lateDays = attendance.data.filter(a => a.is_late).length;
        
        // Calculate salary
        const baseSalary = staff.base_salary || 0;
        const dailyRate = baseSalary / 22; // Assuming 22 work days
        const earnedSalary = dailyRate * workDays;
        
        // Deductions
        const lateDeduction = lateDays * 50; // Example: 50 THB per late day
        
        payroll.push({
          staff_id: staff.id,
          staff_name: staff.name,
          period_start: periodStart,
          period_end: periodEnd,
          work_days: workDays,
          late_days: lateDays,
          base_salary: baseSalary,
          earned_salary: earnedSalary,
          deductions: lateDeduction,
          net_salary: earnedSalary - lateDeduction,
          status: 'PENDING'
        });
      }
      
      return { success: true, data: payroll };
    }
    return { success: true, data: [] };
  },

  /**
   * Process payroll payment
   */
  async processPayroll(payrollId) {
    if (BACKEND_MODE === 'supabase') {
      await sb.update('payroll', {
        status: 'PAID',
        paid_at: new Date().toISOString()
      }, { id: payrollId });
      
      return { success: true };
    }
    return { success: true };
  }
};

/* ═══════════════════════════════════════════════════════════════
   BUSINESS INTELLIGENCE & ANALYTICS
   ═══════════════════════════════════════════════════════════════ */

window.API.Analytics = {
  /**
   * Get dashboard KPIs
   */
  async getDashboardKPIs(branchId = null) {
    if (BACKEND_MODE === 'supabase') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Today's sales
      const todaySales = await this.getDailySales(today.toISOString(), branchId);
      
      // This month's sales
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthSales = await window.API.Accounting.getMonthlyPL(
        today.getFullYear(), 
        today.getMonth() + 1
      );
      
      // Customer count
      const members = await sb.query('members', { select: 'id' });
      
      // Low stock count
      const lowStock = await window.API.Inventory.getLowStockAlerts(10);
      
      // Pending orders
      const pendingOrders = await sb.query('orders', {
        eq: branchId ? { branch_id: branchId, status: 'PENDING' } : { status: 'PENDING' },
        select: 'id'
      });
      
      return {
        success: true,
        data: {
          todayRevenue: todaySales.data.totalRevenue,
          todayOrders: todaySales.data.totalOrders,
          monthRevenue: monthSales.data.revenue,
          monthProfit: monthSales.data.netProfit,
          totalCustomers: members.length,
          lowStockItems: lowStock.data.length,
          pendingOrders: pendingOrders.length,
          asOf: new Date().toISOString()
        }
      };
    }
    return { 
      success: true, 
      data: {
        todayRevenue: 0,
        todayOrders: 0,
        monthRevenue: 0,
        monthProfit: 0,
        totalCustomers: 0,
        lowStockItems: 0,
        pendingOrders: 0
      }
    };
  },

  /**
   * Get sales trend (daily for last 30 days)
   */
  async getSalesTrend(days = 30, branchId = null) {
    if (BACKEND_MODE === 'supabase') {
      const trend = [];
      const today = new Date();
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayData = await this.getDailySales(date.toISOString(), branchId);
        
        trend.push({
          date: date.toISOString().split('T')[0],
          revenue: dayData.data.totalRevenue,
          orders: dayData.data.totalOrders
        });
      }
      
      return { success: true, data: trend };
    }
    return { success: true, data: [] };
  },

  /**
   * Get top selling products
   */
  async getTopProducts(limit = 10, startDate, endDate) {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', {
        eq: {
          created_at: `gte.${startDate.toISOString()}`,
          created_at: `lte.${endDate.toISOString()}`,
          status: 'COMPLETED'
        },
        select: 'items'
      });
      
      const productSales = {};
      
      orders.forEach(order => {
        const items = JSON.parse(order.items || '[]');
        items.forEach(item => {
          if (!productSales[item.product_id]) {
            productSales[item.product_id] = {
              product_id: item.product_id,
              product_name: item.name,
              quantity: 0,
              revenue: 0
            };
          }
          productSales[item.product_id].quantity += item.quantity || 0;
          productSales[item.product_id].revenue += (item.quantity || 0) * (item.price || 0);
        });
      });
      
      const topProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
      
      return { success: true, data: topProducts };
    }
    return { success: true, data: [] };
  },

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics() {
    if (BACKEND_MODE === 'supabase') {
      const members = await sb.query('members', { select: '*' });
      
      const tierDistribution = members.reduce((acc, m) => {
        acc[m.tier] = (acc[m.tier] || 0) + 1;
        return acc;
      }, {});
      
      const avgPoints = members.reduce((sum, m) => sum + (m.points || 0), 0) / (members.length || 1);
      
      const activeCustomers = members.filter(m => m.is_active).length;
      
      return {
        success: true,
        data: {
          totalCustomers: members.length,
          activeCustomers,
          tierDistribution,
          averagePoints: Math.round(avgPoints),
          byTier: tierDistribution
        }
      };
    }
    return { 
      success: true, 
      data: { totalCustomers: 0, activeCustomers: 0, tierDistribution: {}, averagePoints: 0 } 
    };
  }
};

/* ═══════════════════════════════════════════════════════════════
   ADVANCED POS FEATURES
   ═══════════════════════════════════════════════════════════════ */

window.API.POS = {
  /**
   * Create POS order with full details
   */
  async createOrder({ 
    items, 
    total, 
    subtotal, 
    discount, 
    tax, 
    branchId, 
    cashierId, 
    customerId = null, 
    paymentMethod, 
    paymentDetails = {},
    orderType = 'DINE_IN',
    tableNumber = null,
    notes = ''
  }) {
    if (BACKEND_MODE === 'supabase') {
      const order = await sb.insert('orders', {
        user_id: customerId,
        items: JSON.stringify(items),
        total_amount: total,
        subtotal: subtotal,
        discount_amount: discount,
        tax_amount: tax,
        branch_id: branchId,
        order_type: orderType,
        table_number: tableNumber,
        payment_method: paymentMethod,
        payment_details: JSON.stringify(paymentDetails),
        status: 'COMPLETED',
        cashier_id: cashierId,
        notes: notes,
        source: 'POS',
        created_at: new Date().toISOString()
      });
      
      // Update inventory
      for (const item of items) {
        await window.API.Inventory.updateStock(
          item.product_id, 
          -item.quantity, 
          'SALE',
          branchId
        );
      }
      
      // Update customer points if applicable
      if (customerId) {
        const member = await sb.query('members', { eq: { id: customerId }, select: '*' });
        if (member && member.length > 0) {
          const pointsEarned = Math.floor(total / 10); // 1 point per 10 THB
          await sb.update('members', {
            points: (member[0].points || 0) + pointsEarned
          }, { id: customerId });
        }
      }
      
      return { success: true, id: order[0].id, pointsEarned: customerId ? Math.floor(total / 10) : 0 };
    }
    return { success: true, id: 'POS-' + Date.now() };
  },

  /**
   * Process refund
   */
  async processRefund(orderId, reason, refundAmount, refundItems = null) {
    if (BACKEND_MODE === 'supabase') {
      // Update order status
      await sb.update('orders', {
        status: 'REFUNDED',
        refund_reason: reason,
        refund_amount: refundAmount,
        refunded_at: new Date().toISOString()
      }, { id: orderId });
      
      // Restore inventory if items returned
      if (refundItems) {
        const order = await sb.query('orders', { eq: { id: orderId }, select: 'branch_id' });
        if (order && order.length > 0) {
          for (const item of refundItems) {
            await window.API.Inventory.updateStock(
              item.product_id,
              item.quantity,
              'REFUND',
              order[0].branch_id
            );
          }
        }
      }
      
      // Record expense for refund
      await window.API.Accounting.recordExpense(
        'REFUND',
        refundAmount,
        `Refund for order ${orderId}: ${reason}`
      );
      
      return { success: true };
    }
    return { success: true };
  },

  /**
   * Apply promotion/discount
   */
  async applyPromoCode(code, total) {
    if (BACKEND_MODE === 'supabase') {
      const promos = await sb.query('promo_codes', {
        eq: { code: code.toUpperCase(), is_active: true },
        select: '*'
      });
      
      if (!promos || promos.length === 0) {
        return { success: false, message: 'Invalid promo code' };
      }
      
      const promo = promos[0];
      let discount = 0;
      
      if (promo.type === 'PERCENTAGE') {
        discount = total * (promo.value / 100);
        if (promo.max_discount && discount > promo.max_discount) {
          discount = promo.max_discount;
        }
      } else if (promo.type === 'FIXED') {
        discount = promo.value;
      }
      
      return { 
        success: true, 
        discount: Math.min(discount, total),
        promo: promo 
      };
    }
    return { success: false, message: 'Promo code not available' };
  },

  /**
   * Get customer order history
   */
  async getCustomerHistory(customerId, limit = 20) {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('orders', {
        eq: { user_id: customerId },
        select: '*',
        order: 'created_at.desc',
        limit: limit
      });
      return { success: true, data: orders };
    }
    return { success: true, data: [] };
  },

  /**
   * Hold order (for later pickup)
   */
  async holdOrder(orderData) {
    if (BACKEND_MODE === 'supabase') {
      await sb.insert('held_orders', {
        items: JSON.stringify(orderData.items),
        total: orderData.total,
        customer_name: orderData.customerName,
        customer_phone: orderData.customerPhone,
        notes: orderData.notes,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      });
      return { success: true };
    }
    return { success: true };
  },

  /**
   * Get held orders
   */
  async getHeldOrders() {
    if (BACKEND_MODE === 'supabase') {
      const orders = await sb.query('held_orders', {
        eq: { status: 'HELD' },
        select: '*',
        order: 'created_at.asc'
      });
      return { success: true, data: orders };
    }
    return { success: true, data: [] };
  }
};

/* ═══════════════════════════════════════════════════════════════
   WAREHOUSE MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

window.API.Warehouse = {
  /**
   * Get all warehouses/branches
   */
  async getWarehouses() {
    if (BACKEND_MODE === 'supabase') {
      const warehouses = await sb.query('branches', {
        select: '*',
        order: 'name.asc'
      });
      return { success: true, data: warehouses };
    }
    return { success: true, data: [] };
  },

  /**
   * Get warehouse capacity utilization
   */
  async getCapacityUtilization(warehouseId) {
    if (BACKEND_MODE === 'supabase') {
      const stock = await sb.query('inventory_stock', {
        eq: { branch_id: warehouseId },
        select: '*, products(volume, name)'
      });
      
      const warehouse = await sb.query('branches', {
        eq: { id: warehouseId },
        select: 'storage_capacity'
      });
      
      const totalVolume = stock.reduce((sum, item) => {
        return sum + (item.quantity * (item.products?.volume || 0));
      }, 0);
      
      const capacity = warehouse[0]?.storage_capacity || 0;
      
      return {
        success: true,
        data: {
          warehouseId,
          totalVolume,
          capacity,
          utilization: capacity > 0 ? ((totalVolume / capacity) * 100).toFixed(2) : 0,
          items: stock.length
        }
      };
    }
    return { success: true, data: { utilization: 0, items: 0 } };
  },

  /**
   * Batch stock update (for receiving shipments)
   */
  async batchStockUpdate(items, branchId, reason = 'BATCH_UPDATE') {
    if (BACKEND_MODE === 'supabase') {
      const results = [];
      
      for (const item of items) {
        try {
          await window.API.Inventory.updateStock(
            item.product_id,
            item.quantity,
            reason,
            branchId
          );
          results.push({ product_id: item.product_id, success: true });
        } catch (err) {
          results.push({ product_id: item.product_id, success: false, error: err.message });
        }
      }
      
      return { success: true, results };
    }
    return { success: true, results: [] };
  }
};

console.log('✅ ERP Module loaded successfully');
