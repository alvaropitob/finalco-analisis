import React, { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Sparkles, Save, CheckCircle } from 'lucide-react'

const DEFAULT = {
  score_datacredito_minimo: 550, score_cifin_minimo: 500,
  endeudamiento_maximo_pct: 60, obligaciones_cifin_maximas: 5,
  requiere_confiable: true, niveles_riesgo_permitidos: ['bajo', 'medio'],
  monto_minimo: 500000, monto_maximo_base: 50000000,
  tasa_base_anual_pct: 24, ajuste_tasa_riesgo_medio_pct: 4,
  plazo_minimo_meses: 3, plazo_maximo_meses: 60, factor_capacidad_pago: 0.30,
}

function Slider({ label, hint, value, min, max, step = 1, onChange, fmt }) {
  return (
    <div className="form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <label className="form-label" style={{ margin: 0 }}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)' }}>
          {fmt ? fmt(value) : value}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))} />
      {hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

export default function Politica() {
  const [criterios, setCriterios] = useState(DEFAULT)
  const [nombre, setNombre] = useState('')
  const [desc, setDesc] = useState('')
  const [politicaActual, setPoliticaActual] = useState(null)
  const [sugeriendo, setSugeriendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [justIA, setJustIA] = useState('')
  const [advsIA, setAdvsIA] = useState([])

  useEffect(() => {
    api.getPolitica().then(p => {
      setPoliticaActual(p)
      if (p?.criterios) setCriterios({ ...DEFAULT, ...p.criterios })
      if (p?.nombre) setNombre(p.nombre + ' (copia)')
    }).catch(console.error)
  }, [])

  async function sugerir() {
    setSugeriendo(true)
    setJustIA('')
    setAdvsIA([])
    try {
      const res = await api.sugerirPolitica()
      setCriterios(c => ({ ...c, ...res.criterios }))
      setJustIA(res.justificacion || '')
      setAdvsIA(res.advertencias || [])
    } catch (e) {
      alert('Error al consultar IA: ' + e.message)
    } finally {
      setSugeriendo(false)
    }
  }

  async function guardar() {
    if (!nombre.trim()) return alert('Escribe un nombre para la política')
    setGuardando(true)
    try {
      await api.savePolitica({ nombre, descripcion: desc, criterios })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  const set = (key) => (val) => setCriterios(c => ({ ...c, [key]: val }))
  const fmtPct = v => `${v}%`
  const fmtM = v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${Number(v).toLocaleString('es-CO')}`

  return (
    <div className="page fade-up">
      <div className="page-header">
        <h2>Política de crédito</h2>
        <p>Define los criterios que aplica la IA para cada decisión</p>
      </div>

      {politicaActual?.nombre && (
        <div style={{ marginBottom: '1.5rem', padding: '0.875rem 1rem', background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 10, fontSize: 13, color: 'var(--text2)' }}>
          Política activa: <strong style={{ color: 'var(--text)' }}>{politicaActual.nombre}</strong>
        </div>
      )}

      {/* Botón IA */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 3 }}>Sugerencia automática con IA</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Claude analiza tu cartera histórica y propone criterios optimizados</div>
          </div>
          <button className="btn btn-primary" onClick={sugerir} disabled={sugeriendo}>
            {sugeriendo ? <><span className="loader" /> Analizando...</> : <><Sparkles size={15} /> Sugerir criterios</>}
          </button>
        </div>

        {justIA && (
          <div style={{ marginTop: '1rem', padding: '0.875rem', background: 'var(--bg3)', borderRadius: 8, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, borderLeft: '2px solid var(--accent)' }}>
            <strong style={{ color: 'var(--accent)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Análisis IA</strong>
            <p style={{ marginTop: 4 }}>{justIA}</p>
          </div>
        )}

        {advsIA.length > 0 && (
          <div style={{ marginTop: '0.875rem', padding: '0.875rem', background: 'var(--amber-bg)', borderRadius: 8, fontSize: 13, color: 'var(--amber)' }}>
            <strong>Advertencias:</strong>
            <ul style={{ marginTop: 4, paddingLeft: '1rem' }}>
              {advsIA.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
            Scores y riesgo
          </h3>
          <Slider label="Score DataCrédito mínimo" value={criterios.score_datacredito_minimo}
            min={0} max={900} step={10} onChange={set('score_datacredito_minimo')} />
          <Slider label="Score CIFIN mínimo" value={criterios.score_cifin_minimo}
            min={0} max={900} step={10} onChange={set('score_cifin_minimo')} />
          <Slider label="Endeudamiento máximo" value={criterios.endeudamiento_maximo_pct}
            min={10} max={100} step={5} fmt={fmtPct} onChange={set('endeudamiento_maximo_pct')} />
          <Slider label="Obligaciones CIFIN máximas" value={criterios.obligaciones_cifin_maximas}
            min={0} max={20} onChange={set('obligaciones_cifin_maximas')} />

          <div className="form-group">
            <label className="form-label">Niveles de riesgo permitidos</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {['bajo', 'medio', 'alto'].map(nivel => {
                const active = criterios.niveles_riesgo_permitidos.includes(nivel)
                return (
                  <button key={nivel} className={`btn ${active ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => set('niveles_riesgo_permitidos')(
                      active
                        ? criterios.niveles_riesgo_permitidos.filter(n => n !== nivel)
                        : [...criterios.niveles_riesgo_permitidos, nivel]
                    )}>
                    {nivel.charAt(0).toUpperCase() + nivel.slice(1)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={criterios.requiere_confiable}
                onChange={e => set('requiere_confiable')(e.target.checked)} />
              Requiere informe de confiabilidad positivo
            </label>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
            Condiciones del préstamo
          </h3>
          <Slider label="Monto mínimo" value={criterios.monto_minimo}
            min={100000} max={5000000} step={100000} fmt={fmtM} onChange={set('monto_minimo')} />
          <Slider label="Monto máximo base" value={criterios.monto_maximo_base}
            min={1000000} max={500000000} step={1000000} fmt={fmtM} onChange={set('monto_maximo_base')} />
          <Slider label="Tasa base anual" value={criterios.tasa_base_anual_pct}
            min={5} max={50} step={0.5} fmt={fmtPct} onChange={set('tasa_base_anual_pct')} />
          <Slider label="Ajuste tasa riesgo medio" value={criterios.ajuste_tasa_riesgo_medio_pct}
            min={0} max={15} step={0.5} fmt={v => `+${v}%`} hint="Puntos adicionales para clientes de riesgo medio"
            onChange={set('ajuste_tasa_riesgo_medio_pct')} />
          <Slider label="Plazo mínimo (meses)" value={criterios.plazo_minimo_meses}
            min={1} max={12} onChange={set('plazo_minimo_meses')} />
          <Slider label="Plazo máximo (meses)" value={criterios.plazo_maximo_meses}
            min={6} max={120} step={6} onChange={set('plazo_maximo_meses')} />
          <Slider label="Factor capacidad de pago" value={criterios.factor_capacidad_pago}
            min={0.2} max={0.5} step={0.01} fmt={v => `${Math.round(v*100)}%`}
            hint="% del ingreso destinable al pago de cuota"
            onChange={set('factor_capacidad_pago')} />
        </div>
      </div>

      {/* Guardar */}
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Nombre de la política</label>
            <input className="form-input" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder={`Política ${new Date().toLocaleDateString('es-CO')}`} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Descripción (opcional)</label>
            <input className="form-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: Criterios conservadores Q4 2024" />
          </div>
        </div>
        <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
          {guardado
            ? <><CheckCircle size={15} /> Guardada y activada</>
            : guardando ? <><span className="loader" /> Guardando...</>
            : <><Save size={15} /> Guardar y activar política</>}
        </button>
      </div>
    </div>
  )
}
