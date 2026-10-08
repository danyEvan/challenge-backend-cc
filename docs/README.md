# Documentación técnica

El [README central](../README.md) contiene alcance, estado, ejecución y comandos.

```text
docs/
  README.md                    # índice de documentación
  architecture.md              # organización del código y dependencias
  assumptions.md               # decisiones funcionales y técnicas
  api/
    README.md                  # contrato HTTP implementado
    cocos-capital.http
  diagrams/                    # casos de uso y secuencias principales
    README.md
  pictures/                    # recursos visuales del README
```

| Guía                                             | Contenido                                                |
| ------------------------------------------------ | -------------------------------------------------------- |
| [Arquitectura](architecture.md)                  | Límites entre módulos y estrategia de consistencia.      |
| [Contrato HTTP](api/README.md)                   | Parámetros, respuestas y errores implementados.          |
| [REST Client](api/cocos-capital.http)            | Solicitudes, ejemplos y uso desde el README central.     |
| [Diagramas](diagrams/README.md)                  | Casos de uso y secuencias de órdenes y portfolio.        |
| [Supuestos funcionales](assumptions.md)          | Criterios financieros y decisiones de alcance.           |
| [Base de datos](../database/README.md)           | Preparación, esquema, datos de referencia y migraciones. |
| [Elementos compartidos](../src/shared/README.md) | Dinero, reconstrucción de recursos y lecturas comunes.   |

`pictures/` contiene recursos visuales como el [logo](pictures/cocos.jpg).

## Mantenimiento

Actualizar la guía responsable cuando cambie una decisión y enlazarla desde los documentos relacionados. Mantener explícito el estado de implementación y verificación.

Al completar cada endpoint, actualizar `api/README.md`, el archivo REST Client (`api/cocos-capital.http`) y Swagger. REST Client es el archivo de solicitudes de la entrega y sus ejemplos deben coincidir con el contrato. Los pasos de arranque y ejecución se mantienen en el README central.

Las instrucciones de desarrollo están en [`.agents`](../.agents/README.md).
