/* ==========================================================================
   Payment Screen - Payment method selection, UPI QR, confirmation
   ========================================================================== */

import store from "../store.js";
import router from "../router.js";
import { showToast } from "../components/toast.js";
import { generateUPIQR } from "../utils/qr.js";

export function renderPaymentScreen(container, orderId) {
  let order = store.find("orders", orderId) || store.getDraftOrder();
  const currency = store.get("settings")?.currency || "₹";
  const paymentMethods = store.getAll("paymentMethods").filter((method) => method.enabled);

  if (!order) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Order not found</div></div>';
    return;
  }

  let selectedMethod = null;
  let viewState = "select";

  function render() {
    if (viewState === "success") {
      renderSuccess();
      return;
    }
    if (viewState === "qr") {
      renderQR();
      return;
    }

    container.innerHTML = `
      <div class="payment-layout">
        <div class="payment-amount">
          <div class="payment-amount-label">Total Amount</div>
          <div class="payment-amount-value">${currency}${Number(order.total).toFixed(2)}</div>
        </div>

        <div class="payment-methods-row">
          ${
            paymentMethods.length === 0
              ? `<p style="color:var(--color-danger);font-size:var(--fs-sm)">No payment methods enabled. Enable them in Payment Methods settings.</p>`
              : paymentMethods
                  .map(
                    (method) => `
                      <div class="payment-method-btn ${String(selectedMethod) === String(method.id) ? "selected" : ""}" data-method="${method.id}">
                        <div class="payment-method-btn-icon">${method.icon}</div>
                        <div class="payment-method-btn-name">${method.name}</div>
                      </div>
                    `
                  )
                  .join("")
          }
        </div>

        ${
          selectedMethod
            ? `
              <div class="payment-confirm">
                <button class="btn btn-primary btn-lg" id="validate-payment-btn" style="min-width:200px">
                  Validate Payment
                </button>
              </div>
            `
            : `<p style="color:var(--color-text-muted);font-size:var(--fs-sm)">Select a payment method to proceed</p>`
        }

        <button class="btn btn-ghost" id="back-to-order-btn" style="margin-top:var(--space-lg)">
          Back to Order
        </button>
      </div>
    `;

    container.querySelectorAll(".payment-method-btn").forEach((button) => {
      button.addEventListener("click", () => {
        selectedMethod = button.dataset.method;
        render();
      });
    });

    document.getElementById("validate-payment-btn")?.addEventListener("click", async () => {
      const method = paymentMethods.find((entry) => String(entry.id) === String(selectedMethod));
      if (!method) {
        showToast("Select a payment method first", "error");
        return;
      }
      if (method.type === "upi") {
        viewState = "qr";
        render();
        return;
      }
      await completePayment(method.id);
    });

    document.getElementById("back-to-order-btn")?.addEventListener("click", () => {
      router.navigate(`#/pos/order/${order.tableId}`);
    });
  }

  function renderQR() {
    const upiMethod = paymentMethods.find((method) => method.type === "upi");
    const upiId = upiMethod?.upiId || "store@upi";

    container.innerHTML = `
      <div class="payment-layout">
        <div class="qr-payment-screen">
          <h3>UPI QR</h3>
          <div class="qr-canvas-wrapper">
            <canvas id="qr-canvas"></canvas>
          </div>
          <div class="qr-amount">Amount: ${currency}${Number(order.total).toFixed(2)}</div>
          <div class="qr-actions">
            <button class="btn btn-primary btn-lg" id="qr-confirmed-btn">Confirmed</button>
            <button class="btn btn-ghost btn-lg" id="qr-cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
    `;

    const canvas = document.getElementById("qr-canvas");
    if (canvas) {
      generateUPIQR(canvas, { upiId, amount: order.total }).catch(() => {
        showToast("Failed to generate QR code", "error");
      });
    }

    document.getElementById("qr-confirmed-btn")?.addEventListener("click", async () => {
      if (!upiMethod) {
        showToast("UPI payment method is missing", "error");
        return;
      }
      await completePayment(upiMethod.id);
    });

    document.getElementById("qr-cancel-btn")?.addEventListener("click", () => {
      viewState = "select";
      selectedMethod = null;
      render();
    });
  }

  function renderSuccess() {
    container.innerHTML = `
      <div class="payment-layout">
        <div class="payment-success">
          <div class="payment-success-icon">OK</div>
          <h2>Payment Successful!</h2>
          <p>Thank you for your order</p>
          <div class="payment-success-amount">Amount Paid ${currency}${Number(order.total).toFixed(2)}</div>
          <div style="display:flex;gap:var(--space-md);justify-content:center;flex-wrap:wrap">
            <button class="btn btn-ghost" id="email-receipt-btn">Email Receipt</button>
            <button class="btn btn-secondary" id="clear-table-btn">Clear Table</button>
            <button class="btn btn-primary" id="new-order-btn">Floor View</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("email-receipt-btn")?.addEventListener("click", () => {
      showToast("Receipt sent! (demo)", "success");
    });

    document.getElementById("clear-table-btn")?.addEventListener("click", () => {
      if (order.tableId) {
        store.update("tables", order.tableId, { status: "available" });
      }
      store.remove("currentOrder");
      showToast("Table cleared and reset to available!", "success");
      router.navigate("#/pos/floor");
    });

    document.getElementById("new-order-btn")?.addEventListener("click", () => {
      store.remove("currentOrder");
      router.navigate("#/pos/floor");
    });
  }

  async function completePayment(methodId) {
    try {
      if (!methodId) {
        throw new Error("Select a payment method first");
      }
      const paidOrder = await store.payOrder(store.getDraftOrder() || order, methodId);
      order = paidOrder;
      store.remove("currentOrder");
      showToast(`Payment of ${currency}${Number(order.total).toFixed(2)} confirmed!`, "success");
      viewState = "success";
      render();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  render();
}
