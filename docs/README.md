# Documentación técnica

El [README central](../README.md) contiene alcance, estado, ejecución y comandos.

| Guía                                             | Contenido                                                     |
| ------------------------------------------------ | ------------------------------------------------------------- |
| [Arquitectura](architecture.md)                  | Límites entre módulos y estrategia de consistencia.           |
| [Supuestos funcionales](assumptions.md)          | Criterios financieros, justificación y decisiones pendientes. |
| [Base de datos](../database/README.md)           | Preparación, esquema, datos de referencia y migraciones.      |
| [Elementos compartidos](../src/shared/README.md) | Dinero, reconstrucción de recursos y lecturas comunes.        |
| [Evidencias de performance](evidence/README.md)  | Procedimiento de medición y comparaciones antes/después.      |

`pictures/` contiene recursos visuales como el [logo](pictures/cocos.jpg). Las capturas de mediciones pertenecen a `evidence/`.

## Mantenimiento

Actualizar la guía responsable cuando cambie una decisión y enlazarla desde los documentos relacionados. Mantener explícito el estado de implementación y verificación.

Al completar los endpoints, agregar ejemplos ejecutables en `docs/api.http`; Swagger describirá el contrato HTTP. Cada mejora medida tendrá su carpeta en `evidence/`.

Las instrucciones de desarrollo y los pendientes detallados están en [`.agents`](../.agents/README.md).
