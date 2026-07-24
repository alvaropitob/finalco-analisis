import React, { useState, useRef, useEffect } from 'react'
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

const RenderDataObject = ({ data, politicaActiva }) => {
  if (!data || typeof data !== 'object') return <span>{String(data)}</span>
  
  const formatKey = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
      {Object.entries(data).map(([key, value]) => {
        if (key === 'texto_raw' || key === 'archivo' || key === 'tipo') return null; // Ocultar raw y metadatos
        
        let displayValue = String(value);
        if (value === null || value === undefined || value === '') {
          displayValue = 'No encontrado en PDF';
        }

        if (typeof value === 'object' && !Array.isArray(value)) {
          return (
            <div key={key} style={{ gridColumn: '1 / -1', marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                {formatKey(key)}
              </div>
              <RenderDataObject data={value} politicaActiva={politicaActiva} />
            </div>
          )
        }
        
        let color = 'var(--text)';
        let isPolicyCheck = false;
        let policyPassed = false;
        let policyLabel = '';

        if (typeof value === 'boolean') {
          displayValue = value ? 'Sí' : 'No';
          color = value ? 'var(--success)' : 'var(--danger)';
        } else if (typeof value === 'number' && value > 1000) {
          // Asumir moneda si es mayor a 1000 (heurística simple para este dashboard)
          if (key.includes('score')) displayValue = value.toString();
          else displayValue = formatCOP(value);
        }
        
        // --- Comparación de Políticas ---
        if (politicaActiva && politicaActiva.criterios) {
           const criterios = politicaActiva.criterios;
           
           // Scores
           const scoreKeys = ['score', 'score_datacredito', 'score_acierta_mas', 'score_begini'];
           if (scoreKeys.includes(key) && typeof value === 'number') {
              const min = criterios.score_datacredito_minimo || 500;
              isPolicyCheck = true;
              policyPassed = value >= min;
              policyLabel = `Mínimo: ${min}`;
           } else if (key === 'score_cifin' && typeof value === 'number') {
              const min = criterios.score_cifin_minimo || 500;
              isPolicyCheck = true;
              policyPassed = value >= min;
              policyLabel = `Mínimo: ${min}`;
           }
           // Endeudamiento
           else if (key === 'pct_endeudamiento' && typeof value === 'number') {
              const max = criterios.endeudamiento_maximo_pct || 60;
              isPolicyCheck = true;
              policyPassed = value <= max;
              policyLabel = `Máximo: ${max}%`;
           }
           // Moras, embargos, cartera castigada, etc (deben ser 0 idealmente)
           else if ((key === 'embargos' || key === 'saldo_mora' || key === 'cartera_castigada' || key === 'dudoso_recaudo' || key === 'obligaciones_reestructuradas' || key === 'obligaciones_cobro_juridico') && typeof value === 'number') {
              isPolicyCheck = true;
              policyPassed = value === 0;
              policyLabel = `Tolerancia: 0`;
           }
           // Tiempos de mora
           else if (key.startsWith('mora_') && typeof value === 'number') {
              isPolicyCheck = true;
              policyPassed = value === 0;
              policyLabel = `Sin mora`;
           }
        }

        return (
          <div key={key} style={{ padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{formatKey(key)}</div>
            <div style={{ fontSize: 14, fontWeight: 500, color, wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {displayValue}
              {isPolicyCheck && (
                 <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 12, background: policyPassed ? 'var(--success-bg)' : 'var(--danger-bg)', color: policyPassed ? 'var(--success)' : 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                   {policyPassed ? <CheckCircle size={12} /> : <X size={12} />}
                   {policyLabel}
                 </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

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

  // Política Activa (para comparar en Paso 2)
  const [politicaActiva, setPoliticaActiva] = useState(null)

  useEffect(() => {
    api.getPoliticaActiva().then(res => setPoliticaActiva(res)).catch(console.error)
  }, [])

  // Estados UI
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState(null)

  // ── Manejo de Inputs ──────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // ── Paso 1: Cargar Documentos ──────────────────────────────────────
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

  const procesarDocumentos = async () => {
    if (files.length === 0) {
      setError('Por favor sube al menos un documento para continuar.')
      return
    }
    setLoading(true)
    setError(null)
    setLoadingMsg('Procesando documentos...')
    
    const timer = setInterval(() => {
      setLoadingMsg(prev => {
        if (prev === 'Procesando documentos...') return 'Aplicando OCR...'
        if (prev === 'Aplicando OCR...') return 'Extrayendo datos clave...'
        return 'Finalizando extracción...'
      })
    }, 2500)

    try {
      const data = await api.cargarDocumentos(files, null, null)
      clearInterval(timer)
      setLoadingMsg('')
      setAnalisis(data)
      
      let newCedula = formData.cedula
      let newNombres = formData.nombres
      let newApellidos = formData.apellidos
      
      if (data.resultados) {
        data.resultados.forEach(res => {
          if (res.ok && res.datos) {
            if (res.datos.cedula) newCedula = res.datos.cedula;
            if (res.datos.nombres) newNombres = res.datos.nombres;
            if (res.datos.apellidos) newApellidos = res.datos.apellidos;
          }
        })
      }
      
      setFormData(prev => ({
        ...prev,
        cedula: newCedula,
        nombres: newNombres,
        apellidos: newApellidos
      }))
      
      setStep(2)
    } catch (e) {
      clearInterval(timer)
      setLoadingMsg('')
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Paso 2: Guardar Cliente ────────────────────────────────────────
  const guardarDatosCliente = async () => {
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
      setStep(3)
      ejecutarScoring(res.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Paso 3: Calcular Scoring ───────────────────────────────────────
  const ejecutarScoring = async (cid = clienteId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.calcularScoring(cid)
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
          { id: 1, label: 'Cargar Documentos', icon: Upload },
          { id: 2, label: 'Verificar Datos', icon: User },
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

      {/* ── PASO 1: Documentos ── */}
      {step === 1 && (
        <div className="card fade-up">
          <div className="card-header">
            <h3>1. Carga de Documentos</h3>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sube Datacrédito, Cédula, ADRES, etc. para extraer los datos automáticamente.</span>
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
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button className="btn btn-primary" onClick={procesarDocumentos} disabled={loading || files.length === 0}>
                {loading ? <Loader2 className="spin" size={16} /> : <>Extraer Datos <ArrowRight size={16} /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PASO 2: Datos Básicos ── */}
      {step === 2 && (
        <div className="card fade-up">
          <div className="card-header">
            <h3>2. Información Básica del Solicitante</h3>
            <span style={{ fontSize: 13, color: 'var(--success)' }}>Datos extraídos automáticamente. Revisa y completa el monto y plazo.</span>
          </div>
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
            
            {analisis && analisis.resultados && analisis.resultados.length > 0 && (
              <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={18} /> Datos Extraídos de Documentos
                  </h4>
                  {politicaActiva && politicaActiva.criterios ? (
                    <span style={{ fontSize: 12, background: 'var(--success-bg)', color: 'var(--success)', padding: '4px 10px', borderRadius: 12, fontWeight: 500 }}>Política Cargada</span>
                  ) : (
                    <span style={{ fontSize: 12, background: 'var(--danger-bg)', color: 'var(--danger)', padding: '4px 10px', borderRadius: 12, fontWeight: 500 }}>Sin Política</span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                  {analisis.resultados.map((res, i) => (
                    <div key={i} style={{ padding: '1rem', background: 'var(--bg-body)', borderRadius: 8, borderLeft: res.ok ? '4px solid var(--success)' : '4px solid var(--danger)' }}>
                      <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{res.archivo} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 8px', borderRadius: 12, marginLeft: 8 }}>{res.tipo}</span></span>
                        {res.ok ? <CheckCircle size={16} color="var(--success)" /> : <X size={16} color="var(--danger)" />}
                      </div>
                      {res.ok && res.datos ? (
                        <div style={{ marginTop: 12 }}>
                          <RenderDataObject data={res.datos} politicaActiva={politicaActiva} />
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 8, padding: 8, background: 'var(--danger-bg)', borderRadius: 6 }}>
                          {res.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={loading}>Atrás</button>
              <button className="btn btn-primary" onClick={guardarDatosCliente} disabled={loading}>
                {loading ? <Loader2 className="spin" size={16} /> : <>Guardar y Analizar <ArrowRight size={16} /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PASO 3 ── */}
      {step === 3 && (() => {
        // Construir tabla de verificación de políticas con datos extraídos
        const criterios = politicaActiva?.criterios || {}
        const datosExtraidos = {}
        if (analisis?.resultados) {
          analisis.resultados.forEach(r => {
            if (r.ok && r.datos) Object.assign(datosExtraidos, r.datos)
          })
        }

        const checks = [
          {
            campo: 'Score de Crédito',
            clave: 'score_acierta_mas',
            valor: datosExtraidos.score_acierta_mas ?? datosExtraidos.score_datacredito ?? datosExtraidos.score_begini,
            minimo: criterios.score_datacredito_minimo || 550,
            tipo: 'min',
            unidad: 'pts',
          },
          {
            campo: 'Endeudamiento',
            clave: 'pct_endeudamiento',
            valor: datosExtraidos.pct_endeudamiento,
            maximo: criterios.endeudamiento_maximo_pct || 60,
            tipo: 'max',
            unidad: '%',
          },
          {
            campo: 'Embargos',
            clave: 'embargos',
            valor: datosExtraidos.embargos,
            tolerancia: 0,
            tipo: 'zero',
            unidad: '',
          },
          {
            campo: 'Cartera Castigada',
            clave: 'cartera_castigada',
            valor: datosExtraidos.cartera_castigada,
            tolerancia: 0,
            tipo: 'zero',
            unidad: '',
          },
          {
            campo: 'Mora Vigente 30d',
            clave: 'mora_30_vigente',
            valor: datosExtraidos.mora_30_vigente,
            tolerancia: 0,
            tipo: 'zero',
            unidad: '',
          },
          {
            campo: 'Mora Vigente 60d',
            clave: 'mora_60_vigente',
            valor: datosExtraidos.mora_60_vigente,
            tolerancia: 0,
            tipo: 'zero',
            unidad: '',
          },
          {
            campo: 'Mora Histórica 90d',
            clave: 'mora_90_hist_12m',
            valor: datosExtraidos.mora_90_hist_12m,
            tolerancia: 0,
            tipo: 'zero',
            unidad: '',
          },
          {
            campo: 'Dudoso Recaudo',
            clave: 'dudoso_recaudo',
            valor: datosExtraidos.dudoso_recaudo,
            tolerancia: 0,
            tipo: 'zero',
            unidad: '',
          },
        ].filter(c => c.valor !== undefined && c.valor !== null)

        const getResult = (c) => {
          if (c.tipo === 'min') return c.valor >= c.minimo
          if (c.tipo === 'max') return c.valor <= c.maximo
          if (c.tipo === 'zero') return c.valor === 0
          return null
        }
        const getPolicyLabel = (c) => {
          if (c.tipo === 'min') return `Mínimo: ${c.minimo}${c.unidad}`
          if (c.tipo === 'max') return `Máximo: ${c.maximo}${c.unidad}`
          if (c.tipo === 'zero') return `Tolerancia: 0`
          return ''
        }

        const aprobados = checks.filter(c => getResult(c) === true).length
        const rechazados = checks.filter(c => getResult(c) === false).length

        return (
          <div className="card fade-up">
            <div className="card-header">
              <h3>3. Análisis IA y Verificación de Políticas</h3>
            </div>
            <div className="card-body">
              {/* Resumen global */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="stat-card" style={{ background: 'var(--success-bg)', border: '1px solid var(--success)' }}>
                  <div className="stat-label">Criterios Cumplidos</div>
                  <div className="stat-value" style={{ color: 'var(--success)', fontSize: 36 }}>{aprobados}</div>
                </div>
                <div className="stat-card" style={{ background: rechazados > 0 ? 'var(--danger-bg)' : 'var(--bg-surface)', border: `1px solid ${rechazados > 0 ? 'var(--danger)' : 'var(--border)'}` }}>
                  <div className="stat-label">Criterios Incumplidos</div>
                  <div className="stat-value" style={{ color: rechazados > 0 ? 'var(--danger)' : 'var(--text-muted)', fontSize: 36 }}>{rechazados}</div>
                </div>
              </div>

              {checks.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: 10 }}>
                  <AlertCircle size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <p>No se extrajeron datos financieros de los documentos cargados.</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Vuelve al paso anterior y carga el PDF de Preselecta o Datacrédito.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {checks.map((c, i) => {
                    const passed = getResult(c)
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 18px', borderRadius: 10,
                        background: passed ? 'var(--success-bg)' : 'var(--danger-bg)',
                        border: `1px solid ${passed ? 'var(--success)' : 'var(--danger)'}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {passed
                            ? <CheckCircle size={20} color="var(--success)" />
                            : <X size={20} color="var(--danger)" />}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: passed ? 'var(--success)' : 'var(--danger)' }}>{c.campo}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{getPolicyLabel(c)}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: passed ? 'var(--success)' : 'var(--danger)' }}>
                            {c.valor}{c.unidad}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {passed ? 'Cumple' : 'No Cumple'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Scoring del motor IA (si ya se calculó) */}
              {scoring && (
                <div style={{ marginTop: '1.5rem', padding: '1rem 1.5rem', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Motor de Scoring IA</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div>
                      <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>{Number(scoring.puntaje_final).toFixed(0)}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>/ 1000 pts</span>
                    </div>
                    <div style={{
                      padding: '6px 14px', borderRadius: 20, fontWeight: 600, fontSize: 13,
                      background: scoring.decision === 'aprobado' ? 'var(--success-bg)' : scoring.decision === 'rechazado' ? 'var(--danger-bg)' : 'var(--amber-bg)',
                      color: scoring.decision === 'aprobado' ? 'var(--success)' : scoring.decision === 'rechazado' ? 'var(--danger)' : 'var(--amber)',
                    }}>
                      {scoring.banda || scoring.decision || 'En revisión'}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Recomendación Escrita ── */}
              {checks.length > 0 && (() => {
                const montoSolicitado = Number(formData.monto_solicitado) || 0
                const scoreVal = datosExtraidos.score_acierta_mas ?? datosExtraidos.score_datacredito ?? null
                const scoreMin = (politicaActiva?.criterios?.score_datacredito_minimo) || 550
                const endeudamiento = datosExtraidos.pct_endeudamiento ?? null
                const endeudamientoMax = (politicaActiva?.criterios?.endeudamiento_maximo_pct) || 60

                // Señales de riesgo bloqueantes (cualquiera es suficiente para rechazar)
                const tieneEmbargoActivo = (datosExtraidos.embargos || 0) > 0
                const tieneCarteraCastigada = (datosExtraidos.cartera_castigada || 0) > 0
                const tieneMoraVigente = ((datosExtraidos.mora_30_vigente || 0) + (datosExtraidos.mora_60_vigente || 0) + (datosExtraidos.mora_90_vigente || 0)) > 0
                const tieneCarteraDudosa = (datosExtraidos.dudoso_recaudo || 0) > 0

                const fallasCriticas = [
                  tieneEmbargoActivo && 'embargo activo registrado en buró',
                  tieneCarteraCastigada && 'cartera castigada en el historial crediticio',
                  tieneMoraVigente && 'obligaciones con mora vigente no saldada',
                  tieneCarteraDudosa && 'obligaciones de dudoso recaudo',
                ].filter(Boolean)

                const scoreBajo = scoreVal !== null && scoreVal < scoreMin
                const scoreJusto = scoreVal !== null && scoreVal >= scoreMin && scoreVal < scoreMin + 50
                const endeudamientoAlto = endeudamiento !== null && endeudamiento > endeudamientoMax
                const endeudamientoJusto = endeudamiento !== null && endeudamiento > endeudamientoMax * 0.8 && endeudamiento <= endeudamientoMax

                // Calcular monto alternativo (basado en endeudamiento disponible)
                let montoAlternativo = null
                if (endeudamiento !== null && datosExtraidos.ingresos_quanto) {
                  const disponible = (endeudamientoMax / 100 - endeudamiento / 100) * datosExtraidos.ingresos_quanto
                  if (disponible > 0 && disponible < montoSolicitado) {
                    montoAlternativo = Math.floor(disponible * 0.8) // 80% del disponible, por margen de seguridad
                  }
                }

                let tipo, titulo, color, borderColor, lineas

                if (fallasCriticas.length > 0) {
                  // RECHAZO DEFINITIVO
                  tipo = 'rechazado'
                  color = 'var(--danger-bg)'
                  borderColor = 'var(--danger)'
                  titulo = '⚠️ Recomendación: RECHAZAR la solicitud'
                  lineas = [
                    `El perfil crediticio del solicitante presenta ${fallasCriticas.length > 1 ? 'varias señales' : 'una señal'} de riesgo que impiden la aprobación bajo la política vigente.`,
                    `En concreto, se identifica${fallasCriticas.length > 1 ? 'n' : ''}: ${fallasCriticas.join('; ')}.`,
                    `Estas condiciones son incompatibles con la política de crédito de la entidad, independientemente del monto solicitado. Se sugiere notificar al solicitante y dejar la evaluación en estado de rechazo definitivo.`,
                  ]
                } else if (scoreBajo && endeudamientoAlto) {
                  // RECHAZO POR DOBLE FALLO (score + endeudamiento)
                  tipo = 'rechazado'
                  color = 'var(--danger-bg)'
                  borderColor = 'var(--danger)'
                  titulo = '⚠️ Recomendación: RECHAZAR la solicitud'
                  lineas = [
                    `El solicitante no cumple con los criterios mínimos en dos variables clave: el puntaje de crédito (${scoreVal} pts vs mínimo de ${scoreMin} pts) y el nivel de endeudamiento (${endeudamiento}% vs máximo permitido del ${endeudamientoMax}%).`,
                    `La combinación de un score por debajo del umbral y un endeudamiento que supera el límite de la política representa un nivel de riesgo que no es posible mitigar con una reducción de monto.`,
                    `Se recomienda rechazar la solicitud y orientar al solicitante hacia alternativas de saneamiento de deuda antes de volver a postularse.`,
                  ]
                } else if (scoreBajo) {
                  // RECHAZO POR SCORE BAJO
                  tipo = 'rechazado'
                  color = 'var(--danger-bg)'
                  borderColor = 'var(--danger)'
                  titulo = '⚠️ Recomendación: RECHAZAR la solicitud'
                  lineas = [
                    `El puntaje de crédito del solicitante (${scoreVal} pts) está por debajo del mínimo establecido en la política (${scoreMin} pts), lo cual indica un historial crediticio con un nivel de riesgo superior al aceptable.`,
                    `Aunque los demás indicadores son controlables, el score es la variable más determinante en la política y no es posible compensarlo con una reducción del monto. Por esta razón, se recomienda rechazar la solicitud.`,
                  ]
                } else if (endeudamientoAlto && montoAlternativo) {
                  // APROBACIÓN PARCIAL
                  tipo = 'parcial'
                  color = 'var(--amber-bg)'
                  borderColor = 'var(--amber)'
                  titulo = '🟡 Recomendación: APROBAR con monto reducido'
                  lineas = [
                    `El puntaje de crédito del solicitante (${scoreVal} pts) supera el mínimo requerido (${scoreMin} pts), lo cual es una señal positiva. Sin embargo, el nivel de endeudamiento actual (${endeudamiento}%) supera el límite de la política (${endeudamientoMax}%), lo que restringe la capacidad de pago para el monto solicitado de ${formatCOP(montoSolicitado)}.`,
                    `Con base en los ingresos estimados y el margen de endeudamiento disponible, es posible autorizar un monto de hasta ${formatCOP(montoAlternativo)} bajo las condiciones de la política, con un plazo que permita mantener la cuota dentro del límite de capacidad de pago.`,
                    `Se recomienda presentar al solicitante esta alternativa y, si acepta, proceder con la simulación para el monto ajustado.`,
                  ]
                } else if (endeudamientoAlto) {
                  // APROBACIÓN PARCIAL (SIN DATO DE INGRESO PARA CALCULAR MONTO)
                  tipo = 'parcial'
                  color = 'var(--amber-bg)'
                  borderColor = 'var(--amber)'
                  titulo = '🟡 Recomendación: Revisar con monto reducido'
                  lineas = [
                    `El puntaje de crédito es satisfactorio (${scoreVal} pts), pero el nivel de endeudamiento (${endeudamiento}%) supera el máximo permitido (${endeudamientoMax}%).`,
                    `Se recomienda revisar la capacidad de pago real del solicitante con un analista y considerar aprobar un monto menor que mantenga el endeudamiento total dentro del límite de la política.`,
                  ]
                } else if (scoreJusto || endeudamientoJusto) {
                  // APROBACIÓN CON OBSERVACIÓN
                  tipo = 'aprobado'
                  color = 'var(--success-bg)'
                  borderColor = 'var(--success)'
                  titulo = '✅ Recomendación: APROBAR con observación'
                  lineas = [
                    `El solicitante cumple con todos los criterios de la política de crédito vigente. Se puede proceder con la aprobación del monto solicitado de ${formatCOP(montoSolicitado)}.`,
                    scoreJusto ? `Sin embargo, el puntaje de crédito (${scoreVal} pts) se encuentra justo sobre el umbral mínimo (${scoreMin} pts), lo que sugiere un perfil de riesgo moderado. Se recomienda realizar un seguimiento periódico de la obligación durante los primeros 6 meses.` : '',
                    endeudamientoJusto ? `El nivel de endeudamiento (${endeudamiento}%) está cerca del límite máximo, por lo que no se recomienda aprobar créditos adicionales para este cliente en el corto plazo.` : '',
                  ].filter(Boolean)
                } else {
                  // APROBACIÓN PLENA
                  tipo = 'aprobado'
                  color = 'var(--success-bg)'
                  borderColor = 'var(--success)'
                  titulo = '✅ Recomendación: APROBAR el monto solicitado'
                  lineas = [
                    `El solicitante cumple satisfactoriamente con todos los criterios de la política de crédito vigente.${scoreVal ? ` El puntaje de crédito de ${scoreVal} pts está por encima del mínimo requerido (${scoreMin} pts).` : ''}${endeudamiento ? ` El nivel de endeudamiento de ${endeudamiento}% está dentro del límite máximo permitido (${endeudamientoMax}%).` : ''}`,
                    `No se identifican señales de alerta en el historial de moras, embargos ni cartera castigada. El perfil de riesgo es compatible con la aprobación del monto solicitado de ${formatCOP(montoSolicitado)}.`,
                    `Se puede proceder con la generación de la simulación de crédito y la formalización del desembolso.`,
                  ]
                }

                return (
                  <div style={{ marginTop: '1.5rem', padding: '1.5rem', borderRadius: 12, background: color, border: `1px solid ${borderColor}` }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: '1rem', color: tipo === 'rechazado' ? 'var(--danger)' : tipo === 'parcial' ? 'var(--amber)' : 'var(--success)' }}>
                      {titulo}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {lineas.map((l, i) => (
                        <p key={i} style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>
                          {l}
                        </p>
                      ))}
                    </div>
                    {montoAlternativo && tipo === 'parcial' && (
                      <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.6)', borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
                        💡 Monto alternativo sugerido: <span style={{ color: 'var(--primary)', fontSize: 16 }}>{formatCOP(montoAlternativo)}</span>
                      </div>
                    )}
                  </div>
                )
              })()}

              {!scoring && !loading && (
                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <button className="btn btn-primary" onClick={ejecutarScoring}>Ejecutar Motor de Scoring IA</button>
                </div>
              )}
              {loading && !scoring && (
                <div style={{ marginTop: '1.5rem', textAlign: 'center', padding: '1rem' }}>
                  <Loader2 size={24} className="spin" style={{ color: 'var(--primary)' }} />
                  <p style={{ marginTop: 8, color: 'var(--text-muted)' }}>Calculando scoring...</p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <button className="btn btn-ghost" onClick={() => setStep(2)}>Atrás</button>
                <button className="btn btn-primary" onClick={handlePaso3}>
                  Ver Simulador <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
