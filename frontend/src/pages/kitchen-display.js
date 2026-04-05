/* ==========================================================================
   Kitchen Display -- backend-backed kanban board
   ========================================================================== */

import store from "../store.js";
import { showToast } from "../components/toast.js";
import { icon } from "../utils/icons.js";

export function renderKitchenDisplay() {
  const app = document.getElementById("app");
  const activeBranch = store.getAll("branches").find((branch) => String(branch.id) === String(store.getActiveBranchId())) || null;
  let refreshInterval;
  const dismissedStorageKey = `kitchen_dismissed_completed_${activeBranch?.id || "default"}`;
  const dismissedCompletedIds = new Set(JSON.parse(localStorage.getItem(dismissedStorageKey) || "[]"));

  function persistDismissedCompleted() {
    localStorage.setItem(dismissedStorageKey, JSON.stringify([...dismissedCompletedIds]));
  }

  function updateThemeButton() {
    const themeButton = document.getElementById("kitchen-theme-toggle");
    if (!themeButton) return;
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    themeButton.innerHTML = `${icon(isDark ? "sun" : "moon", "", isDark ? "Light theme" : "Dark theme")}<span>${isDark ? "Light" : "Dark"}</span>`;
  }

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
            <span class="kitchen-ticket-table">| ${order.tableNumber ? `Table ${order.tableNumber}` : "Self Order"}</span>
          </div>
        </div>
        <div class="kitchen-ticket-status-row">
          <span class="kitchen-ticket-order-status" style="color:${statusColors[orderStatus]}">${statusLabels[orderStatus]}</span>
          ${order.paidOrder ? '<span class="kitchen-paid-badge">Payment Done</span>' : '<span class="kitchen-unpaid-badge">Pending Payment</span>'}
        </div>
        <div class="kitchen-ticket-items">
          ${order.items.map((item, index) => `
            <div class="kitchen-ticket-item ${item.prepared ? "done" : ""}" data-toggle-item="${order.id}|${index}">
              <span class="kitchen-ticket-item-name">${item.name}</span>
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

  async function render(options = {}) {
    await store.syncPublicData();
    let kitchenOrders = store.getAll("kitchenOrders");
    if (options.dismissCompleted) {
      kitchenOrders
        .filter((order) => order.stage === "completed")
        .forEach((order) => dismissedCompletedIds.add(String(order.id)));
      persistDismissedCompleted();
    }
    kitchenOrders = kitchenOrders.filter((order) => !(order.stage === "completed" && dismissedCompletedIds.has(String(order.id))));
    const columns = {
      to_cook: kitchenOrders.filter((order) => order.stage === "to_cook"),
      preparing: kitchenOrders.filter((order) => order.stage === "preparing"),
      completed: kitchenOrders.filter((order) => order.stage === "completed"),
    };

    app.innerHTML = `
      <div class="kitchen-layout no-anim">
        <div class="kitchen-topbar">
          <div>
            <h1><span class="kitchen-topbar-icon">${icon("kitchen", "", "Kitchen Display")}</span> Kitchen Display</h1>
            <div style="font-size:var(--fs-sm);color:var(--color-text-muted)">${activeBranch ? `Branch: ${activeBranch.name}` : "Current branch"}</div>
          </div>
          <div class="kitchen-topbar-actions">
            <button class="theme-toggle-btn" id="kitchen-theme-toggle" type="button"></button>
            <button class="btn btn-sm btn-ghost" id="kitchen-refresh">Refresh</button>
            <button class="btn btn-sm btn-ghost" id="kitchen-logout">Logout</button>
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

    updateThemeButton();

    document.getElementById("kitchen-theme-toggle")?.addEventListener("click", () => {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      document.documentElement.setAttribute("data-theme", isLight ? "dark" : "light");
      localStorage.setItem("pos_theme", isLight ? "dark" : "light");
      updateThemeButton();
    });

    document.getElementById("kitchen-refresh")?.addEventListener("click", () => render({ dismissCompleted: true }));
    document.getElementById("kitchen-logout")?.addEventListener("click", () => {
      clearInterval(refreshInterval);
      store.logout();
      window.location.hash = "#/login";
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
