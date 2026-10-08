# Diagramas

Estos diagramas complementan la [arquitectura](../architecture.md) y el [contrato HTTP](../api/README.md). Muestran las responsabilidades y las decisiones principales. El código y el contrato mantienen el detalle de implementación.

| Diagrama                                           | Propósito                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| [Casos de uso](use-cases.md)                       | Alcance funcional de los tres endpoints desde la perspectiva del cliente.  |
| [Envío de una orden](submit-order-sequence.md)     | Validación HTTP, idempotencia, bloqueo, evaluación y persistencia atómica. |
| [Consulta de portfolio](get-portfolio-sequence.md) | Existencia del usuario, snapshot consistente y valuación financiera.       |
