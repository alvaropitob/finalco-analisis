import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Search, UserPlus, Filter } from 'lucide-react'

export default function Clientes() {
  const [clientes, setClientes] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const navigate = useNavigate()

  function fetchClientes() {
    setLoading(true)
    api.getClientes({ buscar }).then(setClientes).finally(() => setLoading(false))
  }

  useEffect(() => {
    const timer = setTimeout(fetchClientes, 300)
    return () => clearTimeout(timer)
  }, [buscar])

  return (
    <div className="page fade-up">
      <div className="page-header">
        <h2>Clientes</h2>
        <p>Listado de solicitantes y resultados de análisis</p>
      </div>

      <div className="search-row">
        <input 
          type="text" 
          placeholder="Buscar por nombre o cédula..." 
          className="search-input"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchClientes()}
        />
        <button className="btn btn-primary" onClick={fetchClientes}>
          <Search size={16} /> Buscar
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cédula</th>
                <th>Riesgo</th>
                <th>Score DC</th>
                <th>Estado</th>
                <th>Análisis</th>
              </tr>
            </thead>
            <tbody>
              {clientes.items.map(c => (
                <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}>
                  <td>{c.nombre}</td>
                  <td>{c.cedula}</td>
                  <td>
                    <span className={`badge badge-${c.nivel_riesgo === 'bajo' ? 'green' : c.nivel_riesgo === 'medio' ? 'amber' : 'red'}`}>
                      {c.nivel_riesgo}
                    </span>
                  </td>
                  <td>{c.score_datacredito}</td>
                  <td>
                    {c.decision ? (
                      <span className={`badge badge-${c.decision === 'aprobado' ? 'green' : 'red'}`}>
                        {c.decision}
                      </span>
                    ) : '-'}
                  </td>
                  <td>{new Date(c.fecha_analisis).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && clientes.items.length === 0 && (
            <div className="empty">No se encontraron clientes</div>
          )}
        </div>
      </div>
    </div>
  )
}
