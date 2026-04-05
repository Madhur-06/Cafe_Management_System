/* ==========================================================================
   Self Order - Minimal branch/table QR management
   ========================================================================== */

import store from "../store.js";
import { showToast } from "../components/toast.js";
import { generateTokenQR } from "../utils/qr.js";
import { icon } from "../utils/icons.js";

export function renderSelfOrder(container) {
  const tables = store.getAll("tables").filter((table) => table.active);
  const session = store.getActiveSession();
  const activeBranch = store.getAll("branches").find((branch) => String(branch.id) === String(store.getActiveBranchId())) || null;
  let selectedTable = null;
  let generatedToken = null;

  function selfOrderUrl(token) {
    return `${window.location.origin}${window.location.pathname}#/self-order/${token}`;
  }

  function render() {
    const currentTable = tables.find((table) => String(table.id) === String(selectedTable));
    const tokenUrl = generatedToken ? selfOrderUrl(generatedToken.token) : "";

    container.innerHTML = `
      <div class="backend-header">
        <div>
          <h1>Self Ordering</h1>
          <div style="font-size:var(--fs-sm);color:var(--color-text-muted)">${activeBranch ? `Branch: ${activeBranch.name}` : "Current branch"}</div>
        </div>
      </div>

      <p style="color:var(--color-text-muted);margin-bottom:var(--space-xl);font-size:var(--fs-sm)">
        Generate a live QR for a table in this branch. Customers scan on their phone, place the order, and it goes directly to this branch's kitchen.
      </p>

      ${!session ? `
        <div class="card" style="max-width:520px;text-align:center;padding:var(--space-2xl)">
          <div style="font-size:2rem;margin-bottom:var(--space-md)">${icon("alert", "ui-icon-xl", "Session required")}</div>
          <p style="color:var(--color-text-muted)">Please open a POS session first to enable self-ordering.</p>
          <a href="#/backend/pos-settings" class="btn btn-primary" style="margin-top:var(--space-md)">Go to POS Settings</a>
        </div>
      ` : `
        <div style="display:grid;grid-template-columns:minmax(320px,1fr) minmax(340px,1fr);gap:var(--space-xl);max-width:980px">
          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-sm);margin-bottom:var(--space-md);flex-wrap:wrap">
              <h3>Select Table</h3>
              <span class="badge badge-success">Session ${session.id} Active</span>
            </div>
            <p style="font-size:var(--fs-sm);color:var(--color-text-muted);margin-bottom:var(--space-md)">
              Only active tables from the current branch are shown here.
            </p>

            ${tables.length === 0 ? `
              <div class="empty-state" style="padding:var(--space-xl) var(--space-md)">
                <div class="empty-state-icon">${icon("table", "", "No tables")}</div>
                <div class="empty-state-text">No active tables available in this branch.</div>
              </div>
            ` : `
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-sm)">
                ${tables.map((table) => `
                  <button class="btn ${String(selectedTable) === String(table.id) ? "btn-primary" : "btn-ghost"} table-select-btn" data-table="${table.id}">
                    T${table.number}
                  </button>
                `).join("")}
              </div>
            `}

            ${selectedTable ? `
              <div style="margin-top:var(--space-lg);padding-top:var(--space-lg);border-top:1px solid var(--color-border);display:flex;flex-direction:column;gap:var(--space-sm)">
                <div style="font-size:var(--fs-sm);color:var(--color-text-muted)">Selected table</div>
                <div style="font-size:var(--fs-lg);font-weight:700">Table ${currentTable?.number || "?"}</div>
                <button class="btn btn-secondary btn-block" id="generate-token-btn" type="button">
                  ${generatedToken ? "Regenerate QR" : "Generate QR"}
                </button>
              </div>
            ` : ""}
          </div>

          <div class="card" style="text-align:center">
            <h3 style="margin-bottom:var(--space-md)">Table Ordering QR</h3>

            ${generatedToken ? `
              <div style="background:#fff;border-radius:var(--radius-md);display:inline-block;padding:var(--space-md);margin-bottom:var(--space-md)">
                <canvas id="self-order-qr"></canvas>
              </div>
              <p style="font-size:var(--fs-sm);color:var(--color-text-muted)">
                Scan this QR on a phone to open the live ordering page for Table ${currentTable?.number || "?"}.
              </p>
              <div style="margin-top:var(--space-md);display:flex;flex-direction:column;gap:var(--space-sm)">
                <div class="badge badge-info" style="display:inline-flex;align-self:center">${activeBranch?.name || "Current branch"}</div>
                <div style="font-size:var(--fs-xs);color:var(--color-text-muted);word-break:break-all">${tokenUrl}</div>
                <div style="display:flex;gap:var(--space-sm);justify-content:center;flex-wrap:wrap">
                  <button class="btn btn-sm btn-ghost" id="copy-token-link" type="button">Copy Link</button>
                  <button class="btn btn-sm btn-primary" id="open-token-link" type="button">Open Link</button>
                </div>
              </div>
            ` : `
              <div class="empty-state" style="padding:var(--space-2xl) var(--space-md)">
                <div class="empty-state-icon">${icon("qr", "", "Generate QR")}</div>
                <div class="empty-state-text">Select a table and generate a QR code for live phone ordering.</div>
              </div>
            `}
          </div>
        </div>
      `}
    `;

    container.querySelectorAll(".table-select-btn").forEach((button) => {
      button.addEventListener("click", () => {
        selectedTable = button.dataset.table;
        generatedToken = null;
        render();
      });
    });

    document.getElementById("generate-token-btn")?.addEventListener("click", async () => {
      try {
        generatedToken = await store.createSelfOrderToken(selectedTable, session.id);
        render();
        const canvas = document.getElementById("self-order-qr");
        if (canvas) {
          await generateTokenQR(canvas, selfOrderUrl(generatedToken.token));
        }
        showToast(`QR generated for Table ${currentTable?.number || "?"}`, "success");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    document.getElementById("copy-token-link")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(tokenUrl);
        showToast("Self-order link copied", "success");
      } catch {
        showToast("Copy is not available on this device", "error");
      }
    });

    document.getElementById("open-token-link")?.addEventListener("click", () => {
      window.open(tokenUrl, "_blank");
    });
  }

  render();
}
