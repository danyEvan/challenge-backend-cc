# Instrucciones de desarrollo

El punto de entrada es [AGENTS.md](../AGENTS.md).

| Archivo                                                 | Responsabilidad                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `context.md` (local, no versionado)                     | Estado de implementación, pendientes y verificaciones.               |
| [Calidad de código](rules/code-quality.md)              | Legibilidad, Clean Code, DRY y KISS en código y pruebas.             |
| [Reglas de trading](rules/trading-architecture.md)      | Límites de arquitectura y reglas del código de negocio.              |
| [Reglas de persistencia](rules/database-performance.md) | Criterios para consultas, transacciones y migraciones.               |
| [Reglas REST](rules/rest-api-standard.md)               | Rutas, métodos, contratos HTTP, respuestas, errores y documentación. |

Las cuatro reglas son autocontenidas: no requieren documentos del challenge ni se referencian entre sí. Las decisiones del proyecto, sus excepciones y enlaces permanecen en `AGENTS.md` y las [guías técnicas](../docs/README.md).

## Compatibilidad

- [Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md) descubre `AGENTS.md`; este archivo exige leer cada regla según la tarea. No se presupone descubrimiento automático de `.agents/rules/` ni interpretación de su frontmatter por Codex.
- [Antigravity](https://www.antigravity.google/docs/rules/) descubre `AGENTS.md` y los Markdown directamente bajo `.agents/rules/`. Cada regla conserva `trigger: model_decision` y `description`, válidos para su activación por tema.
- Otras herramientas que lean `AGENTS.md` pueden seguir las mismas instrucciones de lectura. La carga automática de reglas y sus metadatos depende de cada herramienta; no se promete compatibilidad universal.

Se revisó la documentación de ambos productos; no se ejecutó una prueba de carga en Antigravity. No hace falta un `GEMINI.md` duplicado para las versiones documentadas que reconocen `AGENTS.md`.

## Reutilizar en otro proyecto

Copiar las reglas deseadas a `.agents/rules/` y agregar al `AGENTS.md` del destino una instrucción de lectura para cada tema. Por ejemplo:

```markdown
- Para escribir o revisar código y pruebas, leer `.agents/rules/code-quality.md`.
- Para casos de uso y límites de módulos, leer `.agents/rules/trading-architecture.md`.
- Para consultas, transacciones o migraciones, leer `.agents/rules/database-performance.md`.
- Para endpoints y contratos HTTP, leer `.agents/rules/rest-api-standard.md`.
```

Adaptar las políticas locales en el `AGENTS.md` de destino, sin copiar las excepciones del challenge. Las reglas son restricciones y criterios permanentes; no se convirtieron en skills porque no definen un workflow especializado con recursos propios.
