/**
 * SISTEMA DE GESTIÓN DE STOCK Y VENTAS - DRUGSTORE X
 * app.js: Estado global, navegación, control de roles (RUP) y utilidades
 */

window.App = {
  // Usuario actual en sesión (CU01)
  currentUser: {
    id: 1,
    nombre: 'Sonia Santana (Gerente General)',
    nombreUsuario: 'gerente',
    rol: 'Gerente',
    estado: 'activo'
  },

  // Estado del carrito de compras (POS)
  cart: [],

  // Catálogo en memoria para búsqueda inmediata (< 2 seg según RNFR-01)
  products: [],

  // Inicialización
  init() {
    this.initClock();
    this.restoreUserSession();
    this.bindGlobalEvents();
    this.setupModals();
    this.applyRolePermissions();

    // Cargar datos iniciales
    if (window.PosModule) window.PosModule.init();
    if (window.ProductsModule) window.ProductsModule.init();
    if (window.SalesModule) window.SalesModule.init();
    if (window.StockModule) window.StockModule.init();
    if (window.UsersModule) window.UsersModule.init();
    if (window.ReportsModule) window.ReportsModule.init();
  },

  // Reloj de la barra de estado
  initClock() {
    const clockEl = document.getElementById('liveClockDisplay');
    const update = () => {
      const now = new Date();
      if (clockEl) {
        clockEl.innerText = '🕒 ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    };
    update();
    setInterval(update, 1000);
  },

  // Restaurar sesión desde localStorage
  restoreUserSession() {
    try {
      const saved = localStorage.getItem('drugstore_user');
      if (saved) {
        this.currentUser = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error al leer sesión guardada', e);
    }
    this.updateUserUI();
  },

  // Actualizar UI del usuario y rol
  updateUserUI() {
    const nameEl = document.getElementById('userNameDisplay');
    const roleEl = document.getElementById('userRoleDisplay');
    const avatarEl = document.getElementById('userAvatarText');
    const quickSwitchBtn = document.getElementById('btnQuickSwitchRole');

    if (nameEl) nameEl.innerText = this.currentUser.nombre;
    if (roleEl) {
      if (this.currentUser.rol === 'Gerente') {
        roleEl.innerText = 'Gerente (Acceso Total)';
        roleEl.className = 'user-role role-gerente';
        if (quickSwitchBtn) quickSwitchBtn.innerText = '🔄 Probar como Empleado';
      } else {
        roleEl.innerText = 'Empleado (Mostrador / Caja)';
        roleEl.className = 'user-role role-empleado';
        if (quickSwitchBtn) quickSwitchBtn.innerText = '🔄 Probar como Gerente';
      }
    }
    if (avatarEl) {
      avatarEl.innerText = this.currentUser.nombre.charAt(0).toUpperCase();
    }

    this.applyRolePermissions();
  },

  // Aplicar permisos según el rol (RUP Nivel 0 y Nivel 1)
  // Gerente: acceso total (Usuarios, Informes, Modificar/Anular Ventas, CRUD Productos)
  // Empleado: Punto de Venta (CU06) y Consulta de Productos (CU11)
  applyRolePermissions() {
    const isGerente = this.currentUser.rol === 'Gerente';

    // Ocultar / Mostrar pestañas exclusivas de Gerente
    document.querySelectorAll('.gerente-tab').forEach(tab => {
      tab.style.display = isGerente ? 'flex' : 'none';
    });

    // Ocultar / Mostrar botones exclusivos de Gerente
    document.querySelectorAll('.gerente-btn').forEach(btn => {
      btn.style.display = isGerente ? 'inline-flex' : 'none';
    });

    // Si el usuario actual es empleado y está en una pestaña restringida, volver al POS
    const activeTab = document.querySelector('.tab-btn.active');
    if (!isGerente && activeTab && (activeTab.dataset.view === 'view-users' || activeTab.dataset.view === 'view-reports')) {
      this.switchView('view-pos');
    }
  },

  // Alternador rápido entre Gerente y Empleado (muy útil para validación de requisitos)
  quickSwitchRole() {
    if (this.currentUser.rol === 'Gerente') {
      this.currentUser = {
        id: 2,
        nombre: 'Dante Lagana (Mostrador)',
        nombreUsuario: 'empleado',
        rol: 'Empleado',
        estado: 'activo'
      };
      this.showToast('Sesión cambiada a perfil: Empleado de Mostrador', 'warning');
    } else {
      this.currentUser = {
        id: 1,
        nombre: 'Gerente General',
        nombreUsuario: 'gerente',
        rol: 'Gerente',
        estado: 'activo'
      };
      this.showToast('Sesión cambiada a perfil: Gerente (Acceso Total)', 'success');
    }
    localStorage.setItem('drugstore_user', JSON.stringify(this.currentUser));
    this.updateUserUI();

    // Notificar a módulos para refrescar botones
    if (window.SalesModule) SalesModule.renderSalesTable();
    if (window.ProductsModule) ProductsModule.renderTable();
  },

  // Cambiar vista activa
  switchView(viewId) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewId);
    });
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === viewId);
    });

    // Auto-foco en POS
    if (viewId === 'view-pos') {
      const searchInput = document.getElementById('posSearchInput');
      if (searchInput) searchInput.focus();
    }
    // Refresco de datos al abrir vista
    if (viewId === 'view-sales' && window.SalesModule) SalesModule.fetchSales();
    if (viewId === 'view-products' && window.ProductsModule) ProductsModule.fetchProducts();
    if (viewId === 'view-stock-movements' && window.StockModule) StockModule.fetchMovements();
    if (viewId === 'view-users' && window.UsersModule) UsersModule.fetchUsers();
    if (viewId === 'view-reports' && window.ReportsModule) ReportsModule.fetchDashboard();
  },

  // Eventos globales y atajos de teclado
  bindGlobalEvents() {
    // Navegación por tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchView(btn.dataset.view);
      });
    });

    // Botón de cambio rápido de rol
    const btnSwitch = document.getElementById('btnQuickSwitchRole');
    if (btnSwitch) {
      btnSwitch.addEventListener('click', () => this.quickSwitchRole());
    }

    // Botón Salir / Login
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        this.openModal('modalLogin');
      });
    }

    // Manejo de formulario de Login (CU01)
    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('loginUsername').value;
        const pass = document.getElementById('loginPassword').value;

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombreUsuario: user, contrasena: pass })
          });
          const data = await res.json();
          if (!res.ok) {
            this.showToast(data.error || 'Error al iniciar sesión', 'error');
            return;
          }

          this.currentUser = data;
          localStorage.setItem('drugstore_user', JSON.stringify(this.currentUser));
          this.updateUserUI();
          this.closeModal('modalLogin');
          this.showToast(`Bienvenido, ${data.nombre} (${data.rol})`, 'success');
          formLogin.reset();
        } catch (err) {
          this.showToast('Error de conexión con el servidor local.', 'error');
        }
      });
    }

    // Atajos de teclado: F2 (Punto de Venta), F4 (Cobrar), Escape (Cerrar modal)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        this.switchView('view-pos');
      } else if (e.key === 'F4') {
        e.preventDefault();
        const btnCheckout = document.getElementById('btnOpenCheckoutModal');
        if (btnCheckout && this.cart.length > 0) {
          btnCheckout.click();
        }
      } else if (e.key === 'Escape') {
        // Cerrar modales abiertos
        document.querySelectorAll('.modal-backdrop.show').forEach(m => {
          m.classList.remove('show');
        });
      }
    });
  },

  // Gestión de Modales
  setupModals() {
    // Cerrar al clickear botones con data-close-modal
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = btn.dataset.closeModal;
        this.closeModal(modalId);
      });
    });

    // Cerrar al clickear fuera de la cajita del modal
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('show');
        }
      });
    });
  },

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('show');
    }
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('show');
    }
  },

  // Mensajes flotantes (Toasts)
  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span style="font-size: 16px;">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // Formateador de moneda en pesos argentinos
  formatMoney(amount) {
    const num = parseFloat(amount) || 0;
    return '$ ' + num.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
