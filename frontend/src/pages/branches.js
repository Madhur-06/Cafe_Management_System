import store from "../store.js";
import { showToast } from "../components/toast.js";

export function renderBranches(container) {
  let editingBranchId = null;

  function render() {
    const branches = store.getAll("branches");
    const editingBranch = editingBranchId ? branches.find((branch) => String(branch.id) === String(editingBranchId)) : null;

    container.innerHTML = `
      <div class="backend-header">
        <h1>Branches</h1>
      </div>

      <div class="card" style="margin-bottom:var(--space-xl)">
        <h3 style="margin-bottom:var(--space-md)">${editingBranch ? "Edit Branch" : "Create Branch"}</h3>
        <form id="branch-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--space-md)">
          <div class="form-group">
            <label class="form-label">Branch Name</label>
            <input class="form-input" id="branch-name" type="text" value="${editingBranch?.name || ""}" placeholder="Enter branch name" />
          </div>
          <div class="form-group">
            <label class="form-label">Branch Code</label>
            <input class="form-input" id="branch-code" type="text" value="${editingBranch?.code || ""}" placeholder="MAIN" />
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-input" id="branch-phone" type="text" value="${editingBranch?.phone || ""}" placeholder="Phone number" />
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Address</label>
            <textarea class="form-input" id="branch-address" rows="3" placeholder="Branch address">${editingBranch?.address || ""}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-input" id="branch-status">
              <option value="true" ${editingBranch?.is_active !== false ? "selected" : ""}>Active</option>
              <option value="false" ${editingBranch?.is_active === false ? "selected" : ""}>Inactive</option>
            </select>
          </div>
          <div style="display:flex;align-items:end;gap:var(--space-sm);flex-wrap:wrap">
            <button class="btn btn-primary" type="submit">${editingBranch ? "Save Changes" : "Create Branch"}</button>
            ${editingBranch ? '<button class="btn btn-ghost" type="button" id="branch-cancel-btn">Cancel</button>' : ""}
          </div>
        </form>
      </div>

      <div class="card">
        <h3 style="margin-bottom:var(--space-md)">Existing Branches</h3>
        ${
          branches.length === 0
            ? `<div class="empty-state"><div class="empty-state-text">No branches found</div></div>`
            : `
              <div style="display:grid;gap:var(--space-sm)">
                ${branches.map((branch) => `
                  <div class="session-item">
                    <div class="session-item-info">
                      <span class="badge ${branch.is_active ? "badge-success" : "badge-warning"}">${branch.code}</span>
                      <div>
                        <div style="font-weight:600;font-size:var(--fs-sm)">${branch.name}</div>
                        <div style="font-size:var(--fs-xs);color:var(--color-text-muted)">${branch.phone || "No phone"}</div>
                        <div style="font-size:var(--fs-xs);color:var(--color-text-muted)">${branch.address || "No address"}</div>
                      </div>
                    </div>
                    <button class="btn btn-sm btn-ghost edit-branch-btn" data-branch-id="${branch.id}">Edit</button>
                  </div>
                `).join("")}
              </div>
            `
        }
      </div>
    `;

    document.getElementById("branch-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = {
        name: document.getElementById("branch-name").value.trim(),
        code: document.getElementById("branch-code").value.trim(),
        phone: document.getElementById("branch-phone").value.trim(),
        address: document.getElementById("branch-address").value.trim(),
        is_active: document.getElementById("branch-status").value === "true",
      };

      if (!payload.name || !payload.code) {
        showToast("Branch name and code are required", "error");
        return;
      }

      try {
        if (editingBranch) {
          await store.updateBranch(editingBranch.id, payload);
          showToast("Branch updated successfully", "success");
          editingBranchId = null;
        } else {
          await store.createBranch(payload);
          showToast("Branch created successfully", "success");
        }
        render();
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    document.getElementById("branch-cancel-btn")?.addEventListener("click", () => {
      editingBranchId = null;
      render();
    });

    container.querySelectorAll(".edit-branch-btn").forEach((button) => {
      button.addEventListener("click", () => {
        editingBranchId = button.dataset.branchId;
        render();
      });
    });
  }

  render();
}
