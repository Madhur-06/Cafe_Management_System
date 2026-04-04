import store from "../store.js";
import { showToast } from "../components/toast.js";

function methodDescription(type) {
  if (type === "cash") return "Accept cash payments at the register. Change will be calculated automatically.";
  if (type === "card") return "Accept debit and credit card payments directly at checkout.";
  return "Generate QR codes for UPI payments so customers can scan and pay quickly.";
}

function methodTypeLabel(type) {
  if (type === "cash") return "Cash Payments";
  if (type === "card") return "Card Payments";
  return "UPI QR Payments";
}

export function renderPaymentMethods(container) {
  function render() {
    const methods = store.getAll("paymentMethods");

    container.innerHTML = `
      <div class="backend-header">
        <div>
          <h1>Payment Methods</h1>
          <div style="font-size:var(--fs-sm);color:var(--color-text-muted)">Fixed methods for checkout: Cash, Card, and UPI</div>
        </div>
      </div>
      <p style="color:var(--color-text-muted);margin-bottom:var(--space-xl);font-size:var(--fs-sm)">
        Enable or disable payment methods available at checkout. Only enabled methods will appear in the POS terminal.
      </p>

      <div class="payment-methods-grid stagger">
        ${methods.map((method) => `
          <div class="card payment-method-card animate-fadeInUp" data-id="${method.id}">
            <div class="payment-method-header">
              <div class="payment-method-info">
                <div class="payment-method-icon">${method.icon}</div>
                <div>
                  <div class="payment-method-name">${method.name}</div>
                  <div class="payment-method-type">${methodTypeLabel(method.type)}</div>
                </div>
              </div>
              <div class="payment-method-toggle-wrap">
                <span class="badge ${method.enabled ? "badge-success" : "badge-warning"}">${method.enabled ? "Enabled" : "Disabled"}</span>
                <label class="toggle">
                  <input type="checkbox" ${method.enabled ? "checked" : ""} data-toggle="${method.id}" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>

            <p class="payment-method-description">${methodDescription(method.type)}</p>

            ${
              method.type === "upi"
                ? method.enabled
                  ? `
                    <div class="upi-config">
                      <div class="form-group">
                        <label class="form-label">UPI ID</label>
                        <input type="text" class="form-input" id="upi-id-input" value="${method.upiId || ""}" placeholder="example@ybl.com" />
                      </div>
                      <div class="payment-method-actions">
                        <button class="btn btn-sm btn-primary" id="save-upi-btn">Save UPI ID</button>
                      </div>
                    </div>
                  `
                  : `<div class="payment-method-note">Enable UPI to configure your QR payment ID.</div>`
                : ""
            }
          </div>
        `).join("")}
      </div>
    `;

    container.querySelectorAll("[data-toggle]").forEach((input) => {
      input.addEventListener("change", async (event) => {
        const id = event.target.dataset.toggle;
        try {
          await store.updatePaymentMethod(id, { enabled: event.target.checked });
          showToast(`Payment method ${event.target.checked ? "enabled" : "disabled"}`, "info");
          render();
        } catch (error) {
          event.target.checked = !event.target.checked;
          showToast(error.message, "error");
        }
      });
    });

    document.getElementById("save-upi-btn")?.addEventListener("click", async () => {
      const upiId = document.getElementById("upi-id-input")?.value.trim();
      if (!upiId) {
        showToast("Please enter a UPI ID", "error");
        return;
      }
      const upiMethod = methods.find((method) => method.type === "upi");
      if (!upiMethod) {
        showToast("UPI method not found", "error");
        return;
      }
      try {
        await store.updatePaymentMethod(upiMethod.id, { upiId });
        showToast("UPI ID saved", "success");
        render();
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }

  render();
}
