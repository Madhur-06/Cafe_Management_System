/* ==========================================================================
   Products - Product CRUD management
   ========================================================================== */

import store from "../store.js";
import { showToast } from "../components/toast.js";
import { openModal, closeModal } from "../components/modal.js";
import { icon } from "../utils/icons.js";

export function renderProducts(container) {
  const currency = store.get("settings")?.currency || "₹";

  function render() {
    const products = store.getAll("products");

    container.innerHTML = `
      <div class="backend-header">
        <h1>${icon("products", "", "Products")}Products</h1>
        <div class="backend-header-actions">
          <button class="btn btn-primary" id="add-product-btn">+ Add Product</button>
        </div>
      </div>

      ${products.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">${icon("products", "", "No products")}</div>
          <div class="empty-state-text">No products yet. Add your first product!</div>
        </div>
      ` : `
        <div class="products-grid stagger">
          ${products.map((product) => `
            <div class="card product-admin-card animate-fadeInUp" data-id="${product.id}">
              <div class="product-admin-emoji">${icon("products", "", product.category || "Product")}</div>
              <div class="product-admin-name">${product.name}</div>
              <div class="product-admin-category">${product.category} · ${product.unit}</div>
              <div class="product-admin-price">${currency}${product.price.toFixed(2)}</div>
              ${product.description ? `<div style="font-size:var(--fs-xs);color:var(--color-text-muted);margin-top:var(--space-xs)">${product.description}</div>` : ""}
              ${product.variants && product.variants.length > 0 ? `
                <div style="margin-top:var(--space-xs)">
                  ${product.variants.map((variant) => {
                    const label = variant.attribute || variant.name || "Variant";
                    const values = (variant.values || [])
                      .map((value) => value.name || value.label)
                      .filter(Boolean)
                      .join(", ");
                    return `<span class="badge badge-primary" style="margin-right:4px">${label}: ${values}</span>`;
                  }).join("")}
                </div>
              ` : ""}
              <div class="product-admin-actions">
                <button class="btn btn-sm btn-ghost edit-product" data-id="${product.id}">Edit</button>
                <button class="btn btn-sm btn-ghost delete-product" data-id="${product.id}" style="color:var(--color-danger)">Delete</button>
              </div>
            </div>
          `).join("")}
        </div>
      `}
    `;

    document.getElementById("add-product-btn")?.addEventListener("click", () => openProductModal());

    container.querySelectorAll(".edit-product").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const product = store.find("products", button.dataset.id);
        if (product) openProductModal(product);
      });
    });

    container.querySelectorAll(".delete-product").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openModal({
          title: "Delete Product",
          content: "<p>Are you sure you want to delete this product? This cannot be undone.</p>",
          actions: [
            { label: "Cancel", className: "btn-ghost", onClick: closeModal },
            {
              label: "Delete",
              className: "btn-danger",
              onClick: async () => {
                try {
                  await store.deleteProduct(button.dataset.id);
                  closeModal();
                  showToast("Product deleted", "info");
                  render();
                } catch (error) {
                  showToast(error.message, "error");
                }
              },
            },
          ],
        });
      });
    });
  }

  function openProductModal(product = null) {
    const isEdit = Boolean(product);
    let categories = store.get("categories", ["Pizza", "Pasta", "Burger", "Coffee", "Drinks", "Dessert", "Snacks"]);
    let selectedCategory = product?.category || categories[0] || "";
    let variants = product?.variants
      ? JSON.parse(JSON.stringify(product.variants)).map((variant) => ({
          attribute: variant.attribute || variant.name || "",
          values: (variant.values || []).map((value) => ({
            name: value.name || value.label || "",
            extra: Number(value.extra ?? value.extra_price ?? 0),
          })),
        }))
      : [];

    const formContent = document.createElement("div");
    formContent.innerHTML = `
      <form id="product-form">
        <div class="form-group">
          <label class="form-label">Product Name</label>
          <input type="text" class="form-input" id="prod-name" value="${product?.name || ""}" required placeholder="Enter product name" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
          <div class="form-group">
            <label class="form-label">Category</label>
            <div style="display:flex;gap:var(--space-sm);align-items:center">
              <select class="form-select" id="prod-category" style="flex:1">
                ${categories.map((category) => `<option value="${category}" ${selectedCategory === category ? "selected" : ""}>${category}</option>`).join("")}
              </select>
              <button type="button" class="btn btn-sm btn-ghost" id="add-category-btn">+ Category</button>
            </div>
            <div id="new-category-wrap" style="display:none;margin-top:var(--space-sm)">
              <div style="display:flex;gap:var(--space-sm)">
                <input type="text" class="form-input" id="new-category-name" placeholder="New category name" style="flex:1" />
                <button type="button" class="btn btn-sm btn-primary" id="save-category-btn">Save</button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Price (${currency})</label>
            <input type="number" class="form-input" id="prod-price" value="${product?.price || ""}" required step="0.01" min="0" placeholder="0.00" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
          <div class="form-group">
            <label class="form-label">Unit</label>
            <select class="form-select" id="prod-unit">
              ${["piece", "plate", "cup", "glass", "bottle", "basket", "slice"].map((unit) => `<option value="${unit}" ${product?.unit === unit ? "selected" : ""}>${unit}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tax (%)</label>
            <input type="number" class="form-input" id="prod-tax" value="${product?.tax ?? 5}" min="0" max="100" step="0.5" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" id="prod-desc" placeholder="Optional description">${product?.description || ""}</textarea>
        </div>
        <div id="variants-section">
          <label class="form-label" style="margin-bottom:var(--space-sm)">Variants (Optional)</label>
          <div id="variants-list"></div>
          <button type="button" class="btn btn-sm btn-ghost" id="add-variant-btn" style="margin-top:var(--space-sm)">+ Add Variant</button>
        </div>
      </form>
    `;

    openModal({
      title: isEdit ? "Edit Product" : "Add Product",
      content: formContent,
      wide: true,
      actions: [
        { label: "Cancel", className: "btn-ghost", onClick: closeModal },
        { label: isEdit ? "Save Changes" : "Add Product", className: "btn-primary", onClick: () => saveProduct(product?.id) },
      ],
    });

    document.getElementById("add-variant-btn")?.addEventListener("click", () => {
      variants.push({ attribute: "", values: [{ name: "", extra: 0 }] });
      renderVariants();
    });

    document.getElementById("add-category-btn")?.addEventListener("click", () => {
      const wrap = document.getElementById("new-category-wrap");
      if (!wrap) return;
      wrap.style.display = wrap.style.display === "none" ? "block" : "none";
      if (wrap.style.display === "block") {
        document.getElementById("new-category-name")?.focus();
      }
    });

    document.getElementById("save-category-btn")?.addEventListener("click", async () => {
      const input = document.getElementById("new-category-name");
      const categorySelect = document.getElementById("prod-category");
      const wrap = document.getElementById("new-category-wrap");
      const newCategoryName = input?.value.trim();

      if (!newCategoryName) {
        showToast("Enter a category name", "error");
        return;
      }

      try {
        await store.createCategory(newCategoryName);
        categories = store.get("categories", []);
        selectedCategory = newCategoryName;
        if (categorySelect) {
          categorySelect.innerHTML = categories
            .map((category) => `<option value="${category}" ${selectedCategory === category ? "selected" : ""}>${category}</option>`)
            .join("");
          categorySelect.value = selectedCategory;
        }
        if (input) input.value = "";
        if (wrap) wrap.style.display = "none";
        showToast("Category added!", "success");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    renderVariants();

    function renderVariants() {
      const list = document.getElementById("variants-list");
      if (!list) return;

      list.innerHTML = variants
        .map(
          (variant, variantIndex) => `
            <div style="background:var(--color-bg);border-radius:var(--radius-sm);padding:var(--space-sm);margin-bottom:var(--space-sm)">
              <div style="display:flex;gap:var(--space-sm);align-items:center;margin-bottom:var(--space-xs)">
                <input type="text" class="form-input" value="${variant.attribute}" placeholder="Attribute (e.g. Size)" style="flex:1" data-vi="${variantIndex}" data-field="attribute" />
                <button type="button" class="btn btn-sm btn-ghost" data-remove-variant="${variantIndex}" style="color:var(--color-danger)">x</button>
              </div>
              ${(variant.values || [])
                .map(
                  (value, valueIndex) => `
                    <div style="display:flex;gap:var(--space-xs);align-items:center;margin-left:var(--space-md);margin-bottom:4px">
                      <input type="text" class="form-input" value="${value.name}" placeholder="Value" style="flex:1;padding:6px 10px" data-vi="${variantIndex}" data-vali="${valueIndex}" data-field="val-name" />
                      <input type="number" class="form-input" value="${value.extra}" placeholder="Extra ${currency}" style="width:80px;padding:6px 10px" step="0.5" data-vi="${variantIndex}" data-vali="${valueIndex}" data-field="val-extra" />
                      <button type="button" class="btn btn-sm btn-ghost" data-remove-val="${variantIndex}-${valueIndex}" style="color:var(--color-danger);padding:4px">x</button>
                    </div>
                  `
                )
                .join("")}
              <button type="button" class="btn btn-sm btn-ghost" data-add-val="${variantIndex}" style="margin-left:var(--space-md)">+ Value</button>
            </div>
          `
        )
        .join("");

      list.querySelectorAll('[data-field="attribute"]').forEach((input) => {
        input.addEventListener("input", (event) => {
          variants[event.target.dataset.vi].attribute = event.target.value;
        });
      });
      list.querySelectorAll('[data-field="val-name"]').forEach((input) => {
        input.addEventListener("input", (event) => {
          variants[event.target.dataset.vi].values[event.target.dataset.vali].name = event.target.value;
        });
      });
      list.querySelectorAll('[data-field="val-extra"]').forEach((input) => {
        input.addEventListener("input", (event) => {
          variants[event.target.dataset.vi].values[event.target.dataset.vali].extra = parseFloat(event.target.value) || 0;
        });
      });
      list.querySelectorAll("[data-remove-variant]").forEach((button) => {
        button.addEventListener("click", () => {
          variants.splice(Number(button.dataset.removeVariant), 1);
          renderVariants();
        });
      });
      list.querySelectorAll("[data-add-val]").forEach((button) => {
        button.addEventListener("click", () => {
          variants[Number(button.dataset.addVal)].values.push({ name: "", extra: 0 });
          renderVariants();
        });
      });
      list.querySelectorAll("[data-remove-val]").forEach((button) => {
        button.addEventListener("click", () => {
          const [variantIndex, valueIndex] = button.dataset.removeVal.split("-").map(Number);
          variants[variantIndex].values.splice(valueIndex, 1);
          renderVariants();
        });
      });
    }

    async function saveProduct(editId) {
      const name = document.getElementById("prod-name").value.trim();
      const category = document.getElementById("prod-category").value;
      const price = parseFloat(document.getElementById("prod-price").value);
      const unit = document.getElementById("prod-unit").value;
      const tax = parseFloat(document.getElementById("prod-tax").value) || 0;
      const description = document.getElementById("prod-desc").value.trim();

      if (!name || !category || Number.isNaN(price)) {
        showToast("Please fill in required fields", "error");
        return;
      }

      const cleanedVariants = variants
        .map((variant) => ({
          attribute: variant.attribute.trim(),
          values: (variant.values || [])
            .filter((value) => value.name.trim())
            .map((value) => ({ name: value.name.trim(), extra: Number(value.extra) || 0 })),
        }))
        .filter((variant) => variant.attribute && variant.values.length > 0);

      try {
        const payload = { name, category, price, unit, tax, description, variants: cleanedVariants };
        if (editId) {
          await store.updateProduct(editId, payload);
          showToast("Product updated!", "success");
        } else {
          await store.createProduct(payload);
          showToast("Product added!", "success");
        }
        closeModal();
        render();
      } catch (error) {
        showToast(error.message, "error");
      }
    }
  }

  render();
}
