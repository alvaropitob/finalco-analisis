import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { ArrowLeft, Zap, FileText, AlertCircle } from 'lucide-react'

function ScoreBar({ label, value, max = 900 }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color = pct > 70 ? '#22c55e' : pct > 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="score-row">
      <span className="score-label">{label}</span>
      <div className="score-bar">
        <div className="score-fill" style={{ width: pct + '%', background: color }} />
      </div>
      <span className="score-num" style={{ color }}>{value || '—'}</span>
    </div>
  )
}

function fmt(n) {
  if (!n) return '—'
  return Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

export default function ClienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [monto, setMonto] = useState(5000000)
  const [decidiendo, setDecidiendo] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getCliente(id)
      .then(setCliente)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  async function handleDecidir() {
    setDecidiendo(true)
    setError(null)
    setResultado(null)
    try {
      const res = await api.decidir(id, monto)
      setResultado(res)
      // Recargar datos del cliente para actualizar última decisión
      const updated = await api.getCliente(id)
      setCliente(updated)
    } catch (e) {
      setError(e.message)
    } finally {
      setDecidiendo(false)
    }
  }

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="loader" style={{ width: 32, height: 32 }} />
    </div>
  )
  if (!cliente) return <div className="page"><div className="empty"><p>Cliente no encontrado</p></div></div>

  const decisionLabels = { aprobado: 'Aprobado', rechazado: 'Rechazado', revision_manual: 'Revisión manual requerida' }
  const decisionEmoji = { aprobado: '✓', rechazado: '✗', revision_manual: '⚠' }

  return (
    <div className="page fade-up">
      <button className="btn btn-ghost" style={{ marginBottom: '1.5rem' }} onClick={() => navigate('/clientes')}>
        <ArrowLeft size={15} /> Volver
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Info principal */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '1.6rem', lineHeight: 1.2 }}>
                {cliente.nombre || 'Sin nombre'}
              </h2>
              <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>CC {cliente.cedula}</p>
            </div>
            <span className={`badge ${cliente.es_confiable ? 'badge-green' : 'badge-red'}`}>
              <span className="badge-dot" />
              {cliente.es_confiable ? 'Confiable' : 'No confiable'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
            {/* Columna 1: Identificación y Biometría */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[
                ['Nombres', cliente.nombres || '—'],
                ['Apellidos', cliente.apellidos || '—'],
                ['Cédula', cliente.cedula || '—'],
                ['Sexo', cliente.sexo || '—'],
                ['Estatura', cliente.estatura ? `${cliente.estatura} m` : '—'],
                ['Grupo Sanguíneo', cliente.grupo_sanguineo || '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Columna 2: Ubicación y Finanzas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[
                ['F. Nacimiento', cliente.fecha_nacimiento || '—'],
                ['Lugar Nac.', cliente.lugar_nacimiento || '—'],
                ['F. Expedición', cliente.fecha_expedicion || '—'],
                ['Lugar Exp.', cliente.lugar_expedicion || '—'],
                ['Endeudamiento', cliente.endeudamiento_datacredito ? `${Number(cliente.endeudamiento_datacredito).toFixed(1)}%` : '—'],
                ['Obligaciones', cliente.obligaciones_cifin ?? '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          <ScoreBar label="Score DataCrédito" value={cliente.score_datacredito} />
          <ScoreBar label="Score CIFIN" value={cliente.score_cifin} />

          {cliente.resumen_ia && (
            <div style={{ marginTop: '1rem', padding: '0.875rem', background: 'var(--bg3)', borderRadius: 8, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, borderLeft: '2px solid var(--border2)' }}>
              {cliente.resumen_ia}
            </div>
          )}
        </div>

        {/* Panel de decisión */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '1.2rem', marginBottom: '1.25rem' }}>
            Evaluar crédito
          </h3>

          <div className="form-group">
            <label className="form-label">Monto solicitado</label>
            <input
              className="form-input"
              type="number"
              value={monto}
              min={100000}
              step={500000}
              onChange={e => setMonto(Number(e.target.value))}
            />
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              {Number(monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleDecidir} disabled={decidiendo}>
            {decidiendo ? <><span className="loader" /> Analizando...</> : <><Zap size={15} /> Tomar decisión con IA</>}
          </button>

          {error && (
            <div style={{ marginTop: '1rem', padding: '0.875rem', background: 'var(--red-bg)', borderRadius: 8, fontSize: 13, color: 'var(--red)' }}>
              <AlertCircle size={14} style={{ display: 'inline', marginRight: 6 }} />{error}
            </div>
          )}

          {resultado && (
            <div className={`decision-box ${resultado.decision}`} style={{ marginTop: '1.25rem' }}>
              <div className="decision-title" style={{
                color: { aprobado: 'var(--green)', rechazado: 'var(--red)', revision_manual: 'var(--amber)' }[resultado.decision]
              }}>
                {decisionEmoji[resultado.decision]} {decisionLabels[resultado.decision]}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>
                Score interno: <strong style={{ color: 'var(--text)' }}>{resultado.score_interno}/100</strong>
              </div>

              {resultado.decision === 'aprobado' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: '1rem' }}>
                  {[
                    ['Monto aprobado', fmt(resultado.monto_aprobado)],
                    ['Tasa anual', resultado.tasa_interes_anual ? `${resultado.tasa_interes_anual}% EA` : '—'],
                    ['Plazo máx.', resultado.plazo_maximo_meses ? `${resultado.plazo_maximo_meses} meses` : '—'],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginTop: 4 }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}

              {resultado.motivos_rechazo?.length > 0 && (
                <ul style={{ marginTop: '0.875rem', fontSize: 13, color: 'var(--text2)', paddingLeft: '1rem' }}>
                  {resultado.motivos_rechazo.map((m, i) => <li key={i} style={{ marginBottom: 4 }}>{m}</li>)}
                </ul>
              )}

              {resultado.justificacion && (
                <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: '0.875rem', fontStyle: 'italic', lineHeight: 1.6 }}>
                  "{resultado.justificacion}"
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Historial de decisiones */}
      {cliente.decisiones?.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
            Historial de decisiones
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th><th>Decisión</th><th>Monto solicitado</th>
                  <th>Monto aprobado</th><th>Tasa</th><th>Plazo</th><th>Score</th>
                </tr>
              </thead>
              <tbody>
                {cliente.decisiones.map(d => (
                  <tr key={d.id} style={{ cursor: 'default' }}>
                    <td>{new Date(d.fecha_decision).toLocaleDateString('es-CO')}</td>
                    <td>
                      <span className={`badge ${d.decision === 'aprobado' ? 'badge-green' : d.decision === 'rechazado' ? 'badge-red' : 'badge-amber'}`}>
                        <span className="badge-dot" />
                        {{ aprobado: 'Aprobado', rechazado: 'Rechazado', revision_manual: 'Revisión' }[d.decision]}
                      </span>
                    </td>
                    <td>{fmt(d.monto_solicitado)}</td>
                    <td>{d.monto_aprobado ? fmt(d.monto_aprobado) : '—'}</td>
                    <td>{d.tasa_interes ? `${d.tasa_interes}%` : '—'}</td>
                    <td>{d.plazo_meses ? `${d.plazo_meses}m` : '—'}</td>
                    <td>{d.score_decision}/100</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documentos procesados */}
      {cliente.documentos?.length > 0 && (
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
            <FileText size={16} style={{ display: 'inline', marginRight: 8 }} />Documentos procesados
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cliente.documentos.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 1rem', background: 'var(--bg3)', borderRadius: 8 }}>
                <span className="badge badge-blue">{doc.formato?.toUpperCase()}</span>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{doc.nombre_archivo}</span>
                <span className="badge badge-gray">{doc.tipo_documento}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(doc.fecha_proceso).toLocaleDateString('es-CO')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
