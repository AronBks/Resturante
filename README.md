# 🍽️ SGGI — Sistema de Gestión Gastronómica Inteligente

> **Peña Restaurant Tukuypaj** — Cochabamba, Bolivia  
> Plataforma digital completa para la gestión operativa de un restaurante: pedidos, cocina, caja y experiencia del cliente en tiempo real.

---

## 📋 Descripción General

**SGGI** es un sistema de gestión gastronómica full-stack desarrollado para modernizar la operación del restaurante **Tukuypaj**. Integra un **panel administrativo para el personal** con una **aplicación móvil para los clientes**, conectados en tiempo real mediante WebSockets.

La plataforma digitaliza todo el flujo operacional: desde que el cliente explora la carta y hace su pedido, hasta que el chef lo prepara, el garzón lo sirve y el cajero procesa el cobro.

---

## 🏗️ Arquitectura del Monorepo

```
Restaurante/
├── backend/              # API REST + WebSockets (NestJS)
├── frontend/
│   ├── src/              # Panel Administrativo (Angular 19)
│   └── projects/
│       └── client-app/   # App Móvil del Cliente (Angular 19)
├── packages/
│   └── shared/           # Tipos y DTOs compartidos (TypeScript)
├── docker-compose.yml
└── package.json          # Scripts de monorepo (NPM Workspaces)
```

---

## ⚙️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Backend** | NestJS 11, TypeScript, Prisma ORM |
| **Base de Datos** | PostgreSQL 16 |
| **Caché / Pub-Sub** | Redis 7 |
| **WebSockets** | Socket.IO |
| **IA (Asistente)** | Google Gemini API |
| **Autenticación** | JWT + Refresh Tokens |
| **Frontend Admin** | Angular 19, Signals, SCSS |
| **App Móvil Cliente** | Angular 19 (client-app project) |
| **Iconografía** | Lucide Angular |
| **Infraestructura** | Docker, Docker Compose |

---

## ✨ Funcionalidades Principales

### 👤 App del Cliente (Puerto 4300)

| Módulo | Descripción |
|---|---|
| **Carta Digital** | Menú visual con categorías, fotos y variantes de platos |
| **Asistente IA "Don Beto"** | Pedidos por lenguaje natural con confirmación conversacional multi-turno |
| **Carrito Inteligente** | Gestión de pedidos con resumen y cálculo en tiempo real |
| **Llamar al Mesero** | Notificación instantánea al panel administrativo vía WebSocket |
| **Pago por QR** | Muestra el código QR bancario del restaurante (Simple QR / BNB), permite descargarlo y subir el comprobante de pago |
| **Pago en Efectivo** | Notifica en tiempo real a caja y garzón que la mesa solicita ser cobrada |
| **Recibo Digital** | Vista de recibo premium en variante Cinematográfica o Minimalista |
| **Feedback** | Calificación de la experiencia con estrellas y categorías |

### 🖥️ Panel Administrativo (Puerto 4200)

| Módulo | Descripción |
|---|---|
| **Dashboard / Overview** | KPIs en vivo: ventas del día, ocupación, comandas activas |
| **Gestión de Mesas** | Plano del salón con estados en tiempo real (Libre / Ocupada / Por Cobrar) |
| **Comanda Drawer** | Toma y edición de pedidos por mesa con cálculo de cuenta |
| **Display de Cocina** | Vista dedicada para chefs con estados por ítem de pedido |
| **Carta / Menú** | CRUD de platos, categorías, variantes de precio y disponibilidad |
| **Control de Caja** | Apertura, monitoreo en tiempo real, arqueo y cierre de caja |
| **Historial de Transacciones** | Registro del día con filtros por método de pago y búsqueda |
| **Gestión de Usuarios** | Alta de personal con roles diferenciados (RBAC) |

### 🔔 Eventos WebSocket en Tiempo Real

| Evento | Emitido por | Recibido por |
|---|---|---|
| `pedido:creado` | Backend | Admin, Mesero, Chef |
| `pedido:ia-creado` | Backend (IA) | Admin, Mesero, Chef |
| `pedido:estado-actualizado` | Backend | Admin, Mesero, Cajero |
| `mesa:estado-actualizado` | Backend | Admin, Mesero, Cajero |
| `mesero:llamado` | Cliente → Backend | Admin, Mesero |
| `mesero:atendido` | Admin → Backend | App Cliente |
| `transaccion:creada` | Backend | Admin, Cajero |
| `caja:cerrada` | Backend | Admin, Cajero |

---

## 🚀 Puesta en Marcha

### Requisitos Previos

- **Node.js** >= 22.0.0
- **npm** >= 10.0.0
- **Docker Desktop** (para PostgreSQL y Redis)

### 1. Clonar el Repositorio

```bash
git clone https://github.com/AronBks/Resturante.git
cd Resturante
```

### 2. Configurar Variables de Entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales antes de continuar
```

### 3. Levantar la Base de Datos

```bash
npm run docker:up
```

### 4. Instalar Dependencias

```bash
npm install
```

### 5. Inicializar la Base de Datos

```bash
npm run db:generate    # Genera el cliente Prisma
npm run db:migrate     # Aplica las migraciones
npm run db:seed        # Carga datos iniciales (admin, mesas, carta base)
```

### 6. Iniciar el Proyecto Completo

```bash
npm run dev:all
```

| Servicio | URL |
|---|---|
| 🔧 API Backend | http://localhost:3000 |
| 🖥️ Panel Administrativo | http://localhost:4200 |
| 📱 App Móvil Cliente | http://localhost:4300 |
| 🗄️ pgAdmin | http://localhost:5050 |

---

## 📜 Scripts Disponibles

```bash
npm run dev:all        # Levanta Backend + Admin + Cliente simultáneamente
npm run dev            # Backend + Admin solamente
npm run dev:backend    # Solo el servidor NestJS
npm run dev:client     # Solo la app móvil del cliente

npm run db:generate    # Genera el cliente Prisma
npm run db:migrate     # Aplica las migraciones
npm run db:seed        # Carga datos de prueba
npm run db:studio      # Prisma Studio (explorador visual de BD)

npm run docker:up      # Levantar contenedores (PostgreSQL + Redis + pgAdmin)
npm run docker:down    # Detener los contenedores
npm run docker:reset   # Reiniciar BD desde cero (⚠️ borra todos los datos)
```

---

## 🔐 Roles de Usuario

| Rol | Permisos |
|---|---|
| `ADMIN` | Acceso completo al panel |
| `MESERO` | Salón, mesas y gestión de comandas |
| `CHEF` | Display de cocina |
| `CAJERO` | Control de caja y transacciones |
| `IA` | Usuario interno del asistente Don Beto |

---

## 🗂️ Estructura del Proyecto

### Backend — `backend/src/modules/`

```
├── auth/        # Login, JWT, refresh tokens
├── usuarios/    # CRUD del personal con RBAC
├── mesas/       # Gestión de mesas y estados del salón
├── carta/       # Platos, categorías, variantes de precio
├── pedidos/     # Comandas, asistente IA, notificaciones de pago
├── caja/        # Transacciones, apertura y cierre de caja
└── analitica/   # KPIs y resúmenes del día para el dashboard
```

### Frontend Admin — `frontend/src/app/features/`

```
├── overview/       # Dashboard con KPIs y feed de actividad en vivo
├── mesas/          # Plano del salón interactivo
├── cocina/         # Display de cocina para chefs
├── carta/          # Gestión de menú y disponibilidad
├── control-caja/   # Caja registradora con arqueo
└── usuarios/       # Gestión del equipo de trabajo
```

### App Cliente — `frontend/projects/client-app/src/app/components/`

```
├── landing-hero/     # Pantalla de bienvenida del restaurante
├── menu-digital/     # Carta digital interactiva
├── carrito-drawer/   # Carrito con resumen del pedido
├── ia-comanda/       # Asistente conversacional Don Beto
├── chat-mesero/      # Llamada y chat con el mesero
└── cierre-cuenta/    # Flujo de pago (QR, efectivo, recibo, calificación)
```

---

## 🎨 Diseño y Estética

El sistema aplica una paleta **"Gold & Obsidian"** coherente en todas las interfaces:

- **Fondo**: Negro obsidiana `#12100d`
- **Acento dorado**: `#e5c158` / `#d4af37`
- **Tipografía**: Playfair Display (serif) + Inter (sans-serif)
- **Estilo**: Glassmorphism, gradientes dorados, micro-animaciones, modo oscuro nativo

---

## 🤖 Asistente IA — Don Beto

Don Beto es el asistente de pedidos integrado en la app del cliente. Utiliza **Google Gemini** con conversación multi-turno que mantiene el contexto completo de la comanda.

```
Cliente: "Quiero un chicharrón y dos mocochinchis por favor"
Don Beto: "¡Claro! ¿Confirmo: Chicharrón de Cerdo (Bs. 85) 
           y Mocochinchi x2 (Bs. 20)? Total: Bs. 105."
```

Una vez confirmado, el pedido se registra directamente en el sistema y llega en tiempo real a la cocina y al panel administrativo.

---

## 📄 Licencia

Proyecto privado — Peña Restaurant Tukuypaj © 2026
