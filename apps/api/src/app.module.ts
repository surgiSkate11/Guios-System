import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdministracionModule } from './administracion.module';
import { AuthModule } from './auth/auth.module';
import { CatalogoController } from './catalogo/catalogo.controller';
import { EvaluacionModule } from './evaluacion/evaluacion.module';
import { MailModule } from './mail/mail.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ResultadosModule } from './resultados/resultados.module';
import { ProyectosModule } from './proyectos/proyectos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    AuthModule,
    HealthModule,
    AdministracionModule,
    ProyectosModule,
    EvaluacionModule,
    ResultadosModule,
  ],
  controllers: [CatalogoController],
})
export class AppModule {}
