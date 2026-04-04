/* ==========================================================================
   Payment Methods — Cash / Digital / UPI configuration
   ========================================================================== */

import store from '../store.js';
import { showToast } from '../components/toast.js';

export function renderPaymentMethods(container) {
  function render() {
    const methods = store.getAll('paymentMethods');

    container.innerHTML = `
      <div class="backend-header">
        <h1>💳 Payment Methods</h1>
      </div>
      <p style="color:var(--color-text-muted);margin-bottom:var(--space-xl);font-size:var(--fs-sm)">
        Enable or disable payment methods available at checkout. Only enabled methods will appear in the POS terminal.
      </p>

      <div class="payment-methods-grid stagger">
        ${methods.map(m => `
          <div class="card payment-method-card animate-fadeInUp" data-id="${m.id}">
            <div class="payment-method-header">
              <div class="payment-method-info">
                <div class="payment-method-icon">${m.icon}</div>
                <div>
                  <div class="payment-method-name">${m.name}</div>
                  <div class="payment-method-type">${m.type === 'cash' ? 'Cash Payments' : m.type === 'card' ? 'Card Payments' : 'UPI QR Payments'}</div>
                </div>
              </div>
              <label class="toggle">
                <input type="checkbox" ${m.enabled ? 'checked' : ''} data-toggle="${m.id}" />
                <span class="toggle-slider"></span>
              </label>
            </div>

            ${m.type === 'cash' ? `
              <p style="font-size:var(--fs-sm);color:var(--color-text-muted);margin-top:var(--space-sm)">
                Accept cash payments at the register. Change will be calculated automatically.
              </p>
            ` : ''}

            ${m.type === 'card' ? `
              <p style="font-size:var(--fs-sm);color:var(--color-text-muted);margin-top:var(--space-sm)">
                Accept debit and credit card payments at checkout.
              </p>
            ` : ''}

            ${m.type === 'upi' ? `
              <p style="font-size:var(--fs-sm);color:var(--color-text-muted);margin-top:var(--space-sm)">
                Generate QR codes for UPI payments. Customers scan with any UPI app.
              </p>
              ${m.enabled ? `
                <div class="upi-config">
                  <div class="form-group">
                    <label class="form-label">UPI ID</label>
                    <input type="text" class="form-input" id="upi-id-input" value="${m.upiId || ''}" placeholder="example@ybl.com" />
                  </div>
                  <button class="btn btn-sm btn-primary" id="save-upi-btn">Save UPI ID</button>
                </div>
              ` : ''}
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;

    // Toggle handlers
    container.querySelectorAll('[data-toggle]').forEach(input => {
      input.addEventListener('change', async (e) => {
        const id = e.target.dataset.toggle;
        try {
          await store.updatePaymentMethod(id, { enabled: e.target.checked });
          showToast(`Payment method ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
          render();
        } catch (error) {
          e.target.checked = !e.target.checked;
          showToast(error.message, 'error');
        }
      });
    });

    // UPI save
    document.getElementById('save-upi-btn')?.addEventListener('click', async () => {
      const upiId = document.getElementById('upi-id-input').value.trim();
      if (!upiId) {
        showToast('Please enter a UPI ID', 'error');
        return;
      }
      const upiMethod = methods.find(m => m.type === 'upi');
      if (!upiMethod) {
        showToast('UPI method not found', 'error');
        return;
      }
      try {
        await store.updatePaymentMethod(upiMethod.id, { upiId });
        showToast('UPI ID saved!', 'success');
        render();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  render();
}
