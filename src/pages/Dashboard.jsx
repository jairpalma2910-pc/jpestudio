import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import './Dashboard.css'

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="page">
      <Navbar />
      <div className="page-content">
        <div className="dashboard fade-in">

          {/* Saludo */}
          <div className="dash-header">
            <div>
              <h1 className="dash-title">Bienvenido, {user?.nombre} 👋</h1>
              <p className="dash-sub">Sistema de Producción Audiovisual · SITT Tijuana</p>
            </div>
            <div className="dash-date">{new Date().toLocaleDateString('es-MX', {weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
          </div>

          {/* Herramientas principales */}
          <h2 className="section-title">Herramientas</h2>
          <div className="tools-grid">

            <div className="tool-card tool-portada" onClick={() => navigate('/editor/portada')}>
              <div className="tool-icon">🎬</div>
              <div className="tool-info">
                <h3>Portada Sesión</h3>
                <p>Diseña y personaliza la portada animada para la pantalla de fondo durante la junta</p>
              </div>
              <div className="tool-arrow">→</div>
            </div>

            <div className="tool-card tool-teleprompter" onClick={() => navigate('/editor/teleprompter')}>
              <div className="tool-icon">📋</div>
              <div className="tool-info">
                <h3>Teleprompter</h3>
                <p>Carga y controla el guion para que los participantes lean sin bajar la vista</p>
              </div>
              <div className="tool-arrow">→</div>
            </div>

          </div>

          {/* Accesos rápidos */}
          <h2 className="section-title" style={{marginTop:32}}>Accesos Rápidos</h2>
          <div className="quick-grid">
            <div className="quick-card" onClick={() => navigate('/projects')}>
              <span className="quick-icon">📁</span>
              <span>Mis Proyectos</span>
            </div>
            <div className="quick-card" onClick={() => navigate('/requests')}>
              <span className="quick-icon">📥</span>
              <span>Solicitudes</span>
            </div>
            <div className="quick-card" onClick={() => navigate('/suggestions')}>
              <span className="quick-icon">💡</span>
              <span>Sugerencias</span>
            </div>
            {isAdmin && (
              <div className="quick-card quick-admin" onClick={() => navigate('/admin')}>
                <span className="quick-icon">⚙️</span>
                <span>Panel Admin</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
