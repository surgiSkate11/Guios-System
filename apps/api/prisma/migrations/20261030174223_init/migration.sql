-- CreateEnum
CREATE TYPE "Sector" AS ENUM ('publico', 'privado', 'independiente');

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('invitado', 'coordinador', 'administrador');

-- CreateTable
CREATE TABLE "organizacion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "sector" "Sector" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'invitado',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "id_organizacion" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_id_organizacion_idx" ON "usuario"("id_organizacion");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
