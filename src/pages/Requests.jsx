import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import './Requests.css'

const BASE_URL = 'https://jairpalma2910-pc.github.io/jpestudio/present.html?t='

export default function Requests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [respModal, setRespModal] = useState(null)
  const [respText, setRespText] = useState('')
  const [copied, setCopied] = useState(null)
  const { isAdmin } = useAuth()

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const { data } = await api.get('/api/requests')
      setRequests(data)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const respond = async (estado) => {
    try {
      const { data } = await api.patch(`/api/requests/${respModal.id}`, { estado, respuesta: respText })
      setRequests(r => r.map(x => x.id === respModal.id ? {...x, ...data} : x))
      setRespModal(null)
      setRespText('')
    } catch(e) { alert('Error') }
  }

  const revocar = async (id) => {
    const { data } = await api.patch(`/api/requests/${id}/revocar`)
    setRequests(r => r.map(x => x.id === id ? {...x, ...data} : x))
  }

  const reactivar = async (id) => {
    const { data } = await api.patch(`/api/requests/${id}/reactivar`)
    setRequests(r => r.map(x => x.id === id ? {...x, ...data} : x))
  }

  const copyLink = (token) => {
    navigator.clipboard.writeText(BASE_URL + token)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const badgeEstado = (e) => {
    if (e === 'pendiente') return <span className="badge badge-gray">⏳ Pendiente</span>
    if (e === 'aprobada')  return <span className="badge badge-green">✅ Aprobada</span>
    return <span className="badge badge-red">❌ Rechazada</span>
  }

  return (
    <div className="page">
      <Navbar />
      <div className="page-content">
        <div className="fade-in">
          <h1 className="dash-title">📥 Solicitudes de Presentación</h1>
          <p className="dash-sub" style={{marginBottom:28}}>
            {isAdmin
              ? 'Gestiona las solicitudes. Al aprobar se genera un link de presentación sin edición.'
              : 'Historial de tus solicitudes de presentación'}
          </p>

          {loading ? <div className="loading">Cargando...</div> :
           requests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>No hay solicitudes aún</p>
            </div>
          ) : (
            <div className="requests-list">
              {requests.map(r => (
                <div key={r.id} className="request-card fade-in">
                  <div className="request-header">
                    <div>
                      <h3 className="request-proyecto">{r.proyecto_nombre}</h3>
                      <span className="request-tipo">{r.tipo === 'portada' ? '🎬 Portada' : '📋 Teleprompter'}</span>
                      {isAdmin && <span className="request-user"> · 👤 {r.solicitante}</span>}
                    </div>
                    {badgeEstado(r.estado)}
                  </div>

                  {r.mensaje && <p className="request-msg">"{r.mensaje}"</p>}
                  {r.respuesta && <p className="request-resp">Respuesta: {r.respuesta}</p>}
                  <p className="request-date">{new Date(r.created_at).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>

                  {/* Link de presentación para el usuario */}
                  {!isAdmin && r.estado === 'aprobada' && r.link_token && (
                    <div className="present-link">
                      <span>🎬 Tu link de presentación está listo</span>
                      <button className="btn btn-gold btn-sm" onClick={() => window.open(BASE_URL + r.link_token, '_blank')}>
                        Abrir presentación
                      </button>
                    </div>
                  )}
                  {!isAdmin && r.estado === 'aprobada' && !r.link_token && (
                    <div className="present-link revoked">
                      🔒 Link revocado por el administrador
                    </div>
                  )}

                  {/* Controles admin */}
                  {isAdmin && (
                    <div className="admin-controls">
                      {r.estado === 'pendiente' && (
                        <button className="btn btn-gold btn-sm" onClick={() => setRespModal(r)}>
                          Responder solicitud
                        </button>
                      )}
                      {r.estado === 'aprobada' && r.link_token && (
                        <>
                          <button className="btn btn-sm" style={{background:'#1a3a1a',color:'#81c784',border:'1px solid #81c784'}}
                            onClick={() => copyLink(r.link_token)}>
                            {copied === r.link_token ? '✓ Copiado!' : '🔗 Copiar link'}
                          </button>
                          <button className="btn btn-sm" style={{background:'#1a1a3a',color:'#90caf9',border:'1px solid #90caf9'}}
                            onClick={() => window.open(BASE_URL + r.link_token, '_blank')}>
                            👁 Ver presentación
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => revocar(r.id)}>
                            🔒 Revocar acceso
                          </button>
                        </>
                      )}
                      {r.estado === 'aprobada' && !r.link_token && (
                        <button className="btn btn-sm" style={{background:'#1a7a3a',color:'#fff'}}
                          onClick={() => reactivar(r.id)}>
                          🔓 Reactivar acceso
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal responder */}
      {respModal && (
        <div className="modal-overlay" onClick={() => setRespModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📋 Responder Solicitud</div>
            <p style={{color:'#aaa',fontSize:13,marginBottom:16}}>
              Proyecto: <strong style={{color:'#fff'}}>{respModal.proyecto_nombre}</strong><br/>
              Solicitante: <strong style={{color:'#fff'}}>{respModal.solicitante}</strong>
            </p>
            <label className="label">Respuesta (opcional)</label>
            <textarea className="input" style={{height:80,resize:'vertical',marginBottom:20}}
              placeholder="Mensaje para el usuario..."
              value={respText} onChange={e => setRespText(e.target.value)}/>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={() => setRespModal(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => respond('rechazada')}>❌ Rechazar</button>
              <button className="btn btn-gold" onClick={() => respond('aprobada')}>✅ Aprobar y generar link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
