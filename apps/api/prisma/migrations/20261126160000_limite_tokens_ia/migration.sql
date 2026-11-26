CREATE TABLE "uso_tokens_ia" (
    "id" SERIAL NOT NULL,
    "proveedor" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "tokens_entrada" INTEGER NOT NULL DEFAULT 0,
    "tokens_salida" INTEGER NOT NULL DEFAULT 0,
    "tokens_reservados" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uso_tokens_ia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "uso_tokens_ia_creado_en_idx" ON "uso_tokens_ia"("creado_en");
