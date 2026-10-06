---
trigger: model_decision
description: 'Aplicar al modificar entidades, consultas, transacciones, índices, migraciones o evidencias de performance.'
---

# Persistencia y performance

Consultar la [guía de PostgreSQL](../../database/README.md), la estrategia de [consistencia](../../docs/architecture.md) y el procedimiento de [medición](../../docs/evidence/README.md).

- Conservar `synchronize: false`; verificar esquema e índices existentes antes de preparar cambios.
- Alinear tipos y nulabilidad con la base. Mantener precisión decimal en los mapeos.
- Ejecutar todas las operaciones de una transacción con su mismo `EntityManager`, incluido el lector compartido.
- Respetar el protocolo de bloqueo por usuario y confirmar los rechazos financieros.
- Seleccionar columnas necesarias, obtener datos en lote y evitar consultas por posición.
- Evaluar mejoras preservando la detección de datos inválidos y la consistencia financiera.
- Entregar cambios de esquema mediante migraciones explícitas, con aplicación y reversión documentadas.
- Revisar SQL generado y evitar índices duplicados o cambios accidentales de esquema.
- Preparar seed, resets, datos sintéticos y tests de escritura en una base local aislada.
- Ejecutar cambios remotos cuando la tarea incluya esa ejecución y su destino.
- Medir condiciones equivalentes y registrar beneficios, costos y límites. Identificar candidatos pendientes.
- Tener presente que `EXPLAIN ANALYZE` ejecuta la consulta; medir escrituras en la base aislada.
- Mantener credenciales fuera de archivos de entrega, capturas y logs.
