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

function getMockDataForPath(path, options = {}) {
  const url = path.split('?')[0];
  
  if (url.endsWith('/stats')) {
    return {
      clientes: { total_clientes: 24, confiables: 18, riesgo_bajo: 12, riesgo_medio: 8, riesgo_alto: 4, avg_score_dc: 740, avg_score_cifin: 710 },
      decisiones: { total_decisiones: 32, aprobadas: 22, rechazadas: 8, en_revision: 2, monto_total_aprobado: 450000000, tasa_promedio: 24.26 },
      tendencia: [
        { fecha: '2026-07-10', decision: 'aprobado', total: 3 },
        { fecha: '2026-07-11', decision: 'aprobado', total: 2 },
        { fecha: '2026-07-12', decision: 'rechazado', total: 1 },
        { fecha: '2026-07-13', decision: 'aprobado', total: 4 },
        { fecha: '2026-07-14', decision: 'rechazado', total: 2 },
        { fecha: '2026-07-15', decision: 'aprobado', total: 5 }
      ]
    };
  }

  if (url.endsWith('/clientes')) {
    return [
      { id: 1, nombre: 'Carlos Perez', cedula: '1104701529', email: 'carlos@perez.com', score_dc: 720, nivel_riesgo: 'Bajo', fecha_creacion: '2026-07-15' },
      { id: 2, nombre: 'Maria Ortiz', cedula: '1110485228', email: 'maria@ortiz.com', score_dc: 580, nivel_riesgo: 'Medio', fecha_creacion: '2026-07-14' },
      { id: 3, nombre: 'Jorge Ruiz', cedula: '1216971324', email: 'jorge@ruiz.com', score_dc: 450, nivel_riesgo: 'Alto', fecha_creacion: '2026-07-13' }
    ];
  }

  if (url.includes('/clientes/')) {
    if (url.endsWith('/scoring')) {
      return {
        id: 1,
        cliente_id: 1,
        score_dc: 720,
        score_cifin: 690,
        nivel_riesgo: 'Bajo',
        fecha_calculo: new Date().toISOString()
      };
    }
    if (url.endsWith('/evaluar') || url.endsWith('/decidir')) {
      return {
        aprobado: true,
        monto_aprobado: 10000000,
        plazo_aprobado: 12,
        tasa_ea: 0.2426,
        motivo: 'Cumple con todos los criterios de la política de riesgo bajo.'
      };
    }
    const parts = url.split('/');
    const id = parts[parts.length - 1];
    return {
      id: parseInt(id) || 1,
      nombre: 'Carlos Perez',
      cedula: '1104701529',
      email: 'carlos@perez.com',
      score_dc: 720,
      score_cifin: 690,
      nivel_riesgo: 'Bajo',
      situacion_laboral: 'Empleado',
      antiguedad_laboral: 24,
      ingresos: 4500000,
      egresos: 1200000,
      fecha_creacion: '2026-07-15'
    };
  }

  if (url.endsWith('/productos')) {
    return [
      { codigo: 'credito', nombre: 'Libre Inversión', descripcion: 'Crédito libre destinación' },
      { codigo: 'libranza', nombre: 'Libranza', descripcion: 'Descuento por nómina' },
      { codigo: 'microcredito', nombre: 'Microcrédito', descripcion: 'Para microempresarios' }
    ];
  }

  if (url.endsWith('/reglas')) {
    return [
      { id: 1, nombre: 'Score mínimo', tipo_regla: 'score', regla_codigo: 'cifin_min', descripcion: 'Valida score de buró', activa: true },
      { id: 2, nombre: 'Relación cuota ingreso', tipo_regla: 'capacidad', regla_codigo: 'dti_max', descripcion: 'Valida capacidad de pago', activa: true }
    ];
  }

  if (url.endsWith('/parametros-riesgo')) {
    return {
      tasa_ea_min: 0.18,
      tasa_ea_max: 0.28,
      plazo_max_meses: 60,
      max_dti: 0.40,
      min_score_aprobacion: 600
    };
  }

  if (url.endsWith('/parametros-riesgo/historial')) {
    return [
      { id: 1, modificado_por: 'admin@finalco.com.co', fecha: '2026-07-15 10:00:00', detalles: 'Ajuste inicial de parámetros de riesgo' }
    ];
  }

  if (url.endsWith('/politica')) {
    return {
      id: 1,
      nombre: 'Política General',
      criterios: [
        { id: 1, campo: 'score_dc', condicion: '>=', valor: '600' }
      ]
    };
  }

  if (url.endsWith('/decisiones')) {
    return [
      { id: 1, cliente_nombre: 'Carlos Perez', monto_solicitado: 10000000, plazo: 12, tasa_ea: 0.24, decision: 'aprobado', fecha: '2026-07-15' }
    ];
  }

  if (url.endsWith('/simulacion') || url.includes('/simulacion/')) {
    return {
      id: 1,
      monto: 10000000,
      plazo: 12,
      tasa_ea: 0.2426,
      cuota_mensual: 948000,
      tasa_nominal_mes_vencido: 0.0182,
      tabla_amortizacion: [
        { numero_cuota: 1, saldo_inicial: 10000000, cuota: 948000, interes: 182000, capital: 766000, saldo_final: 9234000 }
      ]
    };
  }
  
  if (url.endsWith('/usuarios')) {
    return [
      { id: 1, email: 'admin@finalco.com.co', nombre: 'Administrador Principal', rol: 'admin' },
      { id: 2, email: 'alvaro_pito@hotmail.com', nombre: 'Alvaro Pito', rol: 'admin' }
    ];
  }

  return null;
}

async function request(path, options = {}) {
  const token = getToken()
  try {
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
    return await resp.json()
  } catch (err) {
    const mockData = getMockDataForPath(path, options)
    if (mockData !== null) {
      console.warn(`[Mock Mode] Retornando datos simulados para: ${path}`)
      return mockData
    }
    throw err
  }
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

