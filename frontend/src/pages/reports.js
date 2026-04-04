/* ==========================================================================
   Reports and Dashboard
   ========================================================================== */

import store from "../store.js";
import { exportToCSV, exportToPDF, exportToXLS } from "../utils/export.js";
import { showToast } from "../components/toast.js";

function shortOrderId(id) {
  return String(id || "").slice(-4).toUpperCase() || "NA";
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function renderReports(container) {
  const currency = store.get("settings")?.currency || "₹";

  let filters = {
    period: "all",
    sessionId: "",
    responsible: "",
    product: "",
    startDate: "",
    endDate: "",
    productSort: "best",
  };

  let selectedOrderId = null;
  const activeBranchId = store.getActiveBranchId();

  function getFilteredOrders() {
    let orders = [...store.getAll("orders")];
    const now = new Date();

    if (filters.period === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      orders = orders.filter((order) => {
        const date = safeDate(order.createdAt);
        return date && date >= start;
      });
    } else if (filters.period === "week") {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      orders = orders.filter((order) => {
        const date = safeDate(order.createdAt);
        return date && date >= start;
      });
    } else if (filters.period === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      orders = orders.filter((order) => {
        const date = safeDate(order.createdAt);
        return date && date >= start;
      });
    } else if (filters.period === "custom" && filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      orders = orders.filter((order) => {
        const date = safeDate(order.createdAt);
        return date && date >= start && date <= end;
      });
    }

    if (filters.sessionId) {
      orders = orders.filter((order) => String(order.sessionId) === String(filters.sessionId));
    }
    if (filters.responsible) {
      orders = orders.filter((order) => String(order.responsible || "") === String(filters.responsible));
    }
    if (filters.product) {
      orders = orders.filter((order) =>
        (order.items || []).some((item) => String(item.productId) === String(filters.product))
      );
    }

    return orders;
  }

  function buildProductSales(orders, products) {
    const productSalesMap = new Map();
    products.forEach((product) => {
      productSalesMap.set(product.name, { qty: 0, revenue: 0 });
    });

    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const current = productSalesMap.get(item.name) || { qty: 0, revenue: 0 };
        current.qty += Number(item.qty || 0);
        current.revenue += Number(item.price || 0) * Number(item.qty || 0);
        productSalesMap.set(item.name, current);
      });
    });

    return [...productSalesMap.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) =>
        filters.productSort === "best" ? b.revenue - a.revenue : a.revenue - b.revenue
      );
  }

  function render() {
    const branches = store.getAll("branches");
    const activeBranch = branches.find((branch) => String(branch.id) === String(activeBranchId)) || null;
    const sessions = store.getAll("sessions");
    const products = store.getAll("products");
    const allOrders = store.getAll("orders");
    const orders = getFilteredOrders();
    const responsibles = [...new Set(allOrders.map((order) => order.responsible).filter(Boolean))];
    const paidOrders = orders.filter((order) => order.paymentStatus === "paid" || order.status === "paid");
    const totalSales = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const totalOrders = paidOrders.length;
    const avgOrder = totalOrders ? totalSales / totalOrders : 0;
    const activeSessions = sessions.filter((session) => session.status === "open").length;
    const totalTax = paidOrders.reduce((sum, order) => sum + Number(order.tax || 0), 0);
    const productSales = buildProductSales(paidOrders, products);
    const selectedOrder = selectedOrderId
      ? allOrders.find((order) => String(order.id) === String(selectedOrderId)) || null
      : null;

    container.innerHTML = `
      <div class="reports-header">
        <div>
          <h1>Reports and Dashboard</h1>
          <div style="font-size:var(--fs-sm);color:var(--color-text-muted)">${activeBranch ? `Branch: ${activeBranch.name}` : "Current branch"}</div>
        </div>
        <div class="reports-header-actions">
          <button class="btn btn-ghost btn-sm" id="export-csv-btn">CSV</button>
          <button class="btn btn-ghost btn-sm" id="export-xls-btn">XLS</button>
          <button class="btn btn-ghost btn-sm" id="export-pdf-btn">PDF</button>
        </div>
      </div>

      <div class="reports-filters">
        <div class="reports-filter">
          <label>Period</label>
          <select id="filter-period">
            <option value="all" ${filters.period === "all" ? "selected" : ""}>All Time</option>
            <option value="today" ${filters.period === "today" ? "selected" : ""}>Today</option>
            <option value="week" ${filters.period === "week" ? "selected" : ""}>This Week</option>
            <option value="month" ${filters.period === "month" ? "selected" : ""}>This Month</option>
            <option value="custom" ${filters.period === "custom" ? "selected" : ""}>Custom Range</option>
          </select>
        </div>
        ${
          filters.period === "custom"
            ? `
              <div class="reports-filter">
                <label>Start Date</label>
                <input type="date" id="filter-start" value="${filters.startDate}" />
              </div>
              <div class="reports-filter">
                <label>End Date</label>
                <input type="date" id="filter-end" value="${filters.endDate}" />
              </div>
            `
            : ""
        }
        <div class="reports-filter">
          <label>Session</label>
          <select id="filter-session">
            <option value="">All Sessions</option>
            ${sessions
              .map(
                (session) => `
                  <option value="${session.id}" ${String(filters.sessionId) === String(session.id) ? "selected" : ""}>
                    ${safeDate(session.openedAt)?.toLocaleDateString() || "Unknown"} (${session.responsible || "Staff"})
                  </option>
                `
              )
              .join("")}
          </select>
        </div>
        <div class="reports-filter">
          <label>Responsible</label>
          <select id="filter-responsible">
            <option value="">All Staff</option>
            ${responsibles
              .map(
                (responsible) => `
                  <option value="${responsible}" ${filters.responsible === responsible ? "selected" : ""}>${responsible}</option>
                `
              )
              .join("")}
          </select>
        </div>
        <div class="reports-filter">
          <label>Product</label>
          <select id="filter-product">
            <option value="">All Products</option>
            ${products
              .map(
                (product) => `
                  <option value="${product.id}" ${String(filters.product) === String(product.id) ? "selected" : ""}>${product.name}</option>
                `
              )
              .join("")}
          </select>
        </div>
        <button class="btn btn-sm btn-primary" id="apply-filters" style="align-self:flex-end">Apply</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-value">${currency}${totalSales.toFixed(2)}</div>
          <div class="stat-card-label">Total Sales</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${totalOrders}</div>
          <div class="stat-card-label">Paid Orders</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${currency}${avgOrder.toFixed(2)}</div>
          <div class="stat-card-label">Avg. Order Value</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${currency}${totalTax.toFixed(2)}</div>
          <div class="stat-card-label">Tax Collected</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${activeSessions}</div>
          <div class="stat-card-label">Active Sessions</div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card" style="grid-column:1/-1">
          <div class="chart-card-header">
            <span class="chart-card-title">Top Products</span>
            <div style="display:flex;gap:var(--space-sm)">
              <button class="btn btn-xs ${filters.productSort === "best" ? "btn-primary" : "btn-ghost"}" id="sort-best-btn">Best Selling</button>
              <button class="btn btn-xs ${filters.productSort === "low" ? "btn-primary" : "btn-ghost"}" id="sort-low-btn">Low Selling</button>
            </div>
          </div>
          <div style="display:grid;gap:var(--space-sm);padding-top:var(--space-sm)">
            ${
              productSales.length === 0
                ? `<div style="color:var(--color-text-muted)">No sales data yet</div>`
                : productSales
                    .slice(0, 10)
                    .map((item) => `
                      <div style="display:grid;grid-template-columns:minmax(120px,1fr) 80px 120px;gap:var(--space-md);align-items:center">
                        <div style="font-weight:600">${item.name}</div>
                        <div>${item.qty} sold</div>
                        <div style="color:var(--color-secondary);font-weight:700">${currency}${item.revenue.toFixed(2)}</div>
                      </div>
                    `)
                    .join("")
            }
          </div>
        </div>
      </div>

      <div class="order-history-section">
        <div class="order-history-header">
          <h3>Order History</h3>
          <span class="order-history-hint">Click a row to view details</span>
        </div>
        <div class="order-history-layout">
          <div class="orders-table-wrapper">
            ${
              orders.length === 0
                ? `
                  <div class="empty-state" style="padding:var(--space-xl)">
                    <div class="empty-state-text">No orders found matching the filters</div>
                  </div>
                `
                : `
                  <table class="orders-table">
                    <thead>
                      <tr>
                        <th>Order #</th>
                        <th>Table</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Staff</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${orders
                        .map(
                          (order) => `
                            <tr class="order-row ${String(selectedOrderId) === String(order.id) ? "selected" : ""}" data-order-id="${order.id}">
                              <td><span class="order-id-chip">#${shortOrderId(order.id)}</span></td>
                              <td>${order.tableNumber ? `<span class="table-chip">T${order.tableNumber}</span>` : "-"}</td>
                              <td><span class="item-count-badge">${(order.items || []).length}</span></td>
                              <td style="font-weight:700;color:var(--color-secondary)">${currency}${Number(order.total || 0).toFixed(2)}</td>
                              <td>${order.paymentMethod || "-"}</td>
                              <td><span class="badge ${order.paymentStatus === "paid" || order.status === "paid" ? "badge-success" : order.status === "open" ? "badge-warning" : "badge-info"}">${order.paymentStatus || order.status || "open"}</span></td>
                              <td>${order.responsible || "-"}</td>
                              <td>${safeDate(order.createdAt)?.toLocaleString() || "-"}</td>
                            </tr>
                          `
                        )
                        .join("")}
                    </tbody>
                  </table>
                `
            }
          </div>

          ${
            selectedOrder
              ? `
                <div class="order-detail-panel">
                  <div class="odp-header">
                    <div>
                      <div class="odp-title">Order #${shortOrderId(selectedOrder.id)}</div>
                      <div class="odp-subtitle">${selectedOrder.tableNumber ? `Table ${selectedOrder.tableNumber}` : "No table"}</div>
                    </div>
                    <button class="odp-close-btn" id="close-detail-btn">x</button>
                  </div>
                  <div class="odp-meta-grid">
                    <div class="odp-meta-item">
                      <div class="odp-meta-label">Status</div>
                      <div class="odp-meta-value">${selectedOrder.paymentStatus || selectedOrder.status || "-"}</div>
                    </div>
                    <div class="odp-meta-item">
                      <div class="odp-meta-label">Staff</div>
                      <div class="odp-meta-value">${selectedOrder.responsible || "-"}</div>
                    </div>
                    <div class="odp-meta-item">
                      <div class="odp-meta-label">Payment</div>
                      <div class="odp-meta-value">${selectedOrder.paymentMethod || "-"}</div>
                    </div>
                    <div class="odp-meta-item">
                      <div class="odp-meta-label">Opened</div>
                      <div class="odp-meta-value">${safeDate(selectedOrder.createdAt)?.toLocaleString() || "-"}</div>
                    </div>
                  </div>
                  <div class="odp-section-title">Items Ordered</div>
                  <div class="odp-items">
                    ${(selectedOrder.items || [])
                      .map(
                        (item) => `
                          <div class="odp-item-row">
                            <div class="odp-item-info">
                              <div class="odp-item-name">${item.name}</div>
                              <div class="odp-item-unit">${currency}${Number(item.price || 0).toFixed(2)} each</div>
                            </div>
                            <div class="odp-item-qty">x${item.qty}</div>
                            <div class="odp-item-total">${currency}${(Number(item.price || 0) * Number(item.qty || 0)).toFixed(2)}</div>
                          </div>
                        `
                      )
                      .join("")}
                  </div>
                  <div class="odp-totals">
                    <div class="odp-total-row"><span>Subtotal</span><span>${currency}${Number(selectedOrder.subtotal || 0).toFixed(2)}</span></div>
                    <div class="odp-total-row"><span>Tax</span><span>${currency}${Number(selectedOrder.tax || 0).toFixed(2)}</span></div>
                    <div class="odp-total-row grand"><span>Total</span><span>${currency}${Number(selectedOrder.total || 0).toFixed(2)}</span></div>
                  </div>
                </div>
              `
              : `
                <div class="order-detail-placeholder">
                  <div>Click any order row to view details</div>
                </div>
              `
          }
        </div>
      </div>
    `;

    document.getElementById("apply-filters")?.addEventListener("click", () => {
      filters.period = document.getElementById("filter-period")?.value || "all";
      filters.sessionId = document.getElementById("filter-session")?.value || "";
      filters.responsible = document.getElementById("filter-responsible")?.value || "";
      filters.product = document.getElementById("filter-product")?.value || "";
      filters.startDate = document.getElementById("filter-start")?.value || "";
      filters.endDate = document.getElementById("filter-end")?.value || "";
      render();
    });

    document.getElementById("filter-period")?.addEventListener("change", (event) => {
      filters.period = event.target.value;
      render();
    });

    document.getElementById("sort-best-btn")?.addEventListener("click", () => {
      filters.productSort = "best";
      render();
    });
    document.getElementById("sort-low-btn")?.addEventListener("click", () => {
      filters.productSort = "low";
      render();
    });

    container.querySelectorAll(".order-row").forEach((row) => {
      row.addEventListener("click", () => {
        selectedOrderId = String(selectedOrderId) === String(row.dataset.orderId) ? null : row.dataset.orderId;
        render();
      });
    });

    document.getElementById("close-detail-btn")?.addEventListener("click", () => {
      selectedOrderId = null;
      render();
    });

    document.getElementById("export-csv-btn")?.addEventListener("click", () => {
      const data = orders.map((order) => ({
        OrderID: shortOrderId(order.id),
        Table: order.tableNumber || "",
        Items: (order.items || []).length,
        Total: Number(order.total || 0).toFixed(2),
        Payment: order.paymentMethod || "",
        Status: order.paymentStatus || order.status || "",
        Staff: order.responsible || "",
        Date: safeDate(order.createdAt)?.toLocaleString() || "",
      }));
      exportToCSV(data, "pos_report");
      showToast("CSV exported!", "success");
    });

    document.getElementById("export-xls-btn")?.addEventListener("click", () => {
      const data = orders.map((order) => ({
        "Order ID": shortOrderId(order.id),
        Table: order.tableNumber || "",
        Items: (order.items || []).length,
        Total: Number(order.total || 0),
        Payment: order.paymentMethod || "",
        Status: order.paymentStatus || order.status || "",
        Staff: order.responsible || "",
        Date: safeDate(order.createdAt)?.toLocaleString() || "",
      }));
      exportToXLS(data, "pos_report", "Sales Report");
      showToast("XLS exported!", "success");
    });

    document.getElementById("export-pdf-btn")?.addEventListener("click", () => {
      const headers = ["Order #", "Table", "Items", "Total", "Payment", "Status", "Staff", "Date"];
      const rows = orders.map((order) => [
        shortOrderId(order.id),
        order.tableNumber ? `T${order.tableNumber}` : "",
        (order.items || []).length,
        `${currency}${Number(order.total || 0).toFixed(2)}`,
        order.paymentMethod || "",
        order.paymentStatus || order.status || "",
        order.responsible || "",
        safeDate(order.createdAt)?.toLocaleDateString() || "",
      ]);
      exportToPDF("POS Sales Report", headers, rows);
    });
  }

  render();
}
