import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Autentica un usuario con email y contraseña.
   * Retorna access_token y refresh_token.
   */
  async login(loginDto: LoginDto) {
    const user = await this.prisma.usuario.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.activo) {
      throw new UnauthorizedException('Cuenta desactivada. Contacte al administrador');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      rol: user.rol,
      nombre: user.nombre,
    });

    this.logger.log(`Login exitoso: ${user.email} [${user.rol}]`);

    return {
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      },
      ...tokens,
    };
  }

  /**
   * Registra un nuevo usuario (solo ADMIN puede crear usuarios).
   */
  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.usuario.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con este email');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(registerDto.password, salt);

    const user = await this.prisma.usuario.create({
      data: {
        nombre: registerDto.nombre,
        email: registerDto.email,
        passwordHash,
        rol: registerDto.rol,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        createdAt: true,
      },
    });

    this.logger.log(`Usuario registrado: ${user.email} [${user.rol}]`);

    return user;
  }

  /**
   * Genera un nuevo par de tokens usando el refresh token.
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.usuario.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, rol: true, nombre: true, activo: true },
      });

      if (!user || !user.activo) {
        throw new UnauthorizedException('Usuario no encontrado o desactivado');
      }

      return this.generateTokens({
        sub: user.id,
        email: user.email,
        rol: user.rol,
        nombre: user.nombre,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  /**
   * Retorna el perfil del usuario autenticado.
   */
  async getProfile(userId: string) {
    return this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
      },
    });
  }

  // ── Helpers privados ──

  private async generateTokens(payload: JwtPayload) {
    const tokenPayload = { ...payload } as Record<string, unknown>;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(tokenPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRATION') ?? '15m',
      } as any),
      this.jwtService.signAsync(tokenPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d',
      } as any),
    ]);

    return { access_token: accessToken, refresh_token: refreshToken };
  }
}
