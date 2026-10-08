# Casos de uso

El cliente no necesita autenticarse en el alcance del challenge. `CASH_IN` y `CASH_OUT` son movimientos históricos usados para reconstruir recursos. No se pueden enviar mediante `POST /orders`.

```mermaid
flowchart LR
    Client([Cliente de la API])

    subgraph API[API de inversiones]
        Search([Buscar instrumentos<br/>por ticker o nombre])
        Portfolio([Consultar portfolio])
        Submit([Enviar orden<br/>BUY o SELL])

        Catalog([Listar catálogo<br/>negociable])
        Resources([Reconstruir saldo,<br/>tenencias y reservas])
        Valuation([Valuar posiciones<br/>y calcular rendimientos])
        Quantity([Indicar cantidad exacta<br/>o monto en ARS])
        OrderType([Elegir MARKET<br/>o LIMIT])
        Persist([Persistir FILLED,<br/>NEW o REJECTED])
    end

    Client --> Search
    Client --> Portfolio
    Client --> Submit

    Search -. incluye .-> Catalog
    Portfolio -. incluye .-> Resources
    Portfolio -. incluye .-> Valuation
    Submit -. incluye .-> Quantity
    Submit -. incluye .-> OrderType
    Submit -. incluye .-> Persist
```

La cancelación no forma parte de los tres endpoints solicitados. Si se incorpora, la única transición admitida será `NEW → CANCELLED`, según los [supuestos funcionales](../assumptions.md#disponibilidad-y-órdenes).
