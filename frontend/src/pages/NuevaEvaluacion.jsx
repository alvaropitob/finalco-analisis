import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { 
  User, Upload, FileText, X, CheckCircle, AlertCircle, 
  Loader2, Calculator, ArrowRight, DollarSign, Activity,
  ChevronRight
} from 'lucide-react'

// Utilidades
const formatCOP = (n) => n != null ? `$${Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 })}` : '$0'
const formatPct = (n) => n != null ? `${Number(n).toFixed(2)}%` : '0%'

export default function NuevaEvaluacion() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  
  // Paso 1: Cliente
  const [formData, setFormData] = useState({
    cedula: '',
    nombres: '',
    apellidos: '',
    monto_solicitado: 300000,
    plazo_solicitado: 2
  })
  const [clienteId, setClienteId] = useState(null)
  
  // Paso 2: Documentos
  const [files, setFiles] = useState([])
  const fileRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  
  // Paso 3: Análisis y Scoring
  const [analisis, setAnalisis] = useState(null)
  const [scoring, setScoring] = useState(null)
  
  // Paso 4: Simulación
  const [simulacion, setSimulacion] = useState(null)

  // Estados UI
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState(null)

  // ── Manejo de Inputs ──────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // ── Paso 1: Guardar Cliente ────────────────────────────────────────
  const handlePaso1 = async () => {
    if (!formData.cedula || !formData.nombres || !formData.apellidos) {
      setError('Por favor completa los campos obligatorios.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const payload = {
        ...formData,
        nombre: `${formData.apellidos} ${formData.nombres}`.trim(),
        monto_solicitado: Number(formData.monto_solicitado),
        plazo_solicitado: Number(formData.plazo_solicitado)
      }
      const res = await api.guardarCliente(payload)
      setClienteId(res.id)
      setStep(2)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Paso 2: Cargar Documentos ──────────────────────────────────────
  const addFiles = (newFiles) => {
    const arr = Array.from(newFiles).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase()
      return ['pdf', 'xlsx', 'xls', 'png', 'jpg', 'jpeg'].includes(ext)
    })
    setFiles(prev => [...prev, ...arr])
  }
  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }
  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx))

  const handlePaso2 = async () => {
    if (files.length === 0) {
      // Permitir avanzar sin documentos
      setStep(3)
      return
    }
    setLoading(true)
    setError(null)
    setLoadingMsg('Subiendo documentos...')
    
    // Simular progreso de extracción para dar feedback al usuario
    const timer = setInterval(() => {
      setLoadingMsg(prev => {
        if (prev === 'Subiendo documentos...') return 'Aplicando OCR a las imágenes...'
        if (prev === 'Aplicando OCR a las imágenes...') return 'Extrayendo información clave con IA...'
        if (prev === 'Extrayendo información clave con IA...') return 'Cruzando datos con centrales de riesgo...'
        return 'Guardando resultados...'
      })
    }, 2500)

    try {
      const data = await api.cargarDocumentos(files, clienteId, formData.cedula)
      clearInterval(timer)
      setLoadingMsg('')
      setAnalisis(data)
      setStep(3)
      // Lanzar el scoring automáticamente al entrar al paso 3
      ejecutarScoring()
    } catch (e) {
      clearInterval(timer)
      setLoadingMsg('')
      setError(e.message)
      setLoading(false)
    }
  }

  // ── Paso 3: Calcular Scoring ───────────────────────────────────────
  const ejecutarScoring = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.calcularScoring(clienteId)
      setScoring(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePaso3 = async () => {
    setStep(4)
    ejecutarSimulacion()
  }

  // ── Paso 4: Simulación y Decisión ──────────────────────────────────
  const ejecutarSimulacion = async () => {
    setLoading(true)
    setError(null)
    try {
      // Usamos el monto y plazo del cliente
      const res = await api.simularCredito({
        monto: Number(formData.monto_solicitado),
        plazo_meses: Number(formData.plazo_solicitado),
        tasa_ea: 0.2426, // Tasa por defecto, en producción vendría de los parámetros
        seguro_vida_pct: 0.001
      })
      setSimulacion(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const tomarDecision = async (decision) => {
    setLoading(true)
    try {
      // Actualizar el estado del cliente o registrar la decisión
      await api.decidir(clienteId, formData.monto_solicitado, null)
      navigate(`/clientes/${clienteId}`)
    } catch(e) {
      setError(e.message)
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="page fade-up" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h2>Nueva Evaluación de Crédito</h2>
        <p>Asistente guiado paso a paso para evaluar y decidir créditos</p>
      </div>

      {/* Stepper Header */}
      <div className="stepper-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', background: 'var(--bg-surface)', padding: '1rem 2rem', borderRadius: 12 }}>
        {[
          { id: 1, label: 'Datos Básicos', icon: User },
          { id: 2, label: 'Documentos', icon: Upload },
          { id: 3, label: 'Análisis IA', icon: Activity },
          { id: 4, label: 'Simulación', icon: Calculator }
        ].map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', opacity: step >= s.id ? 1 : 0.4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: step === s.id ? 'var(--accent)' : step > s.id ? 'var(--success)' : 'var(--border)',
              color: 'white', fontWeight: 600, marginRight: 10
            }}>
              {step > s.id ? <CheckCircle size={16} /> : s.id}
            </div>
            <span style={{ fontWeight: step === s.id ? 600 : 400, color: step === s.id ? 'var(--accent)' : 'var(--text)' }}>
              {s.label}
            </span>
            {i < 3 && <ChevronRight size={16} style={{ margin: '0 15px', color: 'var(--text-muted)' }} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── PASO 1 ── */}
      {step === 1 && (
        <div className="card fade-up">
          <div className="card-header"><h3>1. Información Básica del Solicitante</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="field-label">Cédula *</label>
                <input className="input" name="cedula" value={formData.cedula} onChange={handleChange} placeholder="Ej: 1104701529" />
              </div>
              <div></div>
              <div>
                <label className="field-label">Nombres *</label>
                <input className="input" name="nombres" value={formData.nombres} onChange={handleChange} placeholder="Ej: Juan" />
              </div>
              <div>
                <label className="field-label">Apellidos *</label>
                <input className="input" name="apellidos" value={formData.apellidos} onChange={handleChange} placeholder="Ej: Perez" />
              </div>
              <div>
                <label className="field-label">Monto Solicitado (COP) *</label>
                <input className="input" type="number" name="monto_solicitado" value={formData.monto_solicitado} onChange={handleChange} />
              </div>
              <div>
                <label className="field-label">Plazo (Meses) *</label>
                <input className="input" type="number" name="plazo_solicitado" value={formData.plazo_solicitado} onChange={handleChange} />
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button className="btn btn-primary" onClick={handlePaso1} disabled={loading}>
                {loading ? <Loader2 className="spin" size={16} /> : <>Siguiente <ArrowRight size={16} /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PASO 2 ── */}
      {step === 2 && (
        <div className="card fade-up">
          <div className="card-header">
            <h3>2. Carga de Documentos</h3>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Opcional - Sube Datacrédito, Cédula, ADRES, etc.</span>
          </div>
          <div className="card-body">
            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', padding: 40, textAlign: 'center', cursor: 'pointer',
                background: dragOver ? 'var(--accent-glow)' : 'var(--bg-surface)', transition: 'all 0.2s ease',
              }}
            >
              <Upload size={32} style={{ color: 'var(--accent)', marginBottom: 8 }} />
              <p style={{ fontWeight: 500 }}>Arrastra archivos aquí o haz clic para seleccionar</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Formatos soportados: PDF, JPG, PNG, XLSX</p>
              <input ref={fileRef} type="file" multiple accept=".pdf,.xlsx,.xls,image/*" style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
            </div>

            {files.length > 0 && (
              <div style={{ marginTop: 16 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-surface)', marginBottom: 4 }}>
                    <FileText size={16} color="var(--accent)" />
                    <span style={{ flex: 1, fontSize: 13 }}>{f.name}</span>
                    <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            
            {loading && loadingMsg && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--accent-glow)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Loader2 size={18} className="spin" style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500 }}>{loadingMsg}</span>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={loading}>Atrás</button>
              <button className="btn btn-primary" onClick={handlePaso2} disabled={loading}>
                {loading ? <Loader2 className="spin" size={16} /> : <>Procesar Documentos e Ir al Análisis <ArrowRight size={16} /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PASO 3 ── */}
      {step === 3 && (
        <div className="card fade-up">
          <div className="card-header">
            <h3>3. Análisis IA y Scoring</h3>
          </div>
          <div className="card-body">
            {!scoring && !loading && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <button className="btn btn-primary" onClick={ejecutarScoring}>Ejecutar Scoring</button>
              </div>
            )}
            
            {loading && (
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <Activity size={32} className="spin" style={{ color: 'var(--accent)', marginBottom: '1rem' }} />
                <p>Calculando Scoring Multi-fuente...</p>
              </div>
            )}

            {scoring && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="stat-card" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)' }}>
                    <div className="stat-label">Puntaje Final</div>
                    <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 32 }}>{Number(scoring.puntaje_final).toFixed(1)}</div>
                  </div>
                  <div className="stat-card" style={{ background: scoring.decision === 'aprobado' ? 'var(--success-bg)' : scoring.decision === 'rechazado' ? 'var(--danger-bg)' : 'var(--warning-bg)' }}>
                    <div className="stat-label">Banda Riesgo</div>
                    <div className="stat-value" style={{ fontSize: 32, color: scoring.decision === 'aprobado' ? 'var(--success)' : scoring.decision === 'rechazado' ? 'var(--danger)' : 'var(--warning)' }}>{scoring.banda || '-'}</div>
                    <div style={{ fontSize: 13, textTransform: 'uppercase', fontWeight: 600, marginTop: 4 }}>{scoring.decision || 'En revisión'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                  <button className="btn btn-ghost" onClick={() => setStep(2)}>Atrás</button>
                  <button className="btn btn-primary" onClick={handlePaso3}>
                    Ver Simulador <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PASO 4 ── */}
      {step === 4 && (
        <div className="card fade-up">
          <div className="card-header">
            <h3>4. Simulación y Decisión Final</h3>
          </div>
          <div className="card-body">
            {loading && !simulacion ? (
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <Calculator size={32} className="spin" style={{ color: 'var(--accent)', marginBottom: '1rem' }} />
                <p>Generando tabla de amortización...</p>
              </div>
            ) : simulacion && simulacion.resumen && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                  <div className="stat-card">
                    <div className="stat-label">Monto Solicitado</div>
                    <div className="stat-value">{formatCOP(simulacion.resumen.monto_credito)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Plazo</div>
                    <div className="stat-value">{formData.plazo_solicitado} meses</div>
                  </div>
                  <div className="stat-card" style={{ background: 'var(--accent-glow)' }}>
                    <div className="stat-label">Cuota Fija Estimada</div>
                    <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 24 }}>{formatCOP(simulacion.resumen.cuota_estimada_total)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Gran Total a Pagar</div>
                    <div className="stat-value">{formatCOP(simulacion.resumen.gran_total)}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <button className="btn btn-ghost" onClick={() => setStep(3)}>Atrás</button>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn" style={{ background: 'var(--danger)', color: 'white' }} onClick={() => tomarDecision('rechazado')} disabled={loading}>Rechazar Crédito</button>
                    <button className="btn" style={{ background: 'var(--success)', color: 'white' }} onClick={() => tomarDecision('aprobado')} disabled={loading}>Aprobar Crédito</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
