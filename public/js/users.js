/**
 * SISTEMA DE GESTIÓN DE STOCK Y VENTAS - DRUGSTORE X
 * users.js: Administración de Usuarios y Seguridad (CU02, CU03, CU04, CU05)
 * Cumple Requerimiento No Funcional de Seguridad RNFS-01
 */

window.UsersModule = {
  usersList: [],

  init() {
    this.bindEvents();
    this.fetchUsers();
  },

  bindEvents() {
    // Abrir modal nuevo usuario (CU02)
    const btnNew = document.getElementById('btnOpenNewUserModal');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        document.getElementById('formNewUser').reset();
        this.updatePasswordCriteriaUI('');
        App.openModal('modalNewUser');
      });
    }

    // Validación interactiva de contraseña según RNFS-01
    const passInput = document.getElementById('newUserPass');
    if (passInput) {
      passInput.addEventListener('input', (e) => {
        this.updatePasswordCriteriaUI(e.target.value);
      });
    }

    // Submit nuevo usuario (CU02)
    const formNew = document.getElementById('formNewUser');
    if (formNew) {
      formNew.addEventListener('submit', (e) => this.submitNewUser(e));
    }
  },

  // Validador y actualizador visual de los requisitos RNFS-01
  updatePasswordCriteriaUI(pass) {
    const hasLen = pass.length >= 12;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNum = /[0-9]/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);

    this.toggleReqItem('reqLen', hasLen, 'Mínimo 12 caracteres');
    this.toggleReqItem('reqUpper', hasUpper, 'Al menos una letra mayúscula (A-Z)');
    this.toggleReqItem('reqLower', hasLower, 'Al menos una letra minúscula (a-z)');
    this.toggleReqItem('reqNum', hasNum, 'Al menos un número (0-9)');
    this.toggleReqItem('reqSpecial', hasSpecial, 'Al menos un caracter especial (!@#$%...)');

    const isValid = hasLen && hasUpper && hasLower && hasNum && hasSpecial;
    const btnSubmit = document.getElementById('btnSubmitNewUser');
    if (btnSubmit) {
      btnSubmit.disabled = !isValid && pass.length > 0;
    }

    return isValid;
  },

  toggleReqItem(id, isValid, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `req-item ${isValid ? 'valid' : 'invalid'}`;
    el.innerHTML = `<span>${isValid ? '✓' : '•'}</span> ${text}`;
  },

  // Consultar usuarios (CU03 - Gerente)
  async fetchUsers() {
    try {
      const res = await fetch('/api/usuarios');
      const data = await res.json();
      this.usersList = data;
      this.renderTable();
    } catch (err) {
      console.error('Error al cargar usuarios', err);
      App.showToast('Error al consultar usuarios.', 'error');
    }
  },

  // Renderizar tabla de usuarios (CU03)
  renderTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (this.usersList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
            No hay usuarios registrados.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.usersList.map(u => {
      const isSuspended = u.estado === 'suspendido';
      const isSelf = u.id === App.currentUser.id;

      return `
        <tr style="${isSuspended ? 'opacity: 0.6; background: #fff5f5;' : ''}">
          <td style="font-weight: 600;">${u.nombre}</td>
          <td><span class="table-code">${u.nombreUsuario}</span></td>
          <td>
            <span class="badge ${u.rol === 'Gerente' ? 'badge-gerente' : 'badge-empleado'}">
              ${u.rol}
            </span>
          </td>
          <td>
            <span class="badge ${isSuspended ? 'badge-suspendido' : 'badge-activo'}">
              ${isSuspended ? 'Suspendido' : 'Activo'}
            </span>
          </td>
          <td style="font-size: 13px; color: var(--text-muted);">${u.creadoEn || '-'}</td>
          <td style="text-align: right;">
            <div class="table-actions" style="justify-content: flex-end;">
              ${!isSelf ? `
                <button class="btn ${isSuspended ? 'btn-success' : 'btn-danger'} btn-sm" onclick="UsersModule.toggleSuspendUser(${u.id})">
                  ${isSuspended ? '✓ Reactivar' : '🚫 Suspender (CU05)'}
                </button>
              ` : `
                <span style="font-size: 11px; color: var(--text-muted); font-style: italic;">(Usuario Actual)</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // Registrar usuario (CU02 - Gerente)
  async submitNewUser(e) {
    e.preventDefault();
    const nombre = document.getElementById('newUserName').value.trim();
    const nombreUsuario = document.getElementById('newUserUsername').value.trim();
    const rol = document.getElementById('newUserRole').value;
    const contrasena = document.getElementById('newUserPass').value;

    if (!this.updatePasswordCriteriaUI(contrasena)) {
      App.showToast('La contraseña debe cumplir todos los requisitos de seguridad de la norma RNFS-01.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, nombreUsuario, rol, contrasena })
      });

      const data = await res.json();
      if (!res.ok) {
        App.showToast(data.error || 'Error al registrar el usuario.', 'error');
        return;
      }

      App.closeModal('modalNewUser');
      App.showToast(`Usuario "${data.nombreUsuario}" (${data.rol}) creado exitosamente.`, 'success');
      this.fetchUsers();
    } catch (err) {
      console.error('Error al registrar usuario', err);
      App.showToast('Error de comunicación con el servidor.', 'error');
    }
  },

  // Suspender / Reactivar usuario (CU05 - Gerente)
  async toggleSuspendUser(userId) {
    const user = this.usersList.find(u => u.id === userId);
    if (!user) return;

    const actionText = user.estado === 'activo' ? 'suspender (baja lógica)' : 'reactivar';
    if (!confirm(`¿Está seguro de que desea ${actionText} la cuenta de "${user.nombreUsuario}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/usuarios/${userId}/suspender`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) {
        App.showToast(data.error || 'Error al suspender el usuario.', 'error');
        return;
      }

      App.showToast(data.mensaje, user.estado === 'activo' ? 'warning' : 'success');
      this.fetchUsers();
    } catch (err) {
      console.error('Error al suspender usuario', err);
      App.showToast('Error de conexión con el servidor.', 'error');
    }
  }
};
