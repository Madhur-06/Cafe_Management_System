/* ==========================================================================
   Order Screen - Product selection and cart
   ========================================================================== */

import store from "../store.js";
import router from "../router.js";
import { showToast } from "../components/toast.js";
import { icon } from "../utils/icons.js";

const categoryLabels = {
  All: "All",
  Pizza: "Pizza",
  Pasta: "Pasta",
  Burger: "Burger",
  Coffee: "Coffee",
  Drinks: "Drinks",
  Dessert: "Dessert",
  Snacks: "Snacks",
};

export function renderOrderScreen(container, tableId) {
  const products = store.getAll("products");
  const categories = ["All", ...new Set(products.map((product) => product.category).filter(Boolean))];
  const table = store.find("tables", tableId);
  const currency = store.get("settings")?.currency || "₹";

  let activeCategory = "All";

  let orders = store.getAll("orders");
  let order = store.getDraftOrder();
  if (!order || String(order.tableId) !== String(tableId)) {
    order = orders.find(
      (entry) => String(entry.tableId) === String(tableId) && (entry.status === "open" || entry.status === "in_progress")
    );
  }
  if (!order) {
    order = store.add("orders", {
      tableId,
      tableNumber: table?.number,
      status: "open",
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      sessionId: store.getActiveSession()?.id,
      responsible: store.getCurrentUser()?.fullName || "Staff",
    });
  }

  let cartItems = Array.isArray(order.items) ? [...order.items] : [];

  function recalc() {
    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
    const tax = cartItems.reduce((sum, item) => sum + (item.price * item.qty * (item.tax || 0)) / 100, 0);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }

  function saveOrder() {
    const { subtotal, tax, total } = recalc();
    const nextOrder = { ...order, items: cartItems, subtotal, tax, total };
    if (store.find("orders", order.id)) {
      order = store.update("orders", order.id, nextOrder);
    } else {
      order = store.add("orders", nextOrder);
    }
    store.setDraftOrder(order);
  }

  function render() {
    const filteredProducts =
      activeCategory === "All"
        ? products
        : products.filter((product) => product.category === activeCategory);

    const { subtotal, tax, total } = recalc();
    const canGoToPayment = order.status === "in_progress" || order.status === "paid";

    container.innerHTML = `
      <div class="order-layout">
        <div class="order-categories">
          ${categories
            .map(
              (category) => `
                <button class="order-cat-btn ${activeCategory === category ? "active" : ""}" data-cat="${category}">
                  <span>${categoryLabels[category] || category}</span>
                </button>
              `
            )
            .join("")}
        </div>

        <div class="order-products">
          <div class="order-products-grid stagger">
            ${filteredProducts
              .map(
                (product) => `
                  <div class="order-product-card animate-fadeInUp" data-product="${product.id}">
                    <div class="order-product-emoji">${icon("products", "", product.name)}</div>
                    <div class="order-product-name">${product.name}</div>
                    <div class="order-product-price">${currency}${Number(product.price).toFixed(2)}</div>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>

        <div class="order-cart">
          <div class="cart-header">
            <h3>Current Order</h3>
            <span class="cart-table-badge">Table ${table?.number || "?"}</span>
          </div>

          <div class="cart-items" id="cart-items">
            ${
              cartItems.length === 0
                ? `
                  <div class="empty-state" style="padding:var(--space-xl) var(--space-md)">
                    <div class="empty-state-text" style="font-size:var(--fs-sm)">No items yet.<br>Tap a product to add it.</div>
                  </div>
                `
                : cartItems
                    .map(
                      (item, index) => `
                        <div class="cart-item">
                          <div class="cart-item-info">
                            <div class="cart-item-name">${item.name}</div>
                            <div class="cart-item-price">${currency}${Number(item.price).toFixed(2)} ea.</div>
                          </div>
                          <div class="cart-item-qty">
                            <button class="cart-qty-btn" data-action="dec" data-idx="${index}">${icon("minus", "", "Decrease quantity")}</button>
                            <span class="cart-qty-value">${item.qty}</span>
                            <button class="cart-qty-btn" data-action="inc" data-idx="${index}">+</button>
                          </div>
                          <div class="cart-item-total">${currency}${(item.price * item.qty).toFixed(2)}</div>
                          <span class="cart-item-remove" data-action="remove" data-idx="${index}">${icon("trash", "", "Remove item")}</span>
                        </div>
                      `
                    )
                    .join("")
            }
          </div>

          <div class="cart-summary">
            <div class="cart-summary-row">
              <span class="label">Subtotal</span>
              <span>${currency}${subtotal.toFixed(2)}</span>
            </div>
            <div class="cart-summary-row">
              <span class="label">Tax</span>
              <span>${currency}${tax.toFixed(2)}</span>
            </div>
            <div class="cart-summary-row total">
              <span>Total</span>
              <span>${currency}${total.toFixed(2)}</span>
            </div>
          </div>

          <div class="cart-actions">
            <button class="btn btn-accent btn-block" id="send-kitchen-btn" ${cartItems.length === 0 ? "disabled" : ""}>
              Send to Kitchen
            </button>
            <button class="btn btn-primary btn-block" id="go-payment-btn" ${cartItems.length === 0 || !canGoToPayment ? "disabled" : ""}>
              Payment
            </button>
          </div>
          ${cartItems.length > 0 && !canGoToPayment ? `<p style="margin-top:var(--space-sm);font-size:var(--fs-xs);color:var(--color-text-muted)">Send the order to kitchen before taking payment.</p>` : ""}
        </div>
      </div>
    `;

    container.querySelectorAll(".order-cat-btn").forEach((button) => {
      button.addEventListener("click", () => {
        activeCategory = button.dataset.cat;
        render();
      });
    });

    container.querySelectorAll(".order-product-card").forEach((card) => {
      card.addEventListener("click", () => {
        const product = products.find((entry) => String(entry.id) === String(card.dataset.product));
        if (!product) return;

        const existingIndex = cartItems.findIndex((item) => String(item.productId) === String(product.id));
        if (existingIndex >= 0) {
          cartItems[existingIndex].qty += 1;
        } else {
          cartItems.push({
            productId: product.id,
            name: product.name,
            price: Number(product.price),
            qty: 1,
            tax: Number(product.tax || 0),
          });
        }
        saveOrder();
        render();
      });
    });

    container.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.idx);
        const action = button.dataset.action;

        if (action === "inc") {
          cartItems[index].qty += 1;
        } else if (action === "dec") {
          cartItems[index].qty -= 1;
          if (cartItems[index].qty <= 0) cartItems.splice(index, 1);
        } else if (action === "remove") {
          cartItems.splice(index, 1);
        }

        saveOrder();
        render();
      });
    });

    document.getElementById("send-kitchen-btn")?.addEventListener("click", async () => {
      try {
        saveOrder();
        const sentOrder = await store.sendOrder(store.getDraftOrder());
        order = { ...store.getDraftOrder(), id: sentOrder.id, backendId: sentOrder.id, status: "in_progress" };
        store.setDraftOrder(order);
        showToast("Order sent to kitchen!", "success");
        render();
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    document.getElementById("go-payment-btn")?.addEventListener("click", () => {
      saveOrder();
      if (!(order.status === "in_progress" || order.status === "paid")) {
        showToast("Send the order to kitchen before opening payment", "error");
        return;
      }
      router.navigate(`#/pos/payment/${store.getDraftOrder()?.id || order.id}`);
    });
  }

  render();
}
