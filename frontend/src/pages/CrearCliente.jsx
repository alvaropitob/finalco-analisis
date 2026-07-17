import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { 
  Upload, User, Hash, Calendar, MapPin, 
  CheckCircle, AlertCircle, Loader2, X,
  FileText, TrendingUp, Save, Search, 
  Briefcase, Heart, Ruler
} from 'lucide-react'

const EMPTY_FORM = {
  apellidos: '',
  nombres: '',
  cedula: '',
  fecha_nacimiento: '',
  lugar_nacimiento: '',
  fecha_expedicion: '',
  lugar_expedicion: '',
  sexo: '',
  estatura: '',
  grupo_sanguineo: '',
}

export default function CrearCliente() {
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [procesando, setProcesando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  
  const [formData, setFormData] = useState(EMPTY_FORM)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFiles = async (newFiles) => {
    const validFiles = Array.from(newFiles).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf')
    if (validFiles.length === 0) return

    const startIndex = files.length
    setFiles(prev => [...prev, ...validFiles])
    
    // Generar previews
    const newPreviews = validFiles.map(f => f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
    setPreviews(prev => [...prev, ...newPreviews])

    // ANALIZAR EN TIEMPO REAL PARA PREVISUALIZACIÓN
    for (const file of validFiles) {
      try {
        setProcesando(true)
        const data = await api.analizarArchivo(file)
        
        // Mezclar con datos existentes (rellenar lo que esté vacío)
        setFormData(prev => {
          const next = { ...prev }
          Object.keys(data).forEach(key => {
            if (data[key] && !next[key] && key in EMPTY_FORM) {
              next[key] = data[key]
            }
          })
          return next
        })
        setResultado(true) // Activa la vista del formulario
      } catch (err) {
        console.error("Error en previsualización rápida:", err)
      } finally {
        setProcesando(false)
      }
    }
  }

  function handleFileChange(e) {
    handleFiles(e.target.files)
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function guardar() {
    setProcesando(true)
    setError(null)
    try {
      const payload = {
        ...formData,
        nombre: `${formData.apellidos} ${formData.nombres}`.trim() || 'Sin Nombre',
        es_confiable: true,
        nivel_riesgo: 'bajo'
      }
      const res = await api.guardarCliente(payload)
      navigate(`/clientes/${res.id}`)
    } catch (e) {
      setError(e.message)
      setProcesando(false)
    }
  }

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div>
          <h2>Nuevo Cliente</h2>
          <p>Carga documentos de identidad para extraer información automáticamente</p>
        </div>
      </div>

      <div className="crear-layout">
        
        {/* Panel Superior: Carga de Archivos */}
        <div className="card upload-card" style={{ marginBottom: '2rem' }}>
          <div 
            className="upload-zone-wide"
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragging') }}
            onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('dragging') }}
            onDrop={e => {
              e.preventDefault(); e.currentTarget.classList.remove('dragging')
              handleFiles(e.dataTransfer.files)
            }}
          >
            <div className="upload-main-cta">
              <div className="upload-icon-circle"><Upload size={28} color="var(--primary)" /></div>
              <div>
                <h4>Carga Fotos de la Cédula (Frente y Atrás)</h4>
                <p>Arrastra los archivos o haz clic para seleccionarlos</p>
              </div>
              <input 
                type="file" multiple accept="image/*,.pdf" 
                onChange={handleFileChange} 
                style={{ display: 'none' }} id="file-upload" 
              />
              <label htmlFor="file-upload" className="btn btn-primary" style={{ cursor: 'pointer' }}>
                Seleccionar Archivos
              </label>
            </div>
          </div>

          {files.length > 0 && (
            <div className="file-scroll-container">
              {files.map((f, i) => (
                <div key={i} className="file-item fade-up">
                  <div className="file-header">
                    <div className="file-icon-bg">
                      {f.type.startsWith('image/') ? <img src={previews[i]} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} /> : <FileText size={16} color="var(--primary)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: '120px' }}>
                      <div className="file-name" title={f.name}>{f.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{(f.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button onClick={() => removeFile(i)} className="btn-icon-danger"><X size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {procesando && (
            <div className="processing-bar fade-up">
              <Loader2 className="spin" size={16} />
              <span>Extrayendo información en tiempo real...</span>
            </div>
          )}
        </div>

        {/* Panel Inferior: Formulario con Previsualización */}
        {(resultado || files.length > 0) && (
          <div className="card fade-up">
            <div className="card-header">
              <h3 className="section-label">Información Detectada (Previsualización)</h3>
              {procesando ? <span className="status-badge processing">Extrayendo...</span> : <span className="status-badge success">Datos cargados</span>}
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label"><User size={13} /> Apellidos</label>
                <input className="form-input" name="apellidos" value={formData.apellidos} onChange={handleChange} placeholder="..." />
              </div>
              <div className="form-group">
                <label className="form-label"><User size={13} /> Nombres</label>
                <input className="form-input" name="nombres" value={formData.nombres} onChange={handleChange} placeholder="..." />
              </div>
              <div className="form-group">
                <label className="form-label"><Hash size={13} /> Cédula</label>
                <input className="form-input" name="cedula" value={formData.cedula} onChange={handleChange} placeholder="..." />
              </div>

              <div className="form-group">
                <label className="form-label"><Calendar size={13} /> Fecha Nacimiento</label>
                <input className="form-input" type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label"><MapPin size={13} /> Lugar Nacimiento</label>
                <input className="form-input" name="lugar_nacimiento" value={formData.lugar_nacimiento} onChange={handleChange} placeholder="..." />
              </div>
              <div className="form-group">
                <label className="form-label"><Calendar size={13} /> Fecha Expedición</label>
                <input className="form-input" type="date" name="fecha_expedicion" value={formData.fecha_expedicion} onChange={handleChange} />
              </div>

              <div className="form-group">
                <label className="form-label"><Briefcase size={13} /> Sexo</label>
                <select className="form-input" name="sexo" value={formData.sexo} onChange={handleChange}>
                  <option value="">Seleccionar...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label"><Ruler size={13} /> Estatura (m)</label>
                <input className="form-input" name="estatura" value={formData.estatura} onChange={handleChange} placeholder="Ej: 1.75" />
              </div>
              <div className="form-group">
                <label className="form-label"><Heart size={13} /> Grupo Sanguíneo</label>
                <input className="form-input" name="grupo_sanguineo" value={formData.grupo_sanguineo} onChange={handleChange} placeholder="Ej: O+" />
              </div>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginTop: '1.5rem' }}>
                <AlertCircle size={16} /> <span>{error}</span>
              </div>
            )}

            <div className="form-actions" style={{ marginTop: '2.5rem' }}>
              <button className="btn btn-ghost" onClick={() => navigate('/clientes')}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={procesando}>
                {procesando ? <Loader2 className="spin" size={18} /> : <><Save size={18} /> Guardar Cliente</>}
              </button>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .crear-layout { max-width: 1000px; margin: 0 auto; }
        .upload-card { padding: 1rem; }
        .upload-zone-wide { border: 2px dashed var(--border); border-radius: 12px; padding: 2.5rem; transition: all 0.2s; background: rgba(255,255,255,0.02); }
        .upload-zone-wide.dragging { border-color: var(--primary); background: rgba(59,113,254,0.05); }
        .upload-main-cta { display: flex; align-items: center; gap: 1.5rem; }
        .upload-main-cta h4 { font-size: 1.1rem; margin-bottom: 4px; }
        .upload-main-cta p { font-size: 13px; color: var(--text3); }
        .upload-icon-circle { width: 56px; height: 56px; border-radius: 50%; background: rgba(59,113,254,0.1); display: flex; align-items: center; justify-content: center; }
        
        .file-scroll-container { display: flex; gap: 10px; overflow-x: auto; padding: 15px 5px; margin-top: 1rem; border-top: 1px solid var(--border); }
        .file-scroll-container::-webkit-scrollbar { height: 4px; }
        .file-scroll-container::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 10px; }
        
        .file-item { background: var(--bg); padding: 8px; border-radius: 8px; border: 1px solid var(--border); flex-shrink: 0; min-width: 200px; }
        .file-header { display: flex; align-items: center; gap: 10px; }
        .file-icon-bg { width: 32px; height: 32px; border-radius: 6px; background: rgba(59,113,254,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
        .file-name { font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        
        .processing-bar { display: flex; align-items: center; gap: 10px; margin-top: 1rem; padding: 10px 15px; background: var(--primary-light); color: var(--primary); border-radius: 8px; font-size: 13px; font-weight: 500; }
        
        .form-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-top: 1.5rem; }
        .status-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; }
        .status-badge.processing { background: var(--primary-light); color: var(--primary); }
        .status-badge.success { background: var(--green-bg); color: var(--green); }
        
        .btn-icon-danger { width: 24px; height: 24px; border-radius: 50%; border: none; background: rgba(220,38,38,0.1); color: var(--red); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .btn-icon-danger:hover { background: var(--red); color: white; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        @media (max-width: 768px) { .form-grid-3 { grid-template-columns: 1fr 1fr; } .upload-main-cta { flex-direction: column; text-align: center; } }
      `}} />
    </div>
  )
}
