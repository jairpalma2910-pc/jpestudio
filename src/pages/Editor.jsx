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
  const estadoPortadaRef = useRef(null)
  const idRef = useRef(id)
  const nombreRef = useRef(nombre)
  const pendingRef = useRef(null)

  useEffect(() => { idRef.current = id }, [id])
  useEffect(() => { nombreRef.current = nombre }, [nombre])

  // Escuchar mensajes del iframe
  useEffect(() => {
    const handler = async (e) => {
      // PORTADA: usuario da 💾 GUARDAR en el iframe
      if (e.data?.type === 'save_portada') {
        const estado = e.data.estado
        estadoPortadaRef.current = estado  // guardar SIEMPRE aunque sea proyecto nuevo
        const currentId = idRef.current
        if (!currentId) return  // proyecto nuevo: solo actualizar ref, no guardar en BD
        // Proyecto existente: guardar en BD
        try {
          await api.put(`/api/projects/${currentId}`, {
            nombre: nombreRef.current,
            html_content: JSON.stringify({ tipo: 'portada', estado })
          })
          console.log('[REACT] save_portada OK')
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        } catch (err) { console.error('save_portada error:', err) }
        return
      }
      // TELEPROMPTER: usuario da APLICAR
      if (e.data?.type === 'save_guion') {
        const txt = e.data.text || ''
        const opciones = e.data.opciones || null
        guionRef.current = txt
        if (opciones) opcionesRef.current = opciones
        const currentId = idRef.current
        if (!currentId) return
        try {
          await api.put(`/api/projects/${currentId}`, {
            nombre: nombreRef.current,
            html_content: JSON.stringify({ tipo: 'teleprompter', guion: txt, opciones: opciones || opcionesRef.current })
          })
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        } catch (err) { console.error('save_guion error:', err) }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

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
      let pending = null

      if (tipo === 'portada') {
        // Parsear JSON de portada
        try {
          const parsed = JSON.parse(content)
          estadoPortadaRef.current = parsed.estado || null
          pending = { type: 'load_portada', estado: parsed.estado }
        } catch(e) {
          // Legacy HTML — extraer estado básico
          pending = null
        }
      } else {
        // Teleprompter
        let guion = '', opciones = null
        try {
          const parsed = JSON.parse(content)
          guion = parsed.guion || ''
          opciones = parsed.opciones || null
        } catch(e) {
          // Legacy: texto plano o HTML
          const isHTML = content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')
          if (isHTML) {
            const m = content.match(/window\.__GUION__\s*=\s*`([\s\S]*?)`;/)
            guion = m ? m[1].replace(/\\`/g,'`').replace(/\\\\/g,'\\') : ''
          } else { guion = content }
        }
        guionRef.current = guion
        if (opciones) opcionesRef.current = opciones
        pending = { type: 'load_guion', text: guion, opciones }
      }

      pendingRef.current = pending
      if (iframeLoaded && pending) sendPending()
    } catch (e) {
      alert('Error al cargar proyecto')
      navigate('/projects')
    }
  }

  const sendPending = () => {
    if (!pendingRef.current || !iframeRef.current) return
    const msg = pendingRef.current
    pendingRef.current = null
    let tries = 0
    const send = () => {
      tries++
      try { iframeRef.current.contentWindow.postMessage(msg, '*') }
      catch(e) { if (tries < 15) setTimeout(send, 200) }
    }
    setTimeout(send, 300)
  }

  const handleIframeLoad = () => {
    setIframeLoaded(true)
    if (pendingRef.current) sendPending()
  }

  const handleSaveNew = async () => {
    setSaving(true)
    try {
      let content = ''

      if (tipo === 'portada') {
        // Para portada: pedir estado al iframe y esperar respuesta
        content = await new Promise((resolve) => {
          const h = (e) => {
            // Aceptar tanto portada_data como save_portada
            if (e.data?.type === 'portada_data' || e.data?.type === 'save_portada') {
              const estado = e.data.estado
              window.removeEventListener('message', h)
              clearTimeout(t)
              estadoPortadaRef.current = estado
              resolve(JSON.stringify({ tipo: 'portada', estado }))
            }
          }
          window.addEventListener('message', h)
          const t = setTimeout(() => {
            window.removeEventListener('message', h)
            // Fallback: usar lo que ya tenemos en ref
            resolve(JSON.stringify({ tipo: 'portada', estado: estadoPortadaRef.current }))
          }, 2000)
          // Pedir el estado actual al iframe
          try { iframeRef.current?.contentWindow?.postMessage('get_portada', '*') } catch(e) {}
        })
      } else {
        // Teleprompter
        content = await new Promise((resolve) => {
          const h = (e) => {
            if (e.data?.type === 'guion_data' || e.data?.type === 'save_guion') {
              window.removeEventListener('message', h)
              clearTimeout(t)
              const guion = e.data.text || e.data.text || guionRef.current
              const opciones = e.data.opciones || opcionesRef.current
              resolve(JSON.stringify({ tipo: 'teleprompter', guion, opciones }))
            }
          }
          window.addEventListener('message', h)
          const t = setTimeout(() => {
            window.removeEventListener('message', h)
            resolve(JSON.stringify({ tipo: 'teleprompter', guion: guionRef.current, opciones: opcionesRef.current }))
          }, 2000)
          try { iframeRef.current?.contentWindow?.postMessage('get_guion', '*') } catch(e) {}
        })
      }

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
            <input className="input" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej: 14va Sesión Ordinaria" autoFocus
              onKeyDown={e => e.key === 'Enter' && nombre.trim() && handleSaveNew()} />
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
