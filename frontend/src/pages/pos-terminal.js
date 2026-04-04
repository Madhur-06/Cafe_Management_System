/* ==========================================================================
   POS Terminal — Main POS layout (top menu + floor/order/payment views)
   ========================================================================== */

import store from '../store.js';
import router from '../router.js';
import { showToast } from '../components/toast.js';

export function renderPosTerminal(view = 'floor', params = {}) {
  const app = document.getElementById('app');
  const session = store.getActiveSession();

  if (!session) {
    showToast('No active session. Please open a session first.', 'error');
    router.navigate('#/backend/pos-settings');
    return;
  }

  let actionsOpen = false;

  app.innerHTML = `
    <div class="pos-layout">
      <div class="pos-topbar">
        <div class="pos-topbar-left">
          <span class="pos-topbar-brand" id="pos-brand-home" style="cursor:pointer;" title="Back to Dashboard">☕ POS Cafe</span>
          <div class="pos-topbar-nav">
            <button class="pos-topbar-btn ${view === 'floor' ? 'active' : ''}" id="pos-nav-table">🪑 Table</button>
            <button class="pos-topbar-btn ${view === 'order' ? 'active' : ''}" id="pos-nav-register">📋 Register</button>
          </div>
        </div>
        <div class="pos-topbar-right">
          <span class="pos-session-badge">● Session Active</span>
          <button class="theme-toggle-btn" id="pos-theme-toggle"></button>
          <div class="pos-actions-dropdown">
            <button class="btn btn-sm btn-ghost" id="pos-actions-toggle">⚙️ Actions ▾</button>
            <div class="pos-actions-menu" id="pos-actions-menu" style="display:none">
              <div class="pos-actions-item" id="action-reload">🔄 Reload Data</div>
              <div class="pos-actions-item" id="action-backend">⚙️ Go to Back-end</div>
              <div class="pos-actions-item" id="action-customer">🖥️ Customer Display</div>
              <div class="pos-actions-item" id="action-kitchen">👨‍🍳 Kitchen Display</div>
              <div class="pos-actions-divider"></div>
              <div class="pos-actions-item" id="action-close" style="color:var(--color-danger)">⏻ Close Register</div>
            </div>
          </div>
        </div>
      </div>
      <div id="pos-view-content" style="flex:1;display:flex;flex-direction:column;overflow:hidden"></div>
    </div>
  `;

  // Brand logo → home
  document.getElementById('pos-brand-home')?.addEventListener('click', () => router.navigate('#/backend/products'));

  // Theme toggle in POS
  const posThemeBtn = document.getElementById('pos-theme-toggle');
  function updatePosThemeBtn() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    if (posThemeBtn) posThemeBtn.innerHTML = isDark ? '☀️' : '🌙';
  }
  updatePosThemeBtn();
  posThemeBtn?.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
    localStorage.setItem('pos_theme', isLight ? 'dark' : 'light');
    updatePosThemeBtn();
  });

  // Navigation
  document.getElementById('pos-nav-table')?.addEventListener('click', () => router.navigate('#/pos/floor'));
  document.getElementById('pos-nav-register')?.addEventListener('click', () => {
    const currentOrder = store.get('currentOrder');
    if (currentOrder?.tableId) {
      router.navigate(`#/pos/order/${currentOrder.tableId}`);
    } else {
      showToast('Select a table first', 'info');
      router.navigate('#/pos/floor');
    }
  });

  // Actions dropdown
  const actionsToggle = document.getElementById('pos-actions-toggle');
  const actionsMenu = document.getElementById('pos-actions-menu');
  
  actionsToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    actionsOpen = !actionsOpen;
    actionsMenu.style.display = actionsOpen ? 'block' : 'none';
  });
  document.addEventListener('click', () => {
    actionsOpen = false;
    if (actionsMenu) actionsMenu.style.display = 'none';
  });

  document.getElementById('action-reload')?.addEventListener('click', async () => {
    await store.syncProtectedData();
    showToast('Data reloaded!', 'info');
    location.reload();
  });
  document.getElementById('action-backend')?.addEventListener('click', () => router.navigate('#/backend/products'));
  document.getElementById('action-customer')?.addEventListener('click', () => window.open('#/customer', '_blank'));
  document.getElementById('action-kitchen')?.addEventListener('click', () => window.open('#/kitchen', '_blank'));
  document.getElementById('action-close')?.addEventListener('click', async () => {
    if (session) {
      await store.closeSession(session.id, session.totalSales || 0);
      store.remove('currentOrder');
      showToast('Register closed', 'info');
      router.navigate('#/backend/pos-settings');
    }
  });

  // Load view
  loadView(view, params);
}

async function loadView(view, params) {
  const content = document.getElementById('pos-view-content');
  if (!content) return;

  switch (view) {
    case 'floor': {
      const { renderFloorView } = await import('./floor-view.js');
      renderFloorView(content);
      break;
    }
    case 'order': {
      const { renderOrderScreen } = await import('./order-screen.js');
      renderOrderScreen(content, params.tableId);
      break;
    }
    case 'payment': {
      const { renderPaymentScreen } = await import('./payment-screen.js');
      renderPaymentScreen(content, params.orderId);
      break;
    }
    default:
      content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🪑</div><div class="empty-state-text">Select a view</div></div>';
  }
}
