# Sistema de Gestión de Stock y Ventas — Drugstore "X"

**Asignatura:** Ingeniería de Software II  
**Metodología:** Rational Unified Process (RUP)  
**Norma de Requerimientos:** IEEE-STD 830  
**Ubicación del Negocio:** Concordia, Entre Ríos, Argentina  
**Equipo de Desarrollo:** Grupo 6 (Licenciatura en Sistemas — UNER FCAD)  

---

## 1. Descripción del Sistema

El **Sistema de Gestión de Stock y Ventas para Drugstore "X"** es una aplicación de escritorio moderna, intuitiva y robusta diseñada para resolver las limitaciones de los registros manuales en comercios de formato drugstore (almacén, bebidas, snacks y golosinas).

Cumple estrictamente con los requerimientos de la cátedra de Ingeniería de Software II:
- **RNFT-01 / RNFD-01:** Opera de forma local como aplicación de escritorio, 100% disponible **sin conexión a internet**.
- **RNFR-01 / RNFR-02 / RNFR-03:** Respuestas ultrarrápidas (< 2s en consulta de precios con lector de código de barras o teclado; transacciones < 3s; soporte de hasta 500 ítems por ticket sin degradación).
- **RNFS-01:** Seguridad en el acceso con contraseñas de al menos 12 caracteres (mayúsculas, minúsculas, números y símbolos).

---

## 2. Trazabilidad con Casos de Uso (RUP) y Requerimientos (IEEE-STD 830)

| ID CU | Caso de Uso | Actor Principal | Requerimiento ERS | Implementación en el Sistema |
|---|---|---|---|---|
| **CU01** | Iniciar sesión | Empleado / Gerente | RF-09, RNFS-01 | Login con autenticación segura y filtrado por estado activo/suspendido. |
| **CU02** | Registrar usuario | Gerente | RF-10, RNFS-01 | Alta de usuarios con checklist interactivo de seguridad de contraseña. |
| **CU03** | Consultar usuario | Gerente | RF-11 | Grilla de usuarios con roles, estados y filtros de búsqueda. |
| **CU04** | Modificar usuario | Gerente | RF-12 | Edición de credenciales, nombres y roles asignados. |
| **CU05** | Suspender usuario | Gerente | RF-13 | Baja lógica de usuarios conservando integridad referencial histórica. |
| **CU06** | Registrar venta | Empleado / Gerente | RF-05, R-01 | Punto de Venta (POS) con lector de código de barras, cálculo de vuelto y emisión de comprobante térmico o factura B. |
| **CU07** | Modificar venta | Gerente | RF-06, R-01 | Modificación de ítems y cantidades con ajuste y calibración automática de stock. |
| **CU08** | Anular venta | Gerente | RF-07, R-02 | Anulación autorizada dentro de las 24 horas; reintegra el stock e inserta movimiento de auditoría. |
| **CU09** | Consultar venta | Gerente | RF-08 | Filtro por rango de fechas (Desde/Hasta) y cálculo de total acumulado de ventas no anuladas. |
| **CU10** | Registrar producto | Gerente | RF-01 | Alta de productos con código, categoría, precio y stock inicial. |
| **CU11** | Consultar producto | Empleado / Gerente | RF-02, RNFR-01 | Búsqueda instantánea en catálogo por nombre o código de barras. |
| **CU12** | Modificar producto | Gerente | RF-03, R-03 | Modificación de datos, ajustes de stock y registro de devoluciones. |
| **CU13** | Suspender producto | Gerente | RF-04 | Baja lógica de artículos (inhabilitados para venta pero preservando historial). |

---

## 3. Cumplimiento de Reglas del Negocio

- **Regla R-01 (Venta con stock):** El sistema impide agregar o vender productos si el stock disponible es insuficiente o si el producto se encuentra suspendido.
- **Regla R-02 (Anulación de venta dentro de 24 horas):** La anulación de una venta solo puede realizarse dentro de las 24 horas posteriores a su registro. El sistema calcula el tiempo exacto transcurrido, bloqueando ventas vencidas e informando las horas y minutos restantes. Al anular, se restituye el stock y se audita en `MovimientoStock`.
- **Regla R-03 (Stock distinto de cero):** No es posible dejar el stock en 0 sin que el producto pase automáticamente al estado **suspendido** (baja lógica). Al reactivar stock, el producto vuelve a estar activo.

---

## 4. Modelo de Análisis y Clases (Tarjetas CRC)

- **CL-01 USUARIO:** `nombre`, `nombreUsuario`, `contraseña`, `rol` (Gerente/Empleado), `estado` (activo/suspendido).
- **CL-02 PRODUCTO:** `código`, `nombre`, `categoría`, `precioUnitario`, `stock`, `estado`.
- **CL-03 VENTA:** `fecha`, `hora`, `total`, `estado` (registrada/anulada), `usuarioId`.
- **CL-04 DETALLEVENTA:** `cantidad`, `precioUnitario`, `subtotal`. Composición con Venta y asociación con Producto.
- **CL-05 COMPROBANTE:** `número`, `tipo` (comprobante/factura), `fechaEmisión`, `total`, `metodoPago`, `vuelto`. Generación e impresión de ticket 80mm.
- **CL-06 MOVIMIENTOSTOCK:** `fecha`, `cantidad`, `motivo` (`ingreso`, `corrección`, `devolución`, `venta`, `modificación de venta`, `anulación de venta`), `stockResultante`, `usuarioId`.

---

## 5. Cuentas de Acceso y Demostración

El sistema incluye usuarios precargados según la norma **RNFS-01**:

| Rol | Usuario | Contraseña | Permisos |
|---|---|---|---|
| **Gerente** | `gerente` | `Gerente2026!#` | **Acceso Total:** Punto de venta, catálogo, anulación/modificación de ventas, stock, devoluciones, usuarios e informes. |
| **Empleado** | `empleado` | `Empleado2026!#` | **Operativa mostrador:** Registro de ventas (CU06) y consulta de productos/precios (CU11). |
| **Empleado (Cajero 1)** | `cajero1` | `Cajero2026!#` | Operativa de caja. |

> **Nota:** La barra superior cuenta con un botón **"🔄 Probar como Empleado / Gerente"** que permite alternar los roles inmediatamente para evaluar la diferencia de permisos sin necesidad de reescribir contraseñas.

---

## 6. Cómo Ejecutar la Aplicación

### Opción A (Recomendada en Windows - Doble Clic):
Haga doble clic sobre el archivo:
```
iniciar-sistema.bat
```
Este script inicia el servidor local y abre la ventana de escritorio en modo Standalone (usando Microsoft Edge o el navegador predeterminado).

### Opción B (Línea de Comandos):
Dentro de la carpeta del proyecto:
```bash
npm start
```
Luego abra en su navegador:
```
http://localhost:3000
```

---

## 7. Atajos de Teclado del Mostrador
- **`F2`**: Ir al Punto de Venta y enfocar el buscador de productos / lector de código de barras.
- **`F4`**: Abrir ventana de cobro y emisión de ticket cuando hay productos cargados.
- **`Enter` (en buscador)**: Agregar automáticamente el producto escaneado al ticket.
- **`Escape`**: Cerrar cualquier ventana emergente o modal.
