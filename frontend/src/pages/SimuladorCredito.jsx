import React, { useState, useEffect, useCallback } from 'react'
import { Calculator, TrendingDown, DollarSign, Calendar, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../api/client'

const formatCOP = (n) => n != null ? `$${Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 })}` : '$0'
const formatPct = (n, dec = 2) => n != null ? `${Number(n).toFixed(dec)}%` : '0%'

export default function SimuladorCredito() {
  const [monto, setMonto] = useState(300000)
  const [plazo, setPlazo] = useState(2)
  const [tasaEa, setTasaEa] = useState(24.26)
  const [seguro, setSeguro] = useState(0.1)
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showTabla, setShowTabla] = useState(false)
  const [preview, setPreview] = useState(null)

  // Preview rápido en tiempo real
  const fetchPreview = useCallback(async () => {
    if (monto <= 0 || plazo <= 0) return
    try {
      const data = await api.simulacionRapida(monto, plazo, tasaEa / 100)
      setPreview(data)
    } catch { /* ignore preview errors */ }
  }, [monto, plazo, tasaEa])

  useEffect(() => {
    const t = setTimeout(fetchPreview, 300)
    return () => clearTimeout(t)
  }, [fetchPreview])

  const simular = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.simularCredito({
        monto,
        plazo_meses: plazo,
        tasa_ea: tasaEa / 100,
        seguro_vida_pct: seguro / 100,
      })
      setResultado(data)
      setShowTabla(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const res = resultado?.resumen

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calculator size={24} /> Simulador de Crédito
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Calcula la tabla de amortización con el Sistema Francés (cuota fija)
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* ── Panel de entrada ── */}
        <div className="card">
          <div className="card-header">
            <h3><DollarSign size={16} /> Parámetros del Crédito</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Monto */}
            <div>
              <label className="field-label">Monto del crédito</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range" min={100000} max={600000} step={50000}
                  value={monto} onChange={e => setMonto(+e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="number" className="input" style={{ width: 140, textAlign: 'right' }}
                  value={monto} onChange={e => setMonto(+e.target.value)}
                />
              </div>
              <small style={{ color: 'var(--text-muted)' }}>{formatCOP(monto)}</small>
            </div>

            {/* Plazo */}
            <div>
              <label className="field-label">Plazo (meses)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range" min={1} max={12} step={1}
                  value={plazo} onChange={e => setPlazo(+e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="number" className="input" style={{ width: 80, textAlign: 'right' }}
                  value={plazo} onChange={e => setPlazo(+e.target.value)}
                />
              </div>
              <small style={{ color: 'var(--text-muted)' }}>{plazo} {plazo === 1 ? 'mes' : 'meses'}</small>
            </div>

            {/* Tasa EA */}
            <div>
              <label className="field-label">Tasa Efectiva Anual (%)</label>
              <input
                type="number" className="input" step={0.01}
                value={tasaEa} onChange={e => setTasaEa(+e.target.value)}
              />
            </div>

            {/* Seguro */}
            <div>
              <label className="field-label">Seguro de vida mensual (%)</label>
              <input
                type="number" className="input" step={0.01}
                value={seguro} onChange={e => setSeguro(+e.target.value)}
              />
            </div>

            <button className="btn btn-primary" onClick={simular} disabled={loading} style={{ marginTop: 8 }}>
              {loading ? 'Calculando...' : 'Generar Tabla de Amortización'}
            </button>

            {error && <div className="alert alert-danger">{error}</div>}
          </div>
        </div>

        {/* ── Preview / Resumen ── */}
        <div className="card">
          <div className="card-header">
            <h3><TrendingDown size={16} /> Resumen del Crédito</h3>
          </div>
          <div className="card-body">
            {/* Preview rápido */}
            {preview && !res && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="stat-card" style={{ background: 'var(--accent-glow)' }}>
                  <div className="stat-label">Cuota Estimada</div>
                  <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 22 }}>
                    {formatCOP(preview.cuota_base_mensual)}
                  </div>
                  <div className="stat-label">por mes</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total a Pagar</div>
                  <div className="stat-value" style={{ fontSize: 22 }}>
                    {formatCOP(preview.gran_total)}
                  </div>
                </div>
              </div>
            )}

            {/* Resumen completo */}
            {res && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="stat-card" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)' }}>
                    <div className="stat-label">Cuota Fija Base</div>
                    <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 24 }}>
                      {formatCOP(res.cuota_fija_base)}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Cuota Total Estimada</div>
                    <div className="stat-value" style={{ fontSize: 22 }}>{formatCOP(res.cuota_estimada_total)}</div>
                  </div>
                </div>

                <div className="detail-table">
                  <table>
                    <tbody>
                      <tr><td>Monto del crédito</td><td style={{textAlign:'right'}}>{formatCOP(res.monto_credito)}</td></tr>
                      <tr><td>Tasa EA</td><td style={{textAlign:'right'}}>{formatPct(res.tasa_ea_pct)}</td></tr>
                      <tr><td>Tasa mensual</td><td style={{textAlign:'right'}}>{formatPct(res.tasa_mensual_pct, 4)}</td></tr>
                      <tr><td>Total Capital</td><td style={{textAlign:'right'}}>{formatCOP(res.total_capital)}</td></tr>
                      <tr><td>Total Intereses</td><td style={{textAlign:'right', color: 'var(--danger)'}}>{formatCOP(res.total_intereses)}</td></tr>
                      <tr><td>Total Seguro de Vida</td><td style={{textAlign:'right'}}>{formatCOP(res.total_seguro_vida)}</td></tr>
                      <tr><td>Total IVA</td><td style={{textAlign:'right'}}>{formatCOP(res.total_iva)}</td></tr>
                      <tr style={{fontWeight:700, borderTop:'2px solid var(--border)'}}>
                        <td>GRAN TOTAL</td>
                        <td style={{textAlign:'right', color: 'var(--accent)'}}>{formatCOP(res.gran_total)}</td>
                      </tr>
                      <tr><td>Costo financiero</td><td style={{textAlign:'right', color:'var(--warning)'}}>{formatCOP(res.costo_financiero_total)}</td></tr>
                      <tr><td>Período</td><td style={{textAlign:'right'}}>{res.fecha_inicio} → {res.fecha_fin}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabla de amortización ── */}
      {resultado?.tabla?.length > 0 && (
        <div className="card">
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setShowTabla(!showTabla)}>
            <h3><Calendar size={16} /> Tabla de Amortización — Sistema Francés</h3>
            {showTabla ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
          {showTabla && (
            <div className="card-body" style={{ overflowX: 'auto' }}>
              <table className="amort-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fecha Pago</th>
                    <th style={{textAlign:'right'}}>Saldo Inicial</th>
                    <th style={{textAlign:'right'}}>Capital</th>
                    <th style={{textAlign:'right'}}>Interés</th>
                    <th style={{textAlign:'right'}}>Seguro</th>
                    <th style={{textAlign:'right'}}>IVA</th>
                    <th style={{textAlign:'right'}}>Cuota Total</th>
                    <th style={{textAlign:'right'}}>Saldo Final</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.tabla.map(r => (
                    <tr key={r.numero}>
                      <td style={{fontWeight:600}}>{r.numero}</td>
                      <td>{r.fecha_pago}</td>
                      <td style={{textAlign:'right'}}>{formatCOP(r.saldo_inicial)}</td>
                      <td style={{textAlign:'right', color:'var(--accent)'}}>{formatCOP(r.capital)}</td>
                      <td style={{textAlign:'right', color:'var(--danger)'}}>{formatCOP(r.interes)}</td>
                      <td style={{textAlign:'right'}}>{formatCOP(r.seguro_vida)}</td>
                      <td style={{textAlign:'right'}}>{formatCOP(r.iva)}</td>
                      <td style={{textAlign:'right', fontWeight:700}}>{formatCOP(r.cuota_total)}</td>
                      <td style={{textAlign:'right'}}>{formatCOP(r.saldo_final)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
