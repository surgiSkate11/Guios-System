/** Load error of a judge step; a 403 means the judge has not accepted the request yet. */
export function errorDePaso(error: string | null, status: number | null): string | null {
  if (status === 403) return 'Aceptá la solicitud del proyecto para poder evaluar.'
  return error
}
