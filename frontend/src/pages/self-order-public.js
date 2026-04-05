import store from "../store.js";
import router from "../router.js";
import { showToast } from "../components/toast.js";
import { icon } from "../utils/icons.js";

export async function renderSelfOrderPublic(token) {
  const app = document.getElementById("app");
  const currency = store.get("settings")?.currency || "₹";

  app.innerHTML = `
    <div class="payment-layout">
      <div class="card" style="width:min(960px, calc(100vw - 32px));text-align:center">
        <div class="empty-state" style="padding:var(--space-2xl)">
          <div class="empty-state-icon">${icon("qr", "", "Loading self order")}</div>
          <div class="empty-state-text">Loading self-order menu...</div>
        </div>
      </div>
    </div>
  `;

  try {
    const tokenData = await store.fetchSelfOrderToken(token);
    let cartItems = [];

    const render = () => {
      const products = tokenData.products || [];
      const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const tax = cartItems.reduce((sum, item) => sum + ((item.price * item.qty * (item.tax || 0)) / 100), 0);
      const total = subtotal + tax;

      app.innerHTML = `
        <div class="payment-layout" style="justify-content:flex-start;padding:var(--space-lg)">
          <div class="card" style="width:min(1080px, 100%);margin:0 auto">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-lg);margin-bottom:var(--space-lg);flex-wrap:wrap">
              <div>
                <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-xs)">
                  ${icon("mobile", "ui-icon-lg", "Self ordering")}
                  <h1 style="font-size:var(--fs-2xl)">Table ${tokenData.table?.table_number || ""} Self Ordering</h1>
                </div>
                <div style="font-size:var(--fs-sm);color:var(--color-text-muted)">${tokenData.branch_name || "Restaurant Branch"}</div>
              </div>
              <div class="badge badge-primary" style="font-size:var(--fs-xs)">Live Token</div>
            </div>

            <div style="display:grid;grid-template-columns:minmax(0,1.6fr) minmax(300px,1fr);gap:var(--space-lg)">
              <div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-sm)">
                  ${products.map((product) => `
                    <button class="order-product-card" data-product-id="${product.id}" type="button">
                      <div class="order-product-emoji">${icon("products", "", product.name)}</div>
                      <div class="order-product-name">${product.name}</div>
                      <div class="order-product-price">${currency}${Number(product.price).toFixed(2)}</div>
                    </button>
                  `).join("")}
                </div>
              </div>

              <div class="card" style="background:var(--color-bg-alt);padding:var(--space-lg)">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md)">
                  <h3 style="font-size:var(--fs-lg)">Your Order</h3>
                  <span class="badge ${cartItems.length ? "badge-success" : "badge-info"}">${cartItems.length} item${cartItems.length === 1 ? "" : "s"}</span>
                </div>

                <div id="public-self-order-cart">
                  ${cartItems.length === 0 ? `
                    <div class="empty-state" style="padding:var(--space-xl) var(--space-md)">
                      <div class="empty-state-icon">${icon("table", "", "Add items")}</div>
                      <div class="empty-state-text">Tap items to add them to your order.</div>
                    </div>
                  ` : `
                    <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
                      ${cartItems.map((item, index) => `
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-sm);padding-bottom:var(--space-sm);border-bottom:1px solid var(--color-border)">
                          <div style="flex:1;min-width:0">
                            <div style="font-weight:600">${item.name}</div>
                            <div style="font-size:var(--fs-xs);color:var(--color-text-muted)">${currency}${Number(item.price).toFixed(2)} each</div>
                          </div>
                          <div style="display:flex;align-items:center;gap:var(--space-xs)">
                            <button class="cart-qty-btn public-dec" data-index="${index}" type="button">${icon("minus", "", "Decrease quantity")}</button>
                            <span class="cart-qty-value">${item.qty}</span>
                            <button class="cart-qty-btn public-inc" data-index="${index}" type="button">+</button>
                            <button class="cart-item-remove public-remove" data-index="${index}" type="button">${icon("trash", "", "Remove item")}</button>
                          </div>
                        </div>
                      `).join("")}
                    </div>
                  `}
                </div>

                <div style="margin-top:var(--space-lg);padding-top:var(--space-md);border-top:1px solid var(--color-border);display:flex;flex-direction:column;gap:6px">
                  <div class="cart-summary-row"><span class="label">Subtotal</span><span>${currency}${subtotal.toFixed(2)}</span></div>
                  <div class="cart-summary-row"><span class="label">Tax</span><span>${currency}${tax.toFixed(2)}</span></div>
                  <div class="cart-summary-row total"><span>Total</span><span>${currency}${total.toFixed(2)}</span></div>
                </div>

                <button class="btn btn-primary btn-block" id="public-submit-order" type="button" ${cartItems.length === 0 ? "disabled" : ""} style="margin-top:var(--space-lg)">
                  Place Order
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      app.querySelectorAll("[data-product-id]").forEach((button) => {
        button.addEventListener("click", () => {
          const product = products.find((entry) => String(entry.id) === String(button.dataset.productId));
          if (!product) return;
          const existing = cartItems.find((item) => String(item.productId) === String(product.id));
          if (existing) existing.qty += 1;
          else {
            cartItems.push({
              productId: product.id,
              name: product.name,
              price: Number(product.price),
              qty: 1,
              tax: Number(product.tax || 0),
            });
          }
          render();
        });
      });

      app.querySelectorAll(".public-inc").forEach((button) => {
        button.addEventListener("click", () => {
          const item = cartItems[Number(button.dataset.index)];
          if (!item) return;
          item.qty += 1;
          render();
        });
      });

      app.querySelectorAll(".public-dec").forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.dataset.index);
          const item = cartItems[index];
          if (!item) return;
          item.qty -= 1;
          if (item.qty <= 0) cartItems.splice(index, 1);
          render();
        });
      });

      app.querySelectorAll(".public-remove").forEach((button) => {
        button.addEventListener("click", () => {
          cartItems.splice(Number(button.dataset.index), 1);
          render();
        });
      });

      document.getElementById("public-submit-order")?.addEventListener("click", async () => {
        try {
          const response = await store.submitSelfOrder(token, cartItems);
          cartItems = [];
          render();
          showToast(`Order ${response.order_number} sent to kitchen`, "success");
          app.querySelector(".card")?.insertAdjacentHTML(
            "afterbegin",
            `<div class="badge badge-success" style="margin-bottom:var(--space-md);display:inline-flex">${icon("circleCheck", "", "Order sent")}Order sent to kitchen</div>`
          );
        } catch (error) {
          showToast(error.message, "error");
        }
      });
    };

    render();
  } catch (error) {
    app.innerHTML = `
      <div class="payment-layout">
        <div class="card" style="width:min(640px, calc(100vw - 32px));text-align:center">
          <div class="empty-state" style="padding:var(--space-2xl)">
            <div class="empty-state-icon">${icon("alert", "", "Token unavailable")}</div>
            <div class="empty-state-text">${error.message || "This self-order link is no longer available."}</div>
            <button class="btn btn-ghost" id="back-login" type="button">Back</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("back-login")?.addEventListener("click", () => router.navigate("/login"));
  }
}
