import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdministracionModule } from './administracion.module';
import { AuthModule } from './auth/auth.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { EvaluacionModule } from './evaluacion/evaluacion.module';
import { IaModule } from './ia/ia.module';
import { ReportesModule } from './reportes/reportes.module';
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
    IaModule,
    AuthModule,
    HealthModule,
    AdministracionModule,
    ProyectosModule,
    EvaluacionModule,
    ResultadosModule,
    ReportesModule,
    CatalogoModule,
  ],
})
export class AppModule {}
