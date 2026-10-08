# Secuencia de consulta de portfolio

La existencia del usuario se valida antes de cargar el snapshot financiero. Movimientos, instrumentos y cotizaciones se leen en lote. No se ejecuta una consulta por posición.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Cliente
    participant Controller as PortfolioController
    participant UseCase as GetPortfolio
    participant Users as UserRepository
    participant Portfolio as PortfolioRepository
    participant DB as PostgreSQL
    participant Domain as calculatePortfolio

    Client->>Controller: GET /users/:userId/portfolio
    Controller->>UseCase: execute(userId)
    UseCase->>Users: exists(userId)
    Users->>DB: Consultar usuario
    DB-->>Users: Existe o no existe

    alt Usuario inexistente
        Users-->>UseCase: false
        UseCase-->>Client: 404 NOT_FOUND
    else Usuario existente
        Users-->>UseCase: true
        UseCase->>Portfolio: loadSnapshot(userId)
        Portfolio->>DB: BEGIN REPEATABLE READ
        Portfolio->>DB: SET TRANSACTION READ ONLY
        Portfolio->>DB: Leer movimientos FILLED y NEW
        Portfolio->>Portfolio: Detectar posiciones ejecutadas

        opt Hay posiciones abiertas
            Portfolio->>DB: Leer instrumentos en lote
            Portfolio->>DB: Leer últimas cotizaciones en lote
        end

        Portfolio->>DB: COMMIT
        Portfolio-->>UseCase: Snapshot consistente
        UseCase->>Domain: Calcular disponibilidad, valor y rendimientos
        Domain-->>UseCase: Portfolio valuado
        UseCase->>UseCase: Completar datos y ordenar posiciones
        UseCase-->>Controller: PortfolioResult
        Controller-->>Client: 200 con data
    end
```

Si una posición abierta no tiene los datos necesarios para valuarla, la API devuelve un error controlado en lugar de publicar un total parcial.
