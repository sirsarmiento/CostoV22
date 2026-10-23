# Documentación de negocio — COST

## Qué cambió con la reunión del 13 de octubre de 2026

El sistema deja de tratar el producto como tres pestañas sueltas (datos, costos variables y fabricación). Ahora el alta de un producto, un servicio o un proyecto es **un solo formulario**. Primero se arman las piezas y las horas de fabricación; al final van el nombre, la familia y la descripción. **No se guarda incompleto**.

El margen de ganancia **ya no se pide en el producto**. El margen vive en el presupuesto, que es donde se cotiza al cliente.

## Menú

- **Productos y servicios**
  - **Catálogo**: listado de todo lo ya creado.
  - **Productos**: alta de producto o proyecto.
  - **Servicios**: alta de servicio.
- **Estructura de costos**: el módulo que antes se llamaba Costos. Ahí siguen los costos fijos e indirectos de la empresa.

## Fabricación y tecnologías

Se puede marcar **Multitecnología** cuando un trabajo usa filamento y resina (u otra combinación). Cada pieza fabricada lleva su tecnología, su máquina, sus gramos y **sus horas y minutos**. El sistema suma esas horas por tecnología.

Las tasas de fallo quedan en **5 %, 11 % y 18 %**, y se eligen por tecnología. Ya no se usan 12 % ni 25 %.

Si no escriben el nombre de la pieza, el sistema la nombra solo: Pieza 1, Pieza 2, y así.

## Familias

- **Producto**: todas las familias menos Molde (MLD).
- **Servicio**: Molde, Médico, Odontológico, Automotriz e Industrial.
- **Proyecto**: Sin familia (SF) o Molde (MLD). El código del proyecto usa la letra **P**, no PR.

## Código del catálogo

- Un producto de una sola tecnología sigue el patrón de siempre: categoría, tecnología, material, familia y correlativo.
- Si hay varias tecnologías, el código lleva una **M** y las tecnologías y materiales van separados por barras. Ejemplo: `PF-M-FDM/SLA-PLA/RES-POP-001`.
- La tecnología y el material del código **salen de las piezas**, no de un campo suelto en la cabecera.

## Presupuesto

El orden de captura es: **cliente → fecha → número de orden (opcional) → descripción**. El cliente es obligatorio. Se busca por nombre o por cédula.

Un mismo presupuesto puede llevar **varios productos o servicios** (por ejemplo un busto y un modelado). Los que ya se agregaron no vuelven a salir en el selector. Cada ítem tiene su cantidad, preparación, postprocesado, tasa de fallo y margen. La casilla de multitecnología **no va en el presupuesto**: eso se define en el producto.

Estados comerciales: **borrador → enviado → aprobado → pagado**. La venta de inventario se puede hacer desde borrador o desde aprobado. La facturación en Odoo queda para después.

## Qué cambió con la reunión del 20 de octubre de 2026

- Varios ítems en un presupuesto, al estilo de agregar tecnologías: se bloquea lo ya elegido.
- Se quitó la multitecnología del formulario de presupuesto.
- Estados enviado, aprobado y pagado para el camino comercial.
- No se tocó WhatsApp, ni las pruebas de Odoo, ni las familias de servicio (Jaime lo conversa con Irene y Luis).

El presupuesto sí mantiene margen. Las horas se toman de cada pieza y la merma se aplica según la tecnología de esa pieza.

## Cliente

El campo que decía Nacionalidad ahora se llama **Tipo de documento** (V, E, J, G, P).

## Lo que no entra en esta entrega

Bandeja de aprobación, correo de envío, actualización automática de precios de cotizaciones viejas, diccionario de impresoras como dato maestro y el alta de familia según el rol de la persona. Eso queda para otra ronda.
