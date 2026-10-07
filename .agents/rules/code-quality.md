---
trigger: model_decision
description: 'Aplicar al escribir, refactorizar o revisar código y pruebas: legibilidad, Clean Code, DRY y KISS.'
---

# Calidad de código

Aplicar Clean Code, DRY y KISS con juicio, no como cuotas de líneas, funciones o abstracciones. Respetar las convenciones explícitas del proyecto; esta regla no requiere archivos de documentación adicionales.

- Usar nombres que expresen intención y vocabulario del negocio. Nombrar resultados intermedios cuando aclaren una condición o un cálculo.
- Separar etapas con líneas en blanco; usar llaves en los condicionales y bucles nuevos o modificados. No comprimir consultas, negaciones y retornos en una misma expresión si dificulta leer el flujo.
- Mantener una responsabilidad clara por función. Extraer helpers cuando nombren un concepto útil o encapsulen una responsabilidad distinta, no solo para acortar un método.
- DRY: reutilizar reglas de negocio comunes y capacidades existentes. No unificar fragmentos por semejanza visual si representan responsabilidades distintas.
- KISS: elegir la solución más sencilla que preserve los requisitos actuales. No agregar capas, configuraciones, repositorios genéricos ni extensibilidad para consumidores hipotéticos.
- Usar comentarios cortos en el idioma acordado para explicar motivos o restricciones; no narrar lo que el código ya expresa.
- Verificar refactors con las pruebas relevantes existentes; agregar casos solo cuando cubran comportamiento faltante. La legibilidad no justifica cambiar contratos, precisión financiera ni garantías transaccionales.
