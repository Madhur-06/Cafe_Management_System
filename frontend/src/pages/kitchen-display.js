/* ==========================================================================
   Kitchen Display -- backend-backed kanban board
   ========================================================================== */

import store from "../store.js";
import { showToast } from "../components/toast.js";

export function renderKitchenDisplay() {
  const app = document.getElementById("app");
  let refreshInterval;

  function renderTicket(order) {
    const orderStatus = order.paidOrder ? "paid" : order.stage === "preparing" ? "in_progress" : "open";
    const statusColors = {
      paid: "var(--color-secondary)",
      in_progress: "var(--color-accent)",
      open: "var(--color-primary-light)",
    };
    const statusLabels = {
      paid: "Paid",
      in_progress: "Preparing",
      open: "Open",
    };
    const nextStageLabel = order.stage === "to_cook" ? "Start Preparing" : order.stage === "preparing" ? "Mark Complete" : "";
    const nextStageClass = order.stage === "to_cook" ? "btn-accent" : "btn-secondary";

    return `
      <div class="kitchen-ticket">
        <div class="kitchen-ticket-header">
          <div>
            <span class="kitchen-ticket-id">#${order.orderNumber}</span>
            <span class="kitchen-ticket-table">· ${order.tableNumber ? `Table ${order.tableNumber}` : "Self Order"}</span>
          </div>
        </div>
        <div class="kitchen-ticket-status-row">
          <span class="kitchen-ticket-order-status" style="color:${statusColors[orderStatus]}">${statusLabels[orderStatus]}</span>
          ${order.paidOrder ? '<span class="kitchen-paid-badge">Payment Done</span>' : '<span class="kitchen-unpaid-badge">Pending Payment</span>'}
        </div>
        <div class="kitchen-ticket-items">
          ${order.items.map((item, index) => `
            <div class="kitchen-ticket-item ${item.prepared ? "done" : ""}" data-toggle-item="${order.id}|${index}">
              <span class="kitchen-ticket-item-name">${item.emoji || ""} ${item.name}</span>
              <span class="kitchen-ticket-item-qty">x${item.qty}</span>
            </div>
          `).join("")}
        </div>
        ${nextStageLabel ? `
          <div class="kitchen-ticket-action">
            <button class="btn btn-sm ${nextStageClass}" data-advance-ticket="${order.id}">${nextStageLabel}</button>
          </div>
        ` : ""}
      </div>
    `;
  }

  async function render() {
    await store.syncPublicData();
    const kitchenOrders = store.getAll("kitchenOrders");
    const columns = {
      to_cook: kitchenOrders.filter((order) => order.stage === "to_cook"),
      preparing: kitchenOrders.filter((order) => order.stage === "preparing"),
      completed: kitchenOrders.filter((order) => order.stage === "completed"),
    };

    app.innerHTML = `
      <div class="kitchen-layout no-anim">
        <div class="kitchen-topbar">
          <h1><span class="kitchen-topbar-icon">👨‍🍳</span> Kitchen Display</h1>
          <div style="display:flex;gap:var(--space-sm)">
            <button class="btn btn-sm btn-ghost" id="kitchen-refresh">Refresh</button>
            <button class="btn btn-sm btn-ghost" id="kitchen-back">Back</button>
          </div>
        </div>
        <div class="kitchen-kanban">
          ${[
            ["to_cook", "To Cook"],
            ["preparing", "Preparing"],
            ["completed", "Completed"],
          ].map(([key, label]) => `
            <div class="kitchen-column ${key.replace("_", "-")}">
              <div class="kitchen-column-header">
                <div class="kitchen-column-title">${label}</div>
                <span class="kitchen-column-count">${columns[key].length}</span>
              </div>
              <div class="kitchen-column-body">
                ${columns[key].length ? columns[key].map(renderTicket).join("") : '<div class="empty-state" style="padding:var(--space-xl)"><div class="empty-state-text">No orders</div></div>'}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    document.getElementById("kitchen-refresh")?.addEventListener("click", () => render());
    document.getElementById("kitchen-back")?.addEventListener("click", () => {
      clearInterval(refreshInterval);
      window.location.hash = "#/backend/products";
    });

    app.querySelectorAll("[data-advance-ticket]").forEach((button) => {
      button.addEventListener("click", () => {
        const ticket = store.find("kitchenOrders", button.dataset.advanceTicket);
        if (!ticket) return;
        store.advanceKitchenOrder(ticket.orderId)
          .then(() => {
            showToast(`Order #${ticket.orderNumber} updated`, "success");
            render();
          })
          .catch((error) => showToast(error.message, "error"));
      });
    });

    app.querySelectorAll("[data-toggle-item]").forEach((itemNode) => {
      itemNode.addEventListener("click", () => {
        const [ticketId, itemIndex] = itemNode.dataset.toggleItem.split("|");
        const ticket = store.find("kitchenOrders", ticketId);
        const item = ticket?.items?.[Number(itemIndex)];
        if (!item) return;
        store.toggleKitchenItem(item.id)
          .then(() => render())
          .catch((error) => showToast(error.message, "error"));
      });
    });
  }

  render();
  refreshInterval = setInterval(() => {
    render();
  }, 5000);
  window.addEventListener("hashchange", () => clearInterval(refreshInterval), { once: true });
}
