/* ==========================================================================
   Floors & Tables - Floor plan management
   ========================================================================== */

import store from '../store.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { icon } from '../utils/icons.js';

export function renderFloors(container) {
  let activeFloorId = store.getAll('floors')[0]?.id || null;

  function render() {
    const floors = store.getAll('floors');
    const tables = store.getAll('tables');
    const activeFloor = floors.find(f => String(f.id) === String(activeFloorId)) || floors[0];
    if (activeFloor) activeFloorId = activeFloor.id;
    const floorTables = tables.filter(t => String(t.floorId) === String(activeFloorId));

    container.innerHTML = `
      <div class="backend-header">
        <h1>${icon('floors', '', 'Floors & Tables')}Floors & Tables</h1>
        <div class="backend-header-actions">
          <button class="btn btn-ghost" id="add-floor-btn">+ Add Floor</button>
          <button class="btn btn-primary" id="add-table-btn" ${!activeFloorId ? 'disabled' : ''}>+ Add Table</button>
        </div>
      </div>

      ${floors.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">${icon('branch', '', 'No floors')}</div>
          <div class="empty-state-text">No floors created yet. Start by adding a floor!</div>
        </div>
      ` : `
        <div class="floor-tabs">
          ${floors.map(f => `
            <div class="floor-tab ${String(f.id) === String(activeFloorId) ? 'active' : ''}" data-floor="${f.id}">
              ${f.name}
              <button class="delete-floor-btn" data-floor-id="${f.id}" style="margin-left:8px;background:none;border:none;cursor:pointer;color:inherit;opacity:0.5;font-size:0.75rem" title="Delete Floor">${icon('trash', '', 'Delete Floor')}</button>
            </div>
          `).join('')}
        </div>

        ${floorTables.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">${icon('table', '', 'No tables')}</div>
            <div class="empty-state-text">No tables on this floor. Add some tables!</div>
          </div>
        ` : `
          <div class="tables-grid stagger">
            ${floorTables.map(t => `
              <div class="card table-admin-card animate-fadeInUp" data-table-id="${t.id}">
                <div class="table-admin-number">T${t.number}</div>
                <div class="table-admin-seats">${t.seats} seats</div>
                <div style="display:flex;align-items:center;justify-content:center;gap:var(--space-xs);margin-top:var(--space-sm)">
                  <span class="badge ${t.active ? 'badge-success' : 'badge-danger'}">${t.active ? 'Active' : 'Inactive'}</span>
                </div>
                <div style="display:flex;gap:var(--space-xs);justify-content:center;margin-top:var(--space-md)">
                  <button class="btn btn-sm btn-ghost edit-table-btn" data-table-id="${t.id}">Edit</button>
                  <button class="btn btn-sm btn-ghost delete-table-btn" data-table-id="${t.id}" style="color:var(--color-danger)">Delete</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      `}
    `;

    // Floor tab switch
    container.querySelectorAll('.floor-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        if (e.target.closest('.delete-floor-btn')) return;
        activeFloorId = tab.dataset.floor;
        render();
      });
    });

    // Delete floor
    container.querySelectorAll('.delete-floor-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal({
          title: 'Delete Floor',
          content: '<p>Are you sure? All tables on this floor will also be deleted.</p>',
          actions: [
            { label: 'Cancel', className: 'btn-ghost', onClick: closeModal },
            { label: 'Delete', className: 'btn-danger', onClick: async () => {
              try {
                const fid = btn.dataset.floorId;
                await store.deleteFloor(fid);
                activeFloorId = store.getAll('floors')[0]?.id || null;
                closeModal();
                showToast('Floor deleted', 'info');
                render();
              } catch (error) {
                showToast(error.message, 'error');
              }
            }},
          ]
        });
      });
    });

    // Add floor
    document.getElementById('add-floor-btn')?.addEventListener('click', () => {
      const formDiv = document.createElement('div');
      formDiv.innerHTML = `
        <div class="form-group">
          <label class="form-label">Floor Name</label>
          <input type="text" class="form-input" id="floor-name-input" placeholder="e.g. Ground Floor" />
        </div>
      `;
      openModal({
        title: 'Add Floor',
        content: formDiv,
        actions: [
          { label: 'Cancel', className: 'btn-ghost', onClick: closeModal },
          { label: 'Add Floor', className: 'btn-primary', onClick: async () => {
            const name = document.getElementById('floor-name-input').value.trim();
            if (!name) { showToast('Enter a floor name', 'error'); return; }
            try {
              await store.createFloor(name);
              activeFloorId = store.getAll('floors').slice(-1)[0]?.id || store.getAll('floors')[0]?.id || null;
              closeModal();
              showToast('Floor added!', 'success');
              render();
            } catch (error) {
              showToast(error.message, 'error');
            }
          }},
        ]
      });
    });

    // Add table
    document.getElementById('add-table-btn')?.addEventListener('click', () => {
      openTableModal();
    });

    // Edit table
    container.querySelectorAll('.edit-table-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const table = store.find('tables', btn.dataset.tableId);
        if (table) openTableModal(table);
      });
    });

    // Delete table
    container.querySelectorAll('.delete-table-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await store.deleteTable(btn.dataset.tableId);
          showToast('Table deleted', 'info');
          render();
        } catch (error) {
          showToast(error.message, 'error');
        }
      });
    });
  }

  function openTableModal(table = null) {
    const isEdit = !!table;
    const formDiv = document.createElement('div');
    formDiv.innerHTML = `
      <div class="form-group">
        <label class="form-label">Table Number</label>
        <input type="number" class="form-input" id="table-number" value="${table?.number || ''}" placeholder="e.g. 1" min="1" />
      </div>
      <div class="form-group">
        <label class="form-label">Seats</label>
        <input type="number" class="form-input" id="table-seats" value="${table?.seats || 4}" min="1" max="20" />
      </div>
      <div class="form-group" style="flex-direction:row;align-items:center;gap:var(--space-md)">
        <label class="form-label" style="margin-bottom:0">Active</label>
        <label class="toggle">
          <input type="checkbox" id="table-active" ${table?.active !== false ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;

    openModal({
      title: isEdit ? 'Edit Table' : 'Add Table',
      content: formDiv,
      actions: [
        { label: 'Cancel', className: 'btn-ghost', onClick: closeModal },
        { label: isEdit ? 'Save' : 'Add Table', className: 'btn-primary', onClick: async () => {
          const number = parseInt(document.getElementById('table-number').value);
          const seats = parseInt(document.getElementById('table-seats').value) || 4;
          const active = document.getElementById('table-active').checked;

          if (!number) { showToast('Enter a table number', 'error'); return; }

          try {
            if (isEdit) {
              await store.updateTable(table.id, { floorId: activeFloorId, number, seats, active });
              showToast('Table updated!', 'success');
            } else {
              await store.createTable({ floorId: activeFloorId, number, seats, active });
              showToast('Table added!', 'success');
            }
            closeModal();
            render();
          } catch (error) {
            showToast(error.message, 'error');
          }
        }},
      ]
    });
  }

  render();
}
