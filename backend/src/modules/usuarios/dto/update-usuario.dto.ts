import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { RolUsuario } from '@prisma/client';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El formato de correo electrónico no es válido' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password?: string;

  @IsOptional()
  @IsEnum(RolUsuario, {
    message: 'El rol debe ser ADMIN, CAJERO, MESERO o CHEF (Cocina & Despacho)',
  })
  rol?: RolUsuario;

  permisos?: Record<string, boolean>;
}
