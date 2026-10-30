-- CreateEnum
CREATE TYPE "Alcance" AS ENUM ('interno', 'externo');

-- CreateEnum
CREATE TYPE "OrigenFactor" AS ENUM ('tesis', 'lit_2020_2025');

-- CreateEnum
CREATE TYPE "OrigenIs" AS ENUM ('tesis', 'manual', 'ia_aprobada');

-- CreateEnum
CREATE TYPE "TipoPublicacion" AS ENUM ('articulo_revisado', 'norma_tecnica', 'otro');

-- CreateEnum
CREATE TYPE "FuenteEvidencia" AS ENUM ('ia', 'manual');

-- CreateEnum
CREATE TYPE "EstadoProyecto" AS ENUM ('borrador', 'en_curso', 'cerrado');

-- CreateEnum
CREATE TYPE "MetodoConsolidacion" AS ENUM ('mediana', 'promedio');

-- CreateEnum
CREATE TYPE "EstadoJurado" AS ENUM ('invitado', 'activo', 'finalizado');

-- CreateEnum
CREATE TYPE "Foda" AS ENUM ('fortaleza', 'oportunidad', 'debilidad', 'amenaza');

-- CreateEnum
CREATE TYPE "NivelAdopcion" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "EstadoAnalisisIa" AS ENUM ('pendiente', 'completado', 'fallido');

-- CreateEnum
CREATE TYPE "EstadoEstimacionIs" AS ENUM ('en_curso', 'propuesta', 'aprobada', 'rechazada');

-- CreateEnum
CREATE TYPE "ModoEstimacionIs" AS ENUM ('manual', 'ia');

-- CreateTable
CREATE TABLE "token_recuperacion" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "vence_en" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogo_version" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por" INTEGER,
    "motivo" TEXT NOT NULL,
    "rq1" DOUBLE PRECISION NOT NULL,
    "rq2" DOUBLE PRECISION NOT NULL,
    "rq3" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "catalogo_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_proyecto" INTEGER,

    CONSTRAINT "dimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factor" (
    "id" SERIAL NOT NULL,
    "id_dimension" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "sugerida_default" INTEGER NOT NULL,
    "alcance_default" "Alcance" NOT NULL,
    "origen" "OrigenFactor" NOT NULL,
    "is_origen" "OrigenIs" NOT NULL DEFAULT 'tesis',
    "validado_expertos" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subfactor" (
    "id" SERIAL NOT NULL,
    "id_factor" INTEGER NOT NULL,
    "texto" VARCHAR(300) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "subfactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidencia_literatura" (
    "id" SERIAL NOT NULL,
    "id_factor" INTEGER NOT NULL,
    "id_subfactor" INTEGER,
    "referencia" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "doi" TEXT,
    "tipo_publicacion" "TipoPublicacion" NOT NULL,
    "resumen" TEXT,
    "cita_textual" TEXT,
    "aceptada" BOOLEAN NOT NULL DEFAULT false,
    "fuente" "FuenteEvidencia" NOT NULL,

    CONSTRAINT "evidencia_literatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicion_ancla" (
    "id" SERIAL NOT NULL,
    "id_factor" INTEGER NOT NULL,
    "id_catalogo_version" INTEGER NOT NULL,
    "terminos_busqueda" JSONB NOT NULL,
    "periodo_desde" INTEGER NOT NULL,
    "periodo_hasta" INTEGER NOT NULL,
    "citas" INTEGER NOT NULL,
    "ns" INTEGER NOT NULL,
    "r" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicion_ancla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimacion_is" (
    "id" SERIAL NOT NULL,
    "id_factor" INTEGER NOT NULL,
    "modo" "ModoEstimacionIs" NOT NULL,
    "estado" "EstadoEstimacionIs" NOT NULL DEFAULT 'en_curso',
    "terminos_busqueda" JSONB,
    "candidatos_json" JSONB,
    "clasificacion_json" JSONB,
    "descartes_json" JSONB,
    "citas_por_subfactor_json" JSONB,
    "modelo" TEXT,
    "tc" INTEGER,
    "ns" INTEGER,
    "r" DOUBLE PRECISION,
    "il" INTEGER,
    "is_propuesta" INTEGER,
    "is_aprobada" INTEGER,
    "justificacion" TEXT,
    "aprobado_por" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimacion_is_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyecto_evaluacion" (
    "id" SERIAL NOT NULL,
    "id_organizacion" INTEGER NOT NULL,
    "id_coordinador" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'borrador',
    "metodo_consolidacion" "MetodoConsolidacion" NOT NULL DEFAULT 'mediana',
    "id_catalogo_version" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyecto_evaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyecto_dimension" (
    "id_proyecto" INTEGER NOT NULL,
    "id_dimension" INTEGER NOT NULL,

    CONSTRAINT "proyecto_dimension_pkey" PRIMARY KEY ("id_proyecto","id_dimension")
);

-- CreateTable
CREATE TABLE "software_candidato" (
    "id" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "version" TEXT,
    "licencia" TEXT,

    CONSTRAINT "software_candidato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jurado_proyecto" (
    "id" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "estado" "EstadoJurado" NOT NULL DEFAULT 'invitado',

    CONSTRAINT "jurado_proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jurado_dimension" (
    "id_jurado_proyecto" INTEGER NOT NULL,
    "id_dimension" INTEGER NOT NULL,

    CONSTRAINT "jurado_dimension_pkey" PRIMARY KEY ("id_jurado_proyecto","id_dimension")
);

-- CreateTable
CREATE TABLE "proyecto_factor" (
    "id" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "id_factor" INTEGER NOT NULL,
    "imp_sugerida" INTEGER NOT NULL,
    "es_relevante" BOOLEAN,
    "imp_decisor_consol" INTEGER,
    "imp_relativa" INTEGER,
    "alcance_efectivo" "Alcance" NOT NULL,
    "justificacion_alcance" TEXT,

    CONSTRAINT "proyecto_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jurado_importancia" (
    "id" SERIAL NOT NULL,
    "id_proyecto_factor" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "imp_decisor" INTEGER NOT NULL,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jurado_importancia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluacion_subfactor" (
    "id" SERIAL NOT NULL,
    "id_software" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_subfactor" INTEGER NOT NULL,
    "valor" INTEGER,
    "desconozco" BOOLEAN NOT NULL DEFAULT false,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluacion_subfactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "informe_evaluacion" (
    "id" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "foto_calificaciones" JSONB NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "informe_evaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultado_jurado_factor" (
    "id" SERIAL NOT NULL,
    "id_software" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_factor" INTEGER NOT NULL,
    "pm_jurado" DOUBLE PRECISION,

    CONSTRAINT "resultado_jurado_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultado_factor_software" (
    "id" SERIAL NOT NULL,
    "id_software" INTEGER NOT NULL,
    "id_proyecto_factor" INTEGER NOT NULL,
    "pm_consolidada" DOUBLE PRECISION,
    "foda" "Foda",

    CONSTRAINT "resultado_factor_software_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultado_software" (
    "id" SERIAL NOT NULL,
    "id_software" INTEGER NOT NULL,
    "score_final" DOUBLE PRECISION NOT NULL,
    "score_minimo" DOUBLE PRECISION NOT NULL,
    "score_maximo" DOUBLE PRECISION NOT NULL,
    "desviacion" DOUBLE PRECISION NOT NULL,
    "nivel_adopcion" "NivelAdopcion" NOT NULL,
    "ranking" INTEGER NOT NULL,

    CONSTRAINT "resultado_software_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analisis_ia" (
    "id" SERIAL NOT NULL,
    "id_proyecto" INTEGER NOT NULL,
    "entrada" JSONB NOT NULL,
    "salida" TEXT,
    "modelo" TEXT NOT NULL,
    "estado" "EstadoAnalisisIa" NOT NULL DEFAULT 'pendiente',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analisis_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametro_analisis" (
    "id" SERIAL NOT NULL,
    "id_proyecto" INTEGER,
    "umbral_foda" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "umbral_desacuerdo" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "umbral_empate_tecnico" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "umbral_metrica_alta" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "umbral_factor_discutido" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "umbral_datos_inciertos" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "metodo_consolidacion" "MetodoConsolidacion" NOT NULL DEFAULT 'mediana',

    CONSTRAINT "parametro_analisis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "token_recuperacion_token_hash_key" ON "token_recuperacion"("token_hash");

-- CreateIndex
CREATE INDEX "token_recuperacion_id_usuario_idx" ON "token_recuperacion"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_version_numero_key" ON "catalogo_version"("numero");

-- CreateIndex
CREATE INDEX "dimension_id_proyecto_idx" ON "dimension"("id_proyecto");

-- CreateIndex
CREATE INDEX "factor_id_dimension_idx" ON "factor"("id_dimension");

-- CreateIndex
CREATE INDEX "subfactor_id_factor_idx" ON "subfactor"("id_factor");

-- CreateIndex
CREATE INDEX "evidencia_literatura_id_factor_idx" ON "evidencia_literatura"("id_factor");

-- CreateIndex
CREATE INDEX "evidencia_literatura_id_subfactor_idx" ON "evidencia_literatura"("id_subfactor");

-- CreateIndex
CREATE UNIQUE INDEX "medicion_ancla_id_factor_id_catalogo_version_key" ON "medicion_ancla"("id_factor", "id_catalogo_version");

-- CreateIndex
CREATE INDEX "estimacion_is_id_factor_idx" ON "estimacion_is"("id_factor");

-- CreateIndex
CREATE INDEX "proyecto_evaluacion_id_organizacion_idx" ON "proyecto_evaluacion"("id_organizacion");

-- CreateIndex
CREATE INDEX "proyecto_evaluacion_id_coordinador_idx" ON "proyecto_evaluacion"("id_coordinador");

-- CreateIndex
CREATE INDEX "software_candidato_id_proyecto_idx" ON "software_candidato"("id_proyecto");

-- CreateIndex
CREATE UNIQUE INDEX "jurado_proyecto_id_proyecto_id_usuario_key" ON "jurado_proyecto"("id_proyecto", "id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "proyecto_factor_id_proyecto_id_factor_key" ON "proyecto_factor"("id_proyecto", "id_factor");

-- CreateIndex
CREATE UNIQUE INDEX "jurado_importancia_id_proyecto_factor_id_usuario_key" ON "jurado_importancia"("id_proyecto_factor", "id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "evaluacion_subfactor_id_software_id_usuario_id_subfactor_key" ON "evaluacion_subfactor"("id_software", "id_usuario", "id_subfactor");

-- CreateIndex
CREATE UNIQUE INDEX "informe_evaluacion_id_proyecto_version_key" ON "informe_evaluacion"("id_proyecto", "version");

-- CreateIndex
CREATE UNIQUE INDEX "resultado_jurado_factor_id_software_id_usuario_id_factor_key" ON "resultado_jurado_factor"("id_software", "id_usuario", "id_factor");

-- CreateIndex
CREATE UNIQUE INDEX "resultado_factor_software_id_software_id_proyecto_factor_key" ON "resultado_factor_software"("id_software", "id_proyecto_factor");

-- CreateIndex
CREATE UNIQUE INDEX "resultado_software_id_software_key" ON "resultado_software"("id_software");

-- CreateIndex
CREATE INDEX "analisis_ia_id_proyecto_idx" ON "analisis_ia"("id_proyecto");

-- CreateIndex
CREATE UNIQUE INDEX "parametro_analisis_id_proyecto_key" ON "parametro_analisis"("id_proyecto");

-- AddForeignKey
ALTER TABLE "token_recuperacion" ADD CONSTRAINT "token_recuperacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogo_version" ADD CONSTRAINT "catalogo_version_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimension" ADD CONSTRAINT "dimension_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyecto_evaluacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factor" ADD CONSTRAINT "factor_id_dimension_fkey" FOREIGN KEY ("id_dimension") REFERENCES "dimension"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subfactor" ADD CONSTRAINT "subfactor_id_factor_fkey" FOREIGN KEY ("id_factor") REFERENCES "factor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencia_literatura" ADD CONSTRAINT "evidencia_literatura_id_factor_fkey" FOREIGN KEY ("id_factor") REFERENCES "factor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencia_literatura" ADD CONSTRAINT "evidencia_literatura_id_subfactor_fkey" FOREIGN KEY ("id_subfactor") REFERENCES "subfactor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicion_ancla" ADD CONSTRAINT "medicion_ancla_id_factor_fkey" FOREIGN KEY ("id_factor") REFERENCES "factor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicion_ancla" ADD CONSTRAINT "medicion_ancla_id_catalogo_version_fkey" FOREIGN KEY ("id_catalogo_version") REFERENCES "catalogo_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimacion_is" ADD CONSTRAINT "estimacion_is_id_factor_fkey" FOREIGN KEY ("id_factor") REFERENCES "factor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimacion_is" ADD CONSTRAINT "estimacion_is_aprobado_por_fkey" FOREIGN KEY ("aprobado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_evaluacion" ADD CONSTRAINT "proyecto_evaluacion_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_evaluacion" ADD CONSTRAINT "proyecto_evaluacion_id_coordinador_fkey" FOREIGN KEY ("id_coordinador") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_evaluacion" ADD CONSTRAINT "proyecto_evaluacion_id_catalogo_version_fkey" FOREIGN KEY ("id_catalogo_version") REFERENCES "catalogo_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_dimension" ADD CONSTRAINT "proyecto_dimension_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyecto_evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_dimension" ADD CONSTRAINT "proyecto_dimension_id_dimension_fkey" FOREIGN KEY ("id_dimension") REFERENCES "dimension"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_candidato" ADD CONSTRAINT "software_candidato_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyecto_evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurado_proyecto" ADD CONSTRAINT "jurado_proyecto_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyecto_evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurado_proyecto" ADD CONSTRAINT "jurado_proyecto_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurado_dimension" ADD CONSTRAINT "jurado_dimension_id_jurado_proyecto_fkey" FOREIGN KEY ("id_jurado_proyecto") REFERENCES "jurado_proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurado_dimension" ADD CONSTRAINT "jurado_dimension_id_dimension_fkey" FOREIGN KEY ("id_dimension") REFERENCES "dimension"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_factor" ADD CONSTRAINT "proyecto_factor_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyecto_evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_factor" ADD CONSTRAINT "proyecto_factor_id_factor_fkey" FOREIGN KEY ("id_factor") REFERENCES "factor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurado_importancia" ADD CONSTRAINT "jurado_importancia_id_proyecto_factor_fkey" FOREIGN KEY ("id_proyecto_factor") REFERENCES "proyecto_factor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurado_importancia" ADD CONSTRAINT "jurado_importancia_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluacion_subfactor" ADD CONSTRAINT "evaluacion_subfactor_id_software_fkey" FOREIGN KEY ("id_software") REFERENCES "software_candidato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluacion_subfactor" ADD CONSTRAINT "evaluacion_subfactor_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluacion_subfactor" ADD CONSTRAINT "evaluacion_subfactor_id_subfactor_fkey" FOREIGN KEY ("id_subfactor") REFERENCES "subfactor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_evaluacion" ADD CONSTRAINT "informe_evaluacion_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyecto_evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_jurado_factor" ADD CONSTRAINT "resultado_jurado_factor_id_software_fkey" FOREIGN KEY ("id_software") REFERENCES "software_candidato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_jurado_factor" ADD CONSTRAINT "resultado_jurado_factor_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_jurado_factor" ADD CONSTRAINT "resultado_jurado_factor_id_factor_fkey" FOREIGN KEY ("id_factor") REFERENCES "factor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_factor_software" ADD CONSTRAINT "resultado_factor_software_id_software_fkey" FOREIGN KEY ("id_software") REFERENCES "software_candidato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_factor_software" ADD CONSTRAINT "resultado_factor_software_id_proyecto_factor_fkey" FOREIGN KEY ("id_proyecto_factor") REFERENCES "proyecto_factor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_software" ADD CONSTRAINT "resultado_software_id_software_fkey" FOREIGN KEY ("id_software") REFERENCES "software_candidato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analisis_ia" ADD CONSTRAINT "analisis_ia_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyecto_evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametro_analisis" ADD CONSTRAINT "parametro_analisis_id_proyecto_fkey" FOREIGN KEY ("id_proyecto") REFERENCES "proyecto_evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Integrity rules of spec section 9 that Prisma cannot express.
-- ---------------------------------------------------------------------------

-- evaluacion_subfactor: either "Desconozco" with a null value, or a value 1-4.
ALTER TABLE "evaluacion_subfactor" ADD CONSTRAINT "evaluacion_subfactor_valor_o_desconozco_check"
  CHECK (("desconozco" AND "valor" IS NULL) OR (NOT "desconozco" AND "valor" BETWEEN 1 AND 4));

-- factor: a 2020-2025 literature factor is never validated by experts; IS from 1 to 4.
ALTER TABLE "factor" ADD CONSTRAINT "factor_lit_no_validado_check"
  CHECK ("origen" <> 'lit_2020_2025' OR "validado_expertos" = false);
ALTER TABLE "factor" ADD CONSTRAINT "factor_sugerida_default_check"
  CHECK ("sugerida_default" BETWEEN 1 AND 4);

-- proyecto_evaluacion: the end date cannot be before the start date.
ALTER TABLE "proyecto_evaluacion" ADD CONSTRAINT "proyecto_evaluacion_fechas_check"
  CHECK ("fecha_fin" IS NULL OR "fecha_fin" >= "fecha_inicio");

-- estimacion_is: an approval records who approved it; an IS changed by hand needs a justification.
ALTER TABLE "estimacion_is" ADD CONSTRAINT "estimacion_is_aprobacion_check"
  CHECK ("estado" <> 'aprobada' OR ("aprobado_por" IS NOT NULL AND "is_aprobada" IS NOT NULL));
ALTER TABLE "estimacion_is" ADD CONSTRAINT "estimacion_is_justificacion_check"
  CHECK ("is_aprobada" IS NULL OR "is_propuesta" IS NULL OR "is_aprobada" = "is_propuesta" OR "justificacion" IS NOT NULL);
ALTER TABLE "estimacion_is" ADD CONSTRAINT "estimacion_is_rangos_check"
  CHECK (("il" IS NULL OR "il" BETWEEN 1 AND 4)
     AND ("is_propuesta" IS NULL OR "is_propuesta" BETWEEN 1 AND 4)
     AND ("is_aprobada" IS NULL OR "is_aprobada" BETWEEN 1 AND 4));

-- Importance scales (1 Irrelevant .. 4 Fundamental).
ALTER TABLE "jurado_importancia" ADD CONSTRAINT "jurado_importancia_imp_decisor_check"
  CHECK ("imp_decisor" BETWEEN 1 AND 4);
ALTER TABLE "proyecto_factor" ADD CONSTRAINT "proyecto_factor_importancias_check"
  CHECK ("imp_sugerida" BETWEEN 1 AND 4
     AND ("imp_decisor_consol" IS NULL OR "imp_decisor_consol" BETWEEN 1 AND 4)
     AND ("imp_relativa" IS NULL OR "imp_relativa" BETWEEN 1 AND 4));

-- evidencia_literatura: period 2020-2025 (RN-14).
ALTER TABLE "evidencia_literatura" ADD CONSTRAINT "evidencia_literatura_anio_check"
  CHECK ("anio" BETWEEN 2020 AND 2025);

-- PM and metric ranges.
ALTER TABLE "resultado_jurado_factor" ADD CONSTRAINT "resultado_jurado_factor_pm_check"
  CHECK ("pm_jurado" IS NULL OR "pm_jurado" BETWEEN 1 AND 4);
ALTER TABLE "resultado_factor_software" ADD CONSTRAINT "resultado_factor_software_pm_check"
  CHECK ("pm_consolidada" IS NULL OR "pm_consolidada" BETWEEN 1 AND 4);
ALTER TABLE "resultado_software" ADD CONSTRAINT "resultado_software_scores_check"
  CHECK ("score_final" BETWEEN 0 AND 100 AND "score_minimo" BETWEEN 0 AND 100
     AND "score_maximo" BETWEEN 0 AND 100 AND "desviacion" >= 0 AND "ranking" >= 1);
