---
trigger: model_decision
description: 'Aplicar al implementar o revisar endpoints, reglas financieras y límites entre módulos.'
---

# Código de negocio

Antes de modificar un flujo, leer [arquitectura](../../docs/architecture.md), [supuestos funcionales](../../docs/assumptions.md) y el comportamiento de los [elementos compartidos](../../src/shared/README.md).

- Implementar los contratos en su feature, con DTOs HTTP en infraestructura.
- Mantener cálculos de dominio independientes de NestJS y TypeORM.
- Reutilizar dinero, reconstrucción de recursos y lecturas comunes.
- Agregar elementos a `shared` cuando tengan consumidores concretos en distintos módulos.
- Mantener modelos de dominio independientes de los mapeos TypeORM.
- Usar clases abstractas o tokens explícitos para inyectar puertos; los tipos de TypeScript se eliminan en runtime.
- Preservar precisión y validar los límites de entrada antes de persistir.
- Cubrir en las pruebas el resultado financiero y el registro persistido.
- Al modificar una política, actualizar su guía y los casos afectados. Registrar los pendientes en [context.md](../context.md).
