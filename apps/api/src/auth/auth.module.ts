import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RecuperacionService } from './recuperacion.service';
import { RolesGuard } from './roles.guard';

/** Session lifetime of an access token. */
const TOKEN_TTL = '8h';
const MIN_SECRET_LENGTH = 32;

@Module({
  imports: [
    // Brute-force protection on the public auth routes (applied per route).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: 60_000,
            limit: Number(config.get<string>('AUTH_RATE_LIMIT') ?? 10),
          },
        ],
        errorMessage: 'Demasiados intentos; espera un minuto',
      }),
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');
        if (secret.length < MIN_SECRET_LENGTH) {
          throw new Error(
            `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long`,
          );
        }
        return {
          secret,
          signOptions: { expiresIn: TOKEN_TTL, algorithm: 'HS256' },
          verifyOptions: { algorithms: ['HS256'] },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RecuperacionService,
    // Order matters: authentication runs first, then the role check.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
