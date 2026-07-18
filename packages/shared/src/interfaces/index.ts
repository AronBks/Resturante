// ============================================================
// SGGI — Interfaces del Dominio
// Contratos tipados para comunicación entre capas.
// ============================================================

import {
  RolUsuario,
  EstadoMesa,
  EstadoPedido,
  EstadoItemPedido,
  UnidadMedida,
  MetodoPago,
  EstadoCaja,
  TipoMovimientoInventario,
} from '../enums';

// ── Usuarios ──

export interface IUsuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt: Date;
}

// ── Mesas ──

export interface IPosicionMesa {
  x: number;
  y: number;
  rotacion?: number;
}

export interface IMesa {
  id: number;
  numero: string;
  capacidad: number;
  estado: EstadoMesa;
  posicion: IPosicionMesa;
}

// ── Carta ──

export interface ICategoriaPlato {
  id: number;
  nombre: string;
  descripcion?: string;
  orden: number;
}

export interface IPlato {
  id: string;
  nombre: string;
  descripcion?: string;
  precioVenta: number;
  imagenUrl?: string;
  disponible: boolean;
  categoriaId: number;
  costoReceta: number;
  createdAt: Date;
}

// ── Inventario ──

export interface IIngrediente {
  id: string;
  nombre: string;
  unidadMedida: UnidadMedida;
  stockActual: number;
  umbralMinimo: number;
  umbralCritico: number;
  precioUnitario: number;
}

export interface IRecetaDetalle {
  id: string;
  platoId: string;
  ingredienteId: string;
  cantidadRequerida: number;
  unidad: UnidadMedida;
}

// ── Pedidos ──

export interface IPedido {
  id: string;
  mesaId: number;
  meseroId: string;
  estado: EstadoPedido;
  subtotal: number;
  total: number;
  notas?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDetallePedido {
  id: string;
  pedidoId: string;
  platoId: string;
  cantidad: number;
  precioUnitario: number;
  notas?: string;
  estadoItem: EstadoItemPedido;
  createdAt: Date;
}

// ── Caja ──

export interface ICaja {
  id: string;
  usuarioId: string;
  montoApertura: number;
  montoCierre?: number;
  totalVentas: number;
  totalEfectivo: number;
  totalTarjeta: number;
  apertura: Date;
  cierre?: Date;
  estado: EstadoCaja;
}

export interface ITransaccion {
  id: string;
  cajaId: string;
  pedidoId: string;
  monto: number;
  metodoPago: MetodoPago;
  cambio: number;
  createdAt: Date;
}

// ── Inventario Movimientos ──

export interface IMovimientoInventario {
  id: string;
  ingredienteId: string;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  stockResultante: number;
  referencia?: string;
  usuarioId: string;
  createdAt: Date;
}

// ── WebSocket Events ──

export interface IWsEventoPedido {
  evento: 'pedido:creado' | 'pedido:actualizado' | 'pedido:cancelado';
  pedidoId: string;
  mesaId: number;
  estado: EstadoPedido;
  timestamp: Date;
}

export interface IWsEventoInventario {
  evento: 'inventario:alerta' | 'inventario:agotado';
  ingredienteId: string;
  ingredienteNombre: string;
  stockActual: number;
  nivel: string;
  timestamp: Date;
}

// ── Carta Pública (Client-App — Menú Digital) ──

export interface IPlatoPublico {
  id: string;
  nombre: string;
  descripcion?: string;
  precioVenta: number;
  imagenUrl?: string;
}

export interface ICategoriaPublica {
  id: number;
  nombre: string;
  descripcion?: string;
  platos: IPlatoPublico[];
}

// ── WebSocket Eventos Públicos ──

export interface IWsEventoDisponibilidad {
  evento: 'plato:disponibilidad-actualizada';
  platoId: string;
  disponible: boolean;
  timestamp: Date;
}
