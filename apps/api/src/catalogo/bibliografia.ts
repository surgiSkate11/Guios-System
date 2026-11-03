/** A peer-reviewed article candidate returned by the bibliographic service. */
export interface Articulo {
  doi: string;
  titulo: string;
  anio: number;
  tipo: string;
  resumen: string;
}

/** Bibliographic search service. Only receives public search terms (RNF-13). */
export interface Bibliografia {
  buscar(consulta: string, max: number): Promise<Articulo[]>;
}

export const BIBLIOGRAFIA = Symbol('BIBLIOGRAFIA');

/** OpenAlex rebuilds abstracts from an inverted index (word -> positions). */
function resumenDeIndice(
  indice: Record<string, number[]> | null | undefined,
): string {
  if (!indice) return '';
  const palabras: string[] = [];
  for (const [palabra, posiciones] of Object.entries(indice)) {
    for (const p of posiciones) palabras[p] = palabra;
  }
  return palabras.filter(Boolean).join(' ');
}

/** OpenAlex works search restricted to 2020-2025 articles with DOI and abstract. */
export class OpenAlex implements Bibliografia {
  constructor(private readonly correo?: string) {}

  async buscar(consulta: string, max: number): Promise<Articulo[]> {
    const params = new URLSearchParams({
      search: consulta,
      filter:
        'from_publication_date:2020-01-01,to_publication_date:2025-12-31,type:article,has_doi:true,has_abstract:true',
      'per-page': String(max),
    });
    if (this.correo) params.set('mailto', this.correo);
    const res = await fetch(
      `https://api.openalex.org/works?${params.toString()}`,
      {
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!res.ok) throw new Error(`OpenAlex answered ${res.status}`);
    const data = (await res.json()) as {
      results?: {
        doi?: string | null;
        title?: string | null;
        publication_year?: number;
        type?: string;
        abstract_inverted_index?: Record<string, number[]> | null;
      }[];
    };
    return (data.results ?? []).map((w) => ({
      doi: w.doi ?? '',
      titulo: w.title ?? '',
      anio: w.publication_year ?? 0,
      tipo: w.type ?? '',
      resumen: resumenDeIndice(w.abstract_inverted_index),
    }));
  }
}
