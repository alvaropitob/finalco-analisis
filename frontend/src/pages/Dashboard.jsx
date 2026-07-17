import React, { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { api } from '../api/client'
import { TrendingUp, Users, CheckCircle, XCircle, DollarSign, Clock } from 'lucide-react'

const COLORS = { aprobado: '#22c55e', rechazado: '#ef4444', revision_manual: '#f59e0b' }

function fmt(n) { return n ? Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 }) : '0' }
function fmtM(n) { if (!n) return '$0'; if (n >= 1e9) return '$' + (n/1e9).toFixed(1) + 'B'; if (n >= 1e6) return '$' + (n/1e6).toFixed(1) + 'M'; return '$' + fmt(n) }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ color: 'var(--text2)', marginBottom: 6 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: COLORS[p.name] || 'var(--accent)' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="loader" style={{ width: 32, height: 32 }} />
    </div>
  )

  if (error) return (
    <div className="page">
      <div className="empty">
        <p style={{ color: 'var(--red)' }}>Error conectando con el servidor: {error}</p>
        <p style={{ marginTop: 8, fontSize: 13 }}>Verifica que FastAPI esté corriendo en puerto 8000</p>
      </div>
    </div>
  )

  const c = stats?.clientes || {}
  const d = stats?.decisiones || {}
  const tendencia = stats?.tendencia || []

  const pieData = [
    { name: 'aprobado', value: d.aprobadas || 0 },
    { name: 'rechazado', value: d.rechazadas || 0 },
    { name: 'revision_manual', value: d.en_revision || 0 },
  ].filter(x => x.value > 0)

  const riesgoData = [
    { name: 'Bajo', value: c.riesgo_bajo || 0, fill: '#22c55e' },
    { name: 'Medio', value: c.riesgo_medio || 0, fill: '#f59e0b' },
    { name: 'Alto', value: c.riesgo_alto || 0, fill: '#ef4444' },
  ]

  // Agrupar tendencia por fecha
  const tendenciaMap = {}
  tendencia.forEach(({ fecha, decision, total }) => {
    if (!tendenciaMap[fecha]) tendenciaMap[fecha] = { fecha }
    tendenciaMap[fecha][decision] = total
  })
  const tendenciaData = Object.values(tendenciaMap)

  return (
    <div className="page fade-up">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Resumen del sistema de análisis crediticio</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Clientes totales</div>
          <div className="kpi-value accent">{fmt(c.total_clientes)}</div>
          <div className="kpi-sub">{fmt(c.confiables)} confiables</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Evaluaciones</div>
          <div className="kpi-value">{fmt(d.total_decisiones)}</div>
          <div className="kpi-sub">decisiones registradas</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Aprobados</div>
          <div className="kpi-value green">{fmt(d.aprobadas)}</div>
          <div className="kpi-sub">
            {d.total_decisiones ? Math.round(100 * d.aprobadas / d.total_decisiones) : 0}% del total
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Rechazados</div>
          <div className="kpi-value red">{fmt(d.rechazadas)}</div>
          <div className="kpi-sub">
            {d.total_decisiones ? Math.round(100 * d.rechazadas / d.total_decisiones) : 0}% del total
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Cartera aprobada</div>
          <div className="kpi-value">{fmtM(d.monto_total_aprobado)}</div>
          <div className="kpi-sub">Tasa prom. {Number(d.tasa_promedio || 0).toFixed(1)}% EA</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Score DC promedio</div>
          <div className="kpi-value">{Math.round(c.avg_score_dc || 0)}</div>
          <div className="kpi-sub">CIFIN: {Math.round(c.avg_score_cifin || 0)}</div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, marginBottom: '1.25rem', fontSize: '1.1rem' }}>
            Distribución de decisiones
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                     paddingAngle={3} dataKey="value">
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(v) => <span style={{ color: 'var(--text2)', fontSize: 13 }}>
                  {{ aprobado: 'Aprobado', rechazado: 'Rechazado', revision_manual: 'Revisión' }[v] || v}
                </span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty" style={{ padding: '2rem' }}><p>Sin datos aún</p></div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, marginBottom: '1.25rem', fontSize: '1.1rem' }}>
            Clientes por nivel de riesgo
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={riesgoData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fill: 'var(--text2)', fontSize: 13 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {riesgoData.map((entry) => <Cell key={entry.name} fill={entry.fill} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {tendenciaData.length > 0 && (
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, marginBottom: '1.25rem', fontSize: '1.1rem' }}>
            Tendencia de decisiones (últimos 30 días)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={tendenciaData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="fecha" tick={{ fill: 'var(--text3)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="aprobado" stroke="#22c55e" fill="url(#gGreen)" strokeWidth={2} />
              <Area type="monotone" dataKey="rechazado" stroke="#ef4444" fill="url(#gRed)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
