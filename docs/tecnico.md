# Documentación técnica — reunión 13 de octubre de 2026

## Alcance aplicado

Se unificó el alta de producto, se revirtió la hora solo en cabecera (reunión 5 de octubre) y se alineó el código de catálogo con multitecnología.

## Frontend (`CostoV22`)

- Menú: `navigation.ts`. Grupo **Productos y servicios** (Catálogo, Productos `?ambito=producto`, Servicios `?ambito=servicio`). Costos pasa a **Estructura de costos**.
- Reglas de familia y tasas: `src/app/core/utils/family-rules.ts`.
- Código: `src/app/core/utils/catalog-sku.ts`. Proyecto usa `P`. Varias tecnologías: `CAT-M-TEC1/TEC2-MAT1/MAT2-FAM-CORR`.
- Producto: un solo formulario, fabricación primero, sin pestaña de costos variables ni margen. Horas por pieza. Nombre automático. Familias filtradas por tipo.
- Presupuesto: cliente → fecha → orden opcional → descripción. Varios ítems (`budget-items.ts`). Sin casilla de multitecnología. Cada ítem tiene preparación, post, tasa y margen.
- Cliente: etiqueta **Tipo de documento**.
- Calculadora: `budget-calculator.ts` aplica merma por pieza/tecnología y tarifa de máquina de cada pieza. La cabecera solo se usa si las piezas no tienen tiempo.

## Backend (`backost`)

- `SkuProductoService` replica las mismas reglas de código.
- Migración `Version20261015150000`: familia `SF`, columnas `multitecnologia` y `tasas_fallo` en producto y presupuesto, `tecnologia` en piezas, y se alargan `sku`, `tecnologia` y `material` del producto.
- `ProductoRepository` y `PresupuestoRepository` vuelven a persistir horas y minutos de cada pieza (ya no las fuerzan a cero).

## Pruebas

- `catalog-sku.spec.ts`
- `family-rules.spec.ts`
- `budget-calculator.spec.ts`
- Ajustes en `add-product.component.spec.ts` y `add-budget.component.spec.ts`

## Reunión 20 de octubre de 2026

- Columna `presupuesto.lineas` (migración `Version20261023120000`) guarda los ítems. Las piezas siguen en `piezas` con el producto de cada una.
- Listado: estados enviado, aprobado y pagado además de borrador, vendido y anulado.
- Pruebas: `budget-items.spec.ts`.

## Campos nuevos de piezas

- Reglas: `src/app/core/utils/piece-tech-rules.ts`.
- Formulario dinámico en `add-product` y `add-budget`. Piezas agrupadas por tecnología y equipo; horas al pie de cada bloque.
- Calculadora: descartables de resina sobre gramos; control numérico y láser por área (y caras en placa); chocolate suma limpieza y empaque; alimentos usa costo estimado sin descontar inventario.
- Cliente: `sectores` (selección múltiple). Catálogo inicial en `client-sectors.ts`.
- JSON de presupuesto: `maquinaNombre` / `MaquinaNombre` y `materialNombre` / `MaterialNombre`.
- Migración `Version20261117120000`: columnas de detalle en `piezas` y `piezas_producto`, `cliente.sectores`, `venta.estado`, y siembra de tecnologías CNC, LSR, CHO, ALM.
- Pruebas: `piece-tech-rules.spec.ts` y casos nuevos en `budget-calculator.spec.ts` / `add-product.component.spec.ts`.

## Fuera de esta entrega

Bandeja de aprobación por correo, recálculo de cotizaciones viejas, diccionario de impresoras, alta de familia por rol, matriz de roles operativos, integración con WhatsApp y el cruce con Odoo (pruebas de Juan Carlos, cadena de valor y Carmen Elena). Familias de servicio pendientes de Irene y Luis.
