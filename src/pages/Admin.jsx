import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import api from '../api'
import './Admin.css'

export default function Admin() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [newUserModal, setNewUserModal] = useState(false)
  const [form, setForm] = useState({ usuario:'', password:'', nombre:'', rol:'invitado' })
  const [creating, setCreating] = useState(false)
  const [passModal, setPassModal] = useState(null)
  const [newPass, setNewPass] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    try { const {data} = await api.get('/api/users'); setUsers(data) }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const createUser = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      const {data} = await api.post('/api/users', form)
      setUsers(u => [data,...u])
      setForm({ usuario:'', password:'', nombre:'', rol:'invitado' })
      setNewUserModal(false)
    } catch(err) { alert(err.response?.data?.error || 'Error') }
    finally { setCreating(false) }
  }

  const toggleUser = async (id) => {
    const {data} = await api.patch(`/api/users/${id}/toggle`)
    setUsers(u => u.map(x => x.id===id ? {...x,activo:data.activo} : x))
  }

  const deleteUser = async (id) => {
    if (!confirm('¿Eliminar usuario?')) return
    await api.delete(`/api/users/${id}`)
    setUsers(u => u.filter(x => x.id!==id))
  }

  const changePass = async () => {
    await api.patch(`/api/users/${passModal.id}/password`, { password: newPass })
    setPassModal(null)
    setNewPass('')
    alert('Contraseña actualizada')
  }

  return (
    <div className="page">
      <Navbar />
      <div className="page-content">
        <div className="fade-in">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28}}>
            <div>
              <h1 className="dash-title">⚙️ Panel de Administración</h1>
              <p className="dash-sub">Gestiona usuarios y permisos del sistema</p>
            </div>
            <button className="btn btn-gold" onClick={() => setNewUserModal(true)}>+ Nuevo Usuario</button>
          </div>

          {/* Stats */}
          <div className="admin-stats">
            <div className="stat-card">
              <div className="stat-num">{users.length}</div>
              <div className="stat-label">Total usuarios</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{users.filter(u=>u.activo).length}</div>
              <div className="stat-label">Activos</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{users.filter(u=>u.rol==='admin').length}</div>
              <div className="stat-label">Admins</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{users.filter(u=>u.rol==='invitado').length}</div>
              <div className="stat-label">Invitados</div>
            </div>
          </div>

          {/* Tabla usuarios */}
          <div className="card" style={{marginTop:24}}>
            <h2 style={{fontSize:14,color:'var(--text-muted)',letterSpacing:2,marginBottom:20,textTransform:'uppercase'}}>Usuarios del Sistema</h2>
            {loading ? <div className="loading">Cargando...</div> : (
              <div className="users-table">
                {users.map(u => (
                  <div key={u.id} className="user-row">
                    <div className="user-avatar">{u.nombre[0].toUpperCase()}</div>
                    <div className="user-info">
                      <span className="user-nombre">{u.nombre}</span>
                      <span className="user-usuario">@{u.usuario}</span>
                    </div>
                    <span className={`badge ${u.rol==='admin'?'badge-gold':'badge-gray'}`}>{u.rol}</span>
                    <span className={`badge ${u.activo?'badge-green':'badge-red'}`}>{u.activo?'Activo':'Inactivo'}</span>
                    <span style={{fontSize:11,color:'#555'}}>{new Date(u.created_at).toLocaleDateString('es-MX')}</span>
                    <div className="user-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleUser(u.id)}>
                        {u.activo?'Desactivar':'Activar'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setPassModal(u)}>🔑</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id)}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal nuevo usuario */}
      {newUserModal && (
        <div className="modal-overlay" onClick={() => setNewUserModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">👤 Nuevo Usuario</div>
            <form onSubmit={createUser}>
              {[
                {label:'Nombre completo',key:'nombre',type:'text',placeholder:'Ej: Ana García'},
                {label:'Usuario',key:'usuario',type:'text',placeholder:'Ej: ana'},
                {label:'Contraseña',key:'password',type:'password',placeholder:'••••••••'},
              ].map(f => (
                <div key={f.key} style={{marginBottom:14}}>
                  <label className="label">{f.label}</label>
                  <input className="input" type={f.type} placeholder={f.placeholder}
                    value={form[f.key]} onChange={e => setForm({...form,[f.key]:e.target.value})} required/>
                </div>
              ))}
              <div style={{marginBottom:20}}>
                <label className="label">Rol</label>
                <select className="input" value={form.rol} onChange={e => setForm({...form,rol:e.target.value})}>
                  <option value="invitado">Invitado</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-ghost" onClick={() => setNewUserModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold" disabled={creating}>
                  {creating?'⏳ Creando...':'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal cambiar contraseña */}
      {passModal && (
        <div className="modal-overlay" onClick={() => setPassModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🔑 Cambiar Contraseña</div>
            <p style={{color:'#aaa',fontSize:13,marginBottom:16}}>Usuario: <strong style={{color:'#fff'}}>{passModal.nombre}</strong></p>
            <label className="label">Nueva contraseña</label>
            <input className="input" type="password" placeholder="••••••••"
              value={newPass} onChange={e => setNewPass(e.target.value)} autoFocus/>
            <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={() => setPassModal(null)}>Cancelar</button>
              <button className="btn btn-gold" onClick={changePass} disabled={!newPass}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
