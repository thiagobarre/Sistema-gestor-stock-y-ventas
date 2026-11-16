/**
 * SISTEMA DE GESTIÓN DE STOCK Y VENTAS - DRUGSTORE X
 * products.js: Gestión de Productos (CU10, CU11, CU12, CU13)
 * Cumple Regla R-03: Suspensión automática si stock se modifica a 0
 */

window.ProductsModule = {
  productsList: [],

  init() {
    this.bindEvents();
    this.fetchProducts();
  },

  bindEvents() {
    // Filtros de búsqueda
    const searchInput = document.getElementById('filterProductSearch');
    const catSelect = document.getElementById('filterProductCategory');
    const statusSelect = document.getElementById('filterProductStatus');

    if (searchInput) searchInput.addEventListener('input', () => this.filterAndRender());
    if (catSelect) catSelect.addEventListener('change', () => this.filterAndRender());
    if (statusSelect) statusSelect.addEventListener('change', () => this.filterAndRender());

    // Botón abrir modal nuevo producto (CU10)
    const btnNew = document.getElementById('btnOpenNewProductModal');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        document.getElementById('formNewProduct').reset();
        App.openModal('modalNewProduct');
      });
    }

    // Submit nuevo producto (CU10)
    const formNew = document.getElementById('formNewProduct');
    if (formNew) {
      formNew.addEventListener('submit', (e) => this.submitNewProduct(e));
    }

    // Submit modificar producto (CU12)
    const formEdit = document.getElementById('formEditProduct');
    if (formEdit) {
      formEdit.addEventListener('submit', (e) => this.submitEditProduct(e));
    }

    // Botón abrir modal ingreso / ajuste de stock
    const btnStockEntry = document.getElementById('btnOpenStockEntryModal');
    if (btnStockEntry) {
      btnStockEntry.addEventListener('click', () => this.openStockEntryModal());
    }

    // Submit ingreso / ajuste de stock
    const formStockEntry = document.getElementById('formStockEntry');
    if (formStockEntry) {
      formStockEntry.addEventListener('submit', (e) => this.submitStockEntry(e));
    }

    // Botón abrir modal devolución de producto
    const btnReturn = document.getElementById('btnOpenReturnModal');
    if (btnReturn) {
      btnReturn.addEventListener('click', () => this.openReturnModal());
    }

    // Submit devolución de producto
    const formReturn = document.getElementById('formProductReturn');
    if (formReturn) {
      formReturn.addEventListener('submit', (e) => this.submitProductReturn(e));
    }
  },

  // Obtener listado de productos desde la API
  async fetchProducts() {
    try {
      const res = await fetch('/api/productos');
      const data = await res.json();
      this.productsList = data;
      App.products = data;

      // Actualizar contador global
      const badge = document.getElementById('productsCountBadge');
      if (badge) badge.innerText = data.length;

      this.renderTable();
    } catch (err) {
      console.error('Error al obtener productos', err);
      App.showToast('Error al cargar productos.', 'error');
    }
  },

  // Filtrado dinámico
  filterAndRender() {
    this.renderTable();
  },

  // Renderizar la tabla de productos (CU11 Consultar Producto)
  renderTable() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('filterProductSearch')?.value || '').toLowerCase().trim();
    const cat = document.getElementById('filterProductCategory')?.value || 'Todas';
    const status = document.getElementById('filterProductStatus')?.value || 'Todos';
    const isGerente = App.currentUser.rol === 'Gerente';

    let filtered = this.productsList;

    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.nombre.toLowerCase().includes(searchTerm) || 
        p.codigo.toLowerCase().includes(searchTerm)
      );
    }
    if (cat !== 'Todas') {
      filtered = filtered.filter(p => p.categoria === cat);
    }
    if (status !== 'Todos') {
      filtered = filtered.filter(p => p.estado === status);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">
            No se encontraron productos que coincidan con los filtros aplicados.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const isSuspended = p.estado === 'suspendido';
      const noStock = p.stock <= 0;
      let stockBadgeClass = 'stock-ok';
      let stockText = `${p.stock} u.`;

      if (noStock) {
        stockBadgeClass = 'stock-zero';
        stockText = '0 u. (Sin Stock)';
      } else if (p.stock <= 5) {
        stockBadgeClass = 'stock-low';
        stockText = `${p.stock} u. (Crítico)`;
      }

      // Botones de acción según rol (Gerente tiene edición y suspensión; Empleado solo consulta)
      let actionsHtml = '';
      if (isGerente) {
        actionsHtml = `
          <button class="btn btn-secondary btn-sm" onclick="ProductsModule.openEditModal(${p.id})">
            ✏️ Modificar
          </button>
          <button class="btn ${isSuspended ? 'btn-success' : 'btn-danger'} btn-sm" onclick="ProductsModule.toggleSuspend(${p.id})">
            ${isSuspended ? '✓ Reactivar' : '🚫 Suspender'}
          </button>
        `;
      } else {
        actionsHtml = `<span style="font-size: 12px; color: var(--text-light);">Solo Lectura</span>`;
      }

      return `
        <tr>
          <td><span class="table-code">${p.codigo}</span></td>
          <td style="font-weight: 600;">${p.nombre}</td>
          <td><span class="badge" style="background: #f1f5f9;">${p.categoria}</span></td>
          <td style="font-weight: 700; color: #1e40af;">${App.formatMoney(p.precioUnitario)}</td>
          <td>
            <span class="card-stock-badge ${stockBadgeClass}">
              ${stockText}
            </span>
          </td>
          <td>
            <span class="badge ${isSuspended ? 'badge-suspendido' : 'badge-activo'}">
              ${isSuspended ? 'Suspendido' : 'Activo'}
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

  // Registrar nuevo producto (CU10 - Gerente)
  async submitNewProduct(e) {
    e.preventDefault();
    const codigo = document.getElementById('newProdCodigo').value.trim();
    const nombre = document.getElementById('newProdNombre').value.trim();
    const categoria = document.getElementById('newProdCategoria').value;
    const precio = parseFloat(document.getElementById('newProdPrecio').value);
    const stock = parseInt(document.getElementById('newProdStock').value, 10);

    try {
      const res = await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          nombre,
          categoria,
          precioUnitario: precio,
          stockInicial: stock,
          usuarioId: App.currentUser.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        App.showToast(data.error || 'Error al registrar el producto.', 'error');
        return;
      }

      App.closeModal('modalNewProduct');
      App.showToast(`Producto "${data.nombre}" registrado exitosamente.`, 'success');

      // Actualizar listados
      await this.fetchProducts();
      if (window.PosModule) PosModule.loadCatalog();
      if (window.StockModule) StockModule.fetchMovements();
    } catch (err) {
      console.error('Error al crear producto', err);
      App.showToast('Error de comunicación con el servidor.', 'error');
    }
  },

  // Abrir modal de edición (CU12 - Gerente)
  openEditModal(productId) {
    const prod = this.productsList.find(p => p.id === productId);
    if (!prod) return;

    document.getElementById('editProdId').value = prod.id;
    document.getElementById('editProdCodigo').value = prod.codigo;
    document.getElementById('editProdNombre').value = prod.nombre;
    document.getElementById('editProdCategoria').value = prod.categoria;
    document.getElementById('editProdPrecio').value = prod.precioUnitario;
    document.getElementById('editProdStock').value = prod.stock;

    App.openModal('modalEditProduct');
  },

  // Enviar modificación de producto (CU12 - Gerente)
  // Regla R-03: No es posible modificar el stock a 0; en ese caso se da la suspensión del producto.
  async submitEditProduct(e) {
    e.preventDefault();
    const id = document.getElementById('editProdId').value;
    const codigo = document.getElementById('editProdCodigo').value.trim();
    const nombre = document.getElementById('editProdNombre').value.trim();
    const categoria = document.getElementById('editProdCategoria').value;
    const precio = parseFloat(document.getElementById('editProdPrecio').value);
    const stock = parseInt(document.getElementById('editProdStock').value, 10);

    try {
      const res = await fetch(`/api/productos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          nombre,
          categoria,
          precioUnitario: precio,
          stock,
          usuarioId: App.currentUser.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        App.showToast(data.error || 'Error al modificar el producto.', 'error');
        return;
      }

      App.closeModal('modalEditProduct');

      if (data.avisoR03) {
        // Notificar explícitamente cumplimiento de regla R-03
        App.showToast(data.avisoR03, 'warning');
      } else {
        App.showToast(data.mensaje || 'Producto actualizado con éxito.', 'success');
      }

      await this.fetchProducts();
      if (window.PosModule) PosModule.loadCatalog();
      if (window.StockModule) StockModule.fetchMovements();
    } catch (err) {
      console.error('Error al editar producto', err);
      App.showToast('Error de comunicación con el servidor.', 'error');
    }
  },

  // Suspender / Reactivar producto (CU13 - Gerente)
  async toggleSuspend(productId) {
    const prod = this.productsList.find(p => p.id === productId);
    if (!prod) return;

    const actionText = prod.estado === 'activo' ? 'suspender (baja lógica)' : 'reactivar';
    if (!confirm(`¿Está seguro de que desea ${actionText} el producto "${prod.nombre}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/productos/${productId}/suspender`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) {
        App.showToast(data.error || 'Error al actualizar estado del producto.', 'error');
        return;
      }

      App.showToast(data.mensaje, prod.estado === 'activo' ? 'warning' : 'success');
      await this.fetchProducts();
      if (window.PosModule) PosModule.loadCatalog();
    } catch (err) {
      console.error('Error al suspender producto', err);
      App.showToast('Error de conexión con el servidor.', 'error');
    }
  },

  // Abrir modal de ingreso / ajuste de stock rápido
  openStockEntryModal() {
    const select = document.getElementById('stockEntryProdSelect');
    if (!select) return;

    select.innerHTML = this.productsList.map(p => `
      <option value="${p.id}">${p.nombre} (Stock actual: ${p.stock} u.)</option>
    `).join('');

    document.getElementById('formStockEntry').reset();
    App.openModal('modalStockEntry');
  },

  // Enviar ingreso de stock
  async submitStockEntry(e) {
    e.preventDefault();
    const prodId = document.getElementById('stockEntryProdSelect').value;
    const motivo = document.getElementById('stockEntryMotivo').value;
    const delta = parseInt(document.getElementById('stockEntryCantidad').value, 10);
    const detalle = document.getElementById('stockEntryDetalle').value.trim();

    const prod = this.productsList.find(p => p.id === parseInt(prodId, 10));
    if (!prod) return;

    const nuevoStock = prod.stock + delta;
    if (nuevoStock < 0) {
      App.showToast('El stock no puede quedar negativo.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/productos/${prodId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock: nuevoStock,
          motivoCambio: motivo,
          usuarioId: App.currentUser.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        App.showToast(data.error || 'Error al ajustar stock.', 'error');
        return;
      }

      App.closeModal('modalStockEntry');
      if (data.avisoR03) {
        App.showToast(data.avisoR03, 'warning');
      } else {
        App.showToast(`Stock de "${prod.nombre}" actualizado a ${nuevoStock} unidades.`, 'success');
      }

      await this.fetchProducts();
      if (window.PosModule) PosModule.loadCatalog();
      if (window.StockModule) StockModule.fetchMovements();
    } catch (err) {
      console.error('Error al ajustar stock', err);
      App.showToast('Error al comunicar con el servidor.', 'error');
    }
  },

  // Abrir modal de devolución de producto (CU12)
  openReturnModal() {
    const select = document.getElementById('returnProdSelect');
    if (!select) return;

    select.innerHTML = this.productsList.map(p => `
      <option value="${p.id}">${p.nombre} (Stock actual: ${p.stock} u.)</option>
    `).join('');

    document.getElementById('formProductReturn').reset();
    App.openModal('modalProductReturn');
  },

  // Enviar devolución de producto (CU12)
  async submitProductReturn(e) {
    e.preventDefault();
    const prodId = document.getElementById('returnProdSelect').value;
    const cantidad = parseInt(document.getElementById('returnCantidad').value, 10);
    const motivo = document.getElementById('returnMotivo').value.trim();

    try {
      const res = await fetch(`/api/productos/${prodId}/devolucion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cantidadDevuelta: cantidad,
          motivo,
          usuarioId: App.currentUser.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        App.showToast(data.error || 'Error al registrar devolución.', 'error');
        return;
      }

      App.closeModal('modalProductReturn');
      App.showToast(data.mensaje, 'success');

      await this.fetchProducts();
      if (window.PosModule) PosModule.loadCatalog();
      if (window.StockModule) StockModule.fetchMovements();
    } catch (err) {
      console.error('Error al registrar devolución', err);
      App.showToast('Error de comunicación con el servidor.', 'error');
    }
  }
};
