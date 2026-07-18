import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';

export enum MetodoPagoDto {
  EFECTIVO = 'EFECTIVO',
  TARJETA = 'TARJETA',
  QR = 'QR',
}

export class RegistrarPagoDto {
  @IsUUID()
  @IsNotEmpty()
  pedidoId: string;

  @IsEnum(MetodoPagoDto)
  @IsNotEmpty()
  metodoPago: MetodoPagoDto;

  @IsNumber()
  @Min(0)
  montoRecibido: number;

  @IsString()
  @IsOptional()
  nit?: string;

  @IsString()
  @IsOptional()
  razonSocial?: string;
}
