import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorador para restringir acceso a endpoints por rol.
 * Uso: @Roles(RolUsuario.ADMIN, RolUsuario.CAJERO)
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
