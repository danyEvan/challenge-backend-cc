---
trigger: model_decision
description: 'Aplicar al implementar o revisar casos de uso, reglas financieras y límites entre módulos.'
---

# Arquitectura y código de negocio

Respetar la arquitectura y las políticas explícitas del proyecto. Estos criterios no requieren un framework, ORM ni árbol de carpetas particular.

- Organizar el código por responsabilidades: dominio para reglas, aplicación para casos de uso e infraestructura para HTTP, persistencia y conexión de dependencias.
- Mantener dominio y aplicación independientes de frameworks y ORM. No filtrar entidades de persistencia ni decoradores HTTP hacia ellos.
- Crear elementos de dominio únicamente cuando representen reglas, entidades o valores reales del negocio; no inventarlos para una proyección de lectura sin comportamiento.
- Definir entradas, resultados y puertos junto al consumidor; implementar los adaptadores en infraestructura. Seguir los nombres y carpetas acordados para el proyecto.
- Declarar en los puertos solo operaciones necesarias. No crear repositorios genéricos ni CRUD sin consumidores reales.
- Usar mecanismos de inyección disponibles en runtime cuando el lenguaje borre interfaces o tipos al compilar.
- Compartir capacidades cuando varios consumidores representen la misma regla; conservar contratos específicos cuando tengan responsabilidades diferentes.
- Mantener errores de negocio independientes de HTTP y traducirlos en infraestructura. Distinguir entrada inválida, resultado financiero rechazado y fallo técnico; una consulta sin coincidencias no es una excepción por sí misma.
- En cálculos financieros, reutilizar la interpretación común de dinero y recursos, conservar precisión y validar límites antes de persistir.
- No ocultar datos inválidos ni corregir historial financiero como efecto secundario de una lectura. Seguir la política de conciliación y presentación acordada.
- Comprobar resultados e invariantes del negocio con pruebas relevantes; incluir el registro persistido cuando el flujo escriba datos.
- Al cambiar una política, actualizar los contratos, ejemplos y documentación afectados. Separar lo implementado de lo verificado y lo pendiente.
