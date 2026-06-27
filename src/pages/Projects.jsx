import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import './Projects.css'

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')
  const [deleteModal, setDeleteModal] = useState(null)
  const [requestModal, setRequestModal] = useState(null)
  const [requestMsg, setRequestMsg] = useState('')
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [pRes, rRes] = await Promise.all([
        api.get('/api/projects'),
        api.get('/api/requests')
      ])
      setProjects(pRes.data)
      setRequests(rRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // Obtener estado de solicitud de un proyecto
  const getRequestStatus = (projectId) => {
    const req = requests.find(r => r.proyecto_id === projectId || r.proyecto_id === String(projectId))
    return req || null
  }

  const deleteProject = async (id) => {
    try {
      await api.delete(`/api/projects/${id}`)
      setProjects(p => p.filter(x => x.id !== id))
      setDeleteModal(null)
    } catch (e) { alert('Error al eliminar') }
  }

  const sendRequest = async () => {
    try {
      await api.post('/api/requests', { proyecto_id: requestModal.id, mensaje: requestMsg })
      alert('✅ Solicitud enviada. El administrador la revisará pronto.')
      setRequestModal(null)
      setRequestMsg('')
      loadAll()
    } catch (e) { alert(e.response?.data?.error || 'Error al enviar solicitud') }
  }

  const downloadProject = async (project) => {
    try {
      const { data } = await api.get(`/api/projects/${project.id}`)
      const blob = new Blob([data.html_content], { type: 'text/html' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = project.nombre.replace(/\s+/g, '_') + '.html'
      a.click()
    } catch (e) { alert('Error al descargar') }
  }

  const filtered = filter === 'todos' ? projects : projects.filter(p => p.tipo === filter)

  const badgeRequest = (req) => {
    if (!req) return null
    if (req.estado === 'pendiente') return <span className="badge badge-gray">⏳ Solicitud pendiente</span>
    if (req.estado === 'aprobada')  return <span className="badge badge-green">✅ Descarga aprobada</span>
    if (req.estado === 'rechazada') return <span className="badge badge-red">❌ Solicitud rechazada</span>
  }

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
              {filtered.map(p => {
                const req = getRequestStatus(p.id)
                const aprobado = req?.estado === 'aprobada'
                const pendiente = req?.estado === 'pendiente'
                const rechazado = req?.estado === 'rechazada'
                return (
                  <div key={p.id} className="project-card fade-in">
                    <div className="project-type-badge">
                      {p.tipo === 'portada' ? '🎬 Portada' : '📋 Teleprompter'}
                    </div>
                    <h3 className="project-name">{p.nombre}</h3>
                    {isAdmin && p.autor && <p className="project-autor">👤 {p.autor}</p>}
                    <p className="project-date">
                      Guardado: {new Date(p.updated_at).toLocaleDateString('es-MX', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </p>

                    {/* Badge de estado de solicitud */}
                    {!isAdmin && (
                      <div style={{marginBottom:12}}>
                        {badgeRequest(req)}
                        {req?.respuesta && <p style={{fontSize:11,color:'#aaa',marginTop:4}}>"{req.respuesta}"</p>}
                      </div>
                    )}

                    <div className="project-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/editor/${p.tipo}/${p.id}`)}>✏️ Editar</button>

                      {/* Botón descarga — solo si aprobado o si es admin */}
                      {(isAdmin || aprobado) && (
                        <button className="btn btn-sm" style={{background:'#1a7a3a',color:'#fff'}} onClick={() => downloadProject(p)}>
                          ⬇️ Descargar HTML
                        </button>
                      )}

                      {/* Solicitar descarga — si no hay solicitud o fue rechazada */}
                      {!isAdmin && (!req || rechazado) && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setRequestModal(p)}>
                          📥 Solicitar descarga
                        </button>
                      )}

                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteModal(p)}>🗑</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal solicitar descarga */}
      {requestModal && (
        <div className="modal-overlay" onClick={() => setRequestModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📥 Solicitar Descarga</div>
            <p style={{color:'#aaa',fontSize:13,marginBottom:16}}>
              Proyecto: <strong style={{color:'#fff'}}>"{requestModal.nombre}"</strong>
            </p>
            <label className="label">Mensaje (opcional)</label>
            <textarea className="input" style={{height:80,resize:'vertical'}}
              placeholder="Agrega un comentario..."
              value={requestMsg} onChange={e => setRequestMsg(e.target.value)}/>
            <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={() => setRequestModal(null)}>Cancelar</button>
              <button className="btn btn-gold" onClick={sendRequest}>📤 Enviar solicitud</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🗑️ Eliminar Proyecto</div>
            <p style={{color:'#aaa',marginBottom:20}}>¿Seguro que quieres eliminar <strong style={{color:'#fff'}}>"{deleteModal.nombre}"</strong>?</p>
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
