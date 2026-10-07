---
trigger: model_decision
description: 'Aplicar al modificar entidades, consultas, transacciones, índices, migraciones o evidencias de performance.'
---

# Persistencia y performance

Respetar el motor, esquema, política de concurrencia y permisos del proyecto. No asumir que una base disponible autoriza escrituras o cambios de esquema.

- Deshabilitar cambios automáticos de esquema en entornos compartidos. Verificar columnas, nulabilidad, claves e índices antes de proponer migraciones.
- Alinear los mapeos con la base y conservar precisión decimal; validar los campos necesarios sin inventar valores ausentes.
- Usar la misma conexión o sesión transaccional para todas las operaciones de una transacción, incluidos lectores y adaptadores compartidos.
- Elegir aislamiento y bloqueos según las invariantes del flujo. Respetar el protocolo de concurrencia existente y confirmar rechazos cuando sean resultados de negocio persistidos.
- Parametrizar consultas, seleccionar columnas necesarias y obtener datos en lote; evitar consultas por elemento.
- Optimizar sin debilitar la detección de datos inválidos ni la consistencia de las lecturas.
- Entregar cambios de esquema mediante migraciones explícitas, con aplicación y reversión documentadas. Revisar el SQL generado y evitar índices duplicados.
- Preparar seed, resets, datos sintéticos y tests de escritura en una base aislada. No utilizar bases compartidas para fixtures o limpieza automática.
- Ejecutar cambios remotos únicamente cuando la tarea autorice esa acción y su destino; confirmar el alcance antes de una operación destructiva.
- Medir consultas reales con datos representativos y condiciones equivalentes. Informar procedimiento, repeticiones, resultados, costos y límites; distinguir candidatos de mejoras comprobadas.
- Tener presente que herramientas como `EXPLAIN ANALYZE` ejecutan la consulta. Evaluar escrituras y operaciones con efectos secundarios en la base aislada.
- Mantener credenciales, datos sensibles y cadenas de conexión fuera del código de entrega, capturas y logs.
