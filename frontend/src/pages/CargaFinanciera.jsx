import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { 
  Upload, FileText, CheckCircle, AlertCircle, 
  Loader2, CreditCard, TrendingUp, DollarSign,
  Save, X, RefreshCw, Search, ArrowRight, Hash,
  ShieldCheck, AlertTriangle, Activity, Briefcase
} from 'lucide-react'

export default function CargaFinanciera() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  
  const [cedulaBusqueda, setCedulaBusqueda] = useState('')
  const [clienteEncontrado, setClienteEncontrado] = useState(null)
  
  const [formData, setFormData] = useState({
    score_datacredito: 0,
    endeudamiento_datacredito: 0,
    score_cifin: 0,
    obligaciones_cifin: 0,
    mora_maxima: 0,
    huellas_consulta: 0,
    saldo_total: 0,
    cupo_total: 0,
    cuentas_abiertas: 0,
    estado_cedula: 'VIGENTE',
    es_confiable: true,
    resumen_ia: ''
  })

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function buscarCliente() {
    if (!cedulaBusqueda) return
    try {
      setProcesando(true)
      const res = await api.getClientes({ buscar: cedulaBusqueda })
      if (res.items && res.items.length > 0) {
        setClienteEncontrado(res.items[0])
        setError(null)
      } else {
        setClienteEncontrado(null)
        setError('No se encontró ningún cliente con esa cédula. Créalo primero.')
      }
    } catch (e) {
      setError('Error al buscar cliente: ' + e.message)
    } finally {
      setProcesando(false)
    }
  }

  async function analizarArchivo(fileToProcess) {
    const f = fileToProcess || file
    if (!f) return
    setProcesando(true)
    setError(null)
    try {
      const data = await api.analizarArchivo(f)
      setResultado(data)
      setFormData({
        score_datacredito: data.score_datacredito || 0,
        endeudamiento_datacredito: data.endeudamiento_datacredito || 0,
        score_cifin: data.score_cifin || 0,
        obligaciones_cifin: data.obligaciones_cifin || 0,
        mora_maxima: data.mora_maxima || 0,
        huellas_consulta: data.huellas_consulta || 0,
        saldo_total: data.saldo_total || 0,
        cupo_total: data.cupo_total || 0,
        cuentas_abiertas: data.cuentas_abiertas || 0,
        estado_cedula: data.estado_cedula || 'VIGENTE',
        es_confiable: data.es_confiable !== false,
        resumen_ia: data.resumen_ia || ''
      })

      if (data.cedula) {
        setCedulaBusqueda(data.cedula)
        const res = await api.getClientes({ buscar: data.cedula })
        if (res.items && res.items.length > 0) {
          setClienteEncontrado(res.items[0])
        }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setProcesando(false)
    }
  }

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setError(null)
    setResultado(null)
    if (f.type === 'application/pdf') {
      setPreview(URL.createObjectURL(f))
      analizarArchivo(f)
    }
  }

  async function actualizar() {
    if (!clienteEncontrado) {
      setError('Debes asociar el documento a un cliente.')
      return
    }
    try {
      setProcesando(true)
      const payload = {
        ...clienteEncontrado,
        ...formData,
        cedula: clienteEncontrado.cedula
      }
      await api.guardarCliente(payload)
      navigate(`/clientes/${clienteEncontrado.id}`)
    } catch (e) {
      setError('Error: ' + e.message)
      setProcesando(false)
    }
  }

  function reset() {
    setFile(null); setPreview(null); setResultado(null)
    setError(null); setClienteEncontrado(null); setCedulaBusqueda('')
  }

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div>
          <h2>Carga de Buró Financiero</h2>
          <p>Extracción avanzada de reportes DataCrédito y CIFIN</p>
        </div>
      </div>

      <div className="crear-layout split">
        <div className="upload-panel">
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 className="section-label">Paso 1: Reporte PDF</h3>
            {!file ? (
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                <Upload size={24} color="var(--primary)" />
                <p>Cargar Reporte Financiero</p>
              </div>
            ) : (
              <div className="file-header">
                <FileText size={18} color="var(--primary)" />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="file-name">{file.name}</div>
                </div>
                <button onClick={() => setFile(null)} className="btn-icon-danger"><X size={16} /></button>
              </div>
            )}
            {procesando && !resultado && (
              <div className="processing-bar"><Loader2 className="spin" size={16} /> Analizando...</div>
            )}
          </div>

          <div className="card">
            <h3 className="section-label">Paso 2: Cliente</h3>
            <div className="form-group" style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" placeholder="Cédula..." value={cedulaBusqueda} onChange={e => setCedulaBusqueda(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarCliente()} />
              <button className="btn btn-primary" onClick={buscarCliente}><Search size={16} /></button>
            </div>
            {clienteEncontrado && (
              <div className="success-badge"><CheckCircle size={14} /> {clienteEncontrado.nombre}</div>
            )}
          </div>

          {error && <div className="alert alert-danger" style={{ marginTop: '1rem' }}>{error}</div>}
        </div>

        <div className="result-panel">
          {resultado ? (
            <div className="card fade-up">
              <div className="result-header">
                <TrendingUp size={20} color="var(--green)" />
                <h3>Resultados de la Extracción</h3>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label"><Activity size={13} /> Score DataCrédito</label>
                  <input className="form-input" type="number" value={formData.score_datacredito} onChange={e => setFormData({...formData, score_datacredito: parseInt(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label"><TrendingUp size={13} /> Endeudamiento (%)</label>
                  <input className="form-input" type="number" step="0.01" value={formData.endeudamiento_datacredito} onChange={e => setFormData({...formData, endeudamiento_datacredito: parseFloat(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label"><AlertTriangle size={13} /> Mora Máxima (Meses)</label>
                  <input className="form-input" type="number" value={formData.mora_maxima} onChange={e => setFormData({...formData, mora_maxima: parseInt(e.target.value)})} />
                </div>

                <div className="form-group">
                  <label className="form-label"><Search size={13} /> Huellas Consulta (6m)</label>
                  <input className="form-input" type="number" value={formData.huellas_consulta} onChange={e => setFormData({...formData, huellas_consulta: parseInt(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label"><DollarSign size={13} /> Saldo Total</label>
                  <input className="form-input" type="number" value={formData.saldo_total} onChange={e => setFormData({...formData, saldo_total: parseInt(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label"><CreditCard size={13} /> Cupo Total</label>
                  <input className="form-input" type="number" value={formData.cupo_total} onChange={e => setFormData({...formData, cupo_total: parseInt(e.target.value)})} />
                </div>

                <div className="form-group">
                  <label className="form-label"><Briefcase size={13} /> Cuentas Abiertas</label>
                  <input className="form-input" type="number" value={formData.cuentas_abiertas} onChange={e => setFormData({...formData, cuentas_abiertas: parseInt(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label"><ShieldCheck size={13} /> Estado Identificación</label>
                  <input className="form-input" value={formData.estado_cedula} onChange={e => setFormData({...formData, estado_cedula: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label"><Activity size={13} /> Score CIFIN</label>
                  <input className="form-input" type="number" value={formData.score_cifin} onChange={e => setFormData({...formData, score_cifin: parseInt(e.target.value)})} />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">Resumen y Recomendación de IA</label>
                <textarea className="form-input" rows={4} value={formData.resumen_ia} onChange={e => setFormData({...formData, resumen_ia: e.target.value})} style={{ resize: 'none' }} />
              </div>

              <div className="form-actions" style={{ marginTop: '2rem' }}>
                <button className="btn btn-ghost" onClick={reset}>Reiniciar</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={actualizar} disabled={procesando}>
                  <Save size={18} /> Actualizar Perfil Crediticio
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <FileText size={48} color="var(--bg3)" />
              <p>Los datos extraídos aparecerán aquí</p>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .crear-layout { display: grid; gap: 2rem; grid-template-columns: 380px 1fr; }
        .upload-panel { display: flex; flex-direction: column; gap: 1.5rem; }
        .result-panel { min-height: 500px; }
        .result-header { display: flex; align-items: center; gap: 12px; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
        .form-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
        .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text3); margin-bottom: 1rem; }
        .upload-zone { border: 2px dashed var(--border); border-radius: 12px; padding: 2rem; display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; }
        .file-header { display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--bg3); border-radius: 8px; }
        .processing-bar { display: flex; align-items: center; gap: 10px; margin-top: 1rem; color: var(--primary); font-size: 13px; }
        .success-badge { padding: 8px 12px; background: rgba(34,197,94,0.1); color: var(--green); border-radius: 8px; font-size: 13px; display: flex; align-items: center; gap: 8px; margin-top: 10px; }
        .empty-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text3); border: 2px dashed var(--border); border-radius: 12px; gap: 1rem; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
      <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".pdf" />
    </div>
  )
}
