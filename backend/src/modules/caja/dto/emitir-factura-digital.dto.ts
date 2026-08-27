import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  Min,
} from 'class-validator';

export class EmitirFacturaDigitalDto {
  @IsString()
  @IsNotEmpty()
  mesaNumero: string;

  @IsString()
  @IsOptional()
  pedidoId?: string;

  @IsString()
  @IsNotEmpty()
  nit: string;

  @IsString()
  @IsNotEmpty()
  razonSocial: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsNotEmpty()
  metodoPago: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  propinaPorcentaje?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  propinaMonto?: number;

  @IsArray()
  @IsOptional()
  items?: Array<{
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
}
