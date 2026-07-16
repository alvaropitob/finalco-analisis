import React from 'react'
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { LayoutDashboard, Users, User, CheckSquare, Scale, FolderOpen, TrendingUp, LogOut, Menu, ChevronLeft, ChevronRight, Calculator, Settings, Upload } from 'lucide-react'
import { isLoggedIn, getRol, getNombre, logout } from './api/client'
import Dashboard     from './pages/Dashboard'
import Clientes      from './pages/Clientes'
import ClienteDetalle from './pages/ClienteDetalle'
import Decisiones    from './pages/Decisiones'
import Politica      from './pages/Politica'
import Analizar      from './pages/Analizar'
import Login         from './pages/Login'
import CrearCliente  from './pages/CrearCliente'
import CargaFinanciera from './pages/CargaFinanciera'
import SimuladorCredito from './pages/SimuladorCredito'
import ParametrizadorRiesgo from './pages/ParametrizadorRiesgo'
import CargaDocumental from './pages/CargaDocumental'

// ── Rutas por rol ─────────────────────────────────────────────────────────────
const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',          end: true,  section: 'Principal', roles: ['admin','analista'] },
  { to: '/clientes',  icon: Users,           label: 'Clientes',           end: false, section: null,        roles: ['admin','analista','asesor','cliente'] },
  { to: '/clientes/nuevo', icon: User,           label: 'Nuevo Cliente',      end: false, section: null,        roles: ['admin','analista','asesor'] },
  { to: '/decisiones',icon: CheckSquare,     label: 'Decisiones',         end: false, section: null,        roles: ['admin','analista','asesor'] },
  { to: '/politica',  icon: Scale,           label: 'Política de crédito',end: false, section: 'Config.',   roles: ['admin','analista'] },
  { to: '/analizar',  icon: FolderOpen,      label: 'Analizar documentos',end: false, section: null,        roles: ['admin','analista','asesor'] },
  { to: '/carga-financiera', icon: TrendingUp,  label: 'Carga de Buró',      end: false, section: null,        roles: ['admin','analista','asesor'] },
  { to: '/carga-documental', icon: Upload,      label: 'Carga Documental',   end: false, section: 'Sprint 2',  roles: ['admin','analista','asesor'] },
  { to: '/simulador', icon: Calculator,         label: 'Simulador',          end: false, section: null,        roles: ['admin','analista','asesor'] },
  { to: '/parametrizador', icon: Settings,      label: 'Parametrizador',     end: false, section: null,        roles: ['admin'] },
]

const PAGE_TITLES = {
  '/':           'Dashboard',
  '/clientes':   'Clientes',
  '/clientes/nuevo': 'Crear Nuevo Cliente',
  '/decisiones': 'Historial de Decisiones',
  '/politica':   'Política de Crédito',
  '/analizar':   'Analizar Documentos',
  '/carga-financiera': 'Carga de Buró Financiero',
  '/carga-documental': 'Carga Documental',
  '/simulador':  'Simulador de Crédito',
  '/parametrizador': 'Parametrizador de Riesgo',
}

// ── Guard ─────────────────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ collapsed, setCollapsed }) {
  const rol = getRol()

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-row">
          <div className="sidebar-logo-icon">
            <TrendingUp size={18} />
          </div>
          <h1>Crédito<span>IA</span></h1>
          {!collapsed && (
            <button 
              onClick={() => setCollapsed(true)}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>
        {!collapsed && <p>Sistema de análisis crediticio</p>}
        {collapsed && (
          <button 
            onClick={() => setCollapsed(false)}
            style={{ width: '100%', marginTop: 10, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV.filter(item => !rol || item.roles.includes(rol)).map((item, i, arr) => {
          const Icon = item.icon
          const prev = arr[i - 1]
          const showSection = item.section && item.section !== prev?.section
          return (
            <React.Fragment key={item.to}>
              {showSection && <span className="nav-section">{item.section}</span>}
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
                title={collapsed ? item.label : ''}
              >
                <Icon size={16} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </React.Fragment>
          )
        })}
      </div>

      <div className="sidebar-footer">
        <div style={{ marginBottom: 6, color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
          {getNombre()}
          <span style={{
            marginLeft: 6, background: 'rgba(59,113,254,0.25)', color: '#8aabff',
            fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
          }}>{rol}</span>
        </div>
        <button
          onClick={logout}
          style={{
            background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <LogOut size={12} /> {!collapsed && 'Cerrar sesión'}
        </button>
      </div>
    </aside>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar() {
  const { pathname } = useLocation()
  const base = '/' + pathname.split('/')[1]
  const title = PAGE_TITLES[base] ?? 'CréditoIA'
  return (
    <header className="topbar">
      <span className="topbar-title">{title}</span>
      <div className="topbar-right">
        <span className="topbar-badge">● Sistema activo</span>
      </div>
    </header>
  )
}

// ── Layout protegido ──────────────────────────────────────────────────────────
function AppLayout() {
  const [collapsed, setCollapsed] = React.useState(false)

  return (
    <div className="layout">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className={`main ${collapsed ? 'collapsed' : ''}`}>
        <TopBar />
        <Routes>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/clientes"     element={<Clientes />} />
          <Route path="/clientes/nuevo" element={<CrearCliente />} />
          <Route path="/clientes/:id" element={<ClienteDetalle />} />
          <Route path="/decisiones"   element={<Decisiones />} />
          <Route path="/politica"     element={<Politica />} />
          <Route path="/analizar"     element={<Analizar />} />
          <Route path="/carga-financiera" element={<CargaFinanciera />} />
          <Route path="/carga-documental" element={<CargaDocumental />} />
          <Route path="/simulador"  element={<SimuladorCredito />} />
          <Route path="/parametrizador" element={<ParametrizadorRiesgo />} />
        </Routes>
      </main>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      } />
    </Routes>
  )
}
