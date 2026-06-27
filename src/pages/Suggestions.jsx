import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function Suggestions() {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ titulo: '', descripcion: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const { isAdmin } = useAuth()

  useEffect(() => { if(isAdmin) load() else setLoading(false) }, [])

  const load = async () => {
    try {
      const { data } = await api.get('/api/suggestions')
      setSuggestions(data)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const sendSuggestion = async (e) => {
    e.preventDefault()
    setSending(true)
    try {
      await api.post('/api/suggestions', form)
      setForm({ titulo: '', descripcion: '' })
      setSent(true)
      setTimeout(() => setSent(false), 4000)
    } catch(err) { alert('Error al enviar') }
    finally { setSending(false) }
  }

  const markRead = async (id) => {
    await api.patch(`/api/suggestions/${id}/leida`)
    setSuggestions(s => s.map(x => x.id===id ? {...x,leida:true} : x))
  }

  return (
    <div className="page">
      <Navbar />
      <div className="page-content">
        <div className="fade-in">
          <h1 className="dash-title">💡 Sugerencias</h1>
          <p className="dash-sub" style={{marginBottom:28}}>
            {isAdmin ? 'Sugerencias enviadas por los usuarios' : '¿Tienes una idea o algo que quisieras agregar? ¡Mándanos tu sugerencia!'}
          </p>

          {/* Formulario para invitados */}
          {!isAdmin && (
            <div className="card" style={{maxWidth:600,marginBottom:32}}>
              <h3 style={{marginBottom:16,color:'var(--gold)'}}>Enviar Sugerencia</h3>
              {sent && <div style={{background:'rgba(76,175,80,0.2)',border:'1px solid #81c784',color:'#81c784',padding:'10px 14px',borderRadius:8,marginBottom:16,fontSize:13}}>✅ ¡Sugerencia enviada! El administrador la revisará pronto.</div>}
              <form onSubmit={sendSuggestion}>
                <div style={{marginBottom:14}}>
                  <label className="label">Título</label>
                  <input className="input" placeholder="Ej: Agregar modo oscuro al teleprompter"
                    value={form.titulo} onChange={e => setForm({...form,titulo:e.target.value})} required/>
                </div>
                <div style={{marginBottom:20}}>
                  <label className="label">Descripción</label>
                  <textarea className="input" style={{height:100,resize:'vertical'}}
                    placeholder="Describe qué te gustaría que se agregara o mejorara..."
                    value={form.descripcion} onChange={e => setForm({...form,descripcion:e.target.value})} required/>
                </div>
                <button className="btn btn-gold" type="submit" disabled={sending}>
                  {sending ? '⏳ Enviando...' : '💡 Enviar sugerencia'}
                </button>
              </form>
            </div>
          )}

          {/* Lista para admin */}
          {isAdmin && (
            loading ? <div className="loading">Cargando...</div> :
            suggestions.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">💭</div><p>No hay sugerencias aún</p></div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {suggestions.map(s => (
                  <div key={s.id} className="card fade-in" style={{borderColor:s.leida?'var(--border)':'rgba(201,168,76,0.4)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                      <h3 style={{fontSize:15,fontWeight:700}}>{s.titulo}</h3>
                      {!s.leida && <span className="badge badge-gold">Nueva</span>}
                    </div>
                    <p style={{color:'#aaa',fontSize:13,marginBottom:10,lineHeight:1.6}}>{s.descripcion}</p>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:11,color:'#555'}}>👤 {s.autor} · {new Date(s.created_at).toLocaleDateString('es-MX')}</span>
                      {!s.leida && <button className="btn btn-ghost btn-sm" onClick={() => markRead(s.id)}>Marcar como leída</button>}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
