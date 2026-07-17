import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { FolderOpen, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react'

const EJEMPLOS = [
  './clientes/juan_garcia',
  './clientes/maria_lopez',
  '/home/usuario/documentos/credito/carlos_perez',
]

export default function Analizar() {
  const navigate = useNavigate()
  const [carpeta, setCarpeta] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [pasos, setPasos] = useState([])

  async function analizar() {
    if (!carpeta.trim()) return
    setProcesando(true)
    setError(null)
    setResultado(null)
    setPasos([])

    const steps = [
      'Leyendo archivos de la carpeta...',
      'Aplicando OCR a imágenes y PDFs escaneados...',
      'Enviando documentos a Claude para análisis...',
      'Extrayendo información del cliente...',
      'Guardando en PostgreSQL...',
    ]

    // Simular pasos progresivos
    for (let i = 0; i < steps.length - 1; i++) {
      await new Promise(r => setTimeout(r, 600))
      setPasos(prev => [...prev, { texto: steps[i], ok: true }])
    }

    try {
      const data = await api.analizarCarpeta(carpeta.trim())
      setPasos(prev => [...prev, { texto: steps[steps.length - 1], ok: true }])
      setResultado(data)
    } catch (e) {
      setPasos(prev => [...prev, { texto: 'Error en el procesamiento', ok: false }])
      setError(e.message)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="page fade-up">
      <div className="page-header">
        <h2>Analizar documentos</h2>
        <p>Procesa una carpeta de cliente — la IA extrae y guarda toda la información</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
              Ruta de la carpeta
            </h3>

            <div className="form-group">
              <label className="form-label">Ruta absoluta o relativa al servidor</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <FolderOpen size={16} style={{ flexShrink: 0, alignSelf: 'center', color: 'var(--text3)' }} />
                <input className="form-input" value={carpeta}
                  onChange={e => setCarpeta(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && analizar()}
                  placeholder="/ruta/carpeta/cliente" />
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }}
              onClick={analizar} disabled={procesando || !carpeta.trim()}>
              {procesando ? <><span className="loader" /> Procesando...</> : 'Analizar con IA'}
            </button>

            {/* Pasos */}
            {pasos.length > 0 && (
              <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pasos.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                    color: p.ok ? 'var(--text2)' : 'var(--red)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%',
                      background: p.ok ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
                    {p.texto}
                  </div>
                ))}
                {procesando && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text3)' }}>
                    <div className="loader" style={{ width: 8, height: 8 }} />
                    Procesando...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Formatos soportados */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '1.05rem', marginBottom: '1rem' }}>
              Formatos soportados
            </h3>
            {[
              ['PDF digital', 'Extracción de texto nativa'],
              ['PDF escaneado', 'OCR automático en español'],
              ['JPG / PNG', 'OCR + análisis visual con IA'],
              ['DOCX / DOC', 'Extracción directa de texto'],
            ].map(([fmt, desc]) => (
              <div key={fmt} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{fmt}</span>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>{desc}</span>
              </div>
            ))}
            <div style={{ marginTop: '1rem', fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
              La IA detecta automáticamente el tipo de cada documento por el nombre del archivo
              (cedul*, datacredit*, cifin*, informe*, reporte*).
            </div>
          </div>
        </div>

        <div>
          {/* Resultado */}
          {resultado && (
            <div className="card fade-up" style={{ marginBottom: '1.5rem', border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
                <CheckCircle size={18} color="var(--green)" />
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '1.1rem' }}>
                  Procesado exitosamente
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '1rem' }}>
                {[
                  ['Nombre', resultado.nombre],
                  ['Cédula', resultado.cedula],
                  ['Score DC', resultado.score_datacredito],
                  ['Score CIFIN', resultado.score_cifin],
                  ['Endeudamiento', resultado.endeudamiento_datacredito ? `${resultado.endeudamiento_datacredito}%` : '—'],
                  ['Riesgo', resultado.nivel_riesgo],
                ].map(([l, v]) => (
                  <div key={l} style={{ padding: '0.6rem 0.875rem', background: 'var(--bg3)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginTop: 2 }}>{v || '—'}</div>
                  </div>
                ))}
              </div>

              {resultado.resumen_ia && (
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: '1rem', fontStyle: 'italic' }}>
                  "{resultado.resumen_ia}"
                </p>
              )}

              <button className="btn btn-ghost" style={{ width: '100%' }}
                onClick={() => navigate(`/clientes/${resultado._cliente_id}`)}>
                Ver perfil completo <ChevronRight size={14} />
              </button>
            </div>
          )}

          {error && (
            <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(239,68,68,0.2)', background: 'var(--red-bg)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={16} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--red)', marginBottom: 4 }}>Error al procesar</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Estructura de carpeta recomendada */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '1.05rem', marginBottom: '1rem' }}>
              Estructura recomendada
            </h3>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text2)', lineHeight: 2, background: 'var(--bg3)', borderRadius: 8, padding: '1rem' }}>
              <div style={{ color: 'var(--accent)' }}>clientes/</div>
              <div style={{ paddingLeft: '1.25rem', color: 'var(--text3)' }}>└── carlos_perez/</div>
              <div style={{ paddingLeft: '2.5rem' }}>├── <span style={{ color: 'var(--green)' }}>cedula.jpg</span></div>
              <div style={{ paddingLeft: '2.5rem' }}>├── <span style={{ color: 'var(--amber)' }}>datacredito.pdf</span></div>
              <div style={{ paddingLeft: '2.5rem' }}>├── <span style={{ color: 'var(--amber)' }}>cifin.pdf</span></div>
              <div style={{ paddingLeft: '2.5rem' }}>└── <span style={{ color: 'var(--accent)' }}>informe_confiabilidad.pdf</span></div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Ejemplos de rutas:</div>
              {EJEMPLOS.map(e => (
                <button key={e} className="btn btn-ghost" style={{ display: 'block', width: '100%', marginBottom: 6, justifyContent: 'flex-start', fontSize: 12, fontFamily: 'monospace' }}
                  onClick={() => setCarpeta(e)}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
