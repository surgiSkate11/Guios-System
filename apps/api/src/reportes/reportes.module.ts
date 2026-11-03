import {
  Controller,
  Get,
  Module,
  Param,
  ParseIntPipe,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { UsuarioPublico } from '../auth/usuario-publico';
import { ProyectosModule } from '../proyectos/proyectos.module';
import { ResultadosModule } from '../resultados/resultados.module';
import { AnalisisService } from './analisis.service';
import { PdfService } from './pdf.service';

@Controller('proyectos/:id')
export class ReportesController {
  constructor(
    private readonly pdf: PdfService,
    private readonly analisis: AnalisisService,
  ) {}

  @Get('resultados/pdf')
  async descargar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioPublico,
  ) {
    const buffer = await this.pdf.resultado(id, u);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="resultado-proyecto-${id}.pdf"`,
    });
  }

  @Post('analisis')
  generar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioPublico,
  ) {
    return this.analisis.generar(id, u);
  }

  @Get('analisis')
  ultimo(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: UsuarioPublico,
  ) {
    return this.analisis.ultimo(id, u);
  }
}

/** PDF export (RF-19) and AI analysis (RF-16). */
@Module({
  imports: [ProyectosModule, ResultadosModule],
  controllers: [ReportesController],
  providers: [PdfService, AnalisisService],
})
export class ReportesModule {}
