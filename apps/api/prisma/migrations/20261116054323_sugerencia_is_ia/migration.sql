-- CreateEnum
CREATE TYPE "OrigenSugerenciaIs" AS ENUM ('ia', 'respaldo');

-- AlterTable
ALTER TABLE "proyecto_evaluacion" ADD COLUMN     "id_sugerencia_is" INTEGER,
ADD COLUMN     "tipo_software" TEXT;

-- CreateTable
CREATE TABLE "sugerencia_is" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "contexto" JSONB NOT NULL,
    "id_catalogo_version" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "modelo" TEXT,
    "respuesta" TEXT,
    "resultado" JSONB NOT NULL,
    "origen" "OrigenSugerenciaIs" NOT NULL,
    "motivo_respaldo" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sugerencia_is_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sugerencia_is_clave_idx" ON "sugerencia_is"("clave");

-- AddForeignKey
ALTER TABLE "proyecto_evaluacion" ADD CONSTRAINT "proyecto_evaluacion_id_sugerencia_is_fkey" FOREIGN KEY ("id_sugerencia_is") REFERENCES "sugerencia_is"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sugerencia_is" ADD CONSTRAINT "sugerencia_is_id_catalogo_version_fkey" FOREIGN KEY ("id_catalogo_version") REFERENCES "catalogo_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
