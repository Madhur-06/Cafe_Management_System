/* ==========================================================================
   Customer Display -- backend-backed order board
   ========================================================================== */

import store from "../store.js";
import { icon } from "../utils/icons.js";

export function renderCustomerDisplay() {
  const app = document.getElementById("app");
  const currency = store.get("settings")?.currency || "₹";
  const activeBranch = store.getAll("branches").find((branch) => String(branch.id) === String(store.getActiveBranchId())) || null;
  let refreshInterval;

  function renderOrderCard(order) {
    const statusClass = order.status === "paid" ? "paid" : order.status === "in_progress" ? "in-progress" : "open";
    const statusLabel = order.status === "paid" ? "Paid" : order.status === "in_progress" ? "Preparing" : "Open";

    return `
      <div class="cd-order-card ${statusClass}">
        <div class="cd-card-header">
          <div class="cd-order-id">#${String(order.id).slice(-4).toUpperCase()}</div>
          <div class="cd-table-badge">${order.tableNumber ? `Table ${order.tableNumber}` : "Self Order"}</div>
        </div>
        <div class="cd-items-list">
          ${(order.items || []).map((item) => `
            <div class="cd-item-row">
              <span class="cd-item-name">${item.name}</span>
              <span class="cd-item-qty">x${item.qty}</span>
              <span class="cd-item-price">${currency}${(item.price * item.qty).toFixed(2)}</span>
            </div>
          `).join("")}
        </div>
        <div class="cd-card-footer">
          <div class="cd-total-row"><span>Subtotal</span><span>${currency}${(order.subtotal || 0).toFixed(2)}</span></div>
          ${(order.tax || 0) > 0 ? `<div class="cd-total-row"><span>Tax</span><span>${currency}${order.tax.toFixed(2)}</span></div>` : ""}
          <div class="cd-total-row grand"><span>Total</span><span>${currency}${(order.total || 0).toFixed(2)}</span></div>
          <div class="cd-status-badge ${statusClass}">${statusLabel}</div>
        </div>
      </div>
    `;
  }

  async function render() {
    await store.syncPublicData();
    const activeOrders = store.get("customerOrders", []);

    app.innerHTML = `
      <div class="cd-layout">
        <div class="cd-topbar">
          <div class="cd-brand">${icon("brand", "", "Odoo POS Cafe")}<span>Odoo POS Cafe</span></div>
          <div class="cd-topbar-center">
            <span class="cd-live-badge">${icon("session", "", "Live orders")}<span>LIVE</span></span>
            <span class="cd-order-count">${activeOrders.length} active order${activeOrders.length !== 1 ? "s" : ""}</span>
            <span class="cd-order-count">${activeBranch ? activeBranch.name : ""}</span>
          </div>
          <button id="customer-back-btn" class="btn btn-ghost btn-sm">Back</button>
        </div>
        ${activeOrders.length ? `
          <div class="cd-orders-grid">
            ${activeOrders.slice().reverse().map(renderOrderCard).join("")}
          </div>
        ` : `
          <div class="cd-empty-state">
            <div class="cd-empty-icon">${icon("circleCheck", "", "All clear")}</div>
            <h2>All Tables Clear</h2>
            <p>Waiting for orders...</p>
          </div>
        `}
      </div>
    `;

    document.getElementById("customer-back-btn")?.addEventListener("click", () => {
      clearInterval(refreshInterval);
      window.location.hash = "#/backend/products";
    });
  }

  render();
  refreshInterval = setInterval(() => {
    render();
  }, 3000);
  window.addEventListener("hashchange", () => clearInterval(refreshInterval), { once: true });
}
