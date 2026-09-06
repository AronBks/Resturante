# 🍽️ SGGI — Sistema de Gestión Gastronómica Inteligente

> **Peña Restaurant Tukuypaj** — Cochabamba, Bolivia  
> Plataforma omnicanal de alta fidelidad para la digitalización operativa integral: carta digital interactiva, asistente IA, comanda en sala, monitor de cocina, facturación electrónica y control de caja en tiempo real.

---

## 📑 Tabla de Contenidos

- [Descripción General](#-descripción-general)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Stack Tecnológico](#-stack-tecnológico)
- [Mapa de Puertos y Servicios](#-mapa-de-puertos-y-servicios)
- [Ecosistema de Módulos](#-ecosistema-de-módulos)
  - [1. App del Cliente (Carta Digital & Auto-atención)](#1-app-del-cliente-carta-digital--auto-atención)
  - [2. Panel Administrativo & POS de Salón](#2-panel-administrativo--pos-de-salón)
  - [3. Display de Cocina en Tiempo Real](#3-display-de-cocina-en-tiempo-real)
  - [4. Módulo de Facturación & Control de Caja](#4-módulo-de-facturación--control-de-caja)
- [Lógica de Negocio: Horarios y Turnos](#-lógica-de-negocio-horarios-y-turnos)
- [Eventos WebSocket en Tiempo Real](#-eventos-websocket-en-tiempo-real)
- [Diseño y Experiencia Visual](#-diseño-y-experiencia-visual)
- [Guía de Instalación y Despliegue](#-guía-de-instalación-y-despliegue)
- [Scripts del Monorepo](#-scripts-del-monorepo)
- [Variables de Entorno](#-variables-de-entorno)
- [Estructura del Repositorio](#-estructura-del-repositorio)
- [Licencia](#-licencia)

---

## 📋 Descripción General

**SGGI** (Sistema de Gestión Gastronómica Inteligente) es una solución integral full-stack concebida para modernizar y optimizar la experiencia culinaria y operativa de la **Peña Restaurant Tukuypaj**.

El sistema sincroniza en milisegundos a todos los actores del restaurante:
1. **Comensales**: Exploran la carta desde sus dispositivos móviles mediante códigos QR en las mesas, interactúan con el asistente inteligente "Don Beto", ordenan platos y bebidas, solicitan atención del garzón y efectúan el pago vía QR o efectivo.
2. **Garzones / Meseros**: Monitorean el salón en un plano interactivo interactivo, reciben alertas en vivo de llamadas a mesero, despachan platos y gestionan comandas desde tablets o terminales.
3. **Cocina (Chefs)**: Visualizan comandas organizadas por orden de llegada con tiempos transcurridos, gestionando el ciclo de vida de cada plato (`PENDIENTE` ➔ `EN_PREPARACION` ➔ `LISTO` ➔ `SERVIDO`).
4. **Caja y Administración**: Controlan aperturas y arqueos de caja, procesan pagos, emiten facturas PDF con QR tributario oficial, envían recibos por WhatsApp y analizan KPIs de ventas del día.

---

## 🏗️ Arquitectura del Monorepo

El proyecto está orquestado como un **Monorepo NPM Workspaces** en TypeScript, garantizando coherencia de tipos y contratos de API compartidos entre frontend y backend:

```
Restaurante/
├── backend/                   # API RESTful, WebSockets Gateway y ORM (NestJS)
├── frontend/                  # Espacio de trabajo Angular 19
│   ├── src/                   # Aplicación 1: Panel Administrativo & POS Salón
│   └── projects/
│       └── client-app/        # Aplicación 2: App Móvil del Cliente (Carta Digital)
├── packages/
│   └── shared/                # Contratos, Enums, DTOs e Interfaces compartidas
├── docker/                    # Scripts de aprovisionamiento de PostgreSQL
├── docker-compose.yml         # Contenedores para PostgreSQL 16, Redis 7 y pgAdmin 4
└── package.json               # Scripts unificados de ejecución concurrently
```

---

## ⚙️ Stack Tecnológico

| Capa | Tecnologías | Descripción |
|---|---|---|
| **Backend Framework** | NestJS 11 | Arquitectura modular orientada a servicios, inyección de dependencias |
| **Lenguaje** | TypeScript 5.7+ | Tipado estricto end-to-end compartido en todo el monorepo |
| **Base de Datos** | PostgreSQL 16 | Motor relacional con soporte para Docker local y Supabase Pooler |
| **ORM** | Prisma ORM 6.9+ | Modelado de datos declarativo, migraciones y seeders automáticos |
| **Caché & Sesiones** | Redis 7 Alpine | Almacenamiento rápido en memoria y cola de mensajería Pub/Sub |
| **WebSockets** | Socket.IO 4.7+ | Comunicación bidireccional reactiva para sala, cocina y pedidos |
| **Inteligencia Artificial** | Google Gemini API | Asistente gastronómico conversacional multi-turno ("Don Beto") |
| **Seguridad & Auth** | JWT + Passport + Bcrypt | Autenticación basada en tokens, control de acceso RBAC |
| **Frontend Core** | Angular 19 (Standalone) | Componentes autónomos, reactividad con Angular Signals y Zoneless-ready |
| **Diseño & UI** | Vanilla SCSS + Lucide | Sistema de diseño obsidian-gold de lujo, glassmorphism e iconos vectoriales |
| **Multimedia CDN** | Cloudinary CDN | Entrega de imágenes optimizadas en alta definición para platos y bebidas |
| **Documentos & Facturas** | jsPDF + QRCode | Generación de facturas electrónicas PDF y códigos QR tributarios |
| **Contenedores** | Docker & Docker Compose | Aprovisionamiento local reproducible de base de datos y herramientas |

---

## 🌐 Mapa de Puertos y Servicios

Cuando ejecutas el entorno de desarrollo completo, los servicios quedan disponibles en las siguientes direcciones:

| Servicio | Puerto Local | URL | Descripción |
|---|:---:|---|---|
| 📱 **Carta Digital (Cliente)** | `4201` | [http://localhost:4201](http://localhost:4201) | Menú móvil interactivo, carrito, asistente Don Beto y cobro |
| 🖥️ **Panel Administrativo (POS)** | `4200` | [http://localhost:4200](http://localhost:4200) | Dashboard de control, plano de mesas, cocina y caja |
| 🔧 **API REST & WebSockets** | `3000` | [http://localhost:3000/api](http://localhost:3000/api) | Servidor NestJS y gateway de sockets |
| 🗄️ **pgAdmin 4** | `5050` | [http://localhost:5050](http://localhost:5050) | Administrador visual de base de datos PostgreSQL |
| 🐘 **PostgreSQL (Local Docker)** | `5432` / `5433` | `localhost:5432` | Base de datos relacional (o puerto 6543 en Supabase) |
| ⚡ **Redis Cache** | `6379` | `localhost:6379` | Servidor Redis para pub/sub y caché |

---

## ✨ Ecosistema de Módulos

### 1. App del Cliente (Carta Digital & Auto-atención)

*Acceso desde dispositivo móvil vía QR de mesa (`http://localhost:4201/?mesa=1`)*

- **Landing Hero de Bienvenida**: Diseño "Lujo Nocturno" con detección y persistencia de mesa asignada en `localStorage`.
- **Menú Digital Reactivo**:
  - Catálogo categorizado con imágenes culinarias HD alojadas en Cloudinary.
  - Formato de pedestal y silueta transparente sin recuadros toscos para bebidas embotelladas.
  - Indicadores de estado en tiempo real (badges verdes "Disponible ahora" o naranjas con el horario programado).
  - Selector de variantes de platos (Entero, Medio, Especial) con recálculo dinámico de precios.
- **Asistente Culinario IA ("Don Beto")**:
  - Desarrollado sobre Google Gemini.
  - Toma pedidos en lenguaje natural conversacional, clarifica preferencias, confirma cantidades y envía la comanda automáticamente al sistema.
- **Carrito de Compras**:
  - Control de notas personalizadas por ítem (e.g. *"sin locoto"*, *"bien cocido"*).
  - Agrupación inteligente y desglose del total.
- **Llamar al Garzón en Tiempo Real**:
  - Botón flotante accesible en todo momento para pedir asistencia.
  - Selección de motivo predeterminado (Atención general, servilletas, cubiertos, etc.).
  - Banner de confirmación en pantalla: *"¡Garzón en camino a tu mesa!"* una vez que el mesero pulsa "Atender".
- **Cierre de Cuenta & Métodos de Pago**:
  - **Pago Simple QR / BNB**: Muestra el código QR bancario oficial con descarga inmediata y opción para adjuntar comprobante.
  - **Pago en Efectivo**: Notifica al instante a caja y al garzón para cobrar en mesa.
  - **Recibo Digital en Vivo**: Visualización cinematográfica del detalle consumido, desglose de impuestos/propina y estado de confirmación.

---

### 2. Panel Administrativo & POS de Salón

*Acceso para el personal operativo (`http://localhost:4200`)*

- **Plano Interactivo del Salón**:
  - Representación gráfica de todas las mesas del restaurante.
  - Estados sincronizados en tiempo real: `LIBRE`, `OCUPADA`, `POR_COBRAR`.
  - Alerta visual dorada parpadeante cuando una mesa solicita la cuenta en efectivo.
  - Indicador de campana de llamado activo con botón directo **"Atender Mesero"**.
- **Comanda Drawer Avanzado**:
  - Apertura lateral táctil al seleccionar cualquier mesa.
  - Búsqueda instantánea de platos con imágenes oficiales.
  - Edición flexible de comandas en sala (inclusión de platos fuera de horario de cocina regular con autorización de mesero).
  - Tiempos reales transcurridos desde la emisión de cada orden.
  - Botón de cobro rápido integrado al módulo de caja.
- **Gestión de la Carta**:
  - Administración de platos, categorías, precios de venta y variantes.
  - Configuración de franjas horarias de servicio por plato.
  - Toggle de disponibilidad inmediata (agotado / activo).
- **Gestión del Equipo de Trabajo (Usuarios & RBAC)**:
  - Creación y edición de personal con roles estrictos: `ADMIN`, `MESERO`, `CHEF`, `CAJERO`.
  - Validaciones de integridad: protección contra auto-eliminación o degradación de la cuenta con la que se inició sesión.

---

### 3. Display de Cocina en Tiempo Real

- Vista de alta visibilidad para pantallas táctiles en la zona de cocina.
- Monitor de comandas en orden cronológico (FIFO).
- Control granular por plato: de `PENDIENTE` a `EN_PREPARACION` y `LISTO`.
- Acción masiva **"Servir todos los ítems"** para agilizar la entrega de mesas completas.
- Alertas sonoras y visuales automáticas al ingresar nuevas comandas desde clientes o meseros.

---

### 4. Módulo de Facturación & Control de Caja

- **Gestión de Turnos de Caja**:
  - Apertura con monto inicial, control continuo y arqueo ciego al cierre.
  - Sincronización de eventos de caja vía WebSockets (`caja:cerrada`, `transaccion:creada`).
- **Cobro Seguro & Emisión de Comprobantes**:
  - Desbloqueo en vivo del recibo del cliente al procesar el pago en caja.
  - Modal interactivo con cálculo automático de cambio según el efectivo recibido.
- **Facturación Digital Tributaria**:
  - Generación en cliente de **Factura PDF oficial** con código QR normativo y código de control.
  - Botón directo para compartir el comprobante / factura a través de la API de **WhatsApp Web** (`wa.me`) con mensaje personalizado al cliente.

---

## ⏰ Lógica de Negocio: Horarios y Turnos

El restaurante opera con una carta adaptada por franjas horarias tradicionales de Cochabamba, controlada a nivel de modelo de datos (`hora_inicio`, `hora_fin`):

```
       09:00                               13:00                 17:00
         │                                   │                     │
Caldos:  ├───────────────────────────────────┤                     │ (09:00 - 13:00)
         │  Kawi, Caldo de Cola, Riñón,      │                     │
         │  Chanka de Pollo, Pulpitos...     │                     │
         │                                   │                     │
Platos:  │                             12:00 ├─────────────────────┤ (12:00 - 17:00)
         │                                   │ Pique, Charque,     │
         │                                   │ Planchita, Matambre,│
         │                                   │ Lapping, Pampaku... │
         │                                                         │
Bebidas: ├─────────────────────────────────────────────────────────┤ (Todo el día)
         │ Refrescos, Jugos, Cervezas, Aguas...                    │
```

- **En la App del Cliente**: Si un plato está fuera de horario, se muestra un badge naranja informativo y se deshabilita la adición directa para evitar fricción en cocina.
- **En el POS Administrativo**: El garzón o cajero dispone de la flexibilidad de registrar cualquier ítem ante solicitudes especiales autorizadas.

---

## 🔔 Eventos WebSocket en Tiempo Real

El sistema utiliza un Gateway WebSocket en NestJS con salas y eventos tipados compartidos en `@sggi/shared`:

| Evento Socket | Emisor | Receptores | Acción Operativa |
|---|---|---|---|
| `pedido:creado` | App Cliente / Admin | Salón, Cocina, Caja | Ingresa comanda a cola de cocina |
| `pedido:ia-creado` | Asistente Don Beto | Salón, Cocina, Caja | Notifica comanda completada por IA |
| `pedido:estado-actualizado`| Cocina / Mesero | Salón, App Cliente | Actualiza progreso de plato/mesa |
| `mesa:estado-actualizado`  | Backend / Mesero | Salón, Caja | Cambia estado visual (Libre / Ocupada / Cobro) |
| `mesero:llamado`           | App Cliente | Panel Meseros / Admin | Dispara alerta sonora y visual en plano de salón |
| `mesero:atendido`          | Mesero (Panel) | App Cliente | Muestra banner flotante: *"Garzón en camino"* |
| `pago:solicitado`          | App Cliente | Panel Meseros / Caja | Marca mesa en estado `POR_COBRAR` (alerta dorada) |
| `transaccion:creada`       | Caja | Dashboard, Salón | Registra cobro y libera la mesa |
| `menu:actualizado`         | Admin Carta | App Cliente, Salón | Refresca catálogo y disponibilidad al instante |

---

## 🎨 Diseño y Experiencia Visual

El sistema fue diseñado bajo la filosofía **"Gold & Obsidian"**, una identidad visual que evoca la tradición y elegancia de la peña gastronómica:

- **Fondo Base**: Negro obsidiana profundo (`#0d0c0a` / `#14120e`).
- **Acento Dorado Primario**: Oro envejecido y oro brillante (`#e5c158` / `#d4af37`).
- **Contraste y Superficies**: Glassmorphism con bordes sutiles en `rgba(229, 193, 88, 0.15)`.
- **Tipografía**: Combinación de `Playfair Display` (elegancia de títulos gastronómicos) con `Inter` (máxima legibilidad en números y comandas táctiles).
- **Iconografía**: Iconos vectoriales consistentes mediante `lucide-angular`.

---

## 🚀 Guía de Instalación y Despliegue

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

---

### Paso 2: Configuración de Variables de Entorno

Copia el archivo de ejemplo en la raíz del proyecto:

```bash
cp .env.example .env
```

> [!NOTE]
> Revisa el archivo `.env` para verificar tu conexión a base de datos (PostgreSQL en Docker local o conexión a Supabase Pooler).

---

### Paso 3: Levantar los Contenedores (Base de Datos & Redis)

```bash
npm run docker:up
```

*Esto iniciará PostgreSQL 16 (puerto 5432), Redis 7 (puerto 6379) y pgAdmin 4 (puerto 5050).*

---

### Paso 4: Instalar Dependencias

```bash
npm install
```

---

### Paso 5: Preparar la Base de Datos con Prisma

```bash
# 1. Generar los tipos del cliente Prisma
npm run db:generate

# 2. Ejecutar las migraciones de esquema
npm run db:migrate

# 3. Cargar la carta oficial, mesas y usuarios iniciales
npm run db:seed
```

---

### Paso 6: Iniciar el Ecosistema Completo

Ejecuta el script unificado que levanta los 3 entornos en paralelo:

```bash
npm run dev
```

> [!TIP]
> Una vez iniciado, ingresa a:
> - 📱 **App del Cliente**: [http://localhost:4201](http://localhost:4201) *(prueba agregando `?mesa=1`)*
> - 🖥️ **Panel Administrativo**: [http://localhost:4200](http://localhost:4200)
> - 🔧 **API Backend**: [http://localhost:3000](http://localhost:3000)

---

## 📜 Scripts del Monorepo

| Comando | Descripción |
|---|---|
| `npm run dev` | **Inicia todo en paralelo**: Backend (3000) + Admin (4200) + Cliente (4201) |
| `npm run dev:backend` | Inicia exclusivamente el servidor NestJS en modo watch |
| `npm run dev:frontend` | Inicia exclusivamente el panel administrativo de Angular (:4200) |
| `npm run dev:client` | Inicia exclusivamente la carta digital del cliente (:4201) |
| `npm run build:backend` | Compila el backend de NestJS a la carpeta `dist/` |
| `npm run build:frontend` | Compila el panel administrativo de Angular a `dist/` |
| `npm run build:client` | Compila la app móvil del cliente a `dist/client-app` |
| `npm run db:generate` | Genera los binarios del cliente Prisma (`@prisma/client`) |
| `npm run db:migrate` | Aplica migraciones pendientes sobre la base de datos |
| `npm run db:seed` | Ejecuta el seeder con la carta real y usuarios de prueba |
| `npm run db:studio` | Abre **Prisma Studio** en el navegador para explorar la base de datos |
| `npm run docker:up` | Levanta los contenedores Docker (Postgres, Redis, pgAdmin) |
| `npm run docker:down` | Detiene los contenedores Docker preservando los volúmenes |
| `npm run docker:reset` | Reinicia la base de datos local limpiando volúmenes |

---

## 🔐 Usuarios y Credenciales de Acceso

El script de seed (`npm run db:seed`) inicializa los siguientes perfiles de prueba:

| Rol | Correo / Usuario | Contraseña | Permisos y Destino |
|---|---|:---:|---|
| **ADMIN** | `admin@tukuypaj.com` | `admin123` | Acceso irrestricto a todo el sistema y configuración |
| **MESERO** | `mesero@tukuypaj.com` | `mesero123` | Mapa de salón, apertura y despacho de comandas |
| **CHEF** | `cocina@tukuypaj.com` | `cocina123` | Visualizador de pedidos y cambio de estados en cocina |
| **CAJERO** | `caja@tukuypaj.com` | `caja123` | Control de caja, transacciones y facturación |

---

## 🗂️ Estructura del Repositorio

```
Restaurante/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # Esquema relacional (Plato, Pedido, Mesa, Caja, etc.)
│   │   └── seed.ts              # Carta real oficial, variantes y credenciales
│   └── src/
│       ├── modules/
│       │   ├── auth/            # Autenticación JWT, guards y estrategias
│       │   ├── usuarios/        # Control de personal con validaciones y RBAC
│       │   ├── mesas/           # Gestión de mesas y estados del salón
│       │   ├── carta/           # CRUD de platos, filtros de horarios y Cloudinary
│       │   ├── pedidos/         # Gateway de comandas y asistente IA Gemini
│       │   ├── caja/            # Arqueo de turnos, pagos y facturas
│       │   └── analitica/       # Métricas de ventas y reportes diarios
│       └── main.ts              # Punto de entrada NestJS y configuración CORS
│
├── frontend/
│   ├── src/app/features/        # Panel Administrativo (Angular 19 Standalone)
│   │   ├── overview/            # Dashboard con KPIs y feed en directo
│   │   ├── mesas/               # Plano interactivo, comanda drawer y alertas de salón
│   │   ├── cocina/              # Pantalla KDS (Kitchen Display System)
│   │   ├── carta/               # Administración visual del menú y precios
│   │   ├── control-caja/        # Caja registradora, cobros y arqueos
│   │   └── usuarios/            # Administración del equipo con protección de cuentas
│   └── projects/client-app/     # App del Cliente (Móvil / QR)
│       └── src/app/components/
│           ├── landing-hero/    # Bienvenida con persistencia de mesa
│           ├── menu-digital/    # Carta digital HD con badges de horario
│           ├── ia-comanda/      # Asistente conversacional "Don Beto"
│           ├── chat-mesero/     # Alertas y llamada al garzón
│           ├── carrito-drawer/  # Resumen de pedido y notas de preparación
│           └── cierre-cuenta/   # Flujo de pago QR/Efectivo y factura PDF
│
└── packages/shared/             # Código compartido entre Backend y Frontend
    └── src/
        ├── enums/               # EstadoPedido, EstadoMesa, MetodoPago, etc.
        └── interfaces/          # Interfaces TypeScript compartidas
```

---

## 📄 Licencia

Este proyecto es propiedad privada y confidencial desarrollada para **Peña Restaurant Tukuypaj** © 2026.  
Todos los derechos reservados.
