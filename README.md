# 🍵 CERAMIC — Full POS & ERP System

**Enterprise-grade Tea Shop Management Platform**

A complete business management solution combining Point of Sale (POS), Enterprise Resource Planning (ERP), customer-facing app, kitchen display system (KDS), and administrative dashboard.

---

## 📋 System Overview

### Architecture
- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (no framework dependencies)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Real-time)
- **Deployment**: Cloudflare Workers ready
- **Design**: Custom design system with dark theme, gold accents

---

## 🏗️ System Modules

### 1. **Customer App** (`index.html`)
- User registration & login
- Product browsing with categories
- Customization (sweetness, ice, addons)
- Cart management
- Order placement with payment slip upload
- Order tracking
- Loyalty points & tier system
- Profile management

### 2. **Point of Sale** (`pos.html`)
- Staff PIN-based authentication
- Fast order entry interface
- Table management (dine-in)
- Customer lookup by phone
- Multiple payment methods
- Receipt printing
- Discount & promo code support
- Hold orders for later pickup
- Real-time inventory deduction
- Automatic loyalty points calculation

### 3. **Admin Dashboard** (`admin.html`)
- **Orders Management**: View, filter, update order status
- **Member Management**: Customer database, points adjustment
- **Staff Management**: HR onboarding, role assignment
- **Menu Management**: Products, categories, pricing
- **Promo Codes**: Create & manage promotions
- **Store Settings**: Operating hours, branch configuration
- **Reports**: Sales analytics, inventory reports

### 4. **ERP System** (`erp.html`) ⭐ NEW
Full enterprise resource planning with these modules:

#### 📦 Inventory Management
- Real-time stock levels across branches
- Low stock alerts & notifications
- Stock adjustments (sales, damage, transfers)
- Inter-branch stock transfers
- Inventory valuation reports
- Batch stock updates

#### 🛒 Procurement
- Supplier database management
- Purchase order creation
- PO tracking & receiving
- Automated inventory updates on receipt
- Pending PO dashboard

#### 💰 Accounting & Finance
- Daily sales summaries
- Monthly P&L statements
- Revenue, COGS, gross profit tracking
- Expense recording with categories
- Cash flow statements
- Financial reporting

#### 👥 HR & Payroll
- Staff attendance tracking (clock in/out)
- Work days & late arrival monitoring
- Automated payroll calculation
- Salary, deductions, net pay computation
- Payroll processing & payment tracking

#### 📊 Business Intelligence
- Executive dashboard with KPIs
- 30-day sales trend visualization
- Top-selling products analysis
- Customer analytics (tier distribution, activity)
- Branch performance comparison
- Real-time metrics updates

### 5. **Kitchen Display System** (`kds.html`)
- Real-time order queue
- Order preparation status updates
- Priority ordering
- Timer tracking per order
- Multi-screen support

### 6. **Order Board** (`board.html`)
- Public order status display
- Ready for pickup notifications
- Customer-facing order tracking

### 7. **Staff Onboarding** (`onboarding.html`)
- Digital employee registration
- Document upload (ID, bank book, signature)
- PIN setup for POS access
- Manager approval workflow

---

## 🗂️ File Structure

```
/workspace
├── index.html          # Customer-facing app
├── pos.html            # Point of Sale interface
├── admin.html          # Admin dashboard
├── erp.html            # ✨ ERP system (NEW)
├── kds.html            # Kitchen Display System
├── board.html          # Order status board
├── onboarding.html     # Staff onboarding
├── api.js              # Core API adapter (Supabase integration)
├── api-erp.js          # ✨ ERP API extensions (NEW)
├── env-config.js       # Environment configuration
├── _worker.js          # Cloudflare Workers config
├── style.css           # Global styles
└── js/
    └── main.js         # Shared utilities
```

---

## 🔧 API Integration

### Core API (`api.js`)
Base functions for:
- Authentication (customer & staff)
- Orders CRUD
- Members management
- Menu retrieval
- File uploads (slips, documents)

### ERP API (`api-erp.js`) ⭐ NEW
Extended enterprise functions organized by module:

```javascript
// Inventory
window.API.Inventory.getStockLevels()
window.API.Inventory.updateStock(itemId, qty, reason, branchId)
window.API.Inventory.transferStock(from, to, itemId, qty)
window.API.Inventory.getLowStockAlerts(threshold)
window.API.Inventory.getValuationReport(branchId)

// Procurement
window.API.Procurement.getSuppliers()
window.API.Procurement.createPurchaseOrder(...)
window.API.Procurement.receivePurchaseOrder(poId)
window.API.Procurement.getPendingPOs()

// Accounting
window.API.Accounting.getDailySales(date, branchId)
window.API.Accounting.getMonthlyPL(year, month)
window.API.Accounting.recordExpense(...)
window.API.Accounting.getCashFlow(startDate, endDate)

// HR
window.API.HR.getAttendance(staffId, start, end)
window.API.HR.recordAttendance(staffId, type)
window.API.HR.calculatePayroll(staffId, periodStart, periodEnd)
window.API.HR.processPayroll(payrollId)

// Analytics
window.API.Analytics.getDashboardKPIs(branchId)
window.API.Analytics.getSalesTrend(days, branchId)
window.API.Analytics.getTopProducts(limit, start, end)
window.API.Analytics.getCustomerAnalytics()

// Advanced POS
window.API.POS.createOrder({...})
window.API.POS.processRefund(orderId, reason, amount)
window.API.POS.applyPromoCode(code, total)
window.API.POS.getCustomerHistory(customerId)
window.API.POS.holdOrder(orderData)
window.API.POS.getHeldOrders()

// Warehouse
window.API.Warehouse.getWarehouses()
window.API.Warehouse.getCapacityUtilization(warehouseId)
window.API.Warehouse.batchStockUpdate(items, branchId)
```

---

## 🗄️ Database Schema (Required Tables)

### Core Tables
- `members` - Customer accounts
- `staff` - Employee records
- `branches` - Store locations
- `orders` - Order transactions
- `order_items` - Order line items

### Menu Tables
- `categories` - Product categories
- `menu_items` - Products
- `addons` - Customization options

### ERP Tables ⭐ NEW
- `inventory_stock` - Current stock levels
- `inventory_adjustments` - Stock movement log
- `inventory_transfers` - Inter-branch transfers
- `suppliers` - Vendor database
- `purchase_orders` - Procurement orders
- `expenses` - Expense records
- `attendance` - Staff time tracking
- `payroll` - Payroll records
- `held_orders` - Parked POS orders

---

## 🚀 Getting Started

### 1. Environment Setup
Edit `env-config.js`:
```javascript
window.ENV = {
  URL: 'YOUR_SUPABASE_URL',
  KEY: 'YOUR_SUPABASE_ANON_KEY'
};
```

### 2. Deploy to Cloudflare Workers
```bash
wrangler deploy
```

### 3. Access Points
- Customer App: `https://your-domain.com/`
- POS: `https://your-domain.com/pos.html`
- Admin: `https://your-domain.com/admin.html`
- ERP: `https://your-domain.com/erp.html` ⭐ NEW
- KDS: `https://your-domain.com/kds.html`
- Onboarding: `https://your-domain.com/onboarding.html`

---

## 🔐 Security Features

- Password hashing (SHA-256 + salt)
- Role-based access control (ADMIN, MANAGER, STAFF)
- Session token management
- Secure file uploads
- Input validation
- CORS protection via Supabase RLS

---

## 📱 Responsive Design

- Mobile-first approach
- Tablet-optimized POS interface
- Desktop dashboard layouts
- Touch-friendly controls
- Adaptive grid systems

---

## 🎨 Design Tokens

```css
--c0: #0c0b09     /* Background */
--tan: #e8e0d4    /* Primary text */
--gold: #b8924a   /* Accent / CTAs */
--grn: #4aad75    /* Success states */
--red: #d44f4f    /* Error / Alerts */
--blue: #4a7fbf   /* Info states */
```

---

## 🔄 Update History

### v2.0 — ERP Upgrade (Current)
✨ **Added Full ERP System**
- Complete inventory management
- Procurement & supplier management
- Accounting & financial reports
- HR & payroll automation
- Business intelligence dashboard
- Advanced POS features
- Warehouse management

### v1.0 — Initial Release
- Customer ordering app
- Basic POS functionality
- Admin dashboard
- KDS integration
- Staff onboarding

---

## 📞 Support

For technical support or feature requests, contact the development team.

---

**Built with ❤️ for Ceramic Tea Shop**
