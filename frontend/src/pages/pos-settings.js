/* ==========================================================================
   POS Settings - Terminal setup and session management
   ========================================================================== */

import store from '../store.js';
import router from '../router.js';
import { showToast } from '../components/toast.js';
import { icon } from '../utils/icons.js';

export function renderPosSettings(container) {
  function render() {
    const sessions = store.getAll('sessions');
    const branches = store.getAll('branches');
    const activeBranch = branches.find((branch) => String(branch.id) === String(store.getActiveBranchId())) || null;
    const activeSession = store.getActiveSession();
    const lastSession = sessions[sessions.length - 1];
    const user = store.getCurrentUser();
    const currency = store.get('settings')?.currency || '₹';
    const latestSessions = sessions
      .slice()
      .sort((a, b) => new Date(b.openedAt || b.createdAt || 0) - new Date(a.openedAt || a.createdAt || 0))
      .slice(0, 5);

    const totalSales = sessions.reduce((sum, s) => sum + (s.totalSales || 0), 0);

    container.innerHTML = `
      <div class="backend-header">
        <div>
          <h1>POS Terminal</h1>
          <div style="font-size:var(--fs-sm);color:var(--color-text-muted)">${activeBranch ? `Branch: ${activeBranch.name}` : "Current branch"}</div>
        </div>
      </div>

      <div class="pos-terminal-card card" style="margin:0 auto">
        <div class="pos-terminal-icon">${icon('pos', '', 'POS Terminal')}</div>
        <div class="pos-terminal-title">Odoo POS Cafe</div>
        <div class="pos-terminal-info">Point of Sale Terminal</div>

        <div style="text-align:left;margin-bottom:var(--space-lg)">
          <div class="pos-terminal-stat">
            <span class="pos-terminal-stat-label">Last Open Session</span>
            <span class="pos-terminal-stat-value">${lastSession ? new Date(lastSession.openedAt).toLocaleDateString() : 'Never'}</span>
          </div>
          <div class="pos-terminal-stat">
            <span class="pos-terminal-stat-label">Last Closing Sale</span>
            <span class="pos-terminal-stat-value">${lastSession ? currency + (lastSession.totalSales || 0).toFixed(2) : `${currency}0.00`}</span>
          </div>
          <div class="pos-terminal-stat">
            <span class="pos-terminal-stat-label">Total Sessions</span>
            <span class="pos-terminal-stat-value">${sessions.length}</span>
          </div>
          <div class="pos-terminal-stat">
            <span class="pos-terminal-stat-label">All-Time Sales</span>
            <span class="pos-terminal-stat-value">${currency}${totalSales.toFixed(2)}</span>
          </div>
        </div>

        ${activeSession ? `
          <button class="btn btn-accent btn-lg btn-block" id="resume-session-btn">
            Resume Active Session
          </button>
          <button class="btn btn-ghost btn-block" id="close-session-btn" style="margin-top:var(--space-sm)">
            Close Current Session
          </button>
        ` : `
          <button class="btn btn-primary btn-lg btn-block" id="open-session-btn">
            Open Session
          </button>
        `}
      </div>

      ${sessions.length > 0 ? `
        <div class="sessions-list" style="max-width:500px;margin:var(--space-xl) auto 0">
          <h3 style="margin-bottom:var(--space-md);font-size:var(--fs-md)">Session History</h3>
          ${latestSessions.map(s => `
            <div class="session-item">
              <div class="session-item-info">
                <span class="badge ${s.status === 'open' ? 'badge-success' : 'badge-primary'}">${s.status}</span>
                <div>
                  <div style="font-weight:600;font-size:var(--fs-sm)">${s.responsible || 'Staff'}</div>
                  <div style="font-size:var(--fs-xs);color:var(--color-text-muted)">
                    ${new Date(s.openedAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div style="font-weight:700;color:var(--color-secondary)">${currency}${(s.totalSales || 0).toFixed(2)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    // Open session
    document.getElementById('open-session-btn')?.addEventListener('click', async () => {
      try {
        await store.openSession();
        showToast('Session opened! Redirecting to POS...', 'success');
        setTimeout(() => router.navigate('#/pos/floor'), 600);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });

    // Resume session
    document.getElementById('resume-session-btn')?.addEventListener('click', () => {
      router.navigate('#/pos/floor');
    });

    // Close session
    document.getElementById('close-session-btn')?.addEventListener('click', async () => {
      if (activeSession) {
        try {
          await store.closeSession(activeSession.id, activeSession.totalSales || 0);
          showToast('Session closed successfully', 'info');
          render();
        } catch (error) {
          showToast(error.message, 'error');
        }
      }
    });
  }

  render();
}
