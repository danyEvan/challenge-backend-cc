# Evidencias de performance

Esta carpeta reúne comparaciones de consultas y código antes y después de cada mejora.

**Estado:** pendiente de medición. Todavía no hay capturas ni resultados; los índices propuestos son candidatos a evaluar.

## Organización

Cuando midamos una mejora, crearemos una carpeta por caso. Por ejemplo:

```text
docs/evidence/
├── README.md
└── executed-movements/
    ├── README.md
    ├── query.sql
    ├── before.png
    ├── after.png
    ├── before-plan.txt
    └── after-plan.txt
```

Las capturas facilitan la revisión. La consulta y los planes en texto permiten inspeccionar y reproducir el resultado. El README de cada caso contiene la explicación y muestra ambas capturas con enlaces relativos.

## Qué documentar por caso

| Dato          | Contenido                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Problema      | Endpoint y consulta u operación que buscamos mejorar.                                                                             |
| Cambio        | Índice, migración o cambio de código, con enlace al archivo.                                                                      |
| Entorno       | Versión de PostgreSQL, ejecución local o remota y commit del código evaluado.                                                     |
| Datos         | Cantidad y distribución de registros, y cómo se prepararon. Distinguir seed original de datos sintéticos.                         |
| Procedimiento | Comandos, parámetros, repeticiones y condiciones de caché.                                                                        |
| Resultado     | Comparación antes/después y capturas. Para SQL: tiempo de ejecución, filas y buffers. Para API: latencia y cantidad de consultas. |
| Decisión      | Beneficio observado, costo en almacenamiento/escrituras y límites de la medición.                                                 |

## Método de comparación

1. Preparar una base local de evaluación con datos representativos y estadísticas actualizadas. Conservar el mismo dataset y parámetros durante la comparación.
2. Registrar la consulta real y obtener su plan con `EXPLAIN (ANALYZE, BUFFERS)`.
3. Aplicar únicamente el cambio que queremos evaluar y repetir la medición bajo las mismas condiciones.
4. Realizar varias ejecuciones por variante; informar el número de repeticiones y la mediana, distinguiendo calentamiento de caché de ejecuciones medidas.
5. Guardar planes y capturas, resumir la comparación y enlazar el caso desde este documento.

Los tiempos de una consulta SQL y los de una solicitud HTTP son mediciones diferentes. En una medición de API también intervienen la aplicación y la red.

Un recorrido completo puede ser apropiado para el seed pequeño. Si un cambio no mejora el escenario medido, registrar ese resultado. Las capturas publicadas deben mostrar la medición sin credenciales ni cadenas de conexión privadas.

Referencia: [EXPLAIN en PostgreSQL](https://www.postgresql.org/docs/current/using-explain.html).

## Casos medidos

Pendientes. Agregar aquí un enlace a cada comparación terminada.
