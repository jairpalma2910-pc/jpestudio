import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import './Editor.css'

const TELEPROMPTER_URL = '/jpestudio/teleprompter.html'
const PORTADA_URL = '/jpestudio/portada.html'

export default function Editor() {
  const { tipo, id } = useParams()
  const navigate = useNavigate()
  const iframeRef = useRef(null)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)

  const guionRef = useRef('')
  const opcionesRef = useRef(null)
  const htmlContentRef = useRef('') // para portada
  const idRef = useRef(id)
  const nombreRef = useRef(nombre)
  const pendingRef = useRef(null) // mensaje pendiente de enviar al iframe

  useEffect(() => { idRef.current = id }, [id])
  useEffect(() => { nombreRef.current = nombre }, [nombre])

  // Escuchar mensajes del iframe
  useEffect(() => {
    const handler = async (e) => {
      // PORTADA: guarda HTML completo cuando usuario da 💾 GUARDAR
      if (e.data?.type === 'save_html') {
        const html = e.data.html || ''
        htmlContentRef.current = html
        const currentId = idRef.current
        if (!currentId) return // proyecto nuevo — esperar nombre
        try {
          await api.put(`/api/projects/${currentId}`, {
            nombre: nombreRef.current,
            html_content: html
          })
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        } catch (err) {
          console.error('[REACT] Error save_html:', err)
        }
        return
      }

      // TELEPROMPTER: guarda guión cuando usuario da APLICAR
      if (e.data?.type === 'save_guion') {
        const txt = e.data.text || ''
        const opciones = e.data.opciones || null
        guionRef.current = txt
        if (opciones) opcionesRef.current = opciones
        const currentId = idRef.current
        if (!currentId) return
        const payload = JSON.stringify({ guion: txt, opciones: opciones || opcionesRef.current })
        try {
          await api.put(`/api/projects/${currentId}`, {
            nombre: nombreRef.current,
            html_content: payload
          })
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        } catch (err) {
          console.error('[REACT] Error save_guion:', err)
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Cargar proyecto al montar
  useEffect(() => {
    if (!id) {
      setNombre(tipo === 'portada' ? 'Nueva Portada' : 'Nuevo Teleprompter')
      return
    }
    loadProject()
  }, [id, tipo])

  const loadProject = async () => {
    try {
      const { data } = await api.get(`/api/projects/${id}`)
      setNombre(data.nombre)
      const content = data.html_content || ''

      if (tipo === 'portada') {
        htmlContentRef.current = content
        // Enviar al iframe cuando esté listo
        pendingRef.current = { type: 'load_html', html: content }
        if (iframeLoaded) sendPending()
      } else {
        // Teleprompter: parsear JSON o texto plano
        const isJSON = content.trim().startsWith('{')
        const isHTML = content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')
        let guion = content
        let opciones = null
        if (isJSON) {
          try { const p = JSON.parse(content); guion = p.guion||''; opciones = p.opciones||null } catch(e){}
        } else if (isHTML) {
          const m = content.match(/window\.__GUION__\s*=\s*`([\s\S]*?)`;/)
          guion = m ? m[1].replace(/\\`/g,'`').replace(/\\\\/g,'\\') : ''
        }
        guionRef.current = guion
        if (opciones) opcionesRef.current = opciones
        pendingRef.current = { type: 'load_guion', text: guion, opciones }
        if (iframeLoaded) sendPending()
      }
    } catch (e) {
      alert('Error al cargar proyecto')
      navigate('/projects')
    }
  }

  const sendPending = () => {
    if (!pendingRef.current || !iframeRef.current) return
    const msg = pendingRef.current
    pendingRef.current = null
    // Reintentar hasta 15 veces con delay
    let tries = 0
    const send = () => {
      tries++
      try {
        iframeRef.current.contentWindow.postMessage(msg, '*')
      } catch(e) {
        if (tries < 15) setTimeout(send, 200)
      }
    }
    setTimeout(send, 200)
  }

  const handleIframeLoad = () => {
    setIframeLoaded(true)
    if (pendingRef.current) sendPending()
  }

  // Guardar nuevo proyecto
  const handleSaveNew = async () => {
    setSaving(true)
    try {
      const content = await new Promise((resolve) => {
        const h = (e) => {
          if (tipo === 'portada' && e.data?.type === 'save_html') {
            window.removeEventListener('message', h); clearTimeout(t)
            resolve(e.data.html || '')
          }
          if (tipo === 'teleprompter' && e.data?.type === 'guion_data') {
            window.removeEventListener('message', h); clearTimeout(t)
            resolve(JSON.stringify({ guion: e.data.text||'', opciones: e.data.opciones||opcionesRef.current }))
          }
        }
        window.addEventListener('message', h)
        const t = setTimeout(() => {
          window.removeEventListener('message', h)
          resolve(tipo === 'portada' ? htmlContentRef.current : JSON.stringify({ guion: guionRef.current, opciones: opcionesRef.current }))
        }, 3000)
        if (tipo === 'portada') {
          iframeRef.current?.contentWindow?.postMessage('get_html', '*')
        } else {
          iframeRef.current?.contentWindow?.postMessage('get_guion', '*')
        }
      })

      const { data } = await api.post('/api/projects', { nombre, tipo, html_content: content })
      navigate(`/editor/${tipo}/${data.id}`, { replace: true })
    } catch (e) {
      alert('Error al guardar: ' + (e.response?.data?.error || e.message))
    } finally {
      setSaving(false)
      setShowSaveModal(false)
    }
  }

  return (
    <div className="editor-page">
      <div className="editor-topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>← Volver</button>
        <div className="editor-title">
          {tipo === 'portada' ? '🎬' : '📋'}
          <span>{nombre}</span>
          <span className="editor-tipo">{tipo}</span>
        </div>
        <div className="editor-actions">
          {saved && <span className="editor-saved">✓ Guardado</span>}
          {!id && (
            <button className="btn btn-gold btn-sm" onClick={() => setShowSaveModal(true)}>
              💾 Guardar proyecto
            </button>
          )}
        </div>
      </div>

      <div className="editor-frame">
        <iframe
          ref={iframeRef}
          src={tipo === 'portada' ? PORTADA_URL : TELEPROMPTER_URL}
          title={`Editor ${tipo}`}
          className="editor-iframe"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          onLoad={handleIframeLoad}
        />
      </div>

      {showSaveModal && !id && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">💾 Guardar Proyecto</div>
            <label className="label">Nombre del proyecto</label>
            <input
              className="input"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: 14va Sesión Ordinaria"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && nombre.trim() && handleSaveNew()}
            />
            <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={() => setShowSaveModal(false)}>Cancelar</button>
              <button className="btn btn-gold" onClick={handleSaveNew} disabled={saving || !nombre.trim()}>
                {saving ? '⏳ Guardando...' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
