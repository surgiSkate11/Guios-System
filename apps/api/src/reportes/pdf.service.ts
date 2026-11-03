import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { UsuarioPublico } from '../auth/usuario-publico';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from '../proyectos/acceso.service';
import { ResultadosService } from '../resultados/resultados.service';

const f2 = (n: number) => n.toFixed(2);
const FODA = ['fortaleza', 'oportunidad', 'debilidad', 'amenaza'] as const;
const ETIQUETA_FODA: Record<(typeof FODA)[number], string> = {
  fortaleza: 'Fortalezas',
  oportunidad: 'Oportunidades',
  debilidad: 'Debilidades',
  amenaza: 'Amenazas',
};

/** PDF report of a project's last stored result for senior management (RF-19). */
@Injectable()
export class PdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly resultados: ResultadosService,
  ) {}

  async resultado(
    idProyecto: number,
    usuario: UsuarioPublico,
  ): Promise<Buffer> {
    await this.acceso.comoCoordinador(idProyecto, usuario);
    const r = await this.resultados.ultimo(idProyecto, usuario);
    const p = await this.prisma.proyectoEvaluacion.findUniqueOrThrow({
      where: { id: idProyecto },
      include: { organizacion: true, catalogoVersion: true, coordinador: true },
    });

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: { Title: `Resultado ${p.nombre}` },
    });
    const partes: Buffer[] = [];
    doc.on('data', (c: Buffer) => partes.push(c));
    const fin = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(partes))),
    );

    doc.fontSize(18).text('GUIOS PRO · Resultado de la evaluación');
    doc.moveDown(0.5).fontSize(11);
    doc.text(`Proyecto: ${p.nombre}`);
    doc.text(`Organización: ${p.organizacion.nombre}`);
    doc.text(`Coordinador: ${p.coordinador.nombre}`);
    doc.text(`Versión del catálogo: ${p.catalogoVersion.numero}`);
    doc.text(`Método de consolidación: ${p.metodoConsolidacion}`);
    doc.text(
      `Generado: ${r.generadoEn ? new Date(r.generadoEn).toLocaleString('es') : '-'}`,
    );

    doc.moveDown().fontSize(14).text('Ranking');
    doc.fontSize(11);
    for (const s of [...r.softwares].sort((a, b) => a.ranking - b.ranking)) {
      doc.text(
        `${s.ranking}. ${s.nombre} · nivel ${s.nivel} · métrica ${f2(s.metrica.final)} ` +
          `(mín. ${f2(s.metrica.minimo)}, máx. ${f2(s.metrica.maximo)}, desv. ${f2(s.metrica.desviacion)})`,
      );
    }

    for (const s of r.softwares) {
      doc.moveDown().fontSize(14).text(`FODA de ${s.nombre}`);
      doc.fontSize(11);
      for (const foda of FODA) {
        const factores = s.factores.filter((f) => f.foda === foda);
        const lista = factores
          .map(
            (f) =>
              `${f.nombre} (PM ${f.pmConsolidada === null ? '-' : f2(f.pmConsolidada)})`,
          )
          .join(', ');
        doc.text(`${ETIQUETA_FODA[foda]}: ${lista || 'ninguna'}`);
      }
    }

    doc.moveDown().fontSize(14).text('Banderas de ambigüedad');
    doc.fontSize(11);
    if (r.banderas.length === 0) doc.text('Ninguna.');
    for (const b of r.banderas) doc.text(`• ${b.mensaje}`);

    doc.end();
    return fin;
  }
}
