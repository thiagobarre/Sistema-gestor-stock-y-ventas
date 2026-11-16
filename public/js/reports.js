/**
 * SISTEMA DE GESTIÓN DE STOCK Y VENTAS - DRUGSTORE X
 * reports.js: Informes comerciales y panel de control (Gerente)
 */

window.ReportsModule = {
  init() {
    this.fetchDashboard();
  },

  async fetchDashboard() {
    try {
      const res = await fetch('/api/reportes/dashboard');
      const data = await res.json();
      this.renderDashboard(data);
    } catch (err) {
      console.error('Error al cargar informes', err);
    }
  },

  renderDashboard(data) {
    const todayEl = document.getElementById('dashTodaySales');
    const totalEl = document.getElementById('dashTotalSales');
    const lowStockCountEl = document.getElementById('dashLowStockCount');
    const topTbody = document.getElementById('dashTopProductsTableBody');
    const critTbody = document.getElementById('dashCriticalStockTableBody');

    if (todayEl) {
      const cant = data.ventasHoy?.cantidad || 0;
      const total = data.ventasHoy?.totalRecaudado || 0;
      todayEl.innerText = `${App.formatMoney(total)} (${cant} ventas)`;
    }

    if (totalEl) {
      const cant = data.totalHistorico?.cantidad || 0;
      const total = data.totalHistorico?.total || 0;
      totalEl.innerText = `${App.formatMoney(total)} (${cant} ventas)`;
    }

    if (lowStockCountEl) {
      lowStockCountEl.innerText = data.stockCritico ? data.stockCritico.length : 0;
    }

    // Ranking de productos más vendidos
    if (topTbody) {
      const prods = data.masVendidos || [];
      if (prods.length === 0) {
        topTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">Aún no hay ventas registradas.</td></tr>`;
      } else {
        topTbody.innerHTML = prods.map(p => `
          <tr>
            <td style="font-weight: 600;">${p.nombre}</td>
            <td><span class="badge" style="background: #f1f5f9;">${p.categoria}</span></td>
            <td style="font-weight: 700; color: #1e40af;">${p.totalUnidades} u.</td>
            <td style="font-weight: 700; color: #047857;">${App.formatMoney(p.totalDinero)}</td>
          </tr>
        `).join('');
      }
    }

    // Alertas de stock crítico
    if (critTbody) {
      const crit = data.stockCritico || [];
      if (crit.length === 0) {
        critTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #059669; padding: 20px;">✓ Todos los productos tienen stock suficiente.</td></tr>`;
      } else {
        critTbody.innerHTML = crit.map(c => {
          const isZero = c.stock === 0;
          return `
            <tr>
              <td><span class="table-code">${c.codigo}</span></td>
              <td style="font-weight: 600;">${c.nombre}</td>
              <td>${c.categoria}</td>
              <td>
                <span class="card-stock-badge ${isZero ? 'stock-zero' : 'stock-low'}">
                  ${c.stock} unidades
                </span>
              </td>
              <td>
                <span class="badge ${c.estado === 'suspendido' ? 'badge-suspendido' : 'badge-activo'}">
                  ${c.estado}
                </span>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }
};
