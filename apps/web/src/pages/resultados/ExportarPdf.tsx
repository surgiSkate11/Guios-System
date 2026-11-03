import { FileDown } from 'lucide-react'
import { useState } from 'react'
import { descargarResultadosPdf } from '../../api/resultados'
import { errorMessage } from '../auth/form'

/** Saves a blob as a file through a temporary link. */
function guardarArchivo(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}

/** "Exportar PDF" (RF-19): downloads the last generated result with the session token. */
export function ExportarPdf({ idProyecto }: { idProyecto: number }) {
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function exportar() {
    setError(null)
    setOcupado(true)
    try {
      guardarArchivo(await descargarResultadosPdf(idProyecto), `resultado-proyecto-${idProyecto}.pdf`)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={ocupado}
        onClick={() => void exportar()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        <FileDown aria-hidden className="size-4" />
        Exportar PDF
      </button>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
