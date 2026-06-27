import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import './Requests.css'

export default function Requests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [respModal, setRespModal] = useState(null)
  const [respText, setRespText] = useState('')
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
      await api.patch(`/api/requests/${respModal.id}`, { estado, respuesta: respText })
      setRequests(r => r.map(x => x.id === respModal.id ? {...x, estado, respuesta: respText} : x))
      setRespModal(null)
      setRespText('')
    } catch(e) { alert('Error') }
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
          <h1 className="dash-title">📥 Solicitudes de Descarga</h1>
          <p className="dash-sub" style={{marginBottom:28}}>
            {isAdmin ? 'Gestiona las solicitudes de descarga de los usuarios' : 'Historial de tus solicitudes de descarga'}
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
                  {isAdmin && r.estado === 'pendiente' && (
                    <button className="btn btn-gold btn-sm" style={{marginTop:12}} onClick={() => setRespModal(r)}>
                      Responder solicitud
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
              <button className="btn btn-gold" onClick={() => respond('aprobada')}>✅ Aprobar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
