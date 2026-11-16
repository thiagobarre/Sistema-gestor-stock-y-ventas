const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'drugstore.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

function seedHardcodedData() {
  console.log('[SEED] Limpiando y repoblando base de datos con datos completos...');

  // Desactivar temporalmente FKs para limpieza limpia
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec(`
    DELETE FROM movimientos_stock;
    DELETE FROM comprobantes;
    DELETE FROM detalles_venta;
    DELETE FROM ventas;
    DELETE FROM productos;
    DELETE FROM usuarios;
  `);
  db.exec('PRAGMA foreign_keys = ON;');

  // 1. USUARIOS (CL-01 USUARIO) - Cumplen norma RNFS-01 (12+ caracteres, mayúsculas, minúsculas, números y símbolos)
  const insertUser = db.prepare(`
    INSERT INTO usuarios (id, nombre, nombreUsuario, contrasena, rol, estado, creadoEn)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const usuarios = [
    [1, 'Sonia Santana (Gerente General)', 'gerente', 'Gerente2026!#', 'Gerente', 'activo', '2026-10-01 08:00:00'],
    [2, 'Thiago Barreto (Jefe de Proyecto)', 'tbarreto', 'ThiagoBarreto2026!#', 'Gerente', 'activo', '2026-10-01 08:30:00'],
    [3, 'Dante Lagana (Mostrador / Caja)', 'empleado', 'Empleado2026!#', 'Empleado', 'activo', '2026-10-02 09:00:00'],
    [4, 'Joaquín Britos (Turno Mañana)', 'jbritos', 'Joaquin2026!#', 'Empleado', 'activo', '2026-10-02 09:15:00'],
    [5, 'Emiliano Barrios (Turno Tarde)', 'ebarrios', 'Emiliano2026!#', 'Empleado', 'activo', '2026-10-02 09:30:00'],
    [6, 'Alejo Gallo (Turno Noche)', 'agallo', 'AlejoGallo2026!#', 'Empleado', 'activo', '2026-10-02 10:00:00'],
    [7, 'Ex-Empleado Inactivo', 'suspendido', 'Inactivo2026!#', 'Empleado', 'suspendido', '2026-10-05 11:00:00']
  ];

  for (const u of usuarios) {
    insertUser.run(...u);
  }
  console.log(`[SEED] ${usuarios.length} usuarios registrados (RNFS-01 cumplida).`);

  // 2. PRODUCTOS (CL-02 PRODUCTO) - Catálogo representativo de "Drugstore X" (Concordia, Entre Ríos)
  const insertProd = db.prepare(`
    INSERT INTO productos (id, codigo, nombre, categoria, precioUnitario, stock, estado, creadoEn)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const productos = [
    // --- Bebidas ---
    [1, '7790895000997', 'Coca Cola 500ml', 'Bebidas', 1800.00, 32, 'activo', '2026-10-10 10:00:00'],
    [2, '7790895000980', 'Coca Cola Zero 500ml', 'Bebidas', 1800.00, 24, 'activo', '2026-10-10 10:05:00'],
    [3, '7790895000123', 'Coca Cola 1.5L', 'Bebidas', 2900.00, 18, 'activo', '2026-10-10 10:10:00'],
    [4, '7790895007019', 'Sprite Lima Limón 500ml', 'Bebidas', 1700.00, 20, 'activo', '2026-10-10 10:15:00'],
    [5, '7790895007020', 'Fanta Naranja 500ml', 'Bebidas', 1700.00, 15, 'activo', '2026-10-10 10:20:00'],
    [6, '7791813421111', 'Agua Mineral Villavicencio sin Gas 500ml', 'Bebidas', 1100.00, 42, 'activo', '2026-10-10 10:25:00'],
    [7, '7791813421122', 'Agua Mineral Villavicencio con Gas 500ml', 'Bebidas', 1100.00, 35, 'activo', '2026-10-10 10:30:00'],
    [8, '7790895064128', 'Monster Energy Drink 473ml', 'Bebidas', 2600.00, 16, 'activo', '2026-10-10 10:35:00'],
    [9, '7790895064155', 'Speed Unlimited 250ml', 'Bebidas', 1500.00, 22, 'activo', '2026-10-10 10:40:00'],
    [10, '7792798000014', 'Cerveza Quilmes Clásica 473ml Lata', 'Bebidas', 1900.00, 28, 'activo', '2026-10-10 10:45:00'],
    [11, '7792798000021', 'Cerveza Stella Artois 473ml Lata', 'Bebidas', 2500.00, 18, 'activo', '2026-10-10 10:50:00'],
    [12, '7792798000038', 'Cerveza Corona 330ml Porrón', 'Bebidas', 2800.00, 14, 'activo', '2026-10-10 10:55:00'],
    [13, '7790099887766', 'Energizante Red Bull 250ml (Stock Crítico)', 'Bebidas', 2900.00, 3, 'activo', '2026-10-10 11:00:00'],
    [14, '7790000000011', 'Gaseosa Pomelo 500ml (Descontinuado)', 'Bebidas', 1100.00, 0, 'suspendido', '2026-10-10 11:05:00'],

    // --- Golosinas ---
    [15, '7790580123456', 'Alfajor Havanna Chocolate 70% Cacao', 'Golosinas', 2200.00, 28, 'activo', '2026-10-10 11:10:00'],
    [16, '7790580123789', 'Alfajor Havanna Mar del Plata con Sal Marina', 'Golosinas', 2500.00, 20, 'activo', '2026-10-10 11:15:00'],
    [17, '7790580654321', 'Alfajor Guaymallén Triple Chocolate', 'Golosinas', 650.00, 65, 'activo', '2026-10-10 11:20:00'],
    [18, '7790580998811', 'Alfajor Capitán del Espacio Triple (Crítico)', 'Golosinas', 1400.00, 4, 'activo', '2026-10-10 11:25:00'],
    [19, '7790580111222', 'Chocolate Milka Oreo 100g', 'Golosinas', 3200.00, 15, 'activo', '2026-10-10 11:30:00'],
    [20, '7790580333444', 'Chocolate Cofler Block 110g', 'Golosinas', 2800.00, 18, 'activo', '2026-10-10 11:35:00'],
    [21, '7790040112233', 'Gomitas Mogul Ositos 50g', 'Golosinas', 800.00, 45, 'activo', '2026-10-10 11:40:00'],
    [22, '7790040998877', 'Caramelos Halls Menta Extra Strong', 'Golosinas', 600.00, 50, 'activo', '2026-10-10 11:45:00'],
    [23, '7790040556677', 'Chicles Beldent Menta Polar', 'Golosinas', 700.00, 40, 'activo', '2026-10-10 11:50:00'],
    [24, '7790040778899', 'Bombón Bon o Bon Leche Unidad', 'Golosinas', 500.00, 80, 'activo', '2026-10-10 11:55:00'],
    [25, '7790040114455', 'Turrón Arcor de Maní 25g', 'Golosinas', 400.00, 60, 'activo', '2026-10-10 12:00:00'],

    // --- Snacks ---
    [26, '7791234567890', 'Papas Fritas Lays Clásicas 85g', 'Snacks', 2400.00, 22, 'activo', '2026-10-10 12:05:00'],
    [27, '7791234567891', 'Doritos Queso Nacho 90g', 'Snacks', 2700.00, 16, 'activo', '2026-10-10 12:10:00'],
    [28, '7791234567892', 'Maní Salado Pehuamar 120g', 'Snacks', 1400.00, 25, 'activo', '2026-10-10 12:15:00'],
    [29, '7791234567893', 'Chizitos Krachitos 80g', 'Snacks', 1300.00, 19, 'activo', '2026-10-10 12:20:00'],
    [30, '7791234567894', 'Papas Fritas Pringles Original 124g', 'Snacks', 4500.00, 10, 'activo', '2026-10-10 12:25:00'],

    // --- Almacén ---
    [31, '7790742112233', 'Galletitas Chocolinas 250g', 'Almacén', 1950.00, 30, 'activo', '2026-10-10 12:30:00'],
    [32, '7790742445566', 'Galletitas Oreo 118g', 'Almacén', 1600.00, 26, 'activo', '2026-10-10 12:35:00'],
    [33, '7790070112244', 'Yerba Mate Playadito 500g', 'Almacén', 2800.00, 14, 'activo', '2026-10-10 12:40:00'],
    [34, '7790070554433', 'Café La Virginia Torrado 250g', 'Almacén', 3900.00, 10, 'activo', '2026-10-10 12:45:00'],
    [35, '7790070887766', 'Azúcar Ledesma 1kg', 'Almacén', 1250.00, 18, 'activo', '2026-10-10 12:50:00'],
    [36, '7790742889900', 'Galletitas Pepitos 119g', 'Almacén', 1650.00, 18, 'activo', '2026-10-10 12:55:00'],

    // --- Kiosco y Varios ---
    [37, '7790111223344', 'Cigarrillos Marlboro Box 20', 'Kiosco', 3800.00, 40, 'activo', '2026-10-10 13:00:00'],
    [38, '7790111223355', 'Cigarrillos Philip Morris Box 20', 'Kiosco', 3500.00, 35, 'activo', '2026-10-10 13:05:00'],
    [39, '7790111556677', 'Encendedor BIC Grande', 'Kiosco', 1500.00, 35, 'activo', '2026-10-10 13:10:00'],
    [40, '7790111889900', 'Pilas Duracell AA Pack x2', 'Kiosco', 3400.00, 12, 'activo', '2026-10-10 13:15:00'],
    [41, '7790111332211', 'Pañuelos Descartables Elite', 'Kiosco', 700.00, 30, 'activo', '2026-10-10 13:20:00'],
    [42, '7790111445566', 'Preservativos Prime Texturado x3', 'Kiosco', 3200.00, 15, 'activo', '2026-10-10 13:25:00']
  ];

  for (const p of productos) {
    insertProd.run(...p);
  }
  console.log(`[SEED] ${productos.length} productos registrados con precios y categorías de Concordia.`);

  // 3. MOVIMIENTOS INICIALES DE STOCK (CL-06)
  const insertMov = db.prepare(`
    INSERT INTO movimientos_stock (productoId, usuarioId, fecha, cantidad, motivo, stockResultante, detalle)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of productos) {
    if (p[5] > 0) {
      insertMov.run(p[0], 1, p[7], p[5], 'ingreso', p[5], 'Carga de inventario inicial del Drugstore');
    }
  }

  // 4. VENTAS HARDCODEADAS REALISTAS (CL-03, CL-04, CL-05)
  // Generamos un historial de ventas con variedad de fechas, clientes, productos y métodos de pago
  const insertVenta = db.prepare(`
    INSERT INTO ventas (id, fecha, hora, total, estado, usuarioId, creadoEn, anuladaEn, motivoAnulacion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDetalle = db.prepare(`
    INSERT INTO detalles_venta (ventaId, productoId, cantidad, precioUnitario, subtotal)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertComp = db.prepare(`
    INSERT INTO comprobantes (ventaId, numero, tipo, fechaEmision, total, clienteNombre, clienteDni, metodoPago, montoAbonado, vuelto)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const formatYMD = d => d.toISOString().split('T')[0];
  const formatHMS = d => d.toTimeString().split(' ')[0];

  const todayStr = formatYMD(now);
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  const yesterdayStr = formatYMD(yesterday);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
  const threeDaysAgoStr = formatYMD(threeDaysAgo);

  const ventasData = [
    // Venta 1 (Hoy - Hace 2 horas)
    {
      id: 1,
      fecha: todayStr,
      hora: '14:20:00',
      total: 5400.00,
      estado: 'registrada',
      usuarioId: 3, // Dante Lagana
      cliente: 'Consumidor Final',
      dni: '',
      metodo: 'Efectivo',
      abonado: 6000.00,
      vuelto: 600.00,
      tipo: 'comprobante',
      items: [
        { prodId: 1, qty: 2, price: 1800.00, subtotal: 3600.00 }, // 2 Coca Cola 500ml
        { prodId: 26, qty: 1, price: 2400.00, subtotal: 2400.00 } // 1 Papas Lays (ajustado total abajo)
      ]
    },
    // Venta 2 (Hoy - Hace 1 hora)
    {
      id: 2,
      fecha: todayStr,
      hora: '18:10:00',
      total: 4400.00,
      estado: 'registrada',
      usuarioId: 4, // Joaquín Britos
      cliente: 'Mariana Gómez',
      dni: '34567890',
      metodo: 'Transferencia / QR',
      abonado: 4400.00,
      vuelto: 0.00,
      tipo: 'factura',
      items: [
        { prodId: 15, qty: 2, price: 2200.00, subtotal: 4400.00 } // 2 Alfajor Havanna 70%
      ]
    },
    // Venta 3 (Hoy - Hace 30 minutos)
    {
      id: 3,
      fecha: todayStr,
      hora: '19:45:00',
      total: 6200.00,
      estado: 'registrada',
      usuarioId: 3, // Dante Lagana
      cliente: 'Lucas Benítez',
      dni: '38123456',
      metodo: 'Tarjeta de Débito',
      abonado: 6200.00,
      vuelto: 0.00,
      tipo: 'comprobante',
      items: [
        { prodId: 8, qty: 2, price: 2600.00, subtotal: 5200.00 }, // 2 Monster Energy
        { prodId: 24, qty: 2, price: 500.00, subtotal: 1000.00 }   // 2 Bon o Bon
      ]
    },
    // Venta 4 (Hoy - Venta Anulada dentro de las 24hs para demostrar Regla R-02)
    {
      id: 4,
      fecha: todayStr,
      hora: '20:00:00',
      total: 3800.00,
      estado: 'anulada',
      usuarioId: 1, // Gerente
      cliente: 'Consumidor Final',
      dni: '',
      metodo: 'Efectivo',
      abonado: 4000.00,
      vuelto: 200.00,
      tipo: 'comprobante',
      anuladaEn: `${todayStr} 20:30:00`,
      motivoAnulacion: 'Error en digitación de producto solicitada por cliente en mostrador (Regla R-02)',
      items: [
        { prodId: 37, qty: 1, price: 3800.00, subtotal: 3800.00 } // 1 Marlboro Box 20
      ]
    },
    // Venta 5 (Ayer)
    {
      id: 5,
      fecha: yesterdayStr,
      hora: '11:15:00',
      total: 8250.00,
      estado: 'registrada',
      usuarioId: 5, // Emiliano Barrios
      cliente: 'Clara Fochesatto',
      dni: '29876543',
      metodo: 'Tarjeta de Crédito',
      abonado: 8250.00,
      vuelto: 0.00,
      tipo: 'factura',
      items: [
        { prodId: 33, qty: 2, price: 2800.00, subtotal: 5600.00 }, // 2 Yerba Playadito
        { prodId: 35, qty: 1, price: 1250.00, subtotal: 1250.00 }, // 1 Azúcar Ledesma
        { prodId: 22, qty: 2, price: 700.00, subtotal: 1400.00 }   // 2 Chicles Beldent
      ]
    },
    // Venta 6 (Ayer - Noche)
    {
      id: 6,
      fecha: yesterdayStr,
      hora: '22:45:00',
      total: 7600.00,
      estado: 'registrada',
      usuarioId: 6, // Alejo Gallo (Turno Noche)
      cliente: 'Esteban Müller',
      dni: '',
      metodo: 'Efectivo',
      abonado: 10000.00,
      vuelto: 2400.00,
      tipo: 'comprobante',
      items: [
        { prodId: 10, qty: 4, price: 1900.00, subtotal: 7600.00 } // 4 Quilmes Lata
      ]
    },
    // Venta 7 (Hace 3 días)
    {
      id: 7,
      fecha: threeDaysAgoStr,
      hora: '16:30:00',
      total: 4800.00,
      estado: 'registrada',
      usuarioId: 3, // Dante Lagana
      cliente: 'Consumidor Final',
      dni: '',
      metodo: 'Transferencia / QR',
      abonado: 4800.00,
      vuelto: 0.00,
      tipo: 'comprobante',
      items: [
        { prodId: 27, qty: 1, price: 2700.00, subtotal: 2700.00 }, // 1 Doritos
        { prodId: 4, qty: 1, price: 1700.00, subtotal: 1700.00 },  // 1 Sprite
        { prodId: 25, qty: 1, price: 400.00, subtotal: 400.00 }    // 1 Turrón
      ]
    }
  ];

  for (const v of ventasData) {
    const totalCalc = v.items.reduce((s, it) => s + it.subtotal, 0);
    const creadoEn = `${v.fecha} ${v.hora}`;

    insertVenta.run(
      v.id,
      v.fecha,
      v.hora,
      totalCalc,
      v.estado,
      v.usuarioId,
      creadoEn,
      v.anuladaEn || null,
      v.motivoAnulacion || null
    );

    const padId = String(v.id).padStart(8, '0');
    const numComp = v.tipo === 'factura' ? `FAC-B-0001-${padId}` : `TIK-0001-${padId}`;

    insertComp.run(
      v.id,
      numComp,
      v.tipo,
      creadoEn,
      totalCalc,
      v.cliente,
      v.dni,
      v.metodo,
      v.abonado,
      v.vuelto
    );

    for (const it of v.items) {
      insertDetalle.run(v.id, it.prodId, it.qty, it.price, it.subtotal);

      // Registrar movimiento de stock
      const prodObj = db.prepare('SELECT stock FROM productos WHERE id = ?').get(it.prodId);
      insertMov.run(
        it.prodId,
        v.usuarioId,
        creadoEn,
        -it.qty,
        'venta',
        prodObj ? prodObj.stock : 10,
        `Venta N° ${v.id} - ${numComp}`
      );
    }

    // Si fue anulada, simular el movimiento de reintegro (R-02)
    if (v.estado === 'anulada') {
      for (const it of v.items) {
        const prodObj = db.prepare('SELECT stock FROM productos WHERE id = ?').get(it.prodId);
        insertMov.run(
          it.prodId,
          1,
          v.anuladaEn,
          it.qty,
          'anulación de venta',
          prodObj ? prodObj.stock : 10,
          `Reintegro por Anulación de Venta N° ${v.id} (Regla R-02)`
        );
      }
    }
  }

  // 5. REGISTRAR UN PAR DE MOVIMIENTOS EXTRAS (DEVOLUCIÓN Y CORRECCIÓN)
  insertMov.run(15, 1, `${todayStr} 15:30:00`, 2, 'devolución', 30, 'Devolución de cliente por cambio de sabor (CU12)');
  insertMov.run(34, 1, `${yesterdayStr} 10:00:00`, 5, 'ingreso', 10, 'Recepción Factura Distribuidora Concordia N° 4589');

  console.log(`[SEED] ${ventasData.length} ventas hardcodeadas registradas con detalles, comprobantes y movimientos.`);
  console.log('[SEED] ¡Datos hardcodeados cargados con éxito total!');
}

seedHardcodedData();
