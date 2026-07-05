// ============================================================
// SGGI — Enums del Dominio
// Fuente de verdad compartida entre backend y frontend.
// ============================================================

/** Roles del sistema con permisos jerárquicos */
export enum RolUsuario {
  ADMIN = 'ADMIN',
  CAJERO = 'CAJERO',
  MESERO = 'MESERO',
  CHEF = 'CHEF',
}

/** Estados de una mesa en el mapa del restaurante */
export enum EstadoMesa {
  LIBRE = 'LIBRE',
  OCUPADA = 'OCUPADA',
  RESERVADA = 'RESERVADA',
  POR_COBRAR = 'POR_COBRAR',
}

/** Ciclo de vida de un pedido completo */
export enum EstadoPedido {
  ABIERTO = 'ABIERTO',
  EN_COCINA = 'EN_COCINA',
  LISTO = 'LISTO',
  ENTREGADO = 'ENTREGADO',
  CANCELADO = 'CANCELADO',
}

/** Estado individual de cada ítem dentro de un pedido */
export enum EstadoItemPedido {
  PENDIENTE = 'PENDIENTE',
  PREPARANDO = 'PREPARANDO',
  LISTO = 'LISTO',
  ENTREGADO = 'ENTREGADO',
  CANCELADO = 'CANCELADO',
}

/** Unidades de medida para ingredientes del inventario */
export enum UnidadMedida {
  KG = 'KG',
  G = 'G',
  L = 'L',
  ML = 'ML',
  UNIDAD = 'UNIDAD',
}

/** Tipos de movimiento en el inventario (Event Sourcing simplificado) */
export enum TipoMovimientoInventario {
  ENTRADA = 'ENTRADA',
  SALIDA_VENTA = 'SALIDA_VENTA',
  SALIDA_MERMA = 'SALIDA_MERMA',
  AJUSTE = 'AJUSTE',
}

/** Métodos de pago aceptados */
export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  TARJETA = 'TARJETA',
  QR = 'QR',
  MIXTO = 'MIXTO',
}

/** Estado del turno de caja */
export enum EstadoCaja {
  ABIERTA = 'ABIERTA',
  CERRADA = 'CERRADA',
}

/** Niveles de alerta para inventario */
export enum NivelAlertaInventario {
  NORMAL = 'NORMAL',
  BAJO = 'BAJO',
  CRITICO = 'CRITICO',
  AGOTADO = 'AGOTADO',
}
