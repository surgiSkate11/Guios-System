import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdministracionModule } from './administracion.module';
import { AuthModule } from './auth/auth.module';
import { EvaluacionModule } from './evaluacion/evaluacion.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProyectosModule } from './proyectos/proyectos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    AdministracionModule,
    ProyectosModule,
    EvaluacionModule,
  ],
})
export class AppModule {}
