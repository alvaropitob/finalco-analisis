function getToken() {
  return localStorage.getItem('token')
}

function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh')
  localStorage.removeItem('rol')
  localStorage.removeItem('nombre')
  window.location.href = '/login'
}

async function request(path, options = {}) {
  const token = getToken()
  const resp = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (resp.status === 401) {
    clearSession()
    throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.')
  }

  if (!resp.ok) {
    const error = await resp.json().catch(() => ({ detail: 'Error desconocido' }))
    throw new Error(error.detail || `Error ${resp.status}: ${resp.statusText}`)
  }
  return resp.json()
}

export function getRol()    { return localStorage.getItem('rol') }
export function getNombre() { return localStorage.getItem('nombre') }
export function isLoggedIn() { return !!getToken() }
export function logout()    { clearSession() }

export const api = {
  // ── Auth ────────────────────────────────────────────────────
  login: (email, password) => request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  // ── Clientes (legacy — sin auth requerida en rutas /api/) ───
  getClientes: (params) => {
    const query = new URLSearchParams(params).toString()
    return request(`/api/clientes?${query}`)
  },
  getCliente: (id) => request(`/api/clientes/${id}`),

  analizarCarpeta: (carpeta) => request('/api/analizar', {
    method: 'POST',
    body: JSON.stringify({ carpeta }),
  }),

  analizarArchivo: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    
    const token = getToken()
    const resp = await fetch('/api/v1/analizar-archivo', {
      method: 'POST',
      body: formData,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    
    if (!resp.ok) {
      const error = await resp.json().catch(() => ({ detail: 'Error desconocido' }))
      throw new Error(error.detail || `Error ${resp.status}: ${resp.statusText}`)
    }
    return resp.json()
  },

  guardarCliente: (data) => request('/api/v1/clientes', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  decidir: (clienteId, monto, politicaId) => request(`/api/clientes/${clienteId}/decidir`, {
    method: 'POST',
    body: JSON.stringify({ monto_solicitado: monto, politica_id: politicaId }),
  }),

  getDecisiones: (params) => {
    const query = new URLSearchParams(params).toString()
    return request(`/api/decisiones?${query}`)
  },

  getPolitica:    () => request('/api/politica'),
  savePolitica:   (p) => request('/api/politica', { method: 'POST', body: JSON.stringify(p) }),
  sugerirPolitica: () => request('/api/politica/sugerir'),
  getStats:       () => request('/api/stats'),

  // ── API v1 — Rule Engine ────────────────────────────────────
  getProductos:  () => request('/api/v1/productos'),

  getReglas:     (tipo) => request(`/api/v1/reglas${tipo ? `?tipo=${tipo}` : ''}`),
  crearRegla:    (r)    => request('/api/v1/reglas', { method: 'POST', body: JSON.stringify(r) }),
  activarRegla:  (id, motivo) => request(`/api/v1/reglas/${id}/activar`, {
    method: 'POST', body: JSON.stringify({ motivo }),
  }),
  historialRegla: (id) => request(`/api/v1/reglas/${id}/versiones`),
  sugerirRegla:  (tipo) => request(`/api/v1/reglas/sugerir/${tipo}`),

  evaluarCliente: (clienteId, monto, reglaId, tipo) => request(`/api/v1/clientes/${clienteId}/evaluar`, {
    method: 'POST',
    body: JSON.stringify({ monto_solicitado: monto, regla_id: reglaId, tipo_producto_codigo: tipo }),
  }),

  getUsuarios:  () => request('/api/v1/usuarios'),
  crearUsuario: (u) => request('/api/v1/usuarios', { method: 'POST', body: JSON.stringify(u) }),

  // ── Sprint 2: Simulador ─────────────────────────────────────
  simularCredito: (data) => request('/api/v1/simulacion', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  simulacionRapida: (monto, plazo, tasaEa = 0.2426) =>
    request(`/api/v1/simulacion/rapida?monto=${monto}&plazo=${plazo}&tasa_ea=${tasaEa}`),

  getSimulacion: (id) => request(`/api/v1/simulacion/${id}`),

  // ── Sprint 2: Scoring ───────────────────────────────────────
  calcularScoring: (clienteId) => request(`/api/v1/clientes/${clienteId}/scoring`, {
    method: 'POST',
  }),

  getScoring: (clienteId) => request(`/api/v1/clientes/${clienteId}/scoring`),

  // ── Sprint 2: Parametrizador ────────────────────────────────
  getParametrosRiesgo: () => request('/api/v1/parametros-riesgo'),

  updateParametrosRiesgo: (data) => request('/api/v1/parametros-riesgo', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  getHistorialParametros: () => request('/api/v1/parametros-riesgo/historial'),

  // ── Sprint 2: Carga Documental ──────────────────────────────
  cargarDocumentos: async (files, clienteId, cedula) => {
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    if (clienteId) formData.append('cliente_id', clienteId)
    if (cedula)    formData.append('cedula', cedula)

    const token = getToken()
    const resp = await fetch('/api/v1/documentos/cargar', {
      method: 'POST',
      body: formData,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!resp.ok) {
      const error = await resp.json().catch(() => ({ detail: 'Error desconocido' }))
      throw new Error(error.detail || `Error ${resp.status}`)
    }
    return resp.json()
  },
}

export default api

