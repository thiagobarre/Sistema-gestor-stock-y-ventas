const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { db, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar la base de datos local embebida
initDatabase();

/**
 * Validador de contraseña según RNFS-01:
 * "Longitud mínima de 12 caracteres, integrando obligatoriamente mayúsculas,
 * minúsculas, números y signos especiales"
 */
function validarContrasenaRNFS01(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 12) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSpecial;
}

// -------------------------------------------------------------
// 1. AUTENTICACIÓN Y SESIÓN (CU01)
// -------------------------------------------------------------

// CU01: Iniciar sesión
app.post('/api/auth/login', (req, res) => {
  const { nombreUsuario, contrasena } = req.body;
  if (!nombreUsuario || !contrasena) {
    return res.status(400).json({ error: 'Debe ingresar nombre de usuario y contraseña.' });
  }

  const user = db.prepare(`
    SELECT id, nombre, nombreUsuario, contrasena, rol, estado 
    FROM usuarios 
    WHERE nombreUsuario = ?
  `).get(nombreUsuario.trim());

  if (!user || user.contrasena !== contrasena) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  if (user.estado === 'suspendido') {
    return res.status(403).json({ error: 'El usuario se encuentra suspendido en el sistema.' });
  }

  res.json({
    id: user.id,
    nombre: user.nombre,
    nombreUsuario: user.nombreUsuario,
    rol: user.rol,
    estado: user.estado
  });
});

// -------------------------------------------------------------
// 2. GESTIÓN DE PRODUCTOS (CU10, CU11, CU12, CU13)
// -------------------------------------------------------------

// CU11: Consultar productos (Empleado / Gerente)
app.get('/api/productos', (req, res) => {
  const { q, categoria, estado } = req.query;
  let sql = 'SELECT * FROM productos WHERE 1=1';
  const params = [];

  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    sql += ' AND (codigo LIKE ? OR nombre LIKE ?)';
    params.push(term, term);
  }

  if (categoria && categoria !== 'Todas') {
    sql += ' AND categoria = ?';
    params.push(categoria);
  }

  if (estado && estado !== 'Todos') {
    sql += ' AND estado = ?';
    params.push(estado);
  }

  sql += ' ORDER BY nombre ASC';
  const productos = db.prepare(sql).all(...params);
  res.json(productos);
});

// CU11: Consultar producto por ID o código
app.get('/api/productos/:identificador', (req, res) => {
  const { identificador } = req.params;
  const prod = db.prepare(`
    SELECT * FROM productos WHERE id = ? OR codigo = ?
  `).get(identificador, identificador);

  if (!prod) {
    return res.status(404).json({ error: 'Producto no encontrado.' });
  }
  res.json(prod);
});

// CU10: Registrar producto (Gerente)
app.post('/api/productos', (req, res) => {
  const { codigo, nombre, categoria, precioUnitario, stockInicial, usuarioId } = req.body;

  if (!codigo || !nombre || !categoria || precioUnitario === undefined || stockInicial === undefined) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  const precio = parseFloat(precioUnitario);
  const stock = parseInt(stockInicial, 10);

  if (isNaN(precio) || precio < 0) {
    return res.status(400).json({ error: 'El precio unitario debe ser un número mayor o igual a 0.' });
  }
  if (isNaN(stock) || stock < 0) {
    return res.status(400).json({ error: 'El stock inicial debe ser un número entero mayor o igual a 0.' });
  }

  const existing = db.prepare('SELECT id FROM productos WHERE codigo = ?').get(codigo.trim());
  if (existing) {
    return res.status(409).json({ error: 'Ya existe un producto con el código ingresado.' });
  }

  // R-03: Si el stock inicial es 0, nace suspendido
  const estadoInicial = stock === 0 ? 'suspendido' : 'activo';

  try {
    const insert = db.prepare(`
      INSERT INTO productos (codigo, nombre, categoria, precioUnitario, stock, estado)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = insert.run(codigo.trim(), nombre.trim(), categoria.trim(), precio, stock, estadoInicial);
    const prodId = result.lastInsertRowid;

    // Registrar movimiento inicial de stock si hay stock
    if (stock > 0) {
      db.prepare(`
        INSERT INTO movimientos_stock (productoId, usuarioId, cantidad, motivo, stockResultante, detalle)
        VALUES (?, ?, ?, 'ingreso', ?, 'Stock inicial registrado')
      `).run(prodId, usuarioId || 1, stock, stock);
    }

    const nuevoProd = db.prepare('SELECT * FROM productos WHERE id = ?').get(prodId);
    res.status(201).json(nuevoProd);
  } catch (err) {
    console.error('Error al registrar producto:', err);
    res.status(500).json({ error: 'Error interno al registrar el producto.' });
  }
});

// CU12: Modificar producto (Gerente)
// Regla R-03: No es posible modificar el stock a 0; en ese caso se da la suspensión del producto.
app.put('/api/productos/:id', (req, res) => {
  const { id } = req.params;
  const { codigo, nombre, categoria, precioUnitario, stock, usuarioId, motivoCambio } = req.body;

  const prodActual = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!prodActual) {
    return res.status(404).json({ error: 'Producto no encontrado.' });
  }

  const nuevoPrecio = precioUnitario !== undefined ? parseFloat(precioUnitario) : prodActual.precioUnitario;
  let nuevoStock = stock !== undefined ? parseInt(stock, 10) : prodActual.stock;

  if (isNaN(nuevoPrecio) || nuevoPrecio < 0) {
    return res.status(400).json({ error: 'El precio unitario no puede ser negativo.' });
  }
  if (isNaN(nuevoStock) || nuevoStock < 0) {
    return res.status(400).json({ error: 'El stock no puede ser negativo.' });
  }

  let nuevoEstado = prodActual.estado;
  let mensajeR03 = null;

  // Regla R-03: Si el stock se modifica a 0, se suspende automáticamente el producto
  if (nuevoStock === 0) {
    nuevoEstado = 'suspendido';
    mensajeR03 = 'El stock resultante es 0. De acuerdo a la regla R-03, el producto ha sido suspendido automáticamente.';
  } else if (prodActual.estado === 'suspendido' && prodActual.stock === 0 && nuevoStock > 0) {
    // Si estaba suspendido por falta de stock y ahora tiene stock, reactivar si no se indica lo contrario
    nuevoEstado = 'activo';
  }

  try {
    db.prepare(`
      UPDATE productos 
      SET codigo = ?, nombre = ?, categoria = ?, precioUnitario = ?, stock = ?, estado = ?
      WHERE id = ?
    `).run(
      (codigo || prodActual.codigo).trim(),
      (nombre || prodActual.nombre).trim(),
      (categoria || prodActual.categoria).trim(),
      nuevoPrecio,
      nuevoStock,
      nuevoEstado,
      id
    );

    // Si cambió el stock, registrar el movimiento de stock en CL-06
    const diffStock = nuevoStock - prodActual.stock;
    if (diffStock !== 0) {
      const motivo = motivoCambio || (diffStock > 0 ? 'ingreso' : 'corrección');
      db.prepare(`
        INSERT INTO movimientos_stock (productoId, usuarioId, cantidad, motivo, stockResultante, detalle)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, usuarioId || 1, diffStock, motivo, nuevoStock, `Modificación manual de producto: ${motivo}`);
    }

    const prodActualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
    res.json({
      producto: prodActualizado,
      avisoR03: mensajeR03,
      mensaje: 'Producto modificado exitosamente.'
    });
  } catch (err) {
    console.error('Error al modificar producto:', err);
    res.status(500).json({ error: 'Error interno al actualizar el producto.' });
  }
});

// CU12 (Específico): Registrar devolución de productos
app.post('/api/productos/:id/devolucion', (req, res) => {
  const { id } = req.params;
  const { cantidadDevuelta, motivo, usuarioId } = req.body;

  const cantidad = parseInt(cantidadDevuelta, 10);
  if (isNaN(cantidad) || cantidad <= 0) {
    return res.status(400).json({ error: 'La cantidad devuelta debe ser un número entero mayor a 0.' });
  }

  const prod = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!prod) {
    return res.status(404).json({ error: 'Producto no encontrado.' });
  }

  const stockResultante = prod.stock + cantidad;
  let nuevoEstado = prod.estado;
  // Si estaba suspendido con stock 0, se reactiva con la devolución
  if (prod.estado === 'suspendido' && prod.stock === 0) {
    nuevoEstado = 'activo';
  }

  try {
    db.prepare('UPDATE productos SET stock = ?, estado = ? WHERE id = ?').run(stockResultante, nuevoEstado, id);
    db.prepare(`
      INSERT INTO movimientos_stock (productoId, usuarioId, cantidad, motivo, stockResultante, detalle)
      VALUES (?, ?, ?, 'devolución', ?, ?)
    `).run(id, usuarioId || 1, cantidad, stockResultante, motivo || 'Devolución de mercadería registrada por Gerente');

    const prodActualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
    res.json({
      producto: prodActualizado,
      mensaje: `Se registraron +${cantidad} unidades por devolución con éxito.`
    });
  } catch (err) {
    console.error('Error en devolución de producto:', err);
    res.status(500).json({ error: 'Error al registrar devolución.' });
  }
});

// CU13: Suspender / Reactivar producto (baja lógica)
app.patch('/api/productos/:id/suspender', (req, res) => {
  const { id } = req.params;
  const prod = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!prod) {
    return res.status(404).json({ error: 'Producto no encontrado.' });
  }

  const nuevoEstado = prod.estado === 'activo' ? 'suspendido' : 'activo';
  db.prepare('UPDATE productos SET estado = ? WHERE id = ?').run(nuevoEstado, id);

  res.json({
    id: prod.id,
    nombre: prod.nombre,
    estado: nuevoEstado,
    mensaje: `El producto fue ${nuevoEstado === 'suspendido' ? 'suspendido (baja lógica)' : 'reactivado'}.`
  });
});

// -------------------------------------------------------------
// 3. GESTIÓN DE VENTAS Y COMPROBANTES (CU06, CU07, CU08, CU09)
// -------------------------------------------------------------

// Helper para generar número de comprobante único consecutivo
function generarNumeroComprobante(tipo) {
  const count = db.prepare('SELECT COUNT(*) as count FROM comprobantes').get().count + 1;
  const pad = String(count).padStart(8, '0');
  const prefijo = tipo === 'factura' ? 'FAC-B-0001' : 'TIK-0001';
  return `${prefijo}-${pad}`;
}

// CU06: Registrar venta (Empleado / Gerente)
// Regla R-01: El sistema no debe permitir registrar una venta si el producto no tiene stock.
app.post('/api/ventas', (req, res) => {
  const { items, clienteNombre, clienteDni, tipoComprobante, metodoPago, montoAbonado, usuarioId } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Debe agregar al menos un producto a la venta.' });
  }

  // Verificar R-01 y disponibilidad de todos los productos antes de confirmar
  for (const item of items) {
    const prod = db.prepare('SELECT * FROM productos WHERE id = ?').get(item.productoId);
    if (!prod) {
      return res.status(400).json({ error: `El producto con ID ${item.productoId} no existe.` });
    }
    if (prod.estado === 'suspendido') {
      return res.status(400).json({ error: `El producto "${prod.nombre}" está suspendido y no puede comercializarse.` });
    }
    if (prod.stock < item.cantidad) {
      return res.status(400).json({
        error: `Stock insuficiente para "${prod.nombre}". Solicitado: ${item.cantidad}, Disponible: ${prod.stock} (Regla R-01).`
      });
    }
  }

  const now = new Date();
  const fecha = now.toISOString().split('T')[0];
  const hora = now.toTimeString().split(' ')[0];

  let totalCalculado = 0;
  for (const item of items) {
    totalCalculado += item.cantidad * item.precioUnitario;
  }

  const tipoComp = tipoComprobante === 'factura' ? 'factura' : 'comprobante';
  const numComprobante = generarNumeroComprobante(tipoComp);
  const abonado = parseFloat(montoAbonado) || totalCalculado;
  const vuelto = Math.max(0, abonado - totalCalculado);

  db.exec('BEGIN TRANSACTION');
  try {
    // 1. Insertar Venta
    const resVenta = db.prepare(`
      INSERT INTO ventas (fecha, hora, total, estado, usuarioId)
      VALUES (?, ?, ?, 'registrada', ?)
    `).run(fecha, hora, totalCalculado, usuarioId || 1);

    const ventaId = resVenta.lastInsertRowid;

    // 2. Insertar DetalleVenta y descontar stock
    const stmtDetalle = db.prepare(`
      INSERT INTO detalles_venta (ventaId, productoId, cantidad, precioUnitario, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `);

    const stmtUpdateStock = db.prepare(`
      UPDATE productos SET stock = stock - ? WHERE id = ?
    `);

    const stmtMovStock = db.prepare(`
      INSERT INTO movimientos_stock (productoId, usuarioId, cantidad, motivo, stockResultante, detalle)
      VALUES (?, ?, ?, 'venta', ?, ?)
    `);

    for (const item of items) {
      const subtotal = item.cantidad * item.precioUnitario;
      stmtDetalle.run(ventaId, item.productoId, item.cantidad, item.precioUnitario, subtotal);

      // Descontar stock
      stmtUpdateStock.run(item.cantidad, item.productoId);

      // Obtener nuevo stock para el movimiento
      const prodActualizado = db.prepare('SELECT stock FROM productos WHERE id = ?').get(item.productoId);
      stmtMovStock.run(
        item.productoId,
        usuarioId || 1,
        -item.cantidad,
        prodActualizado.stock,
        `Venta N° ${ventaId} - Comp: ${numComprobante}`
      );
    }

    // 3. Generar Comprobante (CL-05)
    db.prepare(`
      INSERT INTO comprobantes (ventaId, numero, tipo, fechaEmision, total, clienteNombre, clienteDni, metodoPago, montoAbonado, vuelto)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ventaId,
      numComprobante,
      tipoComp,
      `${fecha} ${hora}`,
      totalCalculado,
      clienteNombre || 'Consumidor Final',
      clienteDni || '',
      metodoPago || 'Efectivo',
      abonado,
      vuelto
    );

    db.exec('COMMIT');

    // Recuperar datos completos para responder
    const ventaCompleta = obtenerVentaCompleta(ventaId);
    res.status(201).json(ventaCompleta);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('Error al registrar venta:', err);
    res.status(500).json({ error: 'Error interno al procesar la venta.' });
  }
});

// CU09: Consultar ventas (Gerente)
// Listado de ventas con filtros de fechaDesde, fechaHasta, estado y total acumulado
app.get('/api/ventas', (req, res) => {
  const { fechaDesde, fechaHasta, estado } = req.query;

  let sql = `
    SELECT v.*, u.nombre as nombreEmpleado, c.numero as numeroComprobante, c.tipo as tipoComprobante,
           c.clienteNombre, c.metodoPago
    FROM ventas v
    JOIN usuarios u ON v.usuarioId = u.id
    LEFT JOIN comprobantes c ON v.id = c.ventaId
    WHERE 1=1
  `;
  const params = [];

  if (fechaDesde) {
    sql += ' AND v.fecha >= ?';
    params.push(fechaDesde);
  }
  if (fechaHasta) {
    sql += ' AND v.fecha <= ?';
    params.push(fechaHasta);
  }
  if (estado && estado !== 'Todos') {
    sql += ' AND v.estado = ?';
    params.push(estado);
  }

  sql += ' ORDER BY v.fecha DESC, v.hora DESC';

  const ventas = db.prepare(sql).all(...params);

  // Calcular total acumulado de las ventas no anuladas
  let totalAcumuladoNoAnuladas = 0;
  for (const v of ventas) {
    if (v.estado === 'registrada') {
      totalAcumuladoNoAnuladas += v.total;
    }
  }

  res.json({
    ventas,
    totalAcumulado: totalAcumuladoNoAnuladas,
    cantidadVentas: ventas.length
  });
});

// CU09: Consultar detalle de una venta por ID
app.get('/api/ventas/:id', (req, res) => {
  const { id } = req.params;
  const venta = obtenerVentaCompleta(id);
  if (!venta) {
    return res.status(404).json({ error: 'Venta no encontrada.' });
  }
  res.json(venta);
});

// CU08: Anular venta (Gerente)
// Regla R-02: La anulación de la venta sólo puede darse dentro de las 24 horas de realizada.
app.post('/api/ventas/:id/anular', (req, res) => {
  const { id } = req.params;
  const { motivo, usuarioId } = req.body;

  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id);
  if (!venta) {
    return res.status(404).json({ error: 'Venta no encontrada.' });
  }

  if (venta.estado === 'anulada') {
    return res.status(400).json({ error: 'La venta ya se encuentra anulada.' });
  }

  // Validar regla R-02: Menos de 24 horas transcurridas
  const fechaVentaStr = `${venta.fecha}T${venta.hora}`;
  const fechaVenta = new Date(fechaVentaStr);
  const ahora = new Date();
  const diffHoras = (ahora.getTime() - fechaVenta.getTime()) / (1000 * 60 * 60);

  if (diffHoras > 24) {
    return res.status(400).json({
      error: `No es posible anular la venta. Han transcurrido ${diffHoras.toFixed(1)} horas desde su emisión, superando el límite de 24 horas establecido por la regla R-02.`
    });
  }

  // Proceder a anular e incrementar stock (devolución del stock)
  db.exec('BEGIN TRANSACTION');
  try {
    const ahoraStr = ahora.toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(`
      UPDATE ventas 
      SET estado = 'anulada', anuladaEn = ?, motivoAnulacion = ?
      WHERE id = ?
    `).run(ahoraStr, motivo || 'Anulación autorizada por Gerente dentro de las 24hs', id);

    // Obtener detalles de la venta para reintegrar el stock
    const detalles = db.prepare('SELECT * FROM detalles_venta WHERE ventaId = ?').all(id);

    const stmtReintegrar = db.prepare('UPDATE productos SET stock = stock + ? WHERE id = ?');
    const stmtMovStock = db.prepare(`
      INSERT INTO movimientos_stock (productoId, usuarioId, cantidad, motivo, stockResultante, detalle)
      VALUES (?, ?, ?, 'anulación de venta', ?, ?)
    `);

    for (const d of detalles) {
      stmtReintegrar.run(d.cantidad, d.productoId);
      const prodAct = db.prepare('SELECT stock FROM productos WHERE id = ?').get(d.productoId);
      stmtMovStock.run(
        d.productoId,
        usuarioId || 1,
        d.cantidad,
        prodAct.stock,
        `Reintegro por Anulación de Venta N° ${id} (Regla R-02)`
      );
    }

    db.exec('COMMIT');

    const ventaActualizada = obtenerVentaCompleta(id);
    res.json({
      venta: ventaActualizada,
      mensaje: 'Venta anulada con éxito y stock reintegrado al inventario.'
    });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('Error al anular venta:', err);
    res.status(500).json({ error: 'Error interno al anular la venta.' });
  }
});

// CU07: Modificar venta (Gerente)
// Permite modificar ítems y cantidades manteniendo sincronizados el stock y el comprobante
app.put('/api/ventas/:id', (req, res) => {
  const { id } = req.params;
  const { items, usuarioId } = req.body;

  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id);
  if (!venta) {
    return res.status(404).json({ error: 'Venta no encontrada.' });
  }
  if (venta.estado === 'anulada') {
    return res.status(400).json({ error: 'No se puede modificar una venta anulada.' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La venta debe contener al menos un producto.' });
  }

  const detallesAnteriores = db.prepare('SELECT * FROM detalles_venta WHERE ventaId = ?').all(id);

  db.exec('BEGIN TRANSACTION');
  try {
    // 1. Revertir temporalmente el stock consumido en la venta original
    for (const d of detallesAnteriores) {
      db.prepare('UPDATE productos SET stock = stock + ? WHERE id = ?').run(d.cantidad, d.productoId);
    }

    // 2. Verificar disponibilidad de stock para la nueva lista de ítems (R-01)
    for (const item of items) {
      const prod = db.prepare('SELECT * FROM productos WHERE id = ?').get(item.productoId);
      if (!prod) {
        throw new Error(`El producto con ID ${item.productoId} no existe.`);
      }
      if (prod.estado === 'suspendido') {
        throw new Error(`El producto "${prod.nombre}" está suspendido.`);
      }
      if (prod.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para "${prod.nombre}". Solicitado: ${item.cantidad}, Disponible: ${prod.stock}`);
      }
    }

    // 3. Eliminar detalles anteriores
    db.prepare('DELETE FROM detalles_venta WHERE ventaId = ?').run(id);

    // 4. Insertar nuevos detalles y descontar nuevo stock
    let nuevoTotal = 0;
    const stmtInsertDetalle = db.prepare(`
      INSERT INTO detalles_venta (ventaId, productoId, cantidad, precioUnitario, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const subtotal = item.cantidad * item.precioUnitario;
      nuevoTotal += subtotal;
      stmtInsertDetalle.run(id, item.productoId, item.cantidad, item.precioUnitario, subtotal);
      db.prepare('UPDATE productos SET stock = stock - ? WHERE id = ?').run(item.cantidad, item.productoId);

      // Registrar movimiento de stock por modificación
      const prodActual = db.prepare('SELECT stock FROM productos WHERE id = ?').get(item.productoId);
      db.prepare(`
        INSERT INTO movimientos_stock (productoId, usuarioId, cantidad, motivo, stockResultante, detalle)
        VALUES (?, ?, 0, 'modificación de venta', ?, ?)
      `).run(item.productoId, usuarioId || 1, prodActual.stock, `Ajuste por modificación de Venta N° ${id}`);
    }

    // 5. Actualizar totales de la Venta y del Comprobante
    db.prepare('UPDATE ventas SET total = ? WHERE id = ?').run(nuevoTotal, id);
    db.prepare('UPDATE comprobantes SET total = ? WHERE ventaId = ?').run(nuevoTotal, id);

    db.exec('COMMIT');

    const ventaModificada = obtenerVentaCompleta(id);
    res.json({
      venta: ventaModificada,
      mensaje: 'Venta y comprobante modificados con éxito.'
    });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('Error al modificar venta:', err);
    res.status(400).json({ error: err.message || 'Error al modificar la venta.' });
  }
});

// Función auxiliar para obtener venta completa con sus detalles y comprobante
function obtenerVentaCompleta(ventaId) {
  const venta = db.prepare(`
    SELECT v.*, u.nombre as nombreEmpleado, u.nombreUsuario as usuarioEmpleado
    FROM ventas v
    JOIN usuarios u ON v.usuarioId = u.id
    WHERE v.id = ?
  `).get(ventaId);

  if (!venta) return null;

  const detalles = db.prepare(`
    SELECT d.*, p.codigo as productoCodigo, p.nombre as productoNombre, p.categoria as productoCategoria
    FROM detalles_venta d
    JOIN productos p ON d.productoId = p.id
    WHERE d.ventaId = ?
  `).all(ventaId);

  const comprobante = db.prepare('SELECT * FROM comprobantes WHERE ventaId = ?').get(ventaId);

  return {
    ...venta,
    detalles,
    comprobante
  };
}

// -------------------------------------------------------------
// 4. MOVIMIENTOS DE STOCK (CL-06 MOVIMIENTOSTOCK)
// -------------------------------------------------------------
app.get('/api/movimientos-stock', (req, res) => {
  const { productoId, motivo } = req.query;
  let sql = `
    SELECT m.*, p.codigo as productoCodigo, p.nombre as productoNombre, u.nombre as usuarioNombre
    FROM movimientos_stock m
    JOIN productos p ON m.productoId = p.id
    JOIN usuarios u ON m.usuarioId = u.id
    WHERE 1=1
  `;
  const params = [];

  if (productoId) {
    sql += ' AND m.productoId = ?';
    params.push(productoId);
  }
  if (motivo && motivo !== 'Todos') {
    sql += ' AND m.motivo = ?';
    params.push(motivo);
  }

  sql += ' ORDER BY m.id DESC LIMIT 200';
  const movimientos = db.prepare(sql).all(...params);
  res.json(movimientos);
});

// -------------------------------------------------------------
// 5. GESTIÓN DE USUARIOS (CU02, CU03, CU04, CU05)
// -------------------------------------------------------------

// CU03: Consultar usuarios (Gerente)
app.get('/api/usuarios', (req, res) => {
  const { rol, estado, q } = req.query;
  let sql = 'SELECT id, nombre, nombreUsuario, rol, estado, creadoEn FROM usuarios WHERE 1=1';
  const params = [];

  if (rol && rol !== 'Todos') {
    sql += ' AND rol = ?';
    params.push(rol);
  }
  if (estado && estado !== 'Todos') {
    sql += ' AND estado = ?';
    params.push(estado);
  }
  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    sql += ' AND (nombre LIKE ? OR nombreUsuario LIKE ?)';
    params.push(term, term);
  }

  sql += ' ORDER BY nombre ASC';
  const usuarios = db.prepare(sql).all(...params);
  res.json(usuarios);
});

// CU03: Consultar un usuario por ID (Gerente)
app.get('/api/usuarios/:id', (req, res) => {
  const user = db.prepare('SELECT id, nombre, nombreUsuario, rol, estado, creadoEn FROM usuarios WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }
  res.json(user);
});

// CU02: Registrar usuario (Gerente)
// Cumple RNFS-01 para la contraseña
app.post('/api/usuarios', (req, res) => {
  const { nombre, nombreUsuario, contrasena, rol } = req.body;

  if (!nombre || !nombreUsuario || !contrasena || !rol) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  if (rol !== 'Gerente' && rol !== 'Empleado') {
    return res.status(400).json({ error: 'El rol debe ser "Gerente" o "Empleado".' });
  }

  // Validación de seguridad RNFS-01
  if (!validarContrasenaRNFS01(contrasena)) {
    return res.status(400).json({
      error: 'La contraseña no cumple los requisitos de seguridad RNFS-01: debe tener al menos 12 caracteres, mayúsculas, minúsculas, números y caracteres especiales.'
    });
  }

  const existing = db.prepare('SELECT id FROM usuarios WHERE nombreUsuario = ?').get(nombreUsuario.trim());
  if (existing) {
    return res.status(409).json({ error: 'El nombre de usuario ya está registrado en el sistema.' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO usuarios (nombre, nombreUsuario, contrasena, rol, estado)
      VALUES (?, ?, ?, ?, 'activo')
    `).run(nombre.trim(), nombreUsuario.trim(), contrasena, rol);

    const nuevoUser = db.prepare('SELECT id, nombre, nombreUsuario, rol, estado, creadoEn FROM usuarios WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(nuevoUser);
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    res.status(500).json({ error: 'Error al registrar el usuario.' });
  }
});

// CU04: Modificar usuario (Gerente)
app.put('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, nombreUsuario, contrasena, rol } = req.body;

  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  if (nombreUsuario && nombreUsuario.trim() !== user.nombreUsuario) {
    const existing = db.prepare('SELECT id FROM usuarios WHERE nombreUsuario = ? AND id != ?').get(nombreUsuario.trim(), id);
    if (existing) {
      return res.status(409).json({ error: 'El nombre de usuario ya está en uso por otro usuario.' });
    }
  }

  let passFinal = user.contrasena;
  if (contrasena && contrasena.trim()) {
    if (!validarContrasenaRNFS01(contrasena)) {
      return res.status(400).json({
        error: 'La nueva contraseña no cumple RNFS-01 (mínimo 12 caracteres con mayúsculas, minúsculas, números y símbolos).'
      });
    }
    passFinal = contrasena;
  }

  try {
    db.prepare(`
      UPDATE usuarios
      SET nombre = ?, nombreUsuario = ?, contrasena = ?, rol = ?
      WHERE id = ?
    `).run(
      (nombre || user.nombre).trim(),
      (nombreUsuario || user.nombreUsuario).trim(),
      passFinal,
      rol || user.rol,
      id
    );

    const userAct = db.prepare('SELECT id, nombre, nombreUsuario, rol, estado, creadoEn FROM usuarios WHERE id = ?').get(id);
    res.json({ usuario: userAct, mensaje: 'Usuario actualizado exitosamente.' });
  } catch (err) {
    console.error('Error al modificar usuario:', err);
    res.status(500).json({ error: 'Error al modificar el usuario.' });
  }
});

// CU05: Suspender / Reactivar usuario (baja lógica, Gerente)
app.patch('/api/usuarios/:id/suspender', (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  const nuevoEstado = user.estado === 'activo' ? 'suspendido' : 'activo';
  db.prepare('UPDATE usuarios SET estado = ? WHERE id = ?').run(nuevoEstado, id);

  res.json({
    id: user.id,
    nombreUsuario: user.nombreUsuario,
    estado: nuevoEstado,
    mensaje: `El usuario fue ${nuevoEstado === 'suspendido' ? 'suspendido (baja lógica)' : 'reactivado'}.`
  });
});

// -------------------------------------------------------------
// 6. REPORTES E INFORMES DEL NEGOCIO (Gerente)
// -------------------------------------------------------------
app.get('/api/reportes/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  // Ventas de hoy (registradas no anuladas)
  const ventasHoy = db.prepare(`
    SELECT COUNT(*) as cantidad, COALESCE(SUM(total), 0) as totalRecaudado
    FROM ventas
    WHERE fecha = ? AND estado = 'registrada'
  `).get(today);

  // Total acumulado histórico no anulado
  const totalHistorico = db.prepare(`
    SELECT COUNT(*) as cantidad, COALESCE(SUM(total), 0) as total
    FROM ventas
    WHERE estado = 'registrada'
  `).get();

  // Cantidad de ventas anuladas históricas
  const ventasAnuladas = db.prepare(`
    SELECT COUNT(*) as cantidad
    FROM ventas
    WHERE estado = 'anulada'
  `).get();

  // Alertas de stock crítico (< 5 unidades) o agotado (0)
  const stockCritico = db.prepare(`
    SELECT id, codigo, nombre, categoria, stock, estado
    FROM productos
    WHERE stock <= 5
    ORDER BY stock ASC
  `).all();

  // Productos más vendidos
  const masVendidos = db.prepare(`
    SELECT p.nombre, p.categoria, SUM(d.cantidad) as totalUnidades, SUM(d.subtotal) as totalDinero
    FROM detalles_venta d
    JOIN productos p ON d.productoId = p.id
    JOIN ventas v ON d.ventaId = v.id
    WHERE v.estado = 'registrada'
    GROUP BY p.id
    ORDER BY totalUnidades DESC
    LIMIT 6
  `).all();

  res.json({
    ventasHoy,
    totalHistorico,
    ventasAnuladas: ventasAnuladas.cantidad,
    stockCritico,
    masVendidos
  });
});

// Manejador SPA: enviar index.html si no coincide con API
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor local
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  SISTEMA DE GESTIÓN DE STOCK Y VENTAS - DRUGSTORE X`);
  console.log(`  Servidor activo en: http://localhost:${PORT}`);
  console.log(`  Persistencia: SQLite Local Embebida (drugstore.db)`);
  console.log(`=======================================================`);
});
