/**
 * SISTEMA DE GESTIÓN DE STOCK Y VENTAS - DRUGSTORE X
 * sales.js: Gestión de Ventas (CU07 Modificar, CU08 Anular, CU09 Consultar)
 * Cumple Regla R-02: Anulación exclusiva dentro de las 24 horas de emisión
 */

window.SalesModule = {
  salesList: [],
  selectedSaleForCancel: null,
  selectedSaleForEdit: null,
  editSaleItems: [],

  init() {
    this.setupDatePresets();
    this.bindEvents();
    this.fetchSales();
  },

  // Fechas por defecto: hoy
  setupDatePresets() {
    const today = new Date().toISOString().split('T')[0];
    const inputDesde = document.getElementById('filterSalesDesde');
    const inputHasta = document.getElementById('filterSalesHasta');

    if (inputDesde) inputDesde.value = today;
    if (inputHasta) inputHasta.value = today;
  },

  bindEvents() {
    // Botón filtrar ventas
    const btnFilter = document.getElementById('btnFilterSalesSubmit');
    if (btnFilter) {
      btnFilter.addEventListener('click', () => this.fetchSales());
    }

    // Filtro por estado
    const selectEstado = document.getElementById('filterSalesEstado');
    if (selectEstado) {
      selectEstado.addEventListener('change', () => this.renderSalesTable());
    }

    // Botones rápidos de período
    const btnToday = document.getElementById('btnPresetSalesToday');
    const btn7Days = document.getElementById('btnPresetSales7Days');
    const btnMonth = document.getElementById('btnPresetSalesMonth');

    if (btnToday) {
      btnToday.addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('filterSalesDesde').value = today;
        document.getElementById('filterSalesHasta').value = today;
        this.fetchSales();
      });
    }

    if (btn7Days) {
      btn7Days.addEventListener('click', () => {
        const d = new Date();
        const hasta = d.toISOString().split('T')[0];
        d.setDate(d.getDate() - 7);
        const desde = d.toISOString().split('T')[0];
        document.getElementById('filterSalesDesde').value = desde;
        document.getElementById('filterSalesHasta').value = hasta;
        this.fetchSales();
      });
    }

    if (btnMonth) {
      btnMonth.addEventListener('click', () => {
        const d = new Date();
        const hasta = d.toISOString().split('T')[0];
        const desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
        document.getElementById('filterSalesDesde').value = desde;
        document.getElementById('filterSalesHasta').value = hasta;
        this.fetchSales();
      });
    }

    // Confirmar anulación de venta (CU08 - R-02)
    const btnConfirmAnular = document.getElementById('btnConfirmAnularVenta');
    if (btnConfirmAnular) {
      btnConfirmAnular.addEventListener('click', () => this.submitCancelSale());
    }

    // Guardar modificación de venta (CU07)
    const btnSaveEdit = document.getElementById('btnSaveEditSale');
    if (btnSaveEdit) {
      btnSaveEdit.addEventListener('click', () => this.submitEditSale());
    }

    // Agregar producto en modal modificación de venta
    const btnAddProdEdit = document.getElementById('btnEditSaleAddItem');
    if (btnAddProdEdit) {
      btnAddProdEdit.addEventListener('click', () => this.addItemToEditSale());
    }
  },

  // Consultar ventas por período (CU09)
  async fetchSales() {
    const desde = document.getElementById('filterSalesDesde')?.value || '';
    const hasta = document.getElementById('filterSalesHasta')?.value || '';

    try {
      let url = `/api/ventas?fechaDesde=${encodeURIComponent(desde)}&fechaHasta=${encodeURIComponent(hasta)}`;
      const res = await fetch(url);
      const data = await res.json();

      this.salesList = data.ventas || [];

      // Actualizar métricas del período consultado (CU09)
      const metricTotal = document.getElementById('salesMetricTotal');
      const metricCount = document.getElementById('salesMetricCount');
      const metricAnuladas = document.getElementById('salesMetricAnuladas');

      if (metricTotal) metricTotal.innerText = App.formatMoney(data.totalAcumulado);
      if (metricCount) metricCount.innerText = data.cantidadVentas;

      const anuladas = this.salesList.filter(v => v.estado === 'anulada').length;
      if (metricAnuladas) metricAnuladas.innerText = anuladas;

      this.renderSalesTable();
    } catch (err) {
      console.error('Error al consultar ventas', err);
      App.showToast('Error al obtener ventas del período.', 'error');
    }
  },

  // Renderizar tabla de ventas
  renderSalesTable() {
    const tbody = document.getElementById('salesTableBody');
    if (!tbody) return;

    const filterEstado = document.getElementById('filterSalesEstado')?.value || 'Todos';
    const isGerente = App.currentUser.rol === 'Gerente';

    let list = this.salesList;
    if (filterEstado !== 'Todos') {
      list = list.filter(v => v.estado === filterEstado);
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">
            No se encontraron ventas para los criterios seleccionados.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(v => {
      const isAnulada = v.estado === 'anulada';
      const hoursSince = this.calculateHoursSince(v.fecha, v.hora);
      const canCancel = !isAnulada && hoursSince <= 24;

      let actionsHtml = `
        <button class="btn btn-secondary btn-sm" onclick="SalesModule.viewSaleReceipt(${v.id})">
          👁️ Ver Comprobante
        </button>
      `;

      if (isGerente) {
        if (!isAnulada) {
          actionsHtml += `
            <button class="btn btn-secondary btn-sm" onclick="SalesModule.openEditSaleModal(${v.id})">
              ✏️ Modificar
            </button>
          `;

          if (canCancel) {
            const horasRestantes = (24 - hoursSince).toFixed(1);
            actionsHtml += `
              <button class="btn btn-danger btn-sm" onclick="SalesModule.openCancelSaleModal(${v.id})" title="Regla R-02: Quedan ${horasRestantes} hs para anular">
                🚫 Anular (R-02)
              </button>
            `;
          } else {
            actionsHtml += `
              <button class="btn btn-secondary btn-sm" disabled title="No anulable: Superó el plazo de 24 horas (Regla R-02)">
                ⌛ +24hs No Anulable
              </button>
            `;
          }
        } else {
          actionsHtml += `<span style="font-size: 11px; color: var(--danger); font-weight: 600;">Anulada</span>`;
        }
      }

      return `
        <tr style="${isAnulada ? 'opacity: 0.65; background: #fff5f5;' : ''}">
          <td><span class="table-code">${v.numeroComprobante || 'S/N'}</span></td>
          <td>${v.fecha} <small style="color: var(--text-muted);">${v.hora}</small></td>
          <td>${v.nombreEmpleado || 'Empleado'}</td>
          <td><span class="badge" style="background: #f1f5f9;">${v.tipoComprobante || 'comprobante'}</span></td>
          <td>${v.metodoPago || 'Efectivo'}</td>
          <td style="font-weight: 700; color: ${isAnulada ? '#94a3b8; text-decoration: line-through;' : '#047857;'}">
            ${App.formatMoney(v.total)}
          </td>
          <td>
            <span class="badge ${isAnulada ? 'badge-anulada' : 'badge-registrada'}">
              ${isAnulada ? 'Anulada' : 'Registrada'}
            </span>
          </td>
          <td style="text-align: right;">
            <div class="table-actions" style="justify-content: flex-end;">
              ${actionsHtml}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // Helper para calcular horas transcurridas desde la venta
  calculateHoursSince(fechaStr, horaStr) {
    const ventaDate = new Date(`${fechaStr}T${horaStr}`);
    const now = new Date();
    return (now.getTime() - ventaDate.getTime()) / (1000 * 60 * 60);
  },

  // Ver comprobante original para reimpresión (CU09)
  async viewSaleReceipt(ventaId) {
    try {
      const res = await fetch(`/api/ventas/${ventaId}`);
      const ventaData = await res.json();
      if (!res.ok) {
        App.showToast(ventaData.error || 'No se pudo cargar la venta.', 'error');
        return;
      }
      PosModule.showTicketPreview(ventaData);
    } catch (err) {
      console.error('Error al ver comprobante', err);
      App.showToast('Error de comunicación con el servidor.', 'error');
    }
  },

  // Abrir modal de anulación (CU08 - Regla R-02)
  async openCancelSaleModal(ventaId) {
    try {
      const res = await fetch(`/api/ventas/${ventaId}`);
      const venta = await res.json();
      if (!res.ok) {
        App.showToast(venta.error || 'Venta no encontrada.', 'error');
        return;
      }

      const hoursSince = this.calculateHoursSince(venta.fecha, venta.hora);
      if (hoursSince > 24) {
        App.showToast(`No es posible anular la venta. Han transcurrido ${hoursSince.toFixed(1)} horas (Límite: 24hs según Regla R-02).`, 'error');
        return;
      }

      this.selectedSaleForCancel = venta;

      document.getElementById('cancelSaleIdText').innerText = venta.id;
      document.getElementById('cancelSaleCompText').innerText = venta.comprobante?.numero || 'S/N';
      document.getElementById('cancelSaleFechaText').innerText = `${venta.fecha} ${venta.hora}`;
      document.getElementById('cancelSaleTotalText').innerText = App.formatMoney(venta.total);
      document.getElementById('cancelSaleMotivoInput').value = '';

      const timeLeftHours = Math.floor(24 - hoursSince);
      const timeLeftMins = Math.floor(((24 - hoursSince) % 1) * 60);
      document.getElementById('cancelSaleTimerNotice').innerHTML = `
        <span style="color: #059669; font-weight: 600;">
          ⏱️ Plazo de anulación vigente: Restan aproximadamente ${timeLeftHours}h ${timeLeftMins}m dentro de las 24 horas permitidas.
        </span>
      `;

      App.openModal('modalCancelSale');
    } catch (err) {
      console.error('Error al abrir modal anulación', err);
      App.showToast('Error al consultar datos de la venta.', 'error');
    }
  },

  // Enviar anulación de venta confirmada (CU08)
  async submitCancelSale() {
    if (!this.selectedSaleForCancel) return;

    const motivo = document.getElementById('cancelSaleMotivoInput').value.trim();
    if (!motivo) {
      App.showToast('Debe ingresar el motivo de la anulación.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/ventas/${this.selectedSaleForCancel.id}/anular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo,
          usuarioId: App.currentUser.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        App.showToast(data.error || 'No fue posible anular la venta.', 'error');
        return;
      }

      App.closeModal('modalCancelSale');
      App.showToast('Venta anulada con éxito y productos devueltos al stock.', 'success');

      // Actualizar listados
      await this.fetchSales();
      if (window.PosModule) PosModule.loadCatalog();
      if (window.ProductsModule) ProductsModule.fetchProducts();
      if (window.StockModule) StockModule.fetchMovements();
      if (window.ReportsModule) ReportsModule.fetchDashboard();
    } catch (err) {
      console.error('Error al anular venta', err);
      App.showToast('Error de comunicación con el servidor.', 'error');
    }
  },

  // Abrir modal modificar venta (CU07 - Gerente)
  async openEditSaleModal(ventaId) {
    try {
      const res = await fetch(`/api/ventas/${ventaId}`);
      const venta = await res.json();
      if (!res.ok) {
        App.showToast(venta.error || 'Venta no encontrada.', 'error');
        return;
      }

      this.selectedSaleForEdit = venta;
      this.editSaleItems = (venta.detalles || []).map(d => ({
        productoId: d.productoId,
        nombre: d.productoNombre,
        precioUnitario: d.precioUnitario,
        cantidad: d.cantidad,
        subtotal: d.subtotal
      }));

      // Llenar selector de productos disponibles
      const select = document.getElementById('editSaleAddProdSelect');
      if (select) {
        select.innerHTML = App.products.filter(p => p.estado === 'activo').map(p => `
          <option value="${p.id}">${p.nombre} - ${App.formatMoney(p.precioUnitario)} (Stock disp: ${p.stock})</option>
        `).join('');
      }

      this.renderEditSaleTable();
      App.openModal('modalEditSale');
    } catch (err) {
      console.error('Error al abrir modal modificación', err);
      App.showToast('Error de comunicación con el servidor.', 'error');
    }
  },

  // Renderizar tabla interna del modal de modificación
  renderEditSaleTable() {
    const tbody = document.getElementById('editSaleItemsBody');
    const totalEl = document.getElementById('editSaleNewTotal');
    if (!tbody) return;

    let total = 0;
    tbody.innerHTML = this.editSaleItems.map((item, idx) => {
      total += item.subtotal;
      return `
        <tr>
          <td><strong>${item.nombre}</strong></td>
          <td>${App.formatMoney(item.precioUnitario)}</td>
          <td>
            <input 
              type="number" 
              class="form-input" 
              value="${item.cantidad}" 
              min="1" 
              style="width: 80px; padding: 4px;"
              onchange="SalesModule.changeEditItemQty(${idx}, this.value)"
            >
          </td>
          <td><strong>${App.formatMoney(item.subtotal)}</strong></td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="SalesModule.removeEditItem(${idx})">Quitar</button>
          </td>
        </tr>
      `;
    }).join('');

    if (totalEl) totalEl.innerText = App.formatMoney(total);
  },

  changeEditItemQty(index, newQty) {
    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty <= 0) {
      this.removeEditItem(index);
      return;
    }
    this.editSaleItems[index].cantidad = qty;
    this.editSaleItems[index].subtotal = qty * this.editSaleItems[index].precioUnitario;
    this.renderEditSaleTable();
  },

  removeEditItem(index) {
    this.editSaleItems.splice(index, 1);
    this.renderEditSaleTable();
  },

  addItemToEditSale() {
    const select = document.getElementById('editSaleAddProdSelect');
    const prodId = parseInt(select.value, 10);
    const prod = App.products.find(p => p.id === prodId);
    if (!prod) return;

    const existing = this.editSaleItems.find(i => i.productoId === prod.id);
    if (existing) {
      existing.cantidad += 1;
      existing.subtotal = existing.cantidad * existing.precioUnitario;
    } else {
      this.editSaleItems.push({
        productoId: prod.id,
        nombre: prod.nombre,
        precioUnitario: prod.precioUnitario,
        cantidad: 1,
        subtotal: prod.precioUnitario
      });
    }
    this.renderEditSaleTable();
  },

  // Guardar modificaciones de venta (CU07)
  async submitEditSale() {
    if (!this.selectedSaleForEdit) return;
    if (this.editSaleItems.length === 0) {
      App.showToast('La venta debe contener al menos un producto.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/ventas/${this.selectedSaleForEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: this.editSaleItems,
          usuarioId: App.currentUser.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        App.showToast(data.error || 'Error al modificar la venta.', 'error');
        return;
      }

      App.closeModal('modalEditSale');
      App.showToast('Venta y comprobante modificados con éxito.', 'success');

      await this.fetchSales();
      if (window.PosModule) PosModule.loadCatalog();
      if (window.ProductsModule) ProductsModule.fetchProducts();
      if (window.StockModule) StockModule.fetchMovements();
    } catch (err) {
      console.error('Error al guardar modificación de venta', err);
      App.showToast('Error de comunicación con el servidor.', 'error');
    }
  }
};
