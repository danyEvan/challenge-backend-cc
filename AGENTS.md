# Guía para agentes

## Inicio

1. Si existe, leer `.agents/context.md` para conocer el estado del trabajo y confirmar los archivos relevantes. Es contexto local, no versionado; en un checkout nuevo, consultar el README y las guías técnicas.
2. Consultar las [guías técnicas](docs/README.md) del tema que se vaya a modificar.
3. Para código de negocio, leer [.agents/rules/trading-architecture.md](.agents/rules/trading-architecture.md). Para persistencia o performance, leer [.agents/rules/database-performance.md](.agents/rules/database-performance.md).
4. Para diseñar, implementar o revisar endpoints REST, DTOs o contratos HTTP, leer [.agents/rules/rest-api-standard.md](.agents/rules/rest-api-standard.md).

Las reglas complementarias se leen por estas referencias aunque la herramienta no descubra automáticamente `.agents/rules/`.

## Objetivo

Completar los tres endpoints descritos en el [README](README.md), con ejecución local reproducible, test funcional de envío de órdenes y decisiones justificadas. Priorizar corrección financiera, concurrencia y performance comprobable.

## Convenciones

- Respetar los límites entre módulos definidos en [arquitectura](docs/architecture.md).
- Crear abstracciones y dependencias cuando resuelvan una necesidad concreta.
- Código y nombres en inglés; conservar los valores reales de PostgreSQL.
- TypeScript estricto, ESM y resolución `nodenext`; usar `.js` en imports relativos.
- Usar npm y conservar `package-lock.json`. Los comandos están en el [README](README.md).
- Mantener dominio y aplicación independientes de NestJS y TypeORM.
- Usar las capacidades compartidas existentes cuando la responsabilidad corresponda a varios módulos.
- Las pruebas deben comprobar comportamiento e invariantes financieros.

## Forma de trabajar

- Responder en español con explicaciones claras y breves.
- Respetar las indicaciones actuales del usuario y conservar cambios ajenos a la tarea.
- Justificar cambios y registrar qué se verificó, según el alcance solicitado y las instrucciones de la sesión.
- Distinguir decisiones, implementación y resultados medidos.
- Al cerrar un avance significativo, actualizar `.agents/context.md` y las guías afectadas.

## Documentación

Cada tema se desarrolla en la guía indicada por [docs/README.md](docs/README.md). Las reglas operativas deben referenciar esas guías.

Mantener los archivos, enlaces y procedimientos del proyecto dentro de este repositorio. Las credenciales se configuran por entorno y quedan fuera del código, logs y documentación.
