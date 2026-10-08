# Guía para agentes

## Inicio

1. Si existe, leer `.agents/context.md` para conocer el estado del trabajo y confirmar los archivos relevantes. Es contexto local, no versionado; en un checkout nuevo, consultar el README y las guías técnicas.
2. Consultar las [guías técnicas](docs/README.md) del tema que se vaya a modificar.
3. Para escribir, refactorizar o revisar código y pruebas, leer [.agents/rules/code-quality.md](.agents/rules/code-quality.md).
4. Para código de negocio, leer [.agents/rules/trading-architecture.md](.agents/rules/trading-architecture.md). Para persistencia o performance, leer [.agents/rules/database-performance.md](.agents/rules/database-performance.md).
5. Para diseñar, implementar o revisar endpoints REST, DTOs o contratos HTTP, leer [.agents/rules/rest-api-standard.md](.agents/rules/rest-api-standard.md).

Las reglas complementarias se leen por estas referencias aunque la herramienta no descubra automáticamente `.agents/rules/`.

Las reglas son autocontenidas y reutilizables. Las políticas específicas de este archivo y los contratos del challenge prevalecen sobre sus convenciones generales.

## Objetivo

Completar los tres endpoints descritos en el [README](README.md), con ejecución local reproducible, test funcional de envío de órdenes y decisiones justificadas. Priorizar corrección financiera, concurrencia y performance comprobable.

## Convenciones

- Respetar los límites entre módulos definidos en [arquitectura](docs/architecture.md).
- Crear abstracciones y dependencias cuando resuelvan una necesidad concreta.
- Código y nombres en inglés; conservar los valores reales de PostgreSQL.
- Comentarios cortos en español, solo para explicar motivos o restricciones que aporten.
- TypeScript estricto, ESM y resolución `nodenext`; usar `./` solo para archivos de la misma carpeta y `#src/*` para cualquier otra ruta interna, siempre con extensión `.js`. No usar imports ascendentes con `../`.
- Usar npm y conservar `package-lock.json`. Los comandos están en el [README](README.md).
- Mantener dominio y aplicación independientes de NestJS y TypeORM.
- Usar las capacidades compartidas existentes cuando la responsabilidad corresponda a varios módulos.
- Las pruebas deben comprobar comportamiento e invariantes financieros.
- Ubicar todas las pruebas bajo `test/`: `unit/` para unidades aisladas, `feature/` para módulos con adaptadores simulados e `integration/` para recorridos con infraestructura real.

## Políticas del challenge

- Seguir el [árbol de features](docs/architecture.md#estructura-de-cada-feature): contratos en `application/interfaces/`, puertos en `application/ports/`, casos de uso en `application/usecases/`, controllers y DTOs en `infrastructure/http/` y adaptadores en `infrastructure/persistence/`. Dominio contiene reglas reales, no proyecciones sin comportamiento.
- Los puertos de persistencia son clases abstractas `<Nombre>Repository`; los adaptadores, `<Nombre>TypeOrmRepository`. La clase abstracta funciona como token Nest; los módulos conectan providers sin introducir el framework en aplicación.
- Reutilizar `Money`, recursos y lecturas compartidas; conservar entidades TypeORM en infraestructura compartida. `synchronize: false` y migraciones explícitas, sin ejecución automática al iniciar.
- Mantener todas las operaciones de una transacción con el mismo `EntityManager`. Portfolio usa un snapshot de solo lectura; órdenes requiere bloqueo por usuario y confirmación de rechazos financieros, según la [arquitectura](docs/architecture.md#consistencia-y-concurrencia) y los [supuestos](docs/assumptions.md).
- Éxitos de negocio usan `{ data }` o `{ data, meta }`; no arrays en la raíz. Búsqueda conserva `limit/offset` y portfolio no se pagina. Health mantiene su contrato de infraestructura. El [contrato HTTP](docs/api/README.md) define los códigos y campos de Problem Details.
- `POST /orders` exige un UUID v4 en `Idempotency-Key`: el middleware lo valida y lo mantiene en contexto de infraestructura; controller, caso de uso y `OrderRequest` no reciben la clave. La capacidad compartida garantiza unicidad por operación, usuario y clave dentro de la transacción. Una orden creada o recuperada responde `201` con estado `FILLED`, `NEW` o `REJECTED`. Un fallo técnico confirmado se guarda como `500` sin orden mediante savepoint; un fallo que impide confirmar la transacción no se presenta como resultado guardado.
- Al completar un endpoint, actualizar Swagger, el contrato HTTP y [REST Client](docs/api/cocos-capital.http), único archivo de solicitudes de la entrega. Registrar avance y verificaciones en el contexto local si existe.

## Forma de trabajar

- Responder en español con explicaciones claras y breves.
- Respetar las indicaciones actuales del usuario y conservar cambios ajenos a la tarea.
- Justificar cambios y registrar qué se verificó, según el alcance solicitado y las instrucciones de la sesión.
- Distinguir decisiones, implementación y resultados medidos.
- Al cerrar un avance significativo, actualizar `.agents/context.md` y las guías afectadas.

## Documentación

Cada tema se desarrolla en la guía indicada por [docs/README.md](docs/README.md). Las referencias a archivos del proyecto se concentran en este documento y en las guías, no en las reglas reutilizables.

Mantener los archivos, enlaces y procedimientos del proyecto dentro de este repositorio. Las credenciales se configuran por entorno y quedan fuera del código, logs y documentación.
