/* ==========================================================================
   Backend Layout - Sidebar + content area
   ========================================================================== */

import store from '../store.js';
import router from '../router.js';
import { showToast } from '../components/toast.js';

export function renderBackend(section = 'products') {
  const app = document.getElementById('app');
  const user = store.getCurrentUser();
  const role = String(user?.role || '').toLowerCase();
  const branches = store.getAll('branches');
  const activeBranchId = store.getActiveBranchId();
  const activeBranch = branches.find((branch) => String(branch.id) === String(activeBranchId)) || branches[0] || null;

  const navItems = role === 'admin'
    ? [
        { section: 'Configuration', items: [
          { id: 'branches', icon: '\u{1F3E2}', label: 'Branches' },
          { id: 'products', icon: '\u{1F4E6}', label: 'Products' },
          { id: 'payment-methods', icon: '\u{1F4B3}', label: 'Payment Methods' },
          { id: 'floors', icon: '\u{1F3E2}', label: 'Floors & Tables' },
          { id: 'users', icon: '\u{1F465}', label: 'Users' },
        ]},
        { section: 'Analytics', items: [
          { id: 'reports', icon: '\u{1F4CA}', label: 'Reports & Dashboard' },
        ]},
      ]
    : [
        { section: 'POS', items: [
          { id: 'pos-settings', icon: '\u{1F5A5}\uFE0F', label: 'POS Terminal' },
          { id: 'self-order', icon: '\u{1F4F1}', label: 'Self Ordering' },
        ]},
      ];

  app.innerHTML = `
    <div class="backend-layout">
      <aside class="backend-sidebar">
        <div class="sidebar-brand" id="sidebar-home-btn" style="cursor:pointer;" title="Back to Home">
          <span class="sidebar-brand-icon">\u2615</span>
          <h2>POS Cafe</h2>
        </div>

        <div class="sidebar-section" style="padding-bottom:var(--space-md);border-bottom:1px solid var(--color-border)">
          <div class="sidebar-section-title">Branch</div>
          ${
            role === 'admin'
              ? `
                <select class="form-input" id="branch-switcher" style="width:100%">
                  ${branches.map((branch) => `
                    <option value="${branch.id}" ${String(branch.id) === String(activeBranchId) ? 'selected' : ''}>
                      ${branch.name}
                    </option>
                  `).join('')}
                </select>
              `
              : `
                <div class="badge badge-primary" style="display:inline-flex">${activeBranch?.name || user?.branchName || 'Assigned Branch'}</div>
              `
          }
        </div>

        ${navItems.map(group => `
          <div class="sidebar-section">
            <div class="sidebar-section-title">${group.section}</div>
            <nav class="sidebar-nav">
              ${group.items.map(item => `
                <a class="sidebar-link ${section === item.id ? 'active' : ''}" data-section="${item.id}" href="#/backend/${item.id}">
                  <span class="sidebar-link-icon">${item.icon}</span>
                  ${item.label}
                </a>
              `).join('')}
            </nav>
          </div>
        `).join('')}

        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="sidebar-avatar">${(user?.fullName || 'U')[0].toUpperCase()}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${user?.fullName || 'User'}</div>
              <div class="sidebar-user-role">${user?.role || 'Staff'}</div>
            </div>
            <button class="btn btn-icon btn-ghost" id="logout-btn" title="Logout" style="margin-left:auto">\u23FB</button>
          </div>
          <div style="margin-top:var(--space-sm);display:flex;justify-content:center">
            <button class="theme-toggle-btn" id="theme-toggle-btn"></button>
          </div>
        </div>
      </aside>

      <main class="backend-main" id="backend-content">
        <!-- Content loaded dynamically -->
      </main>
    </div>
  `;

  document.getElementById('sidebar-home-btn')?.addEventListener('click', () => {
    router.navigate(role === 'staff' ? '#/backend/pos-settings' : '#/backend/products');
  });

  document.getElementById('branch-switcher')?.addEventListener('change', async (event) => {
    try {
      await store.setActiveBranch(event.target.value);
      renderBackend(section);
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  const themeBtn = document.getElementById('theme-toggle-btn');
  function updateThemeBtn() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    if (themeBtn) themeBtn.innerHTML = isDark ? '\u2600\uFE0F Light Mode' : '\u{1F319} Dark Mode';
  }
  updateThemeBtn();
  themeBtn?.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
    localStorage.setItem('pos_theme', isLight ? 'dark' : 'light');
    updateThemeBtn();
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    store.logout();
    showToast('Logged out successfully', 'info');
    router.navigate('#/login');
  });

  loadSection(section);
}

async function loadSection(section) {
  const content = document.getElementById('backend-content');
  if (!content) return;

  switch (section) {
    case 'products': {
      const { renderProducts } = await import('./products.js');
      renderProducts(content);
      break;
    }
    case 'payment-methods': {
      const { renderPaymentMethods } = await import('./payment-methods.js');
      renderPaymentMethods(content);
      break;
    }
    case 'floors': {
      const { renderFloors } = await import('./floors.js');
      renderFloors(content);
      break;
    }
    case 'pos-settings': {
      const { renderPosSettings } = await import('./pos-settings.js');
      renderPosSettings(content);
      break;
    }
    case 'self-order': {
      const { renderSelfOrder } = await import('./self-order.js');
      renderSelfOrder(content);
      break;
    }
    case 'reports': {
      const { renderReports } = await import('./reports.js');
      renderReports(content);
      break;
    }
    case 'users': {
      const { renderUsers } = await import('./users.js');
      renderUsers(content);
      break;
    }
    case 'branches': {
      const { renderBranches } = await import('./branches.js');
      renderBranches(content);
      break;
    }
    case 'kitchen': {
      content.innerHTML = `
        <div class="backend-header"><h1>\u{1F468}\u200D\u{1F373} Kitchen Display</h1></div>
        <p style="color:var(--color-text-muted);margin-bottom:var(--space-lg);font-size:var(--fs-sm)">
          The Kitchen Display runs in a separate window for the kitchen staff to see and manage orders.
        </p>
        <button class="btn btn-primary" id="open-kitchen-btn">\u{1FA9F} Open Kitchen Display</button>
      `;
      document.getElementById('open-kitchen-btn')?.addEventListener('click', () => {
        window.open(window.location.origin + window.location.pathname + '#/kitchen', '_blank');
      });
      break;
    }
    case 'customer-display': {
      content.innerHTML = `
        <div class="backend-header"><h1>\u{1F5A5}\uFE0F Customer Display</h1></div>
        <p style="color:var(--color-text-muted);margin-bottom:var(--space-lg);font-size:var(--fs-sm)">
          The Customer Display shows order details to the customer in a separate window.
        </p>
        <button class="btn btn-primary" id="open-customer-btn">\u{1FA9F} Open Customer Display</button>
      `;
      document.getElementById('open-customer-btn')?.addEventListener('click', () => {
        window.open(window.location.origin + window.location.pathname + '#/customer', '_blank');
      });
      break;
    }
    default:
      content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">\u{1F6A7}</div><div class="empty-state-text">Section coming soon</div></div>';
  }
}
