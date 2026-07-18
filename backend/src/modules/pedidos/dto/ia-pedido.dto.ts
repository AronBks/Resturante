import { IsString, IsNotEmpty, IsArray, ValidateNested, IsInt, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

// ── Solicitud de interpretación por IA ──
export class InterpretarPedidoIaDto {
  @IsString()
  @IsNotEmpty()
  texto: string;

  @IsString()
  @IsNotEmpty()
  mesaNumero: string;
}

// ── Item interpretado por la IA (devuelto al cliente) ──
export class ItemInterpretadoDto {
  @IsString()
  @IsNotEmpty()
  platoId: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsString()
  @IsOptional()
  notas?: string;

  precioUnitario: number;
}

// ── Confirmación del pedido por el cliente ──
export class ConfirmarPedidoIaItemDto {
  @IsString()
  @IsNotEmpty()
  platoId: string;

  @IsString()
  @IsOptional()
  varianteId?: string;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsString()
  @IsOptional()
  notas?: string;
}

export class ConfirmarPedidoIaDto {
  @IsString()
  @IsNotEmpty()
  mesaNumero: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmarPedidoIaItemDto)
  items: ConfirmarPedidoIaItemDto[];
}
