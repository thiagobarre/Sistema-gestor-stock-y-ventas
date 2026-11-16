/**
 * SISTEMA DE GESTIÓN DE STOCK Y VENTAS - DRUGSTORE X
 * pos.js: Punto de Venta (CU06 Registrar Venta y CU11 Consultar Producto)
 * Cumple Regla R-01 (Venta con stock) y RNFR-01 (Respuesta inmediata)
 */

window.PosModule = {
  currentCategory: 'Todas',
  searchTerm: '',

  init() {
    this.bindEvents();
    this.loadCatalog();
  },

  bindEvents() {
    // Búsqueda en tiempo real e input de lector de código de barras
    const searchInput = document.getElementById('posSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value;
        this.renderCatalog();
      });

      // Lector de código de barras (al presionar Enter agrega directamente)
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleBarcodeScan(searchInput.value.trim());
        }
      });
    }

    // Filtro de categorías (Pills)
    const pills = document.querySelectorAll('#posCategoryPills .cat-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentCategory = pill.dataset.cat;
        this.renderCatalog();
      });
    });

    // Botón Limpiar Ticket
    const btnClear = document.getElementById('btnClearCart');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (App.cart.length > 0) {
          if (confirm('¿Desea vaciar el ticket de venta actual?')) {
            App.cart = [];
            this.renderCart();
            App.showToast('Ticket vaciado.', 'warning');
          }
        }
      });
    }

    // Botón Cobrar (abre modal de cobro)
    const btnCheckout = document.getElementById('btnOpenCheckoutModal');
    if (btnCheckout) {
      btnCheckout.addEventListener('click', () => {
        if (App.cart.length === 0) {
          App.showToast('El ticket está vacío. Agregue productos para cobrar.', 'error');
          return;
        }
        this.openCheckoutModal();
      });
    }

    // Modal de cobro: Cálculo de vuelto en tiempo real
    const inputAbonado = document.getElementById('checkoutMontoAbonado');
    if (inputAbonado) {
      inputAbonado.addEventListener('input', () => this.calculateVuelto());
    }

    // Modal de cobro: Botones de billetes rápidos
    document.querySelectorAll('.quick-bill').forEach(btn => {
      btn.addEventListener('click', () => {
        const total = this.getCartTotal();
        const amountType = btn.dataset.amount;
        if (amountType === 'exact') {
          inputAbonado.value = total;
        } else {
          inputAbonado.value = amountType;
        }
        this.calculateVuelto();
      });
    });

    // Alternar campos de cobro según método de pago
    const selectMetodo = document.getElementById('checkoutMetodoPago');
    const cashSection = document.getElementById('checkoutCashSection');
    if (selectMetodo && cashSection) {
      selectMetodo.addEventListener('change', () => {
        if (selectMetodo.value === 'Efectivo') {
          cashSection.style.display = 'block';
        } else {
          cashSection.style.display = 'none';
          inputAbonado.value = this.getCartTotal();
          this.calculateVuelto();
        }
      });
    }

    // Confirmar venta definitiva (CU06)
    const btnConfirmSale = document.getElementById('btnConfirmSaleSubmit');
    if (btnConfirmSale) {
      btnConfirmSale.addEventListener('click', () => this.submitSale());
    }

    // Botón Imprimir Ticket en modal
    const btnPrint = document.getElementById('btnPrintTicket');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => window.print());
    }

    // Botón Nueva Venta en modal
    const btnNewSale = document.getElementById('btnTicketNewSale');
    if (btnNewSale) {
      btnNewSale.addEventListener('click', () => {
        App.closeModal('modalTicketPreview');
        const searchInput = document.getElementById('posSearchInput');
        if (searchInput) searchInput.focus();
      });
    }
  },

  // Cargar catálogo de productos desde el servidor local
  async loadCatalog() {
    try {
      const res = await fetch('/api/productos');
      const data = await res.json();
      App.products = data;

      // Actualizar contador global
      const badge = document.getElementById('productsCountBadge');
      if (badge) badge.innerText = data.length;

      this.renderCatalog();
    } catch (err) {
      console.error('Error al cargar catálogo', err);
      App.showToast('Error al conectar con la base de datos local.', 'error');
    }
  },

  // Escaneo de código de barras
  handleBarcodeScan(code) {
    if (!code) return;
    const prod = App.products.find(p => p.codigo === code || p.codigo.endsWith(code));
    if (prod) {
      this.addToCart(prod.id);
      const searchInput = document.getElementById('posSearchInput');
      if (searchInput) {
        searchInput.value = '';
        this.searchTerm = '';
        this.renderCatalog();
        searchInput.focus();
      }
    } else {
      App.showToast(`No se encontró ningún producto con el código "${code}".`, 'error');
    }
  },

  // Renderizar catálogo en tarjetas intuitivas
  renderCatalog() {
    const grid = document.getElementById('posProductsGrid');
    if (!grid) return;

    let filtered = App.products;

    // Filtro por categoría
    if (this.currentCategory !== 'Todas') {
      filtered = filtered.filter(p => p.categoria === this.currentCategory);
    }

    // Filtro por término de búsqueda (nombre o código)
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.nombre.toLowerCase().includes(term) || 
        p.codigo.toLowerCase().includes(term)
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
          <p style="font-size: 28px;">🔍</p>
          <p>No se encontraron productos coincidentes.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(p => {
      const isSuspended = p.estado === 'suspendido';
      const noStock = p.stock <= 0;
      let stockClass = 'stock-ok';
      let stockText = `Stock: ${p.stock}`;

      if (noStock) {
        stockClass = 'stock-zero';
        stockText = 'Sin Stock';
      } else if (p.stock <= 5) {
        stockClass = 'stock-low';
        stockText = `Stock Crítico: ${p.stock}`;
      }

      let extraClass = '';
      if (isSuspended) extraClass = 'suspended';
      else if (noStock) extraClass = 'no-stock';

      return `
        <div class="pos-product-card ${extraClass}" onclick="PosModule.addToCart(${p.id})">
          <div>
            <div class="card-category">${p.categoria}</div>
            <div class="card-title">${p.nombre}</div>
          </div>
          <div class="card-footer">
            <div class="card-price">${App.formatMoney(p.precioUnitario)}</div>
            <span class="card-stock-badge ${stockClass}">
              ${isSuspended ? 'Suspendido' : stockText}
            </span>
          </div>
        </div>
      `;
    }).join('');
  },

  // Regla R-01: El sistema no debe permitir registrar una venta si el producto no tiene stock
  addToCart(productId) {
    const prod = App.products.find(p => p.id === productId);
    if (!prod) return;

    if (prod.estado === 'suspendido') {
      App.showToast(`El producto "${prod.nombre}" está suspendido (baja lógica). No puede venderse.`, 'error');
      return;
    }

    if (prod.stock <= 0) {
      App.showToast(`El producto "${prod.nombre}" no tiene stock disponible (Regla R-01).`, 'error');
      return;
    }

    const existing = App.cart.find(item => item.productoId === prod.id);
    if (existing) {
      if (existing.cantidad + 1 > prod.stock) {
        App.showToast(`No es posible agregar más unidades. Stock disponible: ${prod.stock} (Regla R-01).`, 'error');
        return;
      }
      existing.cantidad += 1;
      existing.subtotal = existing.cantidad * existing.precioUnitario;
    } else {
      App.cart.push({
        productoId: prod.id,
        codigo: prod.codigo,
        nombre: prod.nombre,
        categoria: prod.categoria,
        precioUnitario: prod.precioUnitario,
        cantidad: 1,
        subtotal: prod.precioUnitario,
        stockMax: prod.stock
      });
    }

    this.renderCart();
  },

  // Modificar cantidad directamente en el ticket
  updateCartItemQty(productId, newQty) {
    const prod = App.products.find(p => p.id === productId);
    const item = App.cart.find(i => i.productoId === productId);
    if (!item) return;

    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty <= 0) {
      this.removeFromCart(productId);
      return;
    }

    if (prod && qty > prod.stock) {
      App.showToast(`Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock} (Regla R-01).`, 'error');
      item.cantidad = prod.stock;
    } else {
      item.cantidad = qty;
    }

    item.subtotal = item.cantidad * item.precioUnitario;
    this.renderCart();
  },

  // Eliminar producto del carrito
  removeFromCart(productId) {
    App.cart = App.cart.filter(i => i.productoId !== productId);
    this.renderCart();
  },

  // Obtener total del ticket
  getCartTotal() {
    return App.cart.reduce((sum, item) => sum + item.subtotal, 0);
  },

  // Renderizar panel de ticket / carrito
  renderCart() {
    const emptyMsg = document.getElementById('cartEmptyMessage');
    const itemsList = document.getElementById('cartItemsList');
    const badgeCount = document.getElementById('cartItemsBadge');
    const summaryQty = document.getElementById('cartSummaryQty');
    const summarySubtotal = document.getElementById('cartSummarySubtotal');
    const summaryTotal = document.getElementById('cartSummaryTotal');

    const totalQty = App.cart.reduce((sum, i) => sum + i.cantidad, 0);
    const totalAmount = this.getCartTotal();

    if (badgeCount) badgeCount.innerText = `${totalQty} ítems`;
    if (summaryQty) summaryQty.innerText = totalQty;
    if (summarySubtotal) summarySubtotal.innerText = App.formatMoney(totalAmount);
    if (summaryTotal) summaryTotal.innerText = App.formatMoney(totalAmount);

    if (App.cart.length === 0) {
      if (emptyMsg) emptyMsg.style.display = 'block';
      if (itemsList) itemsList.innerHTML = '';
      return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    if (itemsList) {
      itemsList.innerHTML = App.cart.map(item => `
        <div class="cart-item-row">
          <div class="cart-item-info">
            <div class="item-name">${item.nombre}</div>
            <div class="item-price">${App.formatMoney(item.precioUnitario)} c/u</div>
          </div>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="PosModule.updateCartItemQty(${item.productoId}, ${item.cantidad - 1})">-</button>
            <input 
              type="number" 
              class="qty-input" 
              value="${item.cantidad}" 
              min="1" 
              max="${item.stockMax}"
              onchange="PosModule.updateCartItemQty(${item.productoId}, this.value)"
            >
            <button class="qty-btn" onclick="PosModule.updateCartItemQty(${item.productoId}, ${item.cantidad + 1})">+</button>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="cart-item-subtotal">${App.formatMoney(item.subtotal)}</div>
            <button class="cart-delete-btn" title="Quitar ítem" onclick="PosModule.removeFromCart(${item.productoId})">🗑️</button>
          </div>
        </div>
      `).join('');
    }
  },

  // Abrir modal de cobro y preconfigurar valores
  openCheckoutModal() {
    const total = this.getCartTotal();
    const modalTotal = document.getElementById('modalCheckoutTotal');
    const inputAbonado = document.getElementById('checkoutMontoAbonado');

    if (modalTotal) modalTotal.innerText = App.formatMoney(total);
    if (inputAbonado) {
      inputAbonado.value = total;
      this.calculateVuelto();
    }

    App.openModal('modalCheckout');
  },

  // Calcular vuelto
  calculateVuelto() {
    const total = this.getCartTotal();
    const inputAbonado = document.getElementById('checkoutMontoAbonado');
    const vueltoDisplay = document.getElementById('checkoutVueltoDisplay');

    const abonado = parseFloat(inputAbonado.value) || 0;
    const vuelto = Math.max(0, abonado - total);

    if (vueltoDisplay) {
      vueltoDisplay.innerText = App.formatMoney(vuelto);
      if (abonado < total) {
        vueltoDisplay.style.color = 'var(--danger)';
        vueltoDisplay.innerText = 'Faltan ' + App.formatMoney(total - abonado);
      } else {
        vueltoDisplay.style.color = '#1e40af';
      }
    }
  },

  // Enviar venta confirmada al backend (CU06 Registrar venta)
  async submitSale() {
    const total = this.getCartTotal();
    const inputAbonado = document.getElementById('checkoutMontoAbonado');
    const selectMetodo = document.getElementById('checkoutMetodoPago');
    const abonado = parseFloat(inputAbonado.value) || total;

    if (selectMetodo.value === 'Efectivo' && abonado < total) {
      App.showToast('El monto abonado no puede ser menor al total de la venta.', 'error');
      return;
    }

    const tipoCompRadio = document.querySelector('input[name="checkoutTipoComp"]:checked');
    const tipoComprobante = tipoCompRadio ? tipoCompRadio.value : 'comprobante';

    const clienteNombre = document.getElementById('checkoutClienteNombre').value.trim() || 'Consumidor Final';
    const clienteDni = document.getElementById('checkoutClienteDni').value.trim();

    const payload = {
      items: App.cart.map(i => ({
        productoId: i.productoId,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario
      })),
      clienteNombre,
      clienteDni,
      tipoComprobante,
      metodoPago: selectMetodo.value,
      montoAbonado: abonado,
      usuarioId: App.currentUser.id
    };

    try {
      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        App.showToast(data.error || 'Error al procesar la venta.', 'error');
        return;
      }

      // Venta registrada exitosamente
      App.closeModal('modalCheckout');
      App.showToast('¡Venta registrada con éxito!', 'success');

      // Vaciar carrito
      App.cart = [];
      this.renderCart();

      // Recargar catálogo de productos para ver el stock actualizado
      await this.loadCatalog();

      // Mostrar vista previa del comprobante / ticket térmico (CL-05)
      this.showTicketPreview(data);

      // Si otros módulos están activos, refrescarlos
      if (window.SalesModule) SalesModule.fetchSales();
      if (window.ReportsModule) ReportsModule.fetchDashboard();
      if (window.StockModule) StockModule.fetchMovements();
    } catch (err) {
      console.error('Error al registrar venta', err);
      App.showToast('Error de comunicación con el servidor local.', 'error');
    }
  },

  // Mostrar el comprobante / ticket térmico listo para imprimir (CL-05)
  showTicketPreview(ventaData) {
    const comp = ventaData.comprobante;
    const detalles = ventaData.detalles || [];

    const tipoNumEl = document.getElementById('ticketTipoNum');
    const fechaHoraEl = document.getElementById('ticketFechaHora');
    const atendidoEl = document.getElementById('ticketAtendidoPor');
    const clienteEl = document.getElementById('ticketCliente');
    const itemsBody = document.getElementById('ticketItemsBody');
    const totalEl = document.getElementById('ticketTotalAmount');
    const metodoEl = document.getElementById('ticketMetodoPago');
    const abonadoEl = document.getElementById('ticketAbonado');
    const vueltoEl = document.getElementById('ticketVuelto');

    if (tipoNumEl) {
      const tipoStr = comp.tipo === 'factura' ? 'FACTURA "B"' : 'TICKET COMPROBANTE';
      tipoNumEl.innerText = `${tipoStr} N° ${comp.numero}`;
    }
    if (fechaHoraEl) fechaHoraEl.innerText = comp.fechaEmision;
    if (atendidoEl) atendidoEl.innerText = `Atendido por: ${ventaData.nombreEmpleado || App.currentUser.nombre}`;
    if (clienteEl) {
      clienteEl.innerText = `Cliente: ${comp.clienteNombre}${comp.clienteDni ? ' (DNI: ' + comp.clienteDni + ')' : ''}`;
    }

    if (itemsBody) {
      itemsBody.innerHTML = detalles.map(d => `
        <tr>
          <td>${d.productoNombre}</td>
          <td style="text-align: center;">${d.cantidad}</td>
          <td style="text-align: right;">${App.formatMoney(d.precioUnitario)}</td>
          <td style="text-align: right;">${App.formatMoney(d.subtotal)}</td>
        </tr>
      `).join('');
    }

    if (totalEl) totalEl.innerText = App.formatMoney(comp.total);
    if (metodoEl) metodoEl.innerText = comp.metodoPago || 'Efectivo';
    if (abonadoEl) abonadoEl.innerText = App.formatMoney(comp.montoAbonado || comp.total);
    if (vueltoEl) vueltoEl.innerText = App.formatMoney(comp.vuelto || 0);

    App.openModal('modalTicketPreview');
  }
};
