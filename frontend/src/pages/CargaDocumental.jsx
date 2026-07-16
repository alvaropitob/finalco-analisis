import React, { useState, useRef } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { api } from '../api/client'

const DOC_TYPES = [
  { key: 'cc',          label: 'Cédula (CC)',        accept: '.pdf', color: '#6366f1' },
  { key: 'datacredito', label: 'DataCrédito (PN)',   accept: '.pdf', color: '#0ea5e9' },
  { key: 'preselecta',  label: 'Preselecta',         accept: '.pdf', color: '#8b5cf6' },
  { key: 'adres',       label: 'ADRES (BDUA)',       accept: '.pdf', color: '#10b981' },
  { key: 'begini',      label: 'Begini',             accept: '.pdf', color: '#f59e0b' },
  { key: 'runt',        label: 'RUNT / Activos',     accept: '.pdf', color: '#ef4444' },
  { key: 'digiventure', label: 'Digiventure (XLSX)', accept: '.xlsx,.xls', color: '#059669' },
]

export default function CargaDocumental() {
  const [files, setFiles] = useState([])
  const [cedula, setCedula] = useState('')
  const [resultado, setResultado] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const addFiles = (newFiles) => {
    const arr = Array.from(newFiles).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase()
      return ['pdf', 'xlsx', 'xls'].includes(ext)
    })
    setFiles(prev => [...prev, ...arr])
  }

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx))

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }

  const detectType = (name) => {
    const n = name.toLowerCase()
    if (n.includes('adres')) return 'adres'
    if (n.includes('begini')) return 'begini'
    if (n.includes('preselecta')) return 'preselecta'
    if (n.includes('runt')) return 'runt'
    if (n.startsWith('dg_') || n.includes('digiventure')) return 'digiventure'
    if (n.startsWith('pn-') || n.startsWith('pn_')) return 'datacredito'
    if (n.startsWith('cc_') || n.includes('cedula')) return 'cc'
    return 'desconocido'
  }

  const getTypeInfo = (name) => {
    const type = detectType(name)
    return DOC_TYPES.find(d => d.key === type) || { label: 'Documento', color: '#6b7280' }
  }

  const cargar = async () => {
    if (files.length === 0) return
    setUploading(true)
    setResultado(null)
    try {
      const data = await api.cargarDocumentos(files, null, cedula || null)
      setResultado(data)
    } catch (e) {
      setResultado({ error: e.message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Upload size={24} /> Carga Documental
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Sube los documentos del cliente para análisis automático
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* ── Panel de carga ── */}
        <div className="card">
          <div className="card-header"><h3>Documentos Aceptados</h3></div>
          <div className="card-body">
            {/* Cédula input */}
            <div style={{ marginBottom: 16 }}>
              <label className="field-label">Cédula del cliente (opcional)</label>
              <input
                className="input" placeholder="Ej: 1104701529"
                value={cedula} onChange={e => setCedula(e.target.value)}
              />
            </div>

            {/* Tipos de documento */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {DOC_TYPES.map(d => (
                <span key={d.key} style={{
                  fontSize: 12, padding: '4px 10px', borderRadius: 20,
                  background: d.color + '18', color: d.color, fontWeight: 500,
                }}>
                  {d.label}
                </span>
              ))}
            </div>

            {/* Drop zone */}
            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                padding: 40,
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'var(--accent-glow)' : 'var(--bg-surface)',
                transition: 'all 0.2s ease',
              }}
            >
              <Upload size={32} style={{ color: 'var(--accent)', marginBottom: 8 }} />
              <p style={{ fontWeight: 500 }}>Arrastra archivos aquí o haz clic para seleccionar</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>PDF, XLSX — Múltiples archivos permitidos</p>
              <input
                ref={fileRef} type="file" multiple
                accept=".pdf,.xlsx,.xls" style={{ display: 'none' }}
                onChange={e => { addFiles(e.target.files); e.target.value = '' }}
              />
            </div>

            {/* Files list */}
            {files.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="field-label">{files.length} archivo(s) seleccionado(s)</div>
                {files.map((f, i) => {
                  const info = getTypeInfo(f.name)
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 8,
                      background: 'var(--bg-surface)', marginBottom: 4,
                    }}>
                      <FileText size={16} style={{ color: info.color }} />
                      <span style={{ flex: 1, fontSize: 13 }}>{f.name}</span>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 10,
                        background: info.color + '18', color: info.color,
                      }}>
                        {info.label}
                      </span>
                      <button onClick={() => removeFile(i)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 2,
                      }}>
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}

                <button
                  className="btn btn-primary"
                  onClick={cargar}
                  disabled={uploading}
                  style={{ marginTop: 12, width: '100%' }}
                >
                  {uploading ? (
                    <><Loader size={14} className="spin" /> Procesando...</>
                  ) : (
                    <><Upload size={14} /> Procesar {files.length} Documento(s)</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Panel de resultados ── */}
        <div className="card">
          <div className="card-header"><h3>Resultados del Análisis</h3></div>
          <div className="card-body">
            {!resultado && !uploading && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <FileText size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p>Los resultados del análisis aparecerán aquí</p>
              </div>
            )}

            {uploading && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Loader size={32} className="spin" style={{ color: 'var(--accent)', marginBottom: 12 }} />
                <p>Analizando documentos...</p>
              </div>
            )}

            {resultado?.error && (
              <div className="alert alert-danger">{resultado.error}</div>
            )}

            {resultado?.resultados && (
              <div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div className="stat-card" style={{ flex: 1, background: 'var(--success-bg)' }}>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{resultado.procesados}</div>
                    <div className="stat-label">Procesados</div>
                  </div>
                  <div className="stat-card" style={{ flex: 1, background: resultado.errores ? 'var(--danger-bg)' : 'var(--bg-surface)' }}>
                    <div className="stat-value" style={{ color: resultado.errores ? 'var(--danger)' : 'var(--text-muted)' }}>{resultado.errores}</div>
                    <div className="stat-label">Errores</div>
                  </div>
                </div>

                {resultado.resultados.map((r, i) => (
                  <div key={i} style={{
                    padding: 12, borderRadius: 8, marginBottom: 8,
                    background: r.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
                    border: `1px solid ${r.ok ? 'var(--success)' : 'var(--danger)'}20`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      {r.ok ? <CheckCircle size={14} color="var(--success)" /> : <AlertCircle size={14} color="var(--danger)" />}
                      <strong style={{ fontSize: 13 }}>{r.archivo}</strong>
                      <span style={{
                        marginLeft: 'auto', fontSize: 11, padding: '2px 8px',
                        borderRadius: 10, background: 'var(--bg-card)', fontWeight: 500,
                      }}>
                        {r.tipo}
                      </span>
                    </div>
                    {r.error && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{r.error}</p>}
                    {r.ok && r.datos && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {r.tipo === 'adres' && r.datos.estado_adres && (
                          <span>Estado: <strong>{r.datos.estado_adres}</strong> — {r.datos.regimen} — {r.datos.entidad_eps}</span>
                        )}
                        {r.tipo === 'preselecta' && (
                          <span>Score: <strong>{r.datos.score_acierta_mas}</strong> — Decisión: <strong>{r.datos.decision_preselecta}</strong></span>
                        )}
                        {r.tipo === 'begini' && (
                          <span>Score Begini: <strong>{r.datos.score_begini ?? 'Sin dato'}</strong> — {r.datos.nivel_riesgo_begini || 'Requiere OCR'}</span>
                        )}
                        {r.tipo === 'runt' && (
                          <span>Vehículo: <strong>{r.datos.tiene_vehiculo ? 'Sí' : 'No'}</strong>
                            {r.datos.vehiculos?.[0]?.marca && ` — ${r.datos.vehiculos[0].marca} ${r.datos.vehiculos[0].linea} ${r.datos.vehiculos[0].modelo}`}
                          </span>
                        )}
                        {r.tipo === 'digiventure' && (
                          <span>
                            {r.datos.nombre_solicitante && `${r.datos.nombre_solicitante} — `}
                            Banda: <strong>{r.datos.banda || '—'}</strong> — Puntaje: <strong>{r.datos.puntaje_final ? Number(r.datos.puntaje_final).toFixed(1) : '—'}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
