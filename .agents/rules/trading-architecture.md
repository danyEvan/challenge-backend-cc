---
trigger: model_decision
description: 'Aplicar al implementar o revisar endpoints, reglas financieras y límites entre módulos.'
---

# Código de negocio

Antes de modificar un flujo, leer [arquitectura](../../docs/architecture.md), [supuestos funcionales](../../docs/assumptions.md) y el comportamiento de los [elementos compartidos](../../src/shared/README.md).

- Implementar los contratos en su feature, con DTOs HTTP en infraestructura.
- Seguir la [estructura de cada feature](../../docs/architecture.md#estructura-de-cada-feature): entradas, resultados y proyecciones de casos de uso en `application/interfaces/`; puertos en `application/ports/`; casos de uso en `application/usecases/`; controllers en `infrastructure/http/controllers/`; DTOs en `infrastructure/http/dto/`; y adaptadores de base en `infrastructure/persistence/`. Ubicar transformaciones HTTP reutilizables en `infrastructure/http/transforms/` cuando existan. Dar a cada contrato o clase con responsabilidad propia su archivo.
- Crear elementos en `domain/` únicamente cuando representen reglas, entidades o valores reales del negocio. No inventar clases de dominio para proyecciones de lectura sin comportamiento.
- Mantener cálculos de dominio independientes de NestJS y TypeORM.
- Reutilizar dinero, reconstrucción de recursos y lecturas comunes.
- Agregar elementos a `shared` cuando tengan consumidores concretos en distintos módulos.
- Mantener modelos de dominio independientes de los mapeos TypeORM.
- Ubicar excepciones de negocio concretas en `domain/errors/` de su feature (o del dominio compartido cuando corresponda), independientes de NestJS y HTTP. Definirlas junto al flujo que las produce y su traducción HTTP; distinguirlas de entradas HTTP inválidas y de resultados financieros `REJECTED` persistidos. No agregar excepciones para una búsqueda sin coincidencias.
- Usar clases abstractas o tokens explícitos para inyectar puertos; los tipos de TypeScript se eliminan en runtime.
- Para persistencia, usar contratos abstractos `<Nombre>Repository` en `application/ports/<nombre>.repository.ts` e implementaciones `<Nombre>TypeOrmRepository` en `infrastructure/persistence/<nombre>-typeorm.repository.ts`. La clase abstracta es el token de inyección; conectar ambos en el módulo Nest. Declarar solo operaciones requeridas por los consumidores, sin crear repositorios genéricos ni CRUD sin uso.
- Preservar precisión y validar los límites de entrada antes de persistir.
- Cubrir en las pruebas el resultado financiero y el registro persistido.
- Al modificar una política, actualizar su guía y los casos afectados. Registrar los pendientes en `.agents/context.md` local, si existe.
