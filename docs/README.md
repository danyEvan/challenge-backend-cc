# Documentación técnica

El [README central](../README.md) contiene alcance, ejecución y comandos. Las guías se organizan por tema:

| Guía                                             | Contenido                                                |
| ------------------------------------------------ | -------------------------------------------------------- |
| [Arquitectura](architecture.md)                  | Límites entre módulos y estrategia de consistencia.      |
| [Contrato HTTP](api/README.md)                   | Parámetros, respuestas y errores implementados.          |
| [REST Client](api/cocos-capital.http)            | Solicitudes, ejemplos y uso desde el README central.     |
| [Diagramas](diagrams/README.md)                  | Casos de uso y secuencias de órdenes y portfolio.        |
| [Supuestos funcionales](assumptions.md)          | Criterios financieros y decisiones de alcance.           |
| [Base de datos](../database/README.md)           | Preparación, esquema, datos de referencia y migraciones. |
| [Elementos compartidos](../src/shared/README.md) | Dinero, reconstrucción de recursos y lecturas comunes.   |

Las instrucciones de desarrollo están en [`.agents`](../.agents/README.md).
