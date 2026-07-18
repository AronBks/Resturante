import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CrearPedidoItemDto {
  @IsUUID()
  @IsNotEmpty()
  platoId: string;

  @IsUUID()
  @IsOptional()
  varianteId?: string;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsString()
  @IsOptional()
  notas?: string;
}

export class CrearPedidoDto {
  @IsInt()
  @IsNotEmpty()
  mesaId: number;

  @IsString()
  @IsOptional()
  notas?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearPedidoItemDto)
  items: CrearPedidoItemDto[];
}

export class ActualizarItemEstadoDto {
  @IsString()
  @IsNotEmpty()
  estado: string; // EstadoItemPedido: PENDIENTE, PREPARANDO, LISTO, ENTREGADO, CANCELADO
}

export class ActualizarPedidoEstadoDto {
  @IsString()
  @IsNotEmpty()
  estado: string; // EstadoPedido: ABIERTO, EN_COCINA, LISTO, ENTREGADO, CANCELADO
}
