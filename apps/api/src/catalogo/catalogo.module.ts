import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BIBLIOGRAFIA, OpenAlex } from './bibliografia';
import { CatalogoAdminController } from './catalogo-admin.controller';
import { CatalogoAdminService } from './catalogo-admin.service';
import { CatalogoController } from './catalogo.controller';
import { EstimacionIaService } from './estimacion-ia.service';

/** Catalog reading (A2), administration and IS estimation (A10). */
@Module({
  controllers: [CatalogoController, CatalogoAdminController],
  providers: [
    CatalogoAdminService,
    EstimacionIaService,
    {
      provide: BIBLIOGRAFIA,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OpenAlex(config.get<string>('OPENALEX_MAILTO')),
    },
  ],
})
export class CatalogoModule {}
