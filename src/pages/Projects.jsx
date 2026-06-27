import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import './Projects.css'

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')
  const [deleteModal, setDeleteModal] = useState(null)
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  useEffect(() => { loadProjects() }, [])

  const loadProjects = async () => {
    try {
      const { data } = await api.get('/api/projects')
      setProjects(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const deleteProject = async (id) => {
    try {
      await api.delete(`/api/projects/${id}`)
      setProjects(p => p.filter(x => x.id !== id))
      setDeleteModal(null)
    } catch (e) { alert('Error al eliminar') }
  }

  const filtered = filter === 'todos' ? projects : projects.filter(p => p.tipo === filter)

  return (
    <div className="page">
      <Navbar />
      <div className="page-content">
        <div className="fade-in">
          <div className="projects-header">
            <div>
              <h1 className="dash-title">📁 Proyectos</h1>
              <p className="dash-sub">Historial de portadas y teleprompters guardados</p>
            </div>
            <div className="projects-actions">
              <button className="btn btn-outline" onClick={() => navigate('/editor/portada')}>+ Nueva Portada</button>
              <button className="btn btn-gold" onClick={() => navigate('/editor/teleprompter')}>+ Teleprompter</button>
            </div>
          </div>

          {/* Filtros */}
          <div className="filter-tabs">
            {['todos','portada','teleprompter'].map(f => (
              <button key={f} className={`filter-tab ${filter===f?'active':''}`} onClick={() => setFilter(f)}>
                {f === 'todos' ? 'Todos' : f === 'portada' ? '🎬 Portadas' : '📋 Teleprompters'}
                <span className="filter-count">{f==='todos'?projects.length:projects.filter(p=>p.tipo===f).length}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="loading">Cargando proyectos...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>No hay proyectos aún</p>
              <button className="btn btn-gold" onClick={() => navigate('/editor/portada')}>Crear el primero</button>
            </div>
          ) : (
            <div className="projects-grid">
              {filtered.map(p => (
                <div key={p.id} className="project-card fade-in">
                  <div className="project-type-badge">
                    {p.tipo === 'portada' ? '🎬 Portada' : '📋 Teleprompter'}
                  </div>
                  <h3 className="project-name">{p.nombre}</h3>
                  {isAdmin && p.autor && (
                    <p className="project-autor">👤 {p.autor}</p>
                  )}
                  <p className="project-date">
                    Guardado: {new Date(p.updated_at).toLocaleDateString('es-MX', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                  </p>
                  <div className="project-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/editor/${p.tipo}/${p.id}`)}>✏️ Editar</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/requests?proyecto=${p.id}`)}>📥 Solicitar descarga</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteModal(p)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal confirmar eliminar */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🗑️ Eliminar Proyecto</div>
            <p style={{color:'#aaa',marginBottom:20}}>¿Seguro que quieres eliminar <strong style={{color:'#fff'}}>"{deleteModal.nombre}"</strong>? Esta acción no se puede deshacer.</p>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={() => setDeleteModal(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => deleteProject(deleteModal.id)}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
