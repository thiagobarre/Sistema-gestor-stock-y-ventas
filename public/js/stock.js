/**
 * SISTEMA DE GESTIÓN DE STOCK Y VENTAS - DRUGSTORE X
 * stock.js: Auditoría y trazabilidad de Movimientos de Stock (CL-06 MOVIMIENTOSTOCK)
 */

window.StockModule = {
  movementsList: [],

  init() {
    this.bindEvents();
    this.fetchMovements();
  },

  bindEvents() {
    const filterMotivo = document.getElementById('filterStockMotivo');
    if (filterMotivo) {
      filterMotivo.addEventListener('change', () => this.fetchMovements());
    }
  },

  async fetchMovements() {
    const motivo = document.getElementById('filterStockMotivo')?.value || 'Todos';
    try {
      let url = '/api/movimientos-stock';
      if (motivo !== 'Todos') {
        url += `?motivo=${encodeURIComponent(motivo)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      this.movementsList = data;
      this.renderTable();
    } catch (err) {
      console.error('Error al cargar movimientos de stock', err);
      App.showToast('Error al obtener movimientos de stock.', 'error');
    }
  },

  renderTable() {
    const tbody = document.getElementById('stockMovementsTableBody');
    if (!tbody) return;

    if (this.movementsList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">
            No se han registrado movimientos de stock para los filtros seleccionados.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.movementsList.map(m => {
      const isPositive = m.cantidad > 0;
      const isNegative = m.cantidad < 0;
      let varClass = 'color: #475569;';
      let sign = '';
      if (isPositive) {
        varClass = 'color: #059669; font-weight: bold;';
        sign = '+';
      } else if (isNegative) {
        varClass = 'color: #dc2626; font-weight: bold;';
      }

      let motivoBadgeClass = 'background: #f1f5f9; color: #475569;';
      if (m.motivo === 'ingreso') motivoBadgeClass = 'background: #ecfdf5; color: #059669;';
      if (m.motivo === 'venta') motivoBadgeClass = 'background: #eff6ff; color: #1e40af;';
      if (m.motivo === 'devolución') motivoBadgeClass = 'background: #fdf4ff; color: #a21caf;';
      if (m.motivo === 'anulación de venta') motivoBadgeClass = 'background: #fffbeb; color: #b45309;';
      if (m.motivo === 'corrección') motivoBadgeClass = 'background: #f8fafc; color: #64748b;';

      return `
        <tr>
          <td><small style="color: var(--text-muted);">${m.fecha}</small></td>
          <td><span class="table-code">${m.productoCodigo}</span></td>
          <td style="font-weight: 600;">${m.productoNombre}</td>
          <td>
            <span class="badge" style="${motivoBadgeClass}">
              ${m.motivo}
            </span>
          </td>
          <td style="${varClass}">${sign}${m.cantidad} u.</td>
          <td style="font-weight: 700;">${m.stockResultante} u.</td>
          <td>${m.usuarioNombre || 'Sistema'}</td>
          <td style="font-size: 13px; color: var(--text-muted);">${m.detalle || '-'}</td>
        </tr>
      `;
    }).join('');
  }
};
