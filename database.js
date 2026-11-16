const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, 'drugstore.db');
const db = new DatabaseSync(DB_PATH);

// Habilitar claves foráneas
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Inicializa la base de datos creando las tablas si no existen
 * y cargando datos iniciales representativos del Drugstore X (Concordia, Entre Ríos)
 */
function initDatabase() {
  db.exec(`
    -- 1. Tabla de Usuarios (CL-01 USUARIO)
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      nombreUsuario TEXT UNIQUE NOT NULL,
      contrasena TEXT NOT NULL,
      rol TEXT CHECK(rol IN ('Gerente', 'Empleado')) NOT NULL,
      estado TEXT CHECK(estado IN ('activo', 'suspendido')) NOT NULL DEFAULT 'activo',
      creadoEn TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 2. Tabla de Productos (CL-02 PRODUCTO)
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      categoria TEXT NOT NULL,
      precioUnitario REAL NOT NULL CHECK(precioUnitario >= 0),
      stock INTEGER NOT NULL CHECK(stock >= 0),
      estado TEXT CHECK(estado IN ('activo', 'suspendido')) NOT NULL DEFAULT 'activo',
      creadoEn TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 3. Tabla de Ventas (CL-03 VENTA)
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      hora TEXT NOT NULL,
      total REAL NOT NULL,
      estado TEXT CHECK(estado IN ('registrada', 'anulada')) NOT NULL DEFAULT 'registrada',
      usuarioId INTEGER NOT NULL REFERENCES usuarios(id),
      creadoEn TEXT DEFAULT (datetime('now', 'localtime')),
      anuladaEn TEXT,
      motivoAnulacion TEXT
    );

    -- 4. Tabla DetalleVenta (CL-04 DETALLEVENTA)
    CREATE TABLE IF NOT EXISTS detalles_venta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ventaId INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
      productoId INTEGER NOT NULL REFERENCES productos(id),
      cantidad INTEGER NOT NULL CHECK(cantidad > 0),
      precioUnitario REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    -- 5. Tabla Comprobante (CL-05 COMPROBANTE)
    CREATE TABLE IF NOT EXISTS comprobantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ventaId INTEGER UNIQUE NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
      numero TEXT UNIQUE NOT NULL,
      tipo TEXT CHECK(tipo IN ('comprobante', 'factura')) NOT NULL DEFAULT 'comprobante',
      fechaEmision TEXT NOT NULL,
      total REAL NOT NULL,
      clienteNombre TEXT DEFAULT 'Consumidor Final',
      clienteDni TEXT DEFAULT '',
      metodoPago TEXT DEFAULT 'Efectivo',
      montoAbonado REAL DEFAULT 0,
      vuelto REAL DEFAULT 0
    );

    -- 6. Tabla MovimientoStock (CL-06 MOVIMIENTOSTOCK)
    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productoId INTEGER NOT NULL REFERENCES productos(id),
      usuarioId INTEGER NOT NULL REFERENCES usuarios(id),
      fecha TEXT DEFAULT (datetime('now', 'localtime')),
      cantidad INTEGER NOT NULL,
      motivo TEXT NOT NULL CHECK(motivo IN ('ingreso', 'corrección', 'devolución', 'modificación de venta', 'anulación de venta', 'venta')),
      stockResultante INTEGER NOT NULL,
      detalle TEXT
    );
  `);

  seedInitialData();
}

/**
 * Carga datos iniciales respetando las reglas de negocio y RNFS-01:
 * Contraseñas de >= 12 caracteres, mayúsculas, minúsculas, números y símbolos.
 */
function seedInitialData() {
  const countUsers = db.prepare('SELECT COUNT(*) as count FROM usuarios').get().count;
  if (countUsers === 0) {
    const insertUser = db.prepare(`
      INSERT INTO usuarios (nombre, nombreUsuario, contrasena, rol, estado)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Contraseñas válidas según RNFS-01 (12+ caracteres, mayúsculas, minúsculas, números y símbolos)
    insertUser.run('Gerente General', 'gerente', 'Gerente2026!#', 'Gerente', 'activo');
    insertUser.run('Dante Lagana (Mostrador)', 'empleado', 'Empleado2026!#', 'Empleado', 'activo');
    insertUser.run('Alejo Gallo (Cajero)', 'cajero1', 'Cajero2026!#', 'Empleado', 'activo');
    insertUser.run('Usuario Prueba Suspendido', 'suspendido', 'Inactivo2026!#', 'Empleado', 'suspendido');
    console.log('[DB] Usuarios iniciales sembrados con éxito.');
  }

  const countProducts = db.prepare('SELECT COUNT(*) as count FROM productos').get().count;
  if (countProducts === 0) {
    const insertProd = db.prepare(`
      INSERT INTO productos (codigo, nombre, categoria, precioUnitario, stock, estado)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Catálogo representativo de "Drugstore X" (Concordia, Entre Ríos):
    // Bebidas, Snacks y Golosinas, Almacén, Kiosco
    const productosSeed = [
      ['7790895000997', 'Coca Cola 500ml', 'Bebidas', 1800.00, 35, 'activo'],
      ['7790895000980', 'Coca Cola Zero 500ml', 'Bebidas', 1800.00, 24, 'activo'],
      ['7791813421111', 'Agua Mineral Villavicencio 500ml', 'Bebidas', 1100.00, 40, 'activo'],
      ['7790895064128', 'Monster Energy Drink 473ml', 'Bebidas', 2600.00, 18, 'activo'],
      ['7792798000014', 'Cerveza Quilmes Clásica 473ml Lata', 'Bebidas', 1900.00, 28, 'activo'],
      ['7790895007019', 'Sprite Lima Limón 500ml', 'Bebidas', 1700.00, 20, 'activo'],
      ['7790580123456', 'Alfajor Havanna Chocolate 70% Cacao', 'Golosinas', 2200.00, 30, 'activo'],
      ['7790580654321', 'Alfajor Guaymallén Triple Chocolate', 'Golosinas', 650.00, 60, 'activo'],
      ['7790580111222', 'Chocolate Milka Oreo 100g', 'Golosinas', 3200.00, 15, 'activo'],
      ['7790040112233', 'Gomitas Mogul Ositos 50g', 'Golosinas', 800.00, 45, 'activo'],
      ['7790040998877', 'Caramelos Halls Extra Strong Menta', 'Golosinas', 600.00, 50, 'activo'],
      ['7791234567890', 'Papas Fritas Lays Clásicas 85g', 'Snacks', 2400.00, 22, 'activo'],
      ['7791234567891', 'Doritos Queso Nacho 90g', 'Snacks', 2700.00, 16, 'activo'],
      ['7791234567892', 'Mani Salado Pehuamar 120g', 'Snacks', 1400.00, 25, 'activo'],
      ['7791234567893', 'Chizitos Krachitos 80g', 'Snacks', 1300.00, 19, 'activo'],
      ['7790742112233', 'Galletitas Chocolinas 250g', 'Almacén', 1950.00, 30, 'activo'],
      ['7790742445566', 'Galletitas Oreo 118g', 'Almacén', 1600.00, 26, 'activo'],
      ['7790070112244', 'Yerba Mate Playadito 500g', 'Almacén', 2800.00, 14, 'activo'],
      ['7790070554433', 'Café La Virginia Torrado 250g', 'Almacén', 3900.00, 10, 'activo'],
      ['7790070887766', 'Azúcar Ledesma 1kg', 'Almacén', 1250.00, 18, 'activo'],
      ['7790111223344', 'Cigarrillos Marlboro Box 20', 'Kiosco', 3800.00, 40, 'activo'],
      ['7790111556677', 'Encendedor BIC Grande', 'Kiosco', 1500.00, 35, 'activo'],
      ['7790111889900', 'Pilas Duracell AA Pack x2', 'Kiosco', 3400.00, 12, 'activo'],
      ['7790111332211', 'Pañuelos Descartables Elite', 'Kiosco', 700.00, 30, 'activo'],
      // Producto con stock crítico para pruebas de alerta (< 5 unidades)
      ['7790099887766', 'Energizante Red Bull 250ml', 'Bebidas', 2900.00, 3, 'activo'],
      // Producto suspendido inicialmente para pruebas de baja lógica
      ['7790000000011', 'Gaseosa Pomelo 500ml (Descontinuado)', 'Bebidas', 1100.00, 0, 'suspendido']
    ];

    for (const p of productosSeed) {
      insertProd.run(...p);
    }
    console.log('[DB] Catálogo de productos sembrado con éxito.');

    // Registrar movimientos iniciales de stock para los productos
    const gerenteId = 1;
    const prods = db.prepare('SELECT id, stock FROM productos WHERE stock > 0').all();
    const insertMov = db.prepare(`
      INSERT INTO movimientos_stock (productoId, usuarioId, cantidad, motivo, stockResultante, detalle)
      VALUES (?, ?, ?, 'ingreso', ?, 'Carga de inventario inicial del Drugstore')
    `);
    for (const pr of prods) {
      insertMov.run(pr.id, gerenteId, pr.stock, pr.stock);
    }
  }

  // Si no hay ventas, sembramos una o dos ventas de prueba recientes
  const countVentas = db.prepare('SELECT COUNT(*) as count FROM ventas').get().count;
  if (countVentas === 0) {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().split(' ')[0];

    // Venta de prueba 1
    const resVenta1 = db.prepare(`
      INSERT INTO ventas (fecha, hora, total, estado, usuarioId)
      VALUES (?, ?, ?, 'registrada', 2)
    `).run(today, nowTime, 3600.00);

    const vId1 = resVenta1.lastInsertRowid;

    // Detalle: 2 Coca Cola 500ml ($1800 c/u)
    db.prepare(`
      INSERT INTO detalles_venta (ventaId, productoId, cantidad, precioUnitario, subtotal)
      VALUES (?, 1, 2, 1800.00, 3600.00)
    `).run(vId1);

    // Comprobante
    db.prepare(`
      INSERT INTO comprobantes (ventaId, numero, tipo, fechaEmision, total, clienteNombre, clienteDni, metodoPago, montoAbonado, vuelto)
      VALUES (?, 'TIK-0001-00000001', 'comprobante', ?, 3600.00, 'Consumidor Final', '', 'Efectivo', 4000.00, 400.00)
    `).run(vId1, `${today} ${nowTime}`);

    console.log('[DB] Ventas iniciales de prueba registradas.');
  }
}

module.exports = {
  db,
  initDatabase
};
