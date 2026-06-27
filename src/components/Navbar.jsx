import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const links = [
    { to: '/dashboard', label: '🏠 Inicio', show: true },
    { to: '/projects', label: '📁 Proyectos', show: true },
    { to: '/requests', label: '📥 Solicitudes', show: true },
    { to: '/suggestions', label: '💡 Sugerencias', show: true },
    { to: '/admin', label: '⚙️ Admin', show: isAdmin },
  ]

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-logo">JP</div>
        <span className="navbar-name">JP Estudio</span>
      </div>

      <div className="navbar-links">
        {links.filter(l => l.show).map(l => (
          <Link
            key={l.to}
            to={l.to}
            className={`navbar-link ${location.pathname === l.to ? 'active' : ''}`}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <div className="navbar-user">
        <span className="navbar-username">
          {isAdmin && <span className="badge badge-gold" style={{marginRight:8}}>Admin</span>}
          {user?.nombre}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Salir</button>
      </div>
    </nav>
  )
}
