/* ==========================================================================
   Products - Product CRUD management
   ========================================================================== */

import store from "../store.js";
import { showToast } from "../components/toast.js";
import { openModal, closeModal } from "../components/modal.js";
import { icon } from "../utils/icons.js";

export function renderProducts(container) {
  const currency = store.get("settings")?.currency || "₹";
  let searchQuery = "";
  let currentPage = 1;
  const pageSize = 8;

  container.innerHTML = `
    <div class="backend-header">
      <h1>${icon("products", "", "Products")}Products</h1>
      <div class="backend-header-actions">
        <button class="btn btn-primary" id="add-product-btn">+ Add Product</button>
      </div>
    </div>

    <div class="products-toolbar">
      <div class="products-search">
        <input
          type="text"
          class="form-input"
          id="products-search-input"
          placeholder="Search products, categories, units, or variants"
          autocomplete="off"
        />
      </div>
      <div class="products-toolbar-meta">
        <button class="btn btn-sm btn-ghost" id="products-clear-btn" disabled>Clear</button>
        <span class="products-count" id="products-count"></span>
        <div class="products-pagination">
          <button class="btn btn-sm btn-ghost" id="products-prev-page">Prev</button>
          <span class="products-page-label" id="products-page-label"></span>
          <button class="btn btn-sm btn-ghost" id="products-next-page">Next</button>
        </div>
      </div>
    </div>

    <div id="products-results"></div>
  `;

  const addButton = container.querySelector("#add-product-btn");
  const searchInput = container.querySelector("#products-search-input");
  const clearButton = container.querySelector("#products-clear-btn");
  const countLabel = container.querySelector("#products-count");
  const prevButton = container.querySelector("#products-prev-page");
  const nextButton = container.querySelector("#products-next-page");
  const pageLabel = container.querySelector("#products-page-label");
  const results = container.querySelector("#products-results");

  addButton?.addEventListener("click", () => openProductModal());

  searchInput?.addEventListener("input", (event) => {
    searchQuery = event.target.value;
    currentPage = 1;
    renderResults();
  });

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
    }
  });

  clearButton?.addEventListener("click", () => {
    searchQuery = "";
    currentPage = 1;
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }
    renderResults();
  });

  prevButton?.addEventListener("click", () => {
    currentPage -= 1;
    renderResults();
  });

  nextButton?.addEventListener("click", () => {
    currentPage += 1;
    renderResults();
  });

  function getFilteredProducts() {
    const products = store.getAll("products");
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return products;

    return products.filter((product) => {
      const searchableValues = [
        product.name,
        product.category,
        product.unit,
        product.description,
        ...(product.variants || []).map((variant) => variant.attribute || variant.name || ""),
        ...(product.variants || []).flatMap((variant) =>
          (variant.values || []).map((value) => value.name || value.label || "")
        ),
      ];

      return searchableValues
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }

  function renderResults() {
    const allProducts = store.getAll("products");

    if (!allProducts.length) {
      countLabel.textContent = "0 products";
      pageLabel.textContent = "Page 1 / 1";
      prevButton.disabled = true;
      nextButton.disabled = true;
      clearButton.disabled = !searchQuery;
      results.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${icon("products", "", "No products")}</div>
          <div class="empty-state-text">No products yet. Add your first product!</div>
        </div>
      `;
      return;
    }

    const filteredProducts = getFilteredProducts();
    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
    currentPage = Math.min(Math.max(currentPage, 1), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + pageSize);

    countLabel.textContent = `${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"}`;
    pageLabel.textContent = `Page ${currentPage} / ${totalPages}`;
    prevButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
    clearButton.disabled = !searchQuery;

    if (!filteredProducts.length) {
      results.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${icon("search", "", "No results")}</div>
          <div class="empty-state-text">No products match your search.</div>
        </div>
      `;
      return;
    }

    results.innerHTML = `
      <div class="products-grid stagger">
        ${paginatedProducts
          .map(
            (product) => `
              <div class="card product-admin-card animate-fadeInUp" data-id="${product.id}">
                <div class="product-admin-emoji">${icon("products", "", product.category || "Product")}</div>
                <div class="product-admin-name">${escapeHtml(product.name)}</div>
                <div class="product-admin-category">${escapeHtml(product.category || "Uncategorized")} · ${escapeHtml(product.unit || "")}</div>
                <div class="product-admin-price">${currency}${Number(product.price || 0).toFixed(2)}</div>
                ${product.description ? `<div style="font-size:var(--fs-xs);color:var(--color-text-muted);margin-top:var(--space-xs)">${escapeHtml(product.description)}</div>` : ""}
                ${
                  product.variants && product.variants.length
                    ? `
                      <div style="margin-top:var(--space-xs)">
                        ${product.variants
                          .map((variant) => {
                            const label = escapeHtml(variant.attribute || variant.name || "Variant");
                            const values = (variant.values || [])
                              .map((value) => escapeHtml(value.name || value.label))
                              .filter(Boolean)
                              .join(", ");
                            return `<span class="badge badge-primary" style="margin-right:4px">${label}: ${values}</span>`;
                          })
                          .join("")}
                      </div>
                    `
                    : ""
                }
                <div class="product-admin-actions">
                  <button class="btn btn-sm btn-ghost edit-product" data-id="${product.id}">Edit</button>
                  <button class="btn btn-sm btn-ghost delete-product" data-id="${product.id}" style="color:var(--color-danger)">Delete</button>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    `;

    results.querySelectorAll(".edit-product").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const product = store.find("products", button.dataset.id);
        if (product) openProductModal(product);
      });
    });

    results.querySelectorAll(".delete-product").forEach((button) => {
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
                  renderResults();
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
          <input type="text" class="form-input" id="prod-name" value="${escapeHtml(product?.name || "")}" required placeholder="Enter product name" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
          <div class="form-group">
            <label class="form-label">Category</label>
            <div style="display:flex;gap:var(--space-sm);align-items:center">
              <select class="form-select" id="prod-category" style="flex:1">
                ${categories
                  .map((category) => `<option value="${escapeHtml(category)}" ${selectedCategory === category ? "selected" : ""}>${escapeHtml(category)}</option>`)
                  .join("")}
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
            <input type="number" class="form-input" id="prod-price" value="${escapeHtml(product?.price || "")}" required step="0.01" min="0" placeholder="0.00" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
          <div class="form-group">
            <label class="form-label">Unit</label>
            <select class="form-select" id="prod-unit">
              ${["piece", "plate", "cup", "glass", "bottle", "basket", "slice", "bowl", "jar", "portion"]
                .map((unit) => `<option value="${unit}" ${product?.unit === unit ? "selected" : ""}>${unit}</option>`)
                .join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tax (%)</label>
            <input type="number" class="form-input" id="prod-tax" value="${escapeHtml(product?.tax ?? 5)}" min="0" max="100" step="0.5" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" id="prod-desc" placeholder="Optional description">${escapeHtml(product?.description || "")}</textarea>
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
            .map((category) => `<option value="${escapeHtml(category)}" ${selectedCategory === category ? "selected" : ""}>${escapeHtml(category)}</option>`)
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
                <input type="text" class="form-input" value="${escapeHtml(variant.attribute)}" placeholder="Attribute (e.g. Size)" style="flex:1" data-vi="${variantIndex}" data-field="attribute" />
                <button type="button" class="btn btn-sm btn-ghost" data-remove-variant="${variantIndex}" style="color:var(--color-danger)">x</button>
              </div>
              ${(variant.values || [])
                .map(
                  (value, valueIndex) => `
                    <div style="display:flex;gap:var(--space-xs);align-items:center;margin-left:var(--space-md);margin-bottom:4px">
                      <input type="text" class="form-input" value="${escapeHtml(value.name)}" placeholder="Value" style="flex:1;padding:6px 10px" data-vi="${variantIndex}" data-vali="${valueIndex}" data-field="val-name" />
                      <input type="number" class="form-input" value="${escapeHtml(value.extra)}" placeholder="Extra ${currency}" style="width:80px;padding:6px 10px" step="0.5" data-vi="${variantIndex}" data-vali="${valueIndex}" data-field="val-extra" />
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
        renderResults();
      } catch (error) {
        showToast(error.message, "error");
      }
    }
  }

  renderResults();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
