/* ==========================================================================
   Main — App Bootstrap, Router Configuration
   ========================================================================== */

import { router } from './router.js';
import { store } from './store.js';
import { seedData } from './utils/seed.js';

// Restore theme preference
const savedTheme = localStorage.getItem('pos_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Seed demo data on first launch
seedData();

// ---- Route Definitions ---- //

// Auth
router.on('/login', () => {
  import('./pages/auth.js').then(m => m.renderAuth());
});

// Backend routes
router.on('/backend/products', () => {
  import('./pages/backend.js').then(m => m.renderBackend('products'));
});
router.on('/backend/payment-methods', () => {
  import('./pages/backend.js').then(m => m.renderBackend('payment-methods'));
});
router.on('/backend/floors', () => {
  import('./pages/backend.js').then(m => m.renderBackend('floors'));
});
router.on('/backend/pos-settings', () => {
  import('./pages/backend.js').then(m => m.renderBackend('pos-settings'));
});
router.on('/backend/self-order', () => {
  import('./pages/backend.js').then(m => m.renderBackend('self-order'));
});
router.on('/self-order/:token', (params) => {
  import('./pages/self-order-public.js').then(m => m.renderSelfOrderPublic(params.token));
});
router.on('/backend/reports', () => {
  import('./pages/backend.js').then(m => m.renderBackend('reports'));
});
router.on('/backend/users', () => {
  import('./pages/backend.js').then(m => m.renderBackend('users'));
});
router.on('/backend/branches', () => {
  import('./pages/backend.js').then(m => m.renderBackend('branches'));
});
router.on('/backend/kitchen', () => {
  import('./pages/backend.js').then(m => m.renderBackend('kitchen'));
});
router.on('/backend/customer-display', () => {
  import('./pages/backend.js').then(m => m.renderBackend('customer-display'));
});

// POS Terminal routes
router.on('/pos/floor', () => {
  import('./pages/pos-terminal.js').then(m => m.renderPosTerminal('floor'));
});
router.on('/pos/order/:tableId', (params) => {
  import('./pages/pos-terminal.js').then(m => m.renderPosTerminal('order', params));
});
router.on('/pos/payment/:orderId', (params) => {
  import('./pages/pos-terminal.js').then(m => m.renderPosTerminal('payment', params));
});

// Kitchen Display (standalone)
router.on('/kitchen', () => {
  import('./pages/kitchen-display.js').then(m => m.renderKitchenDisplay());
});

// Customer Display (standalone)
router.on('/customer', () => {
  import('./pages/customer-display.js').then(m => m.renderCustomerDisplay());
});

// ---- Route Guard ---- //
router.beforeEach = (path) => {
  const publicRoutes = ['/login', '/customer', '/self-order/'];
  const isPublic = publicRoutes.some(r => path.startsWith(r));
  const user = store.getCurrentUser();

  if (!isPublic && !user) {
    return '/login';
  }

  if (isPublic) return null;

  const role = String(user?.role || '').toLowerCase();
  const adminRoutes = ['/backend/products', '/backend/payment-methods', '/backend/floors', '/backend/reports', '/backend/users', '/backend/branches'];
  const staffRoutes = ['/backend/pos-settings', '/backend/self-order', '/pos/floor', '/pos/order/', '/pos/payment/'];
  const chefRoutes = ['/kitchen'];

  if (role === 'admin' && !adminRoutes.some(r => path.startsWith(r))) {
    return '/backend/products';
  }

  if (role === 'staff' && !staffRoutes.some(r => path.startsWith(r))) {
    return '/backend/pos-settings';
  }

  if (role === 'chef' && !chefRoutes.some(r => path.startsWith(r))) {
    return '/kitchen';
  }

  return null; // proceed
};

// ---- Start Router ---- //
async function startApp() {
  await store.initialize();
  router.start();
}

startApp();
