/* ==========================================================================
   Self Order — Token-based mobile ordering
   ========================================================================== */

import store from '../store.js';
import { showToast } from '../components/toast.js';
import { generateTokenQR } from '../utils/qr.js';

export function renderSelfOrder(container) {
  const tables = store.getAll('tables').filter(t => t.active);
  const session = store.getActiveSession();
  const currency = store.get('settings')?.currency || '₹';
  let selectedTable = null;
  let tokenGenerated = false;
  let generatedToken = null;

  function render() {
    container.innerHTML = `
      <div class="backend-header">
        <h1>📱 Self Ordering</h1>
      </div>
      <p style="color:var(--color-text-muted);margin-bottom:var(--space-xl);font-size:var(--fs-sm)">
        Generate a token QR code for a table. Customers scan it with their phone to place orders directly, which are sent to the Kitchen Display.
      </p>

      ${!session ? `
        <div class="card" style="max-width:500px;text-align:center;padding:var(--space-2xl)">
          <div style="font-size:2rem;margin-bottom:var(--space-md)">⚠️</div>
          <p style="color:var(--color-text-muted)">Please open a POS session first to enable self-ordering.</p>
          <a href="#/backend/pos-settings" class="btn btn-primary" style="margin-top:var(--space-md)">Go to POS Settings</a>
        </div>
      ` : `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-xl);max-width:800px">
          <!-- Table Selection -->
          <div class="card">
            <h3 style="margin-bottom:var(--space-md)">Select Table</h3>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-sm)">
              ${tables.map(t => `
                <button class="btn ${selectedTable === t.id ? 'btn-primary' : 'btn-ghost'} table-select-btn" data-table="${t.id}">
                  T${t.number}
                </button>
              `).join('')}
            </div>
            ${selectedTable ? `
              <button class="btn btn-secondary btn-block" id="generate-token-btn" style="margin-top:var(--space-lg)">
                Generate Token QR
              </button>
            ` : ''}
          </div>

          <!-- QR Display -->
          <div class="card" style="text-align:center">
            <h3 style="margin-bottom:var(--space-md)">Self-Order Token</h3>
            ${tokenGenerated ? `
              <div style="background:#fff;border-radius:var(--radius-md);display:inline-block;padding:var(--space-md);margin-bottom:var(--space-md)">
                <canvas id="self-order-qr"></canvas>
              </div>
              <p style="font-size:var(--fs-sm);color:var(--color-text-muted)">
                Scan this QR code with your phone to start ordering.
              </p>
              <p style="font-size:var(--fs-xs);color:var(--color-text-muted);margin-top:var(--space-sm)">
                Table ${tables.find(t => t.id === selectedTable)?.number || '?'} · Session Active
              </p>
            ` : `
              <div style="padding:var(--space-2xl);color:var(--color-text-muted)">
                <div style="font-size:2rem;margin-bottom:var(--space-sm);opacity:0.3">📱</div>
                <p style="font-size:var(--fs-sm)">Select a table and generate a token</p>
              </div>
            `}
          </div>
        </div>

        <!-- Self-Order simulation section -->
        ${tokenGenerated && selectedTable ? `
          <div class="card" style="max-width:800px;margin-top:var(--space-xl)">
            <h3 style="margin-bottom:var(--space-md)">📱 Simulate Mobile Order</h3>
            <p style="font-size:var(--fs-sm);color:var(--color-text-muted);margin-bottom:var(--space-md)">
              This simulates what a customer would see after scanning the QR. Select items and submit the order.
            </p>
            <div id="self-order-products" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:var(--space-sm);margin-bottom:var(--space-md)"></div>
            <div id="self-order-cart" style="margin-bottom:var(--space-md)"></div>
            <button class="btn btn-primary" id="submit-self-order" disabled>Submit Order</button>
          </div>
        ` : ''}
      `}
    `;

    // Table selection
    container.querySelectorAll('.table-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedTable = btn.dataset.table;
        tokenGenerated = false;
        render();
      });
    });

    // Generate token
    document.getElementById('generate-token-btn')?.addEventListener('click', async () => {
      try {
        const token = await store.createSelfOrderToken(selectedTable, session.id);
        generatedToken = token.token;
        tokenGenerated = true;
        render();
        setTimeout(async () => {
          const canvas = document.getElementById('self-order-qr');
          if (canvas) {
            const table = tables.find(t => t.id === selectedTable);
            await generateTokenQR(canvas, {
              type: 'self_order',
              token: generatedToken,
              tableId: selectedTable,
              tableNumber: table?.number,
              sessionId: session.id,
            });
          }
          renderSelfOrderSimulation();
        }, 100);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  function renderSelfOrderSimulation() {
    const products = store.getAll('products');
    const productsDiv = document.getElementById('self-order-products');
    const cartDiv = document.getElementById('self-order-cart');
    const submitBtn = document.getElementById('submit-self-order');
    if (!productsDiv) return;

    let selfCart = [];

    function renderUI() {
      productsDiv.innerHTML = products.map(p => `
        <div class="order-product-card" data-pid="${p.id}" style="cursor:pointer">
          <div class="order-product-emoji">${p.emoji || '📦'}</div>
          <div class="order-product-name">${p.name}</div>
          <div class="order-product-price">${currency}${p.price.toFixed(2)}</div>
        </div>
      `).join('');

      cartDiv.innerHTML = selfCart.length === 0
        ? '<p style="color:var(--color-text-muted);font-size:var(--fs-sm)">Tap items to add to order</p>'
        : `<div style="display:flex;flex-direction:column;gap:4px">${selfCart.map((item, i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:var(--fs-sm);border-bottom:1px solid var(--color-border)">
              <span>${item.name}</span>
              <span style="display:flex;align-items:center;gap:6px">
                <button class="cart-qty-btn self-dec" data-idx="${i}" style="width:24px;height:24px;border-radius:4px;cursor:pointer;background:var(--color-bg);border:1px solid var(--color-border);font-weight:700">−</button>
                <span style="min-width:18px;text-align:center;font-weight:700">${item.qty}</span>
                <button class="cart-qty-btn self-inc" data-idx="${i}" style="width:24px;height:24px;border-radius:4px;cursor:pointer;background:var(--color-bg);border:1px solid var(--color-border);font-weight:700">+</button>
                <span style="min-width:52px;color:var(--color-secondary);font-weight:700;text-align:right">${currency}${(item.price * item.qty).toFixed(2)}</span>
                <button class="self-remove" data-idx="${i}" style="cursor:pointer;background:none;border:none;color:var(--color-text-muted);font-size:1rem;padding:2px 4px" title="Remove">✕</button>
              </span>
            </div>
          `).join('')}</div>`;

      if (submitBtn) submitBtn.disabled = selfCart.length === 0;

      productsDiv.querySelectorAll('.order-product-card').forEach(card => {
        card.addEventListener('click', () => {
          const p = products.find(pr => pr.id === card.dataset.pid);
          if (!p) return;
          const existing = selfCart.find(c => c.productId === p.id);
          if (existing) existing.qty++;
          else selfCart.push({ productId: p.id, name: p.name, price: p.price, qty: 1, emoji: p.emoji, tax: p.tax || 0 });
          renderUI();
        });
      });

      // Cart controls
      cartDiv.querySelectorAll('.self-inc').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          selfCart[idx].qty++;
          renderUI();
        });
      });
      cartDiv.querySelectorAll('.self-dec').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          selfCart[idx].qty--;
          if (selfCart[idx].qty <= 0) selfCart.splice(idx, 1);
          renderUI();
        });
      });
      cartDiv.querySelectorAll('.self-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          selfCart.splice(idx, 1);
          renderUI();
        });
      });
    }

    renderUI();

    submitBtn?.addEventListener('click', async () => {
      if (selfCart.length === 0) return;
      try {
        const response = await store.submitSelfOrder(generatedToken, selfCart);
        await store.syncProtectedData();
        showToast(`Self-order submitted! Order #${response.order_number}`, 'success');
        selfCart = [];
        renderUI();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  render();
}
