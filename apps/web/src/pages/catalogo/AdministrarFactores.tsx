import { useState, type FormEvent } from 'react'
import {
  actualizarFactor,
  actualizarSubfactor,
  agregarSubfactor,
  listarFactoresAdmin,
  type FactorAdmin,
  type SubfactorAdmin,
} from '../../api/catalogo'
import type { Alcance } from '../../api/consolidacion'
import { avisoDeError, useCarga } from '../../components/carga'
import { AvisoMensaje, campoClass, EstadoCarga, type Aviso } from '../../components/ui'

const ETIQUETA_ALCANCE: Record<Alcance, string> = { interno: 'Interno', externo: 'Externo' }
const thClass = 'px-4 py-3 font-medium'
const accionClass = 'text-xs font-medium hover:underline disabled:opacity-50'
const chip = 'inline-block rounded-full px-2.5 py-0.5 text-xs'

type Ejecutar = (accion: () => Promise<string>) => Promise<boolean>

function EstadoActivo({ activo }: { activo: boolean }) {
  return activo ? (
    <span className={`${chip} bg-green-50 text-green-800`}>Activo</span>
  ) : (
    <span className={`${chip} bg-slate-100 text-slate-600`}>Inactivo</span>
  )
}

function FilaSubfactor({
  subfactor,
  ocupado,
  ejecutar,
  onCambio,
}: {
  subfactor: SubfactorAdmin
  ocupado: boolean
  ejecutar: Ejecutar
  onCambio: (subfactor: SubfactorAdmin) => void
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(subfactor.texto)

  async function guardar(event: FormEvent) {
    event.preventDefault()
    if (texto.trim() === '') return
    const guardado = await ejecutar(async () => {
      onCambio(await actualizarSubfactor(subfactor.id, { texto: texto.trim() }))
      return 'Subfactor actualizado'
    })
    if (guardado) setEditando(false)
  }

  const alternar = () =>
    ejecutar(async () => {
      onCambio(await actualizarSubfactor(subfactor.id, { activo: !subfactor.activo }))
      return subfactor.activo ? 'Subfactor desactivado' : 'Subfactor reactivado'
    })

  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      {editando ? (
        <form onSubmit={guardar} className="flex flex-1 items-center gap-2">
          <input
            aria-label="Texto del subfactor"
            className={`${campoClass} flex-1`}
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
          />
          <button type="submit" disabled={ocupado} className={`${accionClass} text-brand-700`}>
            Guardar subfactor
          </button>
        </form>
      ) : (
        <span className={subfactor.activo ? 'text-slate-700' : 'text-slate-400 line-through'}>{subfactor.texto}</span>
      )}
      <span className="flex shrink-0 gap-3">
        {!editando && (
          <button
            type="button"
            aria-label={`Editar subfactor ${subfactor.texto}`}
            disabled={ocupado}
            onClick={() => setEditando(true)}
            className={`${accionClass} text-blue-600`}
          >
            Editar
          </button>
        )}
        <button
          type="button"
          aria-label={`${subfactor.activo ? 'Desactivar' : 'Reactivar'} subfactor ${subfactor.texto}`}
          disabled={ocupado}
          onClick={() => void alternar()}
          className={`${accionClass} ${subfactor.activo ? 'text-red-600' : 'text-brand-700'}`}
        >
          {subfactor.activo ? 'Desactivar' : 'Reactivar'}
        </button>
      </span>
    </li>
  )
}

function FilaFactor({
  factor,
  ocupado,
  ejecutar,
  error,
  onCambio,
}: {
  factor: FactorAdmin
  ocupado: boolean
  ejecutar: Ejecutar
  error: (texto: string) => void
  onCambio: (factor: FactorAdmin) => void
}) {
  const [editando, setEditando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState(factor.nombre)
  const [alcance, setAlcance] = useState<Alcance>(factor.alcanceDefault)
  const [nuevo, setNuevo] = useState('')

  async function guardar() {
    if (nombre.trim() === '') return error('Escribe el nombre del factor')
    const guardado = await ejecutar(async () => {
      onCambio(await actualizarFactor(factor.id, { nombre: nombre.trim(), alcanceDefault: alcance }))
      return 'Factor actualizado'
    })
    if (guardado) setEditando(false)
  }

  const alternar = () =>
    ejecutar(async () => {
      onCambio(await actualizarFactor(factor.id, { activo: !factor.activo }))
      return `${factor.nombre} ${factor.activo ? 'desactivado' : 'reactivado'}`
    })

  async function agregar(event: FormEvent) {
    event.preventDefault()
    if (nuevo.trim() === '') return
    const agregado = await ejecutar(async () => {
      const subfactor = await agregarSubfactor(factor.id, nuevo.trim())
      onCambio({ ...factor, subfactores: [...factor.subfactores, subfactor] })
      return 'Subfactor agregado'
    })
    if (agregado) setNuevo('')
  }

  const reemplazarSubfactor = (subfactor: SubfactorAdmin) =>
    onCambio({
      ...factor,
      subfactores: factor.subfactores.map((item) => (item.id === subfactor.id ? subfactor : item)),
    })

  return (
    <>
      <tr className="border-t border-slate-100 text-slate-700">
        <th scope="row" className="px-4 py-2.5 text-left font-normal text-slate-900">
          {editando ? (
            <input
              aria-label={`Nombre de ${factor.nombre}`}
              className={campoClass}
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
            />
          ) : (
            factor.nombre
          )}
        </th>
        <td className="px-4 py-2.5">{factor.dimension.nombre}</td>
        <td className="px-4 py-2.5">
          {editando ? (
            <select
              aria-label={`Alcance de ${factor.nombre}`}
              className={campoClass}
              value={alcance}
              onChange={(event) => setAlcance(event.target.value as Alcance)}
            >
              <option value="interno">Interno</option>
              <option value="externo">Externo</option>
            </select>
          ) : (
            ETIQUETA_ALCANCE[factor.alcanceDefault]
          )}
        </td>
        <td className="px-4 py-2.5">
          <EstadoActivo activo={factor.activo} />
        </td>
        <td className="space-x-3 px-4 py-2.5 whitespace-nowrap">
          {editando ? (
            <button
              type="button"
              aria-label={`Guardar ${factor.nombre}`}
              disabled={ocupado}
              onClick={() => void guardar()}
              className={`${accionClass} text-brand-700`}
            >
              Guardar
            </button>
          ) : (
            <button
              type="button"
              aria-label={`Editar ${factor.nombre}`}
              disabled={ocupado}
              onClick={() => setEditando(true)}
              className={`${accionClass} text-blue-600`}
            >
              Editar
            </button>
          )}
          <button
            type="button"
            aria-label={`${factor.activo ? 'Desactivar' : 'Reactivar'} ${factor.nombre}`}
            disabled={ocupado}
            onClick={() => void alternar()}
            className={`${accionClass} ${factor.activo ? 'text-red-600' : 'text-brand-700'}`}
          >
            {factor.activo ? 'Desactivar' : 'Reactivar'}
          </button>
          <button
            type="button"
            aria-expanded={abierto}
            aria-label={`Administrar subfactores de ${factor.nombre}`}
            onClick={() => setAbierto((valor) => !valor)}
            className={`${accionClass} text-slate-600`}
          >
            Subfactores ({factor.subfactores.length})
          </button>
        </td>
      </tr>
      {abierto && (
        <tr className="bg-slate-50/60">
          <td colSpan={5} className="px-8 py-3">
            <ul aria-label={`Subfactores de ${factor.nombre}`} className="divide-y divide-slate-100 text-sm">
              {factor.subfactores.map((subfactor) => (
                <FilaSubfactor
                  key={subfactor.id}
                  subfactor={subfactor}
                  ocupado={ocupado}
                  ejecutar={ejecutar}
                  onCambio={reemplazarSubfactor}
                />
              ))}
            </ul>
            <form onSubmit={agregar} className="mt-2 flex items-center gap-2">
              <input
                aria-label={`Nuevo subfactor de ${factor.nombre}`}
                placeholder="Texto del nuevo subfactor"
                className={`${campoClass} flex-1`}
                value={nuevo}
                onChange={(event) => setNuevo(event.target.value)}
              />
              <button
                type="submit"
                aria-label={`Agregar subfactor a ${factor.nombre}`}
                disabled={ocupado || nuevo.trim() === ''}
                className={`${accionClass} text-brand-700`}
              >
                Agregar
              </button>
            </form>
          </td>
        </tr>
      )}
    </>
  )
}

/**
 * Catalog administration (RF-18): every factor, active or inactive, can be renamed, re-scoped,
 * deactivated or reactivated, and so can its subfactors. `onCambio` lets the page refresh the
 * current catalog after a change.
 */
export function AdministrarFactores({ onCambio }: { onCambio: () => void }) {
  const { datos, cargando, error, actualizar } = useCarga(listarFactoresAdmin)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [ocupado, setOcupado] = useState(false)

  const ejecutar: Ejecutar = async (accion) => {
    setOcupado(true)
    setAviso(null)
    try {
      setAviso({ tipo: 'ok', texto: await accion() })
      onCambio()
      return true
    } catch (failure) {
      setAviso(avisoDeError(failure))
      return false
    } finally {
      setOcupado(false)
    }
  }

  const reemplazar = (factor: FactorAdmin) =>
    actualizar((factores) => factores.map((item) => (item.id === factor.id ? factor : item)))

  return (
    <section className="mb-5 rounded-2xl bg-white p-5">
      <h2 className="mb-4 font-semibold text-slate-900">Administrar factores</h2>
      <AvisoMensaje aviso={aviso} />
      {!datos ? (
        <EstadoCarga cargando={cargando} error={error} />
      ) : (
        <table aria-label="Administrar factores" className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className={thClass}>Factor</th>
              <th className={thClass}>Dimensión</th>
              <th className={thClass}>Alcance por defecto</th>
              <th className={thClass}>Estado</th>
              <th className={thClass}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((factor) => (
              <FilaFactor
                key={factor.id}
                factor={factor}
                ocupado={ocupado}
                ejecutar={ejecutar}
                error={(texto) => setAviso({ tipo: 'error', texto })}
                onCambio={reemplazar}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
