/* ==========================================================================
   Users - Admin-only user management
   ========================================================================== */

import store from "../store.js";
import { showToast } from "../components/toast.js";

const ROLE_OPTIONS = [
  { value: "staff", label: "Staff" },
  { value: "chef", label: "Chef" },
];

export async function renderUsers(container) {
  let editingUserId = null;

  async function loadUsers() {
    try {
      await store.fetchUsers();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function render() {
    const users = store.getAll("users");
    const branches = store.getAll("branches");
    const currentUser = store.getCurrentUser();
    const editingUser = editingUserId ? users.find((user) => String(user.id) === String(editingUserId)) : null;

    container.innerHTML = `
      <div class="backend-header">
        <h1>Users</h1>
      </div>

      <div class="card" style="margin-bottom:var(--space-xl)">
        <h3 style="margin-bottom:var(--space-md)">${editingUser ? "Edit User" : "Create User"}</h3>
        <form id="user-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--space-md)">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input class="form-input" id="user-name" type="text" value="${editingUser?.name || ""}" placeholder="Enter full name" />
          </div>
          <div class="form-group">
            <label class="form-label">Username</label>
            <input class="form-input" id="user-username" type="text" value="${editingUser?.username || ""}" placeholder="Enter username" />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" id="user-email" type="email" value="${editingUser?.email || ""}" placeholder="user@example.com" />
          </div>
          <div class="form-group">
            <label class="form-label">Password ${editingUser ? '<span style="color:var(--color-text-muted)">(leave blank to keep current)</span>' : ''}</label>
            <input class="form-input" id="user-password" type="password" placeholder="${editingUser ? "Optional new password" : "Minimum 6 characters"}" />
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <select class="form-input" id="user-role" ${editingUser && String(editingUser.id) === String(currentUser?.id) ? "disabled" : ""}>
              ${ROLE_OPTIONS.map((role) => `<option value="${role.value}" ${editingUser?.role === role.value ? "selected" : ""}>${role.label}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Branch</label>
            <select class="form-input" id="user-branch" ${editingUser && String(editingUser.id) === String(currentUser?.id) ? "disabled" : ""}>
              <option value="">Select branch</option>
              ${branches.map((branch) => `<option value="${branch.id}" ${String(editingUser?.branch_id || editingUser?.branchId || "") === String(branch.id) ? "selected" : ""}>${branch.name}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-input" id="user-status" ${editingUser && String(editingUser.id) === String(currentUser?.id) ? "disabled" : ""}>
              <option value="true" ${editingUser ? (editingUser.is_active ? "selected" : "") : "selected"}>Active</option>
              <option value="false" ${editingUser && !editingUser.is_active ? "selected" : ""}>Inactive</option>
            </select>
          </div>
          <div style="display:flex;align-items:end;gap:var(--space-sm);flex-wrap:wrap">
            <button class="btn btn-primary" type="submit">${editingUser ? "Save Changes" : "Create Account"}</button>
            ${editingUser ? '<button class="btn btn-ghost" type="button" id="cancel-edit-btn">Cancel</button>' : ""}
          </div>
        </form>
      </div>

      <div class="card">
        <h3 style="margin-bottom:var(--space-md)">Existing Users</h3>
        ${
          users.length === 0
            ? `<div class="empty-state"><div class="empty-state-text">No users found</div></div>`
            : `
              <div style="display:grid;gap:var(--space-sm)">
                ${users.map((user) => `
                  <div class="session-item">
                    <div class="session-item-info">
                      <span class="badge ${user.is_active ? "badge-success" : "badge-warning"}">${user.role}</span>
                      <div>
                        <div style="font-weight:600;font-size:var(--fs-sm)">${user.name}</div>
                        <div style="font-size:var(--fs-xs);color:var(--color-text-muted)">@${user.username}</div>
                        <div style="font-size:var(--fs-xs);color:var(--color-text-muted)">${user.email}</div>
                        <div style="font-size:var(--fs-xs);color:var(--color-text-muted)">${user.branch_name || "No branch assigned"}</div>
                      </div>
                    </div>
                    <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap">
                      <button class="btn btn-sm btn-ghost edit-user-btn" data-user-id="${user.id}">Edit</button>
                      ${String(user.id) !== String(currentUser?.id) ? `<button class="btn btn-sm btn-ghost delete-user-btn" data-user-id="${user.id}" style="color:var(--color-danger)">Remove</button>` : ""}
                    </div>
                  </div>
                `).join("")}
              </div>
            `
        }
      </div>
    `;

    document.getElementById("user-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = document.getElementById("user-name").value.trim();
      const username = document.getElementById("user-username").value.trim();
      const email = document.getElementById("user-email").value.trim();
      const password = document.getElementById("user-password").value;
      const role = document.getElementById("user-role").value;
      const branch_id = document.getElementById("user-branch").value || null;
      const is_active = document.getElementById("user-status").value === "true";

      if (!name || !username || !email) {
        showToast("Name, username, and email are required", "error");
        return;
      }
      if ((!editingUser || String(editingUser.id) !== String(currentUser?.id)) && !branch_id) {
        showToast("Please assign a branch", "error");
        return;
      }
      if (!editingUser && password.length < 6) {
        showToast("Password must be at least 6 characters", "error");
        return;
      }
      if (editingUser && password && password.length < 6) {
        showToast("New password must be at least 6 characters", "error");
        return;
      }

      try {
        if (editingUser) {
          await store.updateUser(editingUser.id, { branch_id, name, username, email, password, role, is_active });
          showToast("User updated successfully", "success");
          editingUserId = null;
        } else {
          await store.createUser({ branch_id, name, username, email, password, role });
          showToast("User created successfully", "success");
        }
        render();
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    document.getElementById("cancel-edit-btn")?.addEventListener("click", () => {
      editingUserId = null;
      render();
    });

    container.querySelectorAll(".edit-user-btn").forEach((button) => {
      button.addEventListener("click", () => {
        editingUserId = button.dataset.userId;
        render();
      });
    });

    container.querySelectorAll(".delete-user-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await store.deleteUser(button.dataset.userId);
          showToast("User removed successfully", "success");
          if (String(editingUserId) === String(button.dataset.userId)) editingUserId = null;
          render();
        } catch (error) {
          showToast(error.message, "error");
        }
      });
    });
  }

  await loadUsers();
  render();
}
