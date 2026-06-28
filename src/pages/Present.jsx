import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import './Present.css'

export default function Present() {
  const { id } = useParams()
  const navigate = useNavigate()
  const iframeRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nombre, setNombre] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [htmlSrc, setHtmlSrc] = useState('')

  useEffect(() => { load() }, [id])

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const load = async () => {
    try {
      const { data } = await api.get(`/api/projects/${id}`)
      setNombre(data.nombre)
      const blob = new Blob([data.html_content], { type: 'text/html' })
      setHtmlSrc(URL.createObjectURL(blob))
    } catch (e) {
      setError('No se pudo cargar el proyecto')
    } finally {
      setLoading(false)
    }
  }

  // Auto fullscreen y ocultar controles cuando carga el iframe
  const handleIframeLoad = () => {
    const iframe = iframeRef.current
    if (!iframe) return
    // Enviar mensaje para ocultar panel de opciones
    try {
      iframe.contentWindow.postMessage('present_mode', '*')
    } catch(e) {}
    // Pantalla completa automático
    setTimeout(() => {
      if (iframe?.requestFullscreen) {
        iframe.requestFullscreen().catch(() => {})
      }
    }, 300)
  }

  const toggleFullscreen = () => {
    const iframe = iframeRef.current
    if (!document.fullscreenElement) {
      if (iframe?.requestFullscreen) iframe.requestFullscreen()
      setFullscreen(true)
    } else {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }

  if (loading) return (
    <div className="present-loading">
      <div className="present-logo">JP</div>
      <p>Cargando presentación...</p>
    </div>
  )

  if (error) return (
    <div className="present-loading">
      <div className="present-logo">!</div>
      <p style={{color:'#ef9a9a'}}>{error}</p>
      <button className="btn btn-ghost" style={{marginTop:16}} onClick={() => navigate('/projects')}>← Volver</button>
    </div>
  )

  return (
    <div className="present-page">
      {/* Barra flotante - solo visible al mover mouse */}
      <div className={`present-bar ${fullscreen ? 'present-bar-hidden' : ''}`}
           onMouseLeave={e => e.currentTarget.classList.add('present-bar-hidden')}
           onMouseEnter={e => e.currentTarget.classList.remove('present-bar-hidden')}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>← Volver</button>
        <span className="present-nombre">{nombre}</span>
        <button
          className="btn btn-sm"
          style={{background:'#C9A84C',color:'#000',fontWeight:700}}
          onClick={toggleFullscreen}
        >
          {fullscreen ? '⊡ Salir' : '⛶ Pantalla completa'}
        </button>
      </div>

      <div className="present-frame">
        <iframe
          ref={iframeRef}
          src={htmlSrc}
          title={nombre}
          className="present-iframe"
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  )
}
