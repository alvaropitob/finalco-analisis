import React, { useState, useEffect } from 'react'
import { api } from '../api/client'
import { CheckSquare, Calendar, User } from 'lucide-react'

export default function Decisiones() {
  const [decisiones, setDecisiones] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDecisiones().then(setDecisiones).finally(() => setLoading(false))
  }, [])

  function fmtM(n) { return n ? '$' + Number(n).toLocaleString('es-CO') : '-' }

  return (
    <div className="page fade-up">
      <div className="page-header">
        <h2>Historial de Decisiones</h2>
        <p>Listado completo de todas las evaluaciones crediticias realizadas</p>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Monto Sol.</th>
                <th>Monto Apr.</th>
                <th>Tasa</th>
                <th>Plazo</th>
                <th>Decisión</th>
              </tr>
            </thead>
            <tbody>
              {decisiones.items.map(d => (
                <tr key={d.id}>
                  <td style={{ fontSize: 12 }}>{new Date(d.fecha_decision).toLocaleString()}</td>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--text)' }}>{d.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{d.cedula}</div>
                  </td>
                  <td>{fmtM(d.monto_solicitado)}</td>
                  <td>{fmtM(d.monto_aprobado)}</td>
                  <td>{d.tasa_interes ? d.tasa_interes + '%' : '-'}</td>
                  <td>{d.plazo_meses ? d.plazo_meses + ' m' : '-'}</td>
                  <td>
                    <span className={`badge badge-${d.decision === 'aprobado' ? 'green' : d.decision === 'rechazado' ? 'red' : 'amber'}`}>
                      {d.decision}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && decisiones.items.length === 0 && (
            <div className="empty">No hay decisiones registradas</div>
          )}
        </div>
      </div>
    </div>
  )
}
