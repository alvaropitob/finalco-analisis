import React, { useState, useEffect } from 'react'
import { Settings, Save, History, AlertTriangle, CheckCircle } from 'lucide-react'
import { api, getRol } from '../api/client'

const SECTIONS = [
  {
    title: 'Tasas de Interés',
    fields: [
      { key: 'tasa_ea', label: 'Tasa Efectiva Anual', type: 'percent', step: 0.01 },
      { key: 'seguro_vida_pct', label: 'Seguro de vida mensual (%)', type: 'percent', step: 0.001 },
      { key: 'fianza_pct', label: 'Fianza (%)', type: 'percent', step: 0.001 },
    ],
  },
  {
    title: 'Costos Fijos',
    fields: [
      { key: 'gastos_tecnologia', label: 'Gastos de tecnología ($)', type: 'money' },
      { key: 'administracion', label: 'Administración ($)', type: 'money' },
      { key: 'iva_pct', label: 'IVA (%)', type: 'percent', step: 0.01 },
    ],
  },
  {
    title: 'Pesos del Scoring (4 Ejes)',
    fields: [
      { key: 'peso_capacidad', label: 'Peso Capacidad', type: 'number' },
      { key: 'peso_comportamiento', label: 'Peso Comportamiento', type: 'number' },
      { key: 'peso_flujo', label: 'Peso Flujo', type: 'number' },
      { key: 'peso_entorno', label: 'Peso Entorno', type: 'number' },
    ],
  },
  {
    title: 'Bandas de Decisión (puntaje ≥)',
    fields: [
      { key: 'banda_a_corte', label: 'Banda A — Aprobar $400K-600K', type: 'number' },
      { key: 'banda_b_corte', label: 'Banda B — Aprobar $300K-400K', type: 'number' },
      { key: 'banda_c_corte', label: 'Banda C — Aprobar $200K', type: 'number' },
      { key: 'banda_c_menos_corte', label: 'Banda C⁻ — Revisión Comité', type: 'number' },
    ],
  },
  {
    title: 'Capacidad de Pago',
    fields: [
      { key: 'factor_nano', label: 'Factor nanocredito', type: 'percent', step: 0.01 },
      { key: 'limite_cuota_ingreso', label: 'Límite cuota/ingreso', type: 'percent', step: 0.01 },
    ],
  },
  {
    title: 'Umbrales de Rechazo',
    fields: [
      { key: 'umbral_mora_evidente', label: 'Umbral mora evidente ($)', type: 'money' },
      { key: 'mora_vigente_dias', label: 'Mora vigente ≥ (días)', type: 'number' },
      { key: 'alerta_consultas_6m', label: 'Alerta consultas 6m >', type: 'number' },
    ],
  },
  {
    title: 'Montos por Banda',
    fields: [
      { key: 'monto_min_a', label: 'Monto mín. Banda A ($)', type: 'money' },
      { key: 'monto_max_a', label: 'Monto máx. Banda A ($)', type: 'money' },
      { key: 'monto_min_b', label: 'Monto mín. Banda B ($)', type: 'money' },
      { key: 'monto_max_b', label: 'Monto máx. Banda B ($)', type: 'money' },
      { key: 'monto_c', label: 'Monto Banda C ($)', type: 'money' },
    ],
  },
]

export default function ParametrizadorRiesgo() {
  const [params, setParams] = useState(null)
  const [original, setOriginal] = useState(null)
  const [historial, setHistorial] = useState([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const isAdmin = getRol() === 'admin'

  useEffect(() => {
    api.getParametrosRiesgo().then(d => {
      if (d && !d.mensaje) {
        // Convert percent fields from decimal to display
        const display = { ...d }
        ;['tasa_ea','seguro_vida_pct','fianza_pct','iva_pct','factor_nano','limite_cuota_ingreso'].forEach(k => {
          if (display[k] != null) display[k] = +(display[k] * 100).toFixed(4)
        })
        setParams(display)
        setOriginal(display)
      }
    }).catch(() => {})
  }, [])

  const handleChange = (key, val) => {
    setParams(prev => ({ ...prev, [key]: val }))
  }

  const hasChanges = params && original && JSON.stringify(params) !== JSON.stringify(original)

  const save = async () => {
    if (!params) return
    setSaving(true)
    setMsg(null)
    try {
      // Convert display percents back to decimal
      const payload = {}
      SECTIONS.forEach(s => s.fields.forEach(f => {
        if (params[f.key] != null && params[f.key] !== original?.[f.key]) {
          let val = Number(params[f.key])
          if (f.type === 'percent') val = val / 100
          payload[f.key] = val
        }
      }))

      const res = await api.updateParametrosRiesgo(payload)
      setMsg({ type: 'success', text: res.mensaje || 'Guardado' })
      setOriginal({ ...params })
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  const loadHistory = async () => {
    setShowHistory(!showHistory)
    if (!showHistory) {
      try {
        const data = await api.getHistorialParametros()
        setHistorial(data)
      } catch { /* ignore */ }
    }
  }

  if (!params) return <div className="page-content"><div className="card"><div className="card-body">Cargando parametrizador...</div></div></div>

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={24} /> Parametrizador de Riesgo
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Configura tasas, costos, pesos de scoring y umbrales de decisión
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={loadHistory}>
            <History size={14} /> Historial
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={save} disabled={saving || !hasChanges}>
              <Save size={14} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-danger'}`}
          style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          {msg.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {msg.text}
        </div>
      )}

      {!isAdmin && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <AlertTriangle size={14} /> Solo los administradores pueden modificar los parámetros.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
        {SECTIONS.map(section => (
          <div className="card" key={section.title}>
            <div className="card-header"><h3>{section.title}</h3></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {section.fields.map(f => {
                const changed = params[f.key] !== original?.[f.key]
                return (
                  <div key={f.key}>
                    <label className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      {f.label}
                      {changed && <span style={{ color: 'var(--warning)', fontSize: 11 }}>● modificado</span>}
                    </label>
                    <input
                      type="number"
                      className="input"
                      step={f.step || 1}
                      value={params[f.key] ?? ''}
                      onChange={e => handleChange(f.key, e.target.value === '' ? null : +e.target.value)}
                      disabled={!isAdmin}
                      style={{
                        borderColor: changed ? 'var(--warning)' : undefined,
                        background: changed ? 'var(--warning-bg)' : undefined,
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Historial */}
      {showHistory && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header"><h3><History size={16} /> Historial de Cambios</h3></div>
          <div className="card-body" style={{ overflowX: 'auto' }}>
            {historial.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Sin cambios registrados.</p>
            ) : (
              <table className="amort-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Campo</th>
                    <th>Anterior</th>
                    <th>Nuevo</th>
                    <th>Modificado por</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h, i) => (
                    <tr key={i}>
                      <td>{new Date(h.fecha).toLocaleString('es-CO')}</td>
                      <td><code>{h.campo_modificado}</code></td>
                      <td style={{ color: 'var(--danger)' }}>{h.valor_anterior}</td>
                      <td style={{ color: 'var(--success)' }}>{h.valor_nuevo}</td>
                      <td>{h.modificado_por_nombre || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
