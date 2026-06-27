import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import './Login.css'

export default function Login() {
  const [form, setForm] = useState({ usuario: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', form)
      login(data.token, data.usuario)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Fondo animado */}
      <div className="login-bg">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
        <div className="login-orb login-orb-3"></div>
      </div>

      <div className="login-container fade-in">
        {/* Logo / Header */}
        <div className="login-header">
          <div className="login-logo">JP</div>
          <h1 className="login-title">JP Estudio</h1>
          <p className="login-subtitle">Sistema de Producción Audiovisual · SITT</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="label">Usuario</label>
            <input
              className="input"
              type="text"
              placeholder="Ingresa tu usuario"
              value={form.usuario}
              onChange={e => setForm({...form, usuario: e.target.value})}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="label">Contraseña</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="btn btn-gold btn-lg login-btn" type="submit" disabled={loading}>
            {loading ? '⏳ Verificando...' : '→ Iniciar Sesión'}
          </button>
        </form>

        <p className="login-footer">H. XXV Ayuntamiento de Tijuana · SITT</p>
      </div>
    </div>
  )
}
