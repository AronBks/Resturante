# 🍽️ SGGI — Sistema de Gestión Gastronómica Inteligente

> **Peña Restaurant Tukuypaj** — Cochabamba, Bolivia  
> Plataforma omnicanal de alta fidelidad diseñada específicamente para la dinámica operativa real de una peña y restaurante tradicional: carta digital interactiva, asistente gastronómico Don Beto IA, comanda móvil en salón, monitor táctil de cocina (KDS), protocolo tradicional de cobro seguro con viaje único de mesero, control de caja y arquitectura preparada para integración bancaria automática en tiempo real.

---

## 📑 Tabla de Contenidos

- [1. Descripción y Propósito del Sistema](#1-descripción-y-propósito-del-sistema)
- [2. Actores y Filosofía Operativa Real](#2-actores-y-filosofía-operativa-real)
  - [El Comensal (Móvil / QR en Mesa)](#-el-comensal-móvil--qr-en-mesa)
  - [El Garzón / Mesero (Salón y Tablet)](#-el-garzón--mesero-salón-y-tablet)
  - [La Cocina / KDS (Monitor Táctil Culinario)](#-la-cocina--kds-monitor-táctil-culinario)
  - [El Cajero y Administración (Caja Central)](#-el-cajero-y-administración-caja-central)
- [3. Flujos Operativos de Extremo a Extremo](#3-flujos-operativos-de-extremo-a-extremo)
  - [Flujo de Comanda Omnicanal](#flujo-de-comanda-omnicanal)
  - [Protocolo de Cierre Tradicional y Sincronización Salón-Caja (Viaje Único Optimizado)](#protocolo-de-cierre-tradicional-y-sincronización-salón-caja-viaje-único-optimizado)
  - [Mecanismo de Resiliencia y Eventos WebSocket Duales](#mecanismo-de-resiliencia-y-eventos-websocket-duales)
- [4. Flujo Futuro: Integración Bancaria Automática (API QR Dinámico & Webhooks)](#4-flujo-futuro-integración-bancaria-automática-api-qr-dinámico--webhooks)
  - [Visión General de la Automatización Bancaria](#visión-general-de-la-automatización-bancaria)
  - [Diagrama de Secuencia del Flujo Futuro con Banco](#diagrama-de-secuencia-del-flujo-futuro-con-banco)
  - [Especificación Técnica de la Integración Futura](#especificación-técnica-de-la-integración-futura)
  - [Estrategia de Resiliencia y Fallback Manual](#estrategia-de-resiliencia-y-fallback-manual)
- [5. Lógica de Negocio Gastronómica](#5-lógica-de-negocio-gastronómica)
  - [Franjas Horarias Tradicionales de Cochabamba](#franjas-horarias-tradicionales-de-cochabamba)
  - [Asistente Don Beto IA (Gemini / n8n)](#asistente-don-beto-ia-gemini--n8n)
  - [Cobro en Efectivo con Cambio Anticipado y QR Simple](#cobro-en-efectivo-con-cambio-anticipado-y-qr-simple)
  - [Auto-Cierre Seguro y Purgado de Sesión](#auto-cierre-seguro-y-purgado-de-sesión)
- [6. Arquitectura del Monorepo](#6-arquitectura-del-monorepo)
- [7. Stack Tecnológico](#7-stack-tecnológico)
- [8. Mapa de Puertos y Servicios](#8-mapa-de-puertos-y-servicios)
- [9. Red de Eventos WebSocket en Tiempo Real](#9-red-de-eventos-websocket-en-tiempo-real)
- [10. Modelo de Datos y Entidades Prisma](#10-modelo-de-datos-y-entidades-prisma)
- [11. Usuarios, Roles y Seguridad RBAC](#11-usuarios-roles-y-seguridad-rbac)
  - [Credenciales de Acceso por Perfil](#credenciales-de-acceso-por-perfil)
  - [Blindaje Financiero y Protección del Arqueo de Caja](#blindaje-financiero-y-protección-del-arqueo-de-caja)
- [12. Guía de Instalación y Puesta en Marcha](#12-guía-de-instalación-y-puesta-en-marcha)
- [13. Guía de Certificación y Pruebas E2E (3 Actores en Simultáneo)](#13-guía-de-certificación-y-pruebas-e2e-3-actores-en-simultáneo)
  - [Escenario A: Cobro en Efectivo con Cambio Anticipado](#escenario-a-cobro-en-efectivo-con-cambio-anticipado)
  - [Escenario B: Cobro por Código QR Bancario](#escenario-b-cobro-por-código-qr-bancario)
- [14. Hoja de Ruta y Próximos Pasos Técnicos](#14-hoja-de-ruta-y-próximos-pasos-técnicos)
- [15. Scripts del Monorepo](#15-scripts-del-monorepo)
- [16. Variables de Entorno (Actuales y Futuras del Banco)](#16-variables-de-entorno-actuales-y-futuras-del-banco)
- [17. Licencia](#17-licencia)

---

## 1. Descripción y Propósito del Sistema

El **SGGI** (Sistema de Gestión Gastronómica Inteligente) fue concebido para resolver la realidad operativa de la **Peña Restaurant Tukuypaj** en Cochabamba, Bolivia. A diferencia de soluciones genéricas que asumen flujos de comida rápida o restaurantes extranjeros, SGGI está adaptado a:

1. **Atención por turnos gastronómicos**: Caldos típicos mañaneros en una franja horaria estricta, platos tradicionales fuertes al mediodía/tarde, y bebidas continuas.
2. **Respeto a la jerarquía de salón tradicional**: El garzón es el anfitrión que valida pedidos, asiste presencialmente y entrega físicamente la cuenta antes de pagar, impidiendo confusiones o mesas impagas.
3. **Cocina orientada a producción masiva**: La cocina no interactúa con módulos administrativos complejos; dispone de un monitor KDS táctil con tickets en orden de llegada (FIFO) y alertas visuales de demora.
4. **Cobro boliviano real**: Gestión en moneda nacional (Bolivianos - Bs.), selección de billetes para que el garzón acuda a la mesa con el cambio exacto preparado, y pagos por **QR Simple** acreditados en caja, con hoja de ruta lista para **acreditación bancaria directa 100% automatizada vía Webhooks**.

---

## 2. Actores y Filosofía Operativa Real

Para que cualquier desarrollador o IA entienda la lógica del sistema, es crucial comprender **quién usa qué y cómo interactúan**:

```
 ┌──────────────────────┐        ┌──────────────────────┐        ┌──────────────────────┐
 │   COMENSAL / MÓVIL   │        │    GARZÓN / SALÓN    │        │  COCINA / KDS TÁCTIL │
 │  - Escanea QR Mesa   │  WS    │  - Mapa de Salón     │  WS    │  - Monitor de Tickets│
 │  - Don Beto IA       │◄──────►│  - Comanda Drawer    │◄──────►│  - PENDIENTE ➔ LISTO │
 │  - Pide Cuenta / QR  │        │  - Entrega Cuenta    │        │  - Alerta >15 min    │
 └──────────────────────┘        └──────────┬───────────┘        └──────────────────────┘
                                            │
                                            │ WS
                                            ▼
                                 ┌──────────────────────┐
                                 │     CAJA CENTRAL     │
                                 │  - Arqueo de Turno   │
                                 │  - Cobro Efectivo/QR │
                                 │  - Libera Mesa       │
                                 └──────────────────────┘
```

### 📱 El Comensal (Móvil / QR en Mesa)
- **Acceso sin descarga ni registro**: Escanea el QR físico de su mesa (`http://localhost:4201/?mesa=1` o formato `M01`).
- **Navegación visual**: Catálogo con imágenes HD (Cloudinary), badges de horario ("Disponible ahora" o "Agotado") y variantes de porción (Entero, Medio).
- **Asistente "Don Beto"**: Conversa en lenguaje natural boliviano, resuelve dudas, arma la comanda multi-turno y, al detectar confirmación ("eso nomas sería", "marchalo a cocina"), envía el pedido directo a cocina y salón.
- **Botón "Llamar al Garzón"**: Solicita servilletas, cubiertos o atención presencial con notificación instantánea al equipo de sala.
- **Solicitud de Cuenta con Intención**: Selecciona de antemano si pagará en Efectivo (indicando el billete para estimar su cambio) o vía QR, congelando la comanda en su pantalla mientras llega el garzón.

### 🤵 El Garzón / Mesero (Salón y Tablet)
- **Plano interactivo del restaurante**: Vista de todas las mesas (`LIBRE`, `OCUPADA`, `POR_COBRAR`) con indicador de mesero asignado y filtro **"Mis Mesas"**.
- **Alertas en tiempo real con datos de cobro**: Notificación instantánea en tarjeta con el desglose exacto:
  - Efectivo: *"Mesa 1 paga con Bs. 100 — Llevar Bs. 15.00 de cambio"*.
  - QR: *"Mesa 1 pide cuenta — Pago por QR"*.
- **Comanda Drawer táctil**: Puede cargar pedidos adicionales directamente en mesa, editar notas culinarias y revisar tiempos transcurridos.
- **Protocolo de Entrega de Cuenta (`entregar-cuenta`)**: El garzón acude con la pre-cuenta física y presiona **"Entregar Cuenta"** en el sistema, lo que desbloquea de forma segura las opciones de pago en el teléfono del comensal.
- **Reapertura de Comanda (`reabrir-comanda`)**: Si los comensales deciden pedir algo más antes de pagar, el garzón reactiva la comanda con un solo clic devolviendo la mesa al estado `OCUPADA`.

### 👨‍🍳 La Cocina / KDS (Monitor Táctil Culinario)
> [!IMPORTANT]
> **Aclaración Clave sobre Cocina**: Los chefs y cocineros **NO usan la aplicación administrativa ni gestionan usuarios, cajas o inventarios**. En la cocina opera una **pantalla KDS (Kitchen Display System)** de alta visibilidad, pensada para pantallas táctiles de pared en un ambiente caliente y concurrido.

- **Tickets FIFO**: Los pedidos entran organizados cronológicamente por orden de llegada con número de mesa visible.
- **Temporizador de alerta**: El tiempo transcurrido cambia a color ámbar/rojo de alerta si la comanda supera los 15 minutos sin despacho.
- **Control táctil rápido por ítem**: Botones grandes táctiles para avanzar:
  $$\text{PENDIENTE} \xrightarrow{\text{Tocar 'Preparar'}} \text{PREPARANDO} \xrightarrow{\text{Tocar 'Terminar'}} \text{LISTO}$$
- **Despacho a Mesa**: Cuando los platos están listos, el garzón asignado se encarga de retirarlos de cocina y servirlos a la mesa.

### 💰 El Cajero y Administración (Caja Central)
- **Turnos de Caja**: Apertura con fondo inicial, control de ventas en tiempo real por canal (Efectivo y QR) y arqueo ciego al cierre.
- **Exclusividad Financiera**: Solo Cajeros y Administradores pueden registrar cobros (`POST /api/caja/registrar-pago`), evitando descuadres en el arqueo del turno.
- **Cierre Transaccional Atómico**: Al confirmar el cobro, el backend actualiza la caja, marca el pedido como cerrado, emite el evento WebSocket `pago:confirmado` a salón y cliente, y libera la mesa para los siguientes comensales.

---

## 3. Flujos Operativos de Extremo a Extremo

### Flujo de Comanda Omnicanal

```mermaid
sequenceDiagram
    autonumber
    actor C as Comensal (Móvil QR)
    actor IA as Don Beto (Gemini IA)
    actor G as Garzón (Salón / Tablet)
    actor K as Cocina (Monitor KDS)
    actor X as Caja Central

    alt Opción 1: Pedido vía Don Beto IA
        C->>IA: "Buenas, un Chicharrón sin locoto y dos Huari"
        IA->>C: Confirma platos, variantes y pregunta si marcha
        C->>IA: "Eso nomás sería, mándalo"
        IA->>Backend: POST /api/pedidos/ia/confirmar (canal: IA_DON_BETO)
    else Opción 2: Pedido vía Menú Digital
        C->>C: Selecciona platos del catálogo y notas en carrito
        C->>Backend: POST /api/pedidos/publica/confirmar (canal: CLIENTE_DIGITAL)
    else Opción 3: Pedido tomado por Garzón
        G->>Backend: POST /api/pedidos (canal: MESERO_POS)
    end

    Backend->>Backend: Guarda Pedido y Detalles en PostgreSQL (Transaccional)
    Backend-->>K: WS 'pedido:creado' (Ticket aparece en monitor KDS)
    Backend-->>G: WS 'pedido:creado' (Mesa pasa a OCUPADA en plano)
    Backend-->>X: WS 'pedido:creado' (Actualiza comanda activa)

    Note over K: Cocineros preparan el pedido
    K->>Backend: PATCH /api/pedidos/:id/items/:itemId (estado: PREPARANDO ➔ LISTO)
    Backend-->>G: WS 'pedido:estado-actualizado' (Garzón retira y sirve el plato)
```

---

### Protocolo de Cierre Tradicional y Sincronización Salón-Caja (Viaje Único Optimizado)

En la operativa tradicional de un restaurante, el proceso de cobro suele sufrir el **"problema del triple viaje del mesero"**:
1. El mesero camina a la mesa a preguntar cómo pagarán.
2. Vuelve a caja a pedir la cuenta y cambio.
3. Regresa a la mesa a cobrar y vuelve a caja con el dinero.

**SGGI elimina por completo este cuello de botella**, sincronizando en tiempo real la intención del comensal con el **Garzón Designado** y la **Caja Central**:

- **Declaración Inmediata de Intención (Viaje Único)**: Al momento de pulsar **"Pedir la Cuenta"** en su móvil, el comensal selecciona de inmediato su método de pago (**Efectivo con billete** o **QR**).
- **Cálculo de Cambio Anticipado**: El backend calcula el cambio exacto al instante y emite la alerta tanto al garzón como a caja central **antes de que el garzón se desplace**.
- **Un Solo Viaje a la Mesa**: El garzón acude a la mesa una sola vez llevando ya la pre-cuenta física y el cambio exacto preparado en mano, cobra el importe y entrega el cambio en el acto.
- **Flexibilidad Operativa**: Si el establecimiento prefiere que el garzón entregue primero la cuenta impresa física (`POST /api/pedidos/entregar-cuenta`), el comensal puede confirmar o ratificar su billete en ese instante y el cobro se completa ahí mismo sin viajes redundantes.

```mermaid
sequenceDiagram
    autonumber
    actor C as Comensal (Móvil en Mesa)
    actor G as Garzón Designado (Tablet/Salón)
    participant SGGI as Backend SGGI (WebSockets)
    actor X as Caja Central (Estación de Pago)

    Note over C: Comensal termina de consumir, pulsa "Pedir la Cuenta"<br/>y declara su método de pago al instante
    alt CASO A: PAGO EN EFECTIVO (Declaración de Billete y Cambio Anticipado)
        C->>SGGI: POST /api/pedidos/solicitar-cuenta { mesaNumero: 'M01', metodoPago: 'EFECTIVO', montoPagaCon: 100 }
        
        rect rgb(28, 24, 18)
            Note over SGGI,G: CÁLCULO Y NOTIFICACIÓN INSTANTÁNEA EN SALÓN Y CAJA:<br/>"Mesa M01 paga con Bs. 100 — Total: Bs. 85 — Cambio exacto: Bs. 15"
        end

        SGGI-->>G: WS 'pago:solicitado' ("M01 Efectivo Bs. 100 — Llevar cambio: Bs. 15")
        SGGI-->>X: Alerta monitor Caja: "M01 Efectivo en camino — Total Bs. 85 — Cambio Bs. 15"
        SGGI-->>C: Pantalla móvil: "¡Garzón en camino con tu cuenta y cambio de Bs. 15!"

        rect rgb(30, 25, 20)
            Note over G: EL GARZÓN HACE UN SOLO VIAJE OPTIMIZADO A LA MESA:<br/>1. Ya sabe el consumo (Bs. 85) y cambio exacto a llevar (Bs. 15).<br/>2. Acude con la pre-cuenta física y los Bs. 15 de cambio en mano.<br/>3. Recibe los Bs. 100 del comensal y entrega el cambio en el mismo acto.<br/>(Opcional: Si entrega pre-cuenta primero vía 'entregar-cuenta', cobra de inmediato).<br/>4. Camina directamente a Caja Central con los Bs. 85 recaudados.
        end

        G->>X: Entrega el efectivo recaudado en Caja Central
        X->>SGGI: POST /api/caja/registrar-pago { metodoPago: 'EFECTIVO', montoRecibido: 100 }

    else CASO B: PAGO POR CÓDIGO QR SIMPLE / BANCO MÓVIL
        C->>SGGI: POST /api/pedidos/solicitar-cuenta { mesaNumero: 'M01', metodoPago: 'QR' }
        SGGI-->>C: Renderiza Código QR oficial de Mesa M01 con monto exacto (Bs. 85.00)
        SGGI-->>G: WS 'pago:solicitado' ("Mesa M01 pide cuenta — Pago por QR")
        SGGI-->>X: Alerta monitor Caja: "Mesa M01 esperando verificación QR"

        Note over C: Comensal escanea desde su app bancaria (Banco Unión, BCP, BNB, etc.) y transfiere
        C->>SGGI: Pulsa "He realizado el pago QR"
        Note over C: Pantalla en espera de acreditación oficial

        Note over X: Cajero valida ingreso en la cuenta del restaurante (o Webhook bancario a futuro)
        X->>SGGI: POST /api/caja/registrar-pago { metodoPago: 'QR' }
    end

    rect rgb(20, 30, 20)
        Note over SGGI: CIERRE TRANSACCIONAL ATÓMICO:<br/>1. Registra Transacción en PostgreSQL<br/>2. Incrementa acumuladores en Caja activa<br/>3. Cierra Pedido a ENTREGADO<br/>4. Libera Mesa a LIBRE
    end

    SGGI-->>C: WS 'pago:confirmado' ➔ Pantalla Recibo Digital + Auto-cierre de 45s
    SGGI-->>G: WS 'pago:confirmado' + 'mesa:estado-actualizado' ➔ Mesa M01 pasa a LIBRE en plano
    SGGI-->>X: WS 'transaccion:creada' ➔ Registrado en historial inmutable del turno
```

#### Roles y Sincronización Clara entre los Actores durante el Cobro:

| Actor | Lo que ve en su pantalla | Acción u Obligación que ejecuta |
|---|---|---|
| **Comensal (Móvil)** | Pre-cuenta ➔ Selector de billete (Exacto, Bs. 50, 100, 200) o QR ➔ Desglose del cambio que recibirá ➔ Recibo oficial cancelado | Escoge cómo pagará e indica el billete con el que cancelará al presionar "Pedir Cuenta" para que el mesero no tenga que adivinar. |
| **Garzón Designado (Salón)** | Tarjeta de mesa parpadeando en dorado con aviso: *"Mesa 01: Paga con Bs. 100 — Llevar cambio: Bs. 15"* | Realiza un **viaje único**: se acerca a la mesa con el cambio y la pre-cuenta en mano, recibe el dinero y lo entrega a caja. |
| **Caja Central (Estación)** | Monitor de comandas en vivo que indica qué mesero está cobrando qué mesa y por qué método (Efectivo o QR) | Recibe el dinero físico del mesero o verifica la transferencia QR bancaria, confirma en el sistema y emite el recibo final. |

---

### Mecanismo de Resiliencia y Eventos WebSocket Duales

1. **Persistencia y Resiliencia ante Recargas (`getMesaDetallePago`)**:
   - Si la tableta del mesero sufre una recarga o pérdida temporal de conexión, la información del cobro no se pierde.
   - El helper `getMesaDetallePago` consulta en primer término la memoria reactiva de llamadas (`llamadasDetalle`), y como respaldo seguro lee `metodoPagoPreferido` y `montoPagaCon` almacenados en el registro del pedido en PostgreSQL, calculando el cambio en vivo:
     $$\text{Cambio} = \max(0, \text{montoPagaCon} - \text{subtotal})$$
2. **Emisión Dual del Evento `pago:confirmado`**:
   - **Para el Salón**: `PedidosGateway.broadcastPagoConfirmado(mesaNumero, transaccion)` emite por el socket central a meseros y administradores para que la mesa pase a verde (`LIBRE`) y se remueva la alerta de llamada.
   - **Para el Cliente**: `CartaGateway.broadcastPagoConfirmadoPublico(mesaNumero, transaccion)` emite al namespace `/publica` para activar el Recibo Digital y la cuenta regresiva de auto-cierre en el móvil del comensal.

---

## 4. Flujo Futuro: Integración Bancaria Automática (API QR Dinámico & Webhooks)

### Visión General de la Automatización Bancaria

En la **Fase 1 (Actual)**, el cobro por QR funciona mediante un QR Simple referencial donde el personal de caja valida visualmente la acreditación en la cuenta bancaria del negocio antes de pulsar *"Registrar Pago"*.

En la **Fase 2 (A Futuro)**, el restaurante integrará una **API Bancaria Oficial** (proporcionada por una entidad bancaria boliviana como BCP, Banco Unión, BNB o un procesador de pagos como Red Enlace / PagosNet / Síntesis). Esta integración permitirá la **acreditación desatendida en tiempo real**: el cliente escanea el QR, transfiere desde su aplicación bancaria, el banco notifica al backend vía **Webhook**, el sistema valida y concilia la transacción automáticamente, emitiendo el ticket digital y liberando la mesa **sin intervención manual de caja**.

### Diagrama de Secuencia del Flujo Futuro con Banco

```mermaid
sequenceDiagram
    autonumber
    actor C as Comensal (Móvil)
    actor G as Garzón (Salón)
    participant SGGI as Backend SGGI (NestJS)
    participant Bco as API Bancaria (Banco / Red Enlace)
    actor X as Caja Central (Monitor Pasivo)

    Note over C,G: Protocolo tradicional: Garzón entrega pre-cuenta física
    G->>SGGI: POST /api/pedidos/entregar-cuenta
    SGGI-->>C: WS 'cuenta:entregada'

    Note over C: Comensal elige "Pagar con QR Dinámico"
    C->>SGGI: POST /api/pagos/generar-qr-dinamico { mesaNumero: 'M01', pedidoId: '...' }
    
    SGGI->>Bco: POST /v1/qr/generate (Monto exacto, TTL 15m, Ref: M01-PED123)
    Bco-->>SGGI: Devuelve { qrImagePayload, transactionId, expiration }
    SGGI-->>C: Renderiza QR Dinámico oficial en el móvil del comensal

    Note over C: Comensal escanea y transfiere desde su banco móvil
    C->>Bco: Autoriza pago (Simple QR) por Bs. 85.00
    Bco->>Bco: Acreditación efectiva en la cuenta de Peña Tukuypaj

    Note over Bco,SGGI: Notificación Asíncrona Inmediata (<2 segundos)
    Bco->>SGGI: POST /api/pagos/webhook-banco (HMAC-SHA256 Header, Payload)
    
    rect rgb(20, 30, 20)
        Note over SGGI: 1. Valida firma criptográfica del banco<br/>2. Verifica monto e idempotencia (transactionId)<br/>3. Registra Transacción atómica en PostgreSQL<br/>4. Suma a Caja activa (totalQr += monto)<br/>5. Cierra Pedido y cambia Mesa a LIBRE
    end

    SGGI-->>Bco: 200 OK { received: true }
    SGGI-->>C: WS 'pago:confirmado' ➔ Pantalla Recibo Digital + Auto-cierre 45s
    SGGI-->>G: WS 'mesa:estado-actualizado' ➔ Mesa M01 pasa a LIBRE (Verde)
    SGGI-->>X: WS 'transaccion:creada' ➔ Ingreso registrado en panel de caja
```

---

### Especificación Técnica de la Integración Futura

Para que cualquier desarrollador o IA pueda implementar o auditar esta integración cuando el banco provea las credenciales, se define la siguiente arquitectura contractual:

#### 1. Endpoint para Generación de QR Dinámico
- **Ruta**: `POST /api/pagos/generar-qr-dinamico`
- **Acceso**: Público (desde `client-app` con validación de mesa activa)
- **Payload Solicitado**:
  ```json
  {
    "mesaNumero": "M01",
    "pedidoId": "7b8e5c1a-9f2d-4b8c-8f1e-3a4b5c6d7e8f",
    "monto": 85.00,
    "glosa": "Consumo Mesa M01 - Tukuypaj"
  }
  ```
- **Respuesta de la API Bancaria al Backend**:
  ```json
  {
    "transaccionBancariaId": "BNK-20261002-88491",
    "qrCodeBase64": "data:image/png;base64,iVBORw0KGgo...",
    "qrString": "00020101021226...5802BO5915TUKUYPAJ6010COCHABAMBA...",
    "expiraEnSegundos": 900
  }
  ```

#### 2. Webhook Bancario Seguro (Receptor de Notificaciones)
- **Ruta**: `POST /api/pagos/webhook-banco`
- **Headers de Seguridad**:
  - `X-Bank-Signature`: Firma `HMAC-SHA256` del cuerpo de la petición generada con la clave privada `BANK_WEBHOOK_SECRET`.
  - `X-Bank-Timestamp`: Marca de tiempo Unix para prevenir ataques de replay.
- **Payload Típico del Banco**:
  ```json
  {
    "evento": "PAGO_CONFIRMADO",
    "transaccionBancariaId": "BNK-20261002-88491",
    "referenciaInterna": "7b8e5c1a-9f2d-4b8c-8f1e-3a4b5c6d7e8f",
    "mesaNumero": "M01",
    "montoAcreditado": 85.00,
    "moneda": "BOB",
    "cuentaOrigenEnmascarada": "********1245",
    "bancoOrigen": "BANCO NACIONAL DE BOLIVIA",
    "fechaAcreditacion": "2026-10-02T13:45:12.823Z"
  }
  ```

#### 3. Proceso Atómico de Conciliación en NestJS:
```typescript
@Injectable()
export class PagosBancariosService {
  async procesarWebhook(signature: string, payload: WebhookBancoDto) {
    // 1. Validar firma criptográfica
    this.validarFirmaHmac(signature, payload);

    // 2. Control de Idempotencia (evitar procesar dos veces el mismo pago)
    const yaExiste = await this.prisma.transaccion.findFirst({
      where: { referenciaExterna: payload.transaccionBancariaId }
    });
    if (yaExiste) return { status: 'ALREADY_PROCESSED' };

    // 3. Ejecutar transacción atómica de base de datos
    return await this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({ where: { id: payload.referenciaInterna } });
      const cajaActiva = await tx.caja.findFirst({ where: { estado: 'ABIERTA' } });

      // Registrar transacción financiera
      const transaccion = await tx.transaccion.create({
        data: {
          pedidoId: pedido.id,
          cajaId: cajaActiva.id,
          monto: payload.montoAcreditado,
          metodoPago: 'QR',
          referenciaExterna: payload.transaccionBancariaId,
          origen: 'API_BANCO_AUTOMATICO'
        }
      });

      // Incrementar acumulados de caja
      await tx.caja.update({
        where: { id: cajaActiva.id },
        data: {
          totalVentas: { increment: payload.montoAcreditado },
          totalQr: { increment: payload.montoAcreditado }
        }
      });

      // Liberar mesa y cerrar pedido
      await tx.pedido.update({ where: { id: pedido.id }, data: { estado: 'ENTREGADO' } });
      await tx.mesa.update({ where: { id: pedido.mesaId }, data: { estado: 'LIBRE' } });

      // 4. Emitir eventos WebSocket en milisegundos
      this.pedidosGateway.broadcastPagoConfirmado(payload.mesaNumero, transaccion);
      this.cartaGateway.broadcastPagoConfirmadoPublico(payload.mesaNumero, transaccion);
      this.mesasGateway.broadcastMesaLiberada(pedido.mesaId);

      return { status: 'SUCCESS' };
    });
  }
}
```

---

### Estrategia de Resiliencia y Fallback Manual

Para salvaguardar la operación continua del restaurante ante cualquier eventualidad tecnológica:

1. **Latencia o caída del servicio bancario**: Si el banco tarda en notificar o el webhook experimenta demoras, la pantalla del comensal mantiene activa la opción de comprobante visual y el cajero/garzón retiene en su panel el botón de **"Validar Pago Manual"**.
2. **Expiración del QR Dinámico**: Si el comensal no realiza el pago en la ventana de tiempo (TTL de 15 minutos), el QR se invalida y la aplicación móvil le ofrece el botón *"Generar nuevo código QR"*.
3. **Discrepancia en monto**: La API del banco garantiza que el QR dinámico posee el monto exacto bloqueado, imposibilitando que el cliente transfiera una cantidad menor o mayor por error de digitación.

---

## 5. Lógica de Negocio Gastronómica

### Franjas Horarias Tradicionales de Cochabamba

El restaurante divide su carta según las costumbres culinarias locales mediante los campos `horaInicio` y `horaFin` en cada plato:

```
        09:00                               13:00                 17:00
          │                                   │                     │
Caldos:   ├───────────────────────────────────┤                     │ (09:00 a 13:00)
          │  Caldo de Cola, Kawi, Riñón,      │                     │
          │  Chanka de Pollo, Pulpitos...     │                     │
          │                                   │                     │
Platos:   │                             12:00 ├─────────────────────┤ (12:00 a 17:00)
          │                                   │ Chicharrón, Pique,  │
          │                                   │ Charque, Planchita, │
          │                                   │ Lapping, Pampaku... │
          │                                                         │
Bebidas:  ├─────────────────────────────────────────────────────────┤ (Todo el día)
          │ Chicha cochabambina, Garapiña, Refrescos, Cervezas...   │
```

- **App del Cliente**: Si un plato está fuera de horario, muestra un badge ámbar con el horario de servicio y deshabilita su adición accidental.
- **Don Beto IA**: Conoce las franjas horarias y avisa con calidez cochabambina si el cliente pide un caldo por la tarde o un pique en la mañana.
- **Garzón en POS**: Cuenta con privilegios para despachar solicitudes especiales autorizadas fuera de hora.

### Asistente Don Beto IA (Gemini / n8n)
- **Personalidad**: Diseñado con el tono y vocabulario de un anfitrión tradicional de peña cochabambina.
- **Desambiguación culinaria**: Distingue automáticamente pedidos como *"Caldo de Cola"* (plato de mañana) vs *"Coca Cola"* (bebida), o variantes como *"Entero"* vs *"Medio"*.
- **Auto-marchado**: Interpreta modismos de confirmación (*"eso sería todo"*, *"lo marchas nomás"*, *"con eso estamos"*) y genera la comanda formal sin obligar al usuario a usar botones técnicos.

### Cobro en Efectivo con Cambio Anticipado y QR Simple
- **Moneda oficial**: 100% transaccionado en Bolivianos (**Bs.**).
- **Sin imposición de propinas**: El sistema se enfoca en el cobro transparente y exacto del consumo gastronómico.
- **Cálculo de cambio inteligente**: La app ofrece opciones de billetes habituales (Monto Exacto, Bs. 50, Bs. 100, Bs. 200 u otro monto). El garzón ve en su pantalla con cuánto pagará el comensal y acude a la mesa con el cambio exacto preparado en un solo viaje.
- **QR Simple Interbancario**: Código QR con validación visual y confirmación formal en la caja del restaurante.

### Auto-Cierre Seguro y Purgado de Sesión
Para garantizar que un nuevo cliente que se siente en la mesa no vea los consumos, cuentas ni conversaciones del comensal anterior:
1. Al confirmarse el pago por caja (o automáticamente por webhook bancario), la pantalla muestra el recibo digital con la frase tradicional de la peña: *"Tukuypaj es su casa — Don Roberto"*.
2. Se activa una **cuenta regresiva visual de seguridad de 45 segundos**.
3. Al llegar a cero (o si el comensal pulsa *"Finalizar Sesión"*), el frontend ejecuta un purgado completo de memoria:
   - Limpia `localStorage` (`tukuypaj_carrito`, `tukuypaj_ultimo_pedido`, `don_beto_chat_history`).
   - Resetea las señales reactivas de Angular Signals.
   - Redirige a la pantalla de bienvenida o carta limpia para la siguiente orden.

---

## 6. Arquitectura del Monorepo

El proyecto está estructurado como un **NPM Workspaces Monorepo** con TypeScript estricto de extremo a extremo:

```
Restaurante/
├── backend/                       # Servidor NestJS 11
│   ├── prisma/
│   │   ├── schema.prisma          # Esquema relacional central (PostgreSQL)
│   │   └── seed.ts                # Seeder oficial: carta tradicional, mesas y usuarios
│   └── src/
│       ├── common/                # Guards RBAC, decoradores y filtros de excepción
│       └── modules/
│           ├── auth/              # JWT, estrategias Passport y autenticación
│           ├── usuarios/          # Control de personal y roles
│           ├── mesas/             # Estados de mesa, layout de salón y asignación
│           ├── carta/             # CRUD de platos, horarios, Cloudinary y stock
│           ├── pedidos/           # Comandas omnicanal, Don Beto IA y WebSockets Gateway
│           ├── caja/              # Turnos de caja, cobros, arqueos y webhooks de pago
│           └── analitica/         # KPIs de ventas y métricas de desempeño
│
├── frontend/                      # Workspace Angular 19 Standalone
│   ├── src/                       # Aplicación 1: Panel Administrativo & Salón (:4200)
│   │   └── app/features/
│   │       ├── overview/          # Dashboard con métricas diarias
│   │       ├── mesas/             # Plano interactivo de salón y comanda drawer
│   │       ├── cocina/            # Monitor táctil KDS para el equipo culinario
│   │       ├── carta/             # Gestión de menú, precios y horarios
│   │       ├── control-caja/      # Registro de pagos, apertura y cierre de turnos
│   │       └── usuarios/          # Administración de personal con permisos RBAC
│   └── projects/client-app/       # Aplicación 2: Móvil del Comensal por QR (:4201)
│       └── src/app/components/
│           ├── landing-hero/      # Bienvenida y reconocimiento de mesa
│           ├── menu-digital/      # Menú categorizado con imágenes y badges de horario
│           ├── ia-comanda/        # Interfaz de chat con Don Beto IA
│           ├── carrito-drawer/    # Resumen de orden y notas de preparación
│           ├── chat-mesero/       # Botón flotante para llamar al garzón
│           └── cierre-cuenta/     # Protocolo de pago seguro (Efectivo/QR) y ticket digital
│
├── packages/shared/               # Contratos compartidos entre Backend y Frontend
│   └── src/
│       ├── enums/                 # RolUsuario, EstadoMesa, EstadoPedido, EstadoItemPedido...
│       └── interfaces/            # DTOs, modelos compartidos y payloads WebSocket
│
├── docker/                        # Scripts de aprovisionamiento de PostgreSQL
├── docker-compose.yml             # Contenedores de Postgres 16, Redis 7 y pgAdmin 4
└── package.json                   # Scripts concurrently de desarrollo unificado
```

---

## 7. Stack Tecnológico

| Capa | Tecnología | Justificación y Uso |
|---|---|---|
| **Backend Framework** | NestJS 11 | Arquitectura modular robusta, inyección de dependencias y decoradores |
| **Lenguaje** | TypeScript 5.7+ | Tipado estricto compartido entre backend y cliente mediante `@sggi/shared` |
| **Base de Datos** | PostgreSQL 16 | Motor relacional transaccional (soporte Docker local y Supabase Pooler) |
| **ORM** | Prisma ORM 6.9+ | Migraciones seguras, tipado automático y consultas optimizadas |
| **Caché y Pub/Sub** | Redis 7 Alpine | Almacenamiento volátil rápido y mensajería reactiva |
| **WebSockets** | Socket.IO 4.7+ | Sincronización instantánea de comandas, llamadas de salón y estados de pago |
| **Inteligencia Artificial** | Google Gemini API / n8n | Procesamiento de lenguaje natural, comanda multi-turno y modismos bolivianos |
| **Frontend Framework** | Angular 19 (Standalone) | Componentes autónomos modernos, reactividad nativa con Angular Signals |
| **Diseño y Estilos** | Vanilla SCSS | Sistema de diseño de alta gama "Obsidian & Gold", glassmorphism y micro-interacciones |
| **Iconografía** | Lucide Angular | Iconos vectoriales limpios y consistentes en ambas aplicaciones |
| **Multimedia** | Cloudinary CDN | Entrega optimizada de fotos gastronómicas de alta definición |
| **Contenedores** | Docker & Docker Compose | Entorno de desarrollo local idéntico y reproducible |

---

## 8. Mapa de Puertos y Servicios

Al ejecutar el proyecto en desarrollo, los servicios se distribuyen en los siguientes puertos:

| Servicio | Puerto | URL Local | Descripción |
|---|:---:|---|---|
| 📱 **App del Cliente (QR)** | `4201` | [http://localhost:4201](http://localhost:4201) | Carta digital, Don Beto IA y cierre de cuenta en mesa |
| 🖥️ **Panel Administrativo (POS)** | `4200` | [http://localhost:4200](http://localhost:4200) | Plano de salón, comanda drawer, KDS de cocina y caja |
| 🔧 **API REST & WebSockets** | `3000` | [http://localhost:3000/api](http://localhost:3000/api) | Servidor NestJS y gateway Socket.IO |
| 🗄️ **pgAdmin 4** | `5050` | [http://localhost:5050](http://localhost:5050) | Administrador visual de base de datos PostgreSQL |
| 🐘 **PostgreSQL (Local)** | `5433` / `5432` | `localhost:5433` | Base de datos relacional del proyecto |
| ⚡ **Redis Server** | `6379` | `localhost:6379` | Caché en memoria y cola de eventos |

---

## 9. Red de Eventos WebSocket en Tiempo Real

El sistema utiliza el Gateway centralizado de NestJS (`PedidosGateway` y `CartaGateway`) sincronizado con el cliente mediante eventos fuertemente tipados:

| Evento Socket | Emisor Principal | Destinatarios | Efecto Operativo en el Sistema |
|---|---|---|---|
| `pedido:creado` | Cliente / Garzón | Salón, Cocina, Caja | Agrega el ticket a la cola KDS y cambia la mesa a `OCUPADA` |
| `pedido:ia-creado` | Don Beto IA | Salón, Cocina, Caja | Notifica comanda automática con badge especial de IA |
| `pedido:estado-actualizado` | Monitor KDS | Salón, Mesa | Notifica al mesero que los platos están listos para servirse |
| `mesa:estado-actualizado` | Backend / Garzón | Salón, Caja | Actualiza en tiempo real el color de la mesa en el mapa |
| `mesero:llamado` | App del Cliente | Salón (Meseros/Admin) | Dispara campanilla sonora y renderiza pill con desglose de billete y cambio |
| `mesero:atendido` | Garzón (Salón) | App del Cliente | Muestra banner flotante: *"¡Garzón en camino a tu mesa!"* |
| `pago:solicitado` | App del Cliente | Salón y Caja | Marca la mesa en `POR_COBRAR` y alerta al garzón |
| `cuenta:entregada` | Garzón en Mesa | App del Cliente | Desbloquea en el móvil la pantalla de selección de pago |
| `pago:confirmado` | Caja Central | Cliente, Salón | Notifica simultáneamente a salón (mesa a verde) y cliente (recibo cancelado) |
| `transaccion:creada` | Caja Central | Salón, Administrador | Registra el ingreso financiero en el balance inmutable del turno |
| `menu:actualizado` | Administrador | Cliente, Salón | Refresca disponibilidad de platos y stock al instante |

---

## 10. Modelo de Datos y Entidades Prisma

El archivo [schema.prisma](file:///d:/python/Restaurante/backend/prisma/schema.prisma) define las entidades del dominio culinario:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Usuario     │       │      Mesa       │       │ CategoriaPlato  │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (UUID)       │◄──┐   │ id (Int)        │◄──┐   │ id (Int)        │
│ rol (RolUsuario)│   │   │ numero (VarChar)│   │   │ nombre (VarChar)│
│ nombre (VarChar)│   │   │ estado (Enum)   │   │   └────────┬────────┘
└────────┬────────┘   │   │ posicion (JSON) │   │            │ 1:N
         │ 1:N        │   └────────┬────────┘   │   ┌────────▼────────┐
         │            │            │ 1:N        │   │      Plato      │
         ▼            │            ▼            │   ├─────────────────┤
┌─────────────────┐   │   ┌─────────────────┐   │   │ id (UUID)       │
│      Caja       │   └───┤     Pedido      ├───┘   │ horaInicio/Fin  │
├─────────────────┤       ├─────────────────┤       │ disponible/stock│
│ id (UUID)       │       │ id (UUID)       │       └────────┬────────┘
│ montoApertura   │       │ canalOrigen     │                │ 1:N
│ estado (Enum)   │       │ estado (Enum)   │       ┌────────▼────────┐
└────────┬────────┘       │ cuentaEntregada │       │  DetallePedido  │
         │ 1:N            └────────┬────────┘       ├─────────────────┤
         ▼                         │ 1:N            │ cantidad        │
┌─────────────────┐                │                │ precioUnitario  │
│   Transaccion   │◄───────────────┘                │ estadoItem      │
├─────────────────┤                                 └─────────────────┘
│ total / metodo  │
└─────────────────┘
```

---

## 11. Usuarios, Roles y Seguridad RBAC

### Credenciales de Acceso por Perfil

El seeder inicial (`npm run db:seed`) aprovisiona los siguientes perfiles de prueba:

| Rol | Correo Electrónico | Contraseña | Destino y Alcance Operativo |
|---|---|:---:|---|
| **ADMIN** | `admin@tukuypaj.com` | `admin123` | Control total del sistema, configuración, carta, personal y caja |
| **MESERO** | `mesero@tukuypaj.com` | `mesero123` | Mapa de salón, filtro "Mis Mesas", atención de llamadas y entrega de cuenta |
| **CAJERO** | `caja@tukuypaj.com` | `caja123` | Turnos de caja, cobro en efectivo y validación de transferencias QR |
| **CHEF** | `cocina@tukuypaj.com` | `cocina123` | Acceso directo al monitor KDS de preparación de tickets en cocina |

### Blindaje Financiero y Protección del Arqueo de Caja

Para evitar desvíos o manipulaciones en el cierre de turno, el endpoint central de cobro está protegido a nivel de controlador por el guardián `RolesGuard`:

```typescript
@Post('registrar-pago')
@Roles('ADMIN', 'CAJERO')
async registrarPago(@CurrentUser('id') cajeroId: string, @Body() dto: RegistrarPagoDto)
```

> [!CAUTION]
> Si un usuario autenticado únicamente con rol `MESERO` intenta liquidar una mesa directamente por API, el sistema aborta la petición con **`HTTP 403 Forbidden`**:
> ```json
> {
>   "statusCode": 403,
>   "message": "Acceso denegado. Se requiere uno de los siguientes roles: ADMIN, CAJERO",
>   "error": "Forbidden"
> }
> ```
> Esto certifica que el personal de sala solo transporta y coordina el dinero, mientras que el registro contable y la responsabilidad del arqueo recae siempre en la **Caja Central**.

---

## 12. Guía de Instalación y Puesta en Marcha

### Requisitos Previos
- **Node.js**: `>= 22.0.0`
- **npm**: `>= 10.0.0`
- **Docker & Docker Compose** (para PostgreSQL y Redis local)

---

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/AronBks/Resturante.git
cd Resturante
```

### Paso 2: Configurar Variables de Entorno
Copia la plantilla `.env.example` en la raíz como `.env`:
```bash
cp .env.example .env
```
> [!NOTE]
> Configura en `.env` tu clave de Google Gemini (`GEMINI_API_KEY`) para el asistente Don Beto y verifica los puertos de base de datos.

### Paso 3: Levantar los Contenedores Docker
```bash
npm run docker:up
```
*Inicia PostgreSQL 16 (puerto 5433/5432), Redis 7 (6379) y pgAdmin 4 (5050).*

### Paso 4: Instalar Dependencias
```bash
npm install
```

### Paso 5: Migrar y Sembrar la Base de Datos
```bash
# 1. Generar cliente Prisma
npm run db:generate

# 2. Aplicar migraciones
npm run db:migrate

# 3. Sembrar carta tradicional cochabambina, mesas y usuarios
npm run db:seed
```

### Paso 6: Iniciar el Sistema Completo
Ejecuta el script unificado que levanta los 3 entornos en paralelo:
```bash
npm run dev
```

> [!TIP]
> Accede de inmediato a:
> - 📱 **Móvil del Comensal**: [http://localhost:4201/?mesa=1](http://localhost:4201/?mesa=1)
> - 🖥️ **Panel Administrativo y POS**: [http://localhost:4200](http://localhost:4200)
> - 🔧 **API Backend NestJS**: [http://localhost:3000/api](http://localhost:3000/api)

---

## 13. Guía de Certificación y Pruebas E2E (3 Actores en Simultáneo)

Para verificar y certificar la sincronización en vivo del sistema en desarrollo local, abre 3 ventanas simultáneas en tu navegador:

| Ventana | Actor | URL | Credenciales / Configuración |
|---|---|---|---|
| **Ventana 1** | **Comensal (Móvil)** | `http://localhost:4201/?mesa=1` | Activar emulación móvil en DevTools (`Ctrl + Shift + M`). |
| **Ventana 2** | **Garzón (Salón)** | `http://localhost:4200/login` | Correo: `mesero@tukuypaj.com` \| Clave: `mesero123` ➔ Entrar a **Mesas**. |
| **Ventana 3** | **Caja Central** | `http://localhost:4200/login` *(Incógnito)* | Correo: `caja@tukuypaj.com` \| Clave: `caja123` ➔ Entrar a **Control de Caja**. |

---

### Escenario A: Cobro en Efectivo con Cambio Anticipado

1. **Creación de Comanda**:
   - En **Ventana 1 (Cliente)**, agrega un plato (ej. *Charque Entero* por Bs. 85.00) y confirma la orden.
   - En **Ventana 2 (Garzón)**, la **Mesa 1** pasa automáticamente a color ámbar (`OCUPADA`) y suena la campanilla de comanda nueva.
2. **Selección de Billete por el Comensal**:
   - En **Ventana 1 (Cliente)**, pulsa **"Pedir Cuenta"**. Selecciona **Efectivo** y elige el chip **"Billete de Bs. 100"**.
   - La pantalla muestra: *Pagas con: Bs. 100.00 — Tu garzón te traerá de cambio: Bs. 15.00*.
   - Pulsa **"CONFIRMAR PAGO EN EFECTIVO"**. Pasa al estado *"¡Garzón en Camino!"*.
3. **Aviso Anticipado al Garzón (Viaje Único)**:
   - En **Ventana 2 (Garzón)**, la tarjeta de la Mesa 1 parpadea en color dorado (`POR_COBRAR`) y muestra el pill:
     `💵 Mesa M01 paga en EFECTIVO con Bs. 100 — Llevar Bs. 15.00 de cambio`.
   - El garzón alista los Bs. 15.00 de cambio, acude a la mesa, recibe los Bs. 100.00 y lleva la recaudación a Caja.
4. **Cobro y Cuadratura en Caja**:
   - En **Ventana 3 (Cajero)**, abre la Mesa 1, verifica el monto (Bs. 85.00) con pago de Bs. 100.00 y pulsa **"Finalizar Cobro"**.
5. **Cierre Automático y Sincronizado**:
   - En **Ventana 1 (Cliente)**: Salta de inmediato a **"Cuenta Cancelada / Recibo Digital"** con ticket formal y temporizador de 45 segundos.
   - En **Ventana 2 (Garzón)**: La mesa pasa automáticamente a **`LIBRE` (verde)** en el mapa de salón.
   - En **Ventana 3 (Caja)**: Se actualizan los acumuladores de caja (`totalEfectivo` y `totalVentas`).

---

### Escenario B: Cobro por Código QR Bancario

1. **Selección de QR por el Comensal**:
   - En **Ventana 1 (Cliente)**, al pedir la cuenta selecciona **"Pago QR"**.
   - Se muestra el QR oficial de la mesa con el monto exacto (Bs. 85.00). Pulsa **"HE REALIZADO EL PAGO QR"**.
2. **Aviso al Garzón**:
   - En **Ventana 2 (Garzón)**, la tarjeta de mesa muestra el pill informativo:
     `📱 Mesa M01 pide cuenta — Pago por QR`.
   - El garzón sabe que la mesa cancelará por banca móvil y no necesita llevar cambio en efectivo.
3. **Validación en Caja**:
   - En **Ventana 3 (Cajero)**, corrobora la acreditación bancaria y finaliza el cobro con método **QR**.
   - Se emite el evento `pago:confirmado`, la pantalla del cliente se actualiza a **Recibo Digital Cancelado** y la mesa se libera instantáneamente en el salón.

---

## 14. Hoja de Ruta y Próximos Pasos Técnicos

Habiendo certificado la sincronización integral y el blindaje financiero, se definen las siguientes fases de evolución técnica:

1. **Servicio de Impresión Térmica ESC/POS (80mm)**:
   - Salida directa por socket TCP/USB a impresoras de cocina y caja para emitir la comanda culinaria física y la pre-cuenta de salón.
2. **Estado Operativo de Salón Post-Cobro (`POR_LIMPIAR`)**:
   - Transición visual de la mesa liberada a estado intermedio de desinfección antes de habilitarla para nuevos clientes.
3. **Implementación del Webhook Bancario Automático (Fase 2 QR)**:
   - Creación del controlador `POST /api/pagos/webhook-banco` con verificación de firma `HMAC-SHA256` para liquidación desatendida sin intervención de cajero.

---

## 15. Scripts del Monorepo

| Comando | Acción |
|---|---|
| `npm run dev` | **Inicia todo en paralelo**: Backend (3000) + Admin (4200) + Cliente (4201) |
| `npm run dev:backend` | Inicia exclusivamente el backend NestJS en modo watch |
| `npm run dev:frontend` | Inicia exclusivamente el panel administrativo de Angular (:4200) |
| `npm run dev:client` | Inicia exclusivamente la app del cliente (:4201) |
| `npm run build:backend` | Compila el backend a la carpeta `dist/` |
| `npm run build:frontend` | Compila el panel administrativo de Angular |
| `npm run build:client` | Compila la app móvil del cliente |
| `npm run db:generate` | Genera los binarios del cliente Prisma (`@prisma/client`) |
| `npm run db:migrate` | Ejecuta las migraciones de esquema en PostgreSQL |
| `npm run db:seed` | Carga la carta oficial, mesas y usuarios del restaurante |
| `npm run db:studio` | Abre **Prisma Studio** en el navegador para inspeccionar la base de datos |
| `npm run docker:up` | Levanta los contenedores de Postgres, Redis y pgAdmin |
| `npm run docker:down` | Detiene los contenedores Docker preservando la persistencia |
| `npm run docker:reset` | Reinicia la base de datos local limpiando los volúmenes |

---

## 16. Variables de Entorno (Actuales y Futuras del Banco)

Plantilla de referencia para `.env`:

```env
# ── Base de Datos PostgreSQL ──
POSTGRES_USER=sggi_admin
POSTGRES_PASSWORD=sggi_dev_2026
POSTGRES_DB=sggi_db
POSTGRES_PORT=5433
DATABASE_URL="postgresql://sggi_admin:sggi_dev_2026@127.0.0.1:5433/sggi_db?schema=public"

# ── Redis Cache & Pub/Sub ──
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL="redis://localhost:6379"

# ── pgAdmin 4 ──
PGADMIN_PORT=5050
PGADMIN_EMAIL=admin@sggi.dev
PGADMIN_PASSWORD=admin123

# ── Seguridad JWT ──
JWT_SECRET=sggi-dev-jwt-secret-change-in-production-2026
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=sggi-dev-refresh-secret-change-in-production-2026
JWT_REFRESH_EXPIRATION=7d

# ── Puertos de Servicios ──
BACKEND_PORT=3000
FRONTEND_PORT=4200
CLIENT_APP_PORT=4201
NODE_ENV=development

# ── Multimedia CDN (Cloudinary) ──
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_cloudinary_api_key
CLOUDINARY_API_SECRET=tu_cloudinary_api_secret

# ── Inteligencia Artificial Culinaria ──
GEMINI_API_KEY=tu_api_key_de_google_gemini_aqui

# ── CONFIGURACIÓN FUTURA: Integración Bancaria QR Simple (Fase 2) ──
# Variables reservadas para cuando la entidad bancaria o procesador provea la API oficial:
# BANK_API_URL="https://api.banco.com.bo/v1"
# BANK_MERCHANT_ID="TUKUYPAJ_REST_01"
# BANK_API_KEY="sec_live_bank_token_aqui"
# BANK_WEBHOOK_SECRET="whsec_hmac_sha256_firma_bancaria_super_secreta"
# BANK_EXPIRATION_MINUTES=15
```

---

## 17. Licencia

Este software es un proyecto privado y confidencial desarrollado a medida para **Peña Restaurant Tukuypaj** © 2026.  
Todos los derechos reservados.
