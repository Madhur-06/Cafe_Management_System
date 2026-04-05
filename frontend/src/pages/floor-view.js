/* ==========================================================================
   Floor View - Table selection for POS
   ========================================================================== */

import store from '../store.js';
import router from '../router.js';
import { icon } from '../utils/icons.js';

export function renderFloorView(container) {
  const floors = store.getAll('floors');
  const tables = store.getAll('tables');
  const orders = store.getAll('orders');
  let activeFloorId = floors[0]?.id;

  function render() {
    const floorTables = tables.filter(t => String(t.floorId) === String(activeFloorId) && t.active);
    // Check which tables have active orders
    const activeOrders = orders.filter(o => o.status === 'open' || o.status === 'in_progress');
    const occupiedTableIds = new Set(activeOrders.map(o => o.tableId));

    container.innerHTML = `
      <div class="floor-view">
        <div class="floor-view-tabs">
          ${floors.map(f => `
            <div class="floor-tab ${f.id === activeFloorId ? 'active' : ''}" data-floor="${f.id}">${f.name}</div>
          `).join('')}
        </div>

        ${floorTables.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">${icon('table', '', 'No active tables')}</div>
            <div class="empty-state-text">No active tables on this floor</div>
          </div>
        ` : `
          <div class="tables-floor-grid stagger">
            ${floorTables.map(t => {
              const isOccupied = occupiedTableIds.has(t.id);
              const status = isOccupied ? 'occupied' : 'available';
              return `
                <div class="table-floor-card ${status} animate-fadeInUp" data-table="${t.id}" title="Table ${t.number} - ${t.seats} seats - ${status}">
                  <div class="table-floor-status">
                    ${status === 'occupied' ? icon('clock', '', 'In use') : icon('circleCheck', '', 'Open')}
                  </div>
                  <div class="table-floor-number">${t.number}</div>
                  <div class="table-floor-seats">${t.seats} seats</div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    // Floor tabs
    container.querySelectorAll('.floor-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeFloorId = tab.dataset.floor;
        render();
      });
    });

    // Table click → go to order
    container.querySelectorAll('.table-floor-card').forEach(card => {
      card.addEventListener('click', () => {
        const tableId = card.dataset.table;
        // Create or resume order for this table
        let order = orders.find(o => String(o.tableId) === String(tableId) && (o.status === 'open' || o.status === 'in_progress'));
        if (!order) {
          const table = store.find('tables', tableId);
          order = store.add('orders', {
            tableId,
            tableNumber: table?.number,
            status: 'open',
            items: [],
            subtotal: 0,
            tax: 0,
            total: 0,
            sessionId: store.getActiveSession()?.id,
            responsible: store.getCurrentUser()?.fullName || 'Staff',
          });
          // Update local reference
          orders.push(order);
        }
        store.setDraftOrder(order);
        router.navigate(`#/pos/order/${tableId}`);
      });
    });
  }

  render();
}
