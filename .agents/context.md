# Estado de implementación

Actualizado: 6 de octubre de 2026. Confirmar el código relevante antes de continuar.

## Disponible

- Scaffold NestJS/TypeScript ESM, configuración, Dockerfile, health y Swagger.
- Módulos `instruments`, `orders` y `portfolio`, sin endpoints de negocio.
- Conexión y cuatro entidades TypeORM centralizadas en `shared/infrastructure/persistence`.
- Dinero decimal, modelos de movimientos/cotizaciones y reconstrucción de recursos.
- Puerto `TradingReader`, adaptador TypeORM y módulo de lecturas compartido.
- Validación global de DTOs y tests unitarios de dinero, recursos y health.
- Variables de entorno validadas, TLS con verificación de certificado por defecto y cierre ordenado de la API.
- Compose con PostgreSQL de desarrollo y pruebas en volúmenes separados; guardas e2e para base local terminada en `_test`.
- Configuración compartida API/CLI y comandos explícitos de migraciones. Todavía no hay migraciones de índices.
- Documentación autosuficiente organizada por tema. Logo en `docs/pictures/cocos.jpg`.
- Supuestos funcionales separados en `docs/assumptions.md` y enlazados desde el README.

## Pendientes

1. Verificar equivalencia del esquema remoto con el SQL local y completar la nulabilidad de las entidades.
2. Implementar búsqueda, envío de órdenes y portfolio. Definir contrato HTTP, formato de importes, errores y casos de datos insuficientes.
3. Completar la validación de cantidad/monto y el tratamiento de precio MARKET proporcionado, monto inferior a una acción y referencias inválidas.
4. Implementar transacciones y bloqueo por usuario, lectura coherente del portfolio y test funcional de órdenes. Preparar y limpiar fixtures de escritura en la base aislada.
5. Medir consultas e índices candidatos y preparar las migraciones justificadas.
6. Agregar ejemplos ejecutables, CI y actualizar documentación al completar cada flujo.

Las decisiones financieras están en [supuestos](../docs/assumptions.md); los límites y la consistencia, en [arquitectura](../docs/architecture.md); los índices candidatos, en la [guía de PostgreSQL](../database/README.md).

## Verificaciones

- El 6 de octubre pasaron build, lint, TypeScript completo y validación de Compose.
- Ambos servicios PostgreSQL locales iniciaron con health correcto. La API compilada arrancó contra la base local y el CLI `migration:show` terminó sin errores.
- En este entorno `5432` estaba ocupado: desarrollo se inició con `POSTGRES_PORT=5434`; pruebas utiliza `5433`. Se puede elegir el puerto mediante `.env` o la shell, ajustando también `DATABASE_URL`.
- No se ejecutaron tests en este avance ni se aplicaron migraciones. La base remota y `.env` no se modificaron.
- Integración del lector, pruebas e2e, TLS remoto, imagen Docker de la API y performance: pendientes de verificar.

## Próximo paso

Completar búsqueda de instrumentos como primer flujo HTTP con persistencia; revisar los mapeos implicados. Seguir la prioridad actual del usuario.
