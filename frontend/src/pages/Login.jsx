import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Lock, Mail, AlertCircle } from 'lucide-react'
import api from '../api/client'

const ROL_REDIRECT = {
  admin:    '/',
  analista: '/',
  asesor:   '/clientes',
  cliente:  '/clientes',
}

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await api.login(form.email, form.password)
      localStorage.setItem('token',    data.access_token)
      localStorage.setItem('refresh',  data.refresh_token)
      localStorage.setItem('rol',      data.rol)
      localStorage.setItem('nombre',   data.nombre)
      navigate(ROL_REDIRECT[data.rol] ?? '/')
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.root}>
      {/* Panel izquierdo — branding */}
      <div style={styles.brand}>
        <div style={styles.brandInner}>
          <div style={styles.logoBox}>
            <TrendingUp size={28} color="#fff" />
          </div>
          <h1 style={styles.brandTitle}>Crédito<span style={{ color: '#61CE70' }}>IA</span></h1>
          <p style={styles.brandSub}>Sistema de análisis crediticio inteligente</p>
          <div style={styles.pillsRow}>
            {['Web', 'Android', 'iOS'].map(p => (
              <span key={p} style={styles.pill}>{p}</span>
            ))}
          </div>
          <p style={styles.brandDesc}>
            Las mismas reglas de negocio aplicadas en todas las plataformas,
            en tiempo real, impulsadas por inteligencia artificial.
          </p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div style={styles.formPanel}>
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Iniciar sesión</h2>
          <p style={styles.formSub}>Ingresa con tus credenciales Finalco</p>

          {error && (
            <div style={styles.errorBox}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">
                <Mail size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                Correo electrónico
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="usuario@finalco.com.co"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Lock size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                Contraseña
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
            >
              {loading ? <span className="loader" /> : 'Ingresar'}
            </button>
          </form>

          <div style={styles.rolesHint}>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Roles del sistema:</p>
            {[
              { rol: 'Administrador', desc: 'Gestión completa + reglas' },
              { rol: 'Analista',      desc: 'Evaluar créditos' },
              { rol: 'Asesor',        desc: 'Ingresar documentos' },
              { rol: 'Cliente',       desc: 'Ver su solicitud' },
            ].map(r => (
              <div key={r.rol} style={styles.roleRow}>
                <span style={styles.roleBadge}>{r.rol}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: 'var(--font-body)',
  },
  brand: {
    width: '45%',
    background: 'linear-gradient(145deg, #111812 0%, #1a2e1e 60%, #0d1f2d 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
  },
  brandInner: { maxWidth: 380 },
  logoBox: {
    width: 56,
    height: 56,
    background: '#007836',
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  brandTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '2.2rem',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '0.5rem',
  },
  brandSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginBottom: '1.5rem',
  },
  pillsRow: { display: 'flex', gap: 8, marginBottom: '1.5rem' },
  pill: {
    background: 'rgba(59,113,254,0.2)',
    border: '1px solid rgba(59,113,254,0.4)',
    color: '#8aabff',
    fontSize: 12,
    padding: '3px 12px',
    borderRadius: 20,
    fontWeight: 500,
  },
  brandDesc: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 13,
    lineHeight: 1.7,
  },
  formPanel: {
    flex: 1,
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  formCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '2.5rem',
    width: '100%',
    maxWidth: 420,
    boxShadow: 'var(--shadow-lg)',
  },
  formTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 4,
  },
  formSub: {
    color: 'var(--text3)',
    fontSize: 13,
    marginBottom: '1.75rem',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--red-bg)',
    border: '1px solid rgba(220,38,38,0.2)',
    color: 'var(--red)',
    borderRadius: 'var(--radius)',
    padding: '0.65rem 1rem',
    fontSize: 13,
    marginBottom: '1rem',
  },
  rolesHint: {
    marginTop: '1.75rem',
    paddingTop: '1.25rem',
    borderTop: '1px solid var(--border)',
  },
  roleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  roleBadge: {
    background: 'var(--primary-light)',
    color: 'var(--primary)',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 5,
    minWidth: 90,
    textAlign: 'center',
  },
}
