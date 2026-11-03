import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  cargarCatalogo,
  type CatalogoJson,
} from '../src/catalogo/cargar-catalogo';
import { PrismaClient } from '../src/generated/prisma/client';

/** Usage: npm run db:catalogo -w @guios/api -- [path/to/catalogo.json] */
async function main(): Promise<void> {
  const ruta = resolve(process.argv[2] ?? 'prisma/catalogo.json');
  const json = JSON.parse(readFileSync(ruta, 'utf8')) as CatalogoJson;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    const r = await cargarCatalogo(prisma, json);
    console.log(
      r.creado
        ? `Catalog version ${r.version} loaded: ${r.dimensiones} dimensions, ${r.factores} factors, ${r.subfactores} subfactors.`
        : `A catalog already exists (version ${r.version}); nothing was loaded.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
