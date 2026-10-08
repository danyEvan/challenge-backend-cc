# Secuencia de envío de una orden

La clave idempotente, el resultado y la orden se confirman dentro de la misma transacción. El bloqueo de la fila del usuario serializa el consumo de recursos de una cuenta sin bloquear cuentas distintas.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Cliente
    participant Middleware as IdempotencyKeyMiddleware
    participant Controller as OrdersController
    participant UseCase as SubmitOrder
    participant Repository as OrderTypeOrmRepository
    participant DB as PostgreSQL
    participant Domain as evaluateOrder

    Client->>Middleware: POST /orders + Idempotency-Key
    Middleware->>Middleware: Validar UUID v4

    alt Cabecera ausente o inválida
        Middleware-->>Client: 400 INVALID_REQUEST
    else Clave válida
        Middleware->>Controller: Continuar con clave en contexto
        Controller->>Controller: Validar CreateOrderDto
        Controller->>UseCase: execute(OrderRequest)
        UseCase->>Repository: submitAtomically(request)

        Repository->>DB: BEGIN READ COMMITTED
        Repository->>DB: SELECT user FOR UPDATE

        alt Usuario inexistente
            DB-->>Repository: Sin fila
            Repository-->>UseCase: UserNotFoundError
            UseCase-->>Controller: Propagar error
            Controller-->>Client: ROLLBACK y 404 NOT_FOUND
        else Usuario bloqueado
            Repository->>DB: Reclamar clave idempotente

            alt Clave existente con otro payload
                DB-->>Repository: Hash diferente
                Repository-->>UseCase: IdempotencyConflictError
                UseCase-->>Controller: Propagar error
                Controller-->>Client: ROLLBACK y 409 IDEMPOTENCY_CONFLICT
            else Resultado existente
                DB-->>Repository: Orden o fallo previamente confirmado
                Repository-->>UseCase: Resultado original
                UseCase-->>Controller: Presentar resultado
                Controller-->>Client: COMMIT y replay
            else Clave nueva
                Repository->>DB: SAVEPOINT order_execution
                Repository->>DB: Leer instrumento, último close y movimientos FILLED
                Repository->>Domain: Evaluar precio, cantidad y recursos

                alt Solicitud de negocio inválida
                    Domain-->>Repository: Error conocido
                    Repository-->>UseCase: Propagar error
                    UseCase-->>Controller: Propagar error
                    Controller-->>Client: ROLLBACK y 4xx Problem Details
                else Orden evaluada
                    Domain-->>Repository: FILLED, NEW o REJECTED
                    Repository->>DB: INSERT orders
                    Repository->>DB: Guardar resultado idempotente 201
                    Repository->>DB: COMMIT
                    Repository-->>UseCase: Orden persistida
                    UseCase-->>Controller: OrderResult
                    Controller-->>Client: 201 con data
                else Fallo técnico durante la operación
                    Repository->>DB: ROLLBACK TO SAVEPOINT
                    Repository->>DB: Guardar fallo idempotente 500
                    Repository->>DB: COMMIT
                    Repository-->>UseCase: RecordedOrderFailureError
                    UseCase-->>Controller: Propagar error
                    Controller-->>Client: 500 + Idempotency-Outcome: finalized
                end
            end
        end
    end
```

Si falla el commit o no puede confirmarse el registro idempotente, no se informa el fallo como finalizado. El cliente conserva la misma clave y el mismo body para reintentar, como detalla el [contrato HTTP](../api/README.md#idempotencia-obligatoria).
