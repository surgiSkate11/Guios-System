import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BIBLIOGRAFIA, OpenAlex } from './bibliografia';
import { CatalogoAdminController } from './catalogo-admin.controller';
import { CatalogoAdminService } from './catalogo-admin.service';
import { CatalogoController } from './catalogo.controller';
import { EstimacionIaService } from './estimacion-ia.service';
import { MedicionAnclasController } from './medicion-anclas.controller';
import { MedicionAnclasService } from './medicion-anclas.service';

/** Catalog reading (A2), administration, IS estimation (A10) and anchors (A11). */
@Module({
  controllers: [
    CatalogoController,
    CatalogoAdminController,
    MedicionAnclasController,
  ],
  providers: [
    CatalogoAdminService,
    EstimacionIaService,
    MedicionAnclasService,
    {
      provide: BIBLIOGRAFIA,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OpenAlex(config.get<string>('OPENALEX_MAILTO')),
    },
  ],
})
export class CatalogoModule {}
