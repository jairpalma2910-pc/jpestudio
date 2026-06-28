import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import './Present.css'

const TELEPROMPTER_URL = '/jpestudio/teleprompter.html'
const PORTADA_URL = '/jpestudio/portada.html'

export default function Present() {
  const { id } = useParams()
  const navigate = useNavigate()
  const iframeRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nombre, setNombre] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [iframeSrc, setIframeSrc] = useState('')
  const guionRef = useRef('')
  const opcionesRef = useRef(null)
  const tipoRef = useRef('')

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
      tipoRef.current = data.tipo
      const content = data.html_content || ''
      const isLegacyHTML = content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')

      if (data.tipo === 'teleprompter') {
        const isJSON = content.trim().startsWith('{')
        if (isJSON) {
          try {
            const parsed = JSON.parse(content)
            guionRef.current = parsed.guion || ''
            opcionesRef.current = parsed.opciones || null
          } catch(e) { guionRef.current = content }
        } else if (isLegacyHTML) {
          const guionMatch = content.match(/window\.__GUION__\s*=\s*`([\s\S]*?)`;/)
          guionRef.current = guionMatch ? guionMatch[1].replace(/\\`/g,'`').replace(/\\\\/g,'\\') : ''
        } else {
          guionRef.current = content
        }
        setIframeSrc(TELEPROMPTER_URL)
      } else {
        // Portada: sigue usando HTML completo
        const blob = new Blob([content], { type: 'text/html' })
        setIframeSrc(URL.createObjectURL(blob))
      }
    } catch (e) {
      setError('No se pudo cargar el proyecto')
    } finally {
      setLoading(false)
    }
  }

  const handleIframeLoad = () => {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      if (tipoRef.current === 'teleprompter') {
        // Enviar guión y activar modo presentación
        if (guionRef.current) {
          iframe.contentWindow.postMessage({ type: 'load_guion', text: guionRef.current, opciones: opcionesRef.current }, '*')
        }
        setTimeout(() => {
          iframe.contentWindow.postMessage('present_mode', '*')
        }, 300)
      } else {
        iframe.contentWindow.postMessage('present_mode', '*')
      }
    } catch(e) {}
    // Auto fullscreen
    setTimeout(() => {
      if (iframe?.requestFullscreen) {
        iframe.requestFullscreen().catch(() => {})
      }
    }, 500)
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
          src={iframeSrc}
          title={nombre}
          className="present-iframe"
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  )
}
