# Documentación técnica

El [README central](../README.md) contiene alcance, estado, ejecución y comandos.

```text
docs/
  README.md                    # índice de documentación
  architecture.md              # organización del código y dependencias
  assumptions.md               # decisiones y pendientes de negocio
  api/
    README.md                  # contrato HTTP implementado
    cocos-capital.http
  pictures/                    # recursos visuales del README
  evidence/                    # mediciones de performance
```

| Guía                                             | Contenido                                                       |
| ------------------------------------------------ | --------------------------------------------------------------- |
| [Arquitectura](architecture.md)                  | Límites entre módulos y estrategia de consistencia.             |
| [Contrato HTTP](api/README.md)                   | Parámetros, respuestas y errores implementados.                 |
| [REST Client](api/cocos-capital.http)            | Solicitudes y ejemplos; preparación y uso en el README central. |
| [Supuestos funcionales](assumptions.md)          | Criterios financieros, justificación y decisiones pendientes.   |
| [Base de datos](../database/README.md)           | Preparación, esquema, datos de referencia y migraciones.        |
| [Elementos compartidos](../src/shared/README.md) | Dinero, reconstrucción de recursos y lecturas comunes.          |
| [Evidencias de performance](evidence/README.md)  | Procedimiento de medición y comparaciones antes/después.        |

`pictures/` contiene recursos visuales como el [logo](pictures/cocos.jpg). Las capturas de mediciones pertenecen a `evidence/`.

## Mantenimiento

Actualizar la guía responsable cuando cambie una decisión y enlazarla desde los documentos relacionados. Mantener explícito el estado de implementación y verificación.

Al completar cada endpoint, actualizar `api/README.md`, el archivo REST Client (`api/cocos-capital.http`) y Swagger. REST Client es el archivo de solicitudes de la entrega; sus ejemplos deben coincidir con el contrato. Los pasos de arranque y ejecución se mantienen en el README central. Cada mejora medida tendrá su carpeta en `evidence/`.

Las instrucciones de desarrollo están en [`.agents`](../.agents/README.md).
