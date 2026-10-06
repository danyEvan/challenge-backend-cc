# Instrucciones de desarrollo

El punto de entrada es [AGENTS.md](../AGENTS.md).

| Archivo                                                 | Responsabilidad                                        |
| ------------------------------------------------------- | ------------------------------------------------------ |
| [Contexto](context.md)                                  | Estado de implementación, pendientes y verificaciones. |
| [Reglas de trading](rules/trading-architecture.md)      | Criterios para modificar código de negocio.            |
| [Reglas de persistencia](rules/database-performance.md) | Criterios para consultas, transacciones y migraciones. |

Las decisiones técnicas se explican en [docs](../docs/README.md). Este directorio conserva las instrucciones operativas y el estado del trabajo.

`AGENTS.md` referencia explícitamente las reglas. Los archivos de `rules/` también incluyen `trigger: model_decision` para herramientas que admiten ese formato.

Referencias de compatibilidad: [Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md) y [Antigravity](https://www.antigravity.google/docs/rules/).
