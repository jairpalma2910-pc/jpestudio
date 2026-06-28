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
      // PORTADA: usuario da 💾 GUARDAR en el iframe → actualizar ref SIEMPRE
      if (e.data?.type === 'save_portada') {
        const estado = e.data.estado
        estadoPortadaRef.current = estado
        const currentId = idRef.current
        if (!currentId) return  // proyecto nuevo: solo actualizar ref
        try {
          await api.put(`/api/projects/${currentId}`, {
            nombre: nombreRef.current,
            html_content: JSON.stringify({ tipo: 'portada', estado })
          })
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        } catch (err) { console.error('save_portada error:', err) }
        return
      }
      // PORTADA: respuesta a get_portada → actualizar ref
      if (e.data?.type === 'portada_data') {
        estadoPortadaRef.current = e.data.estado
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
      // TELEPROMPTER: respuesta a get_guion → actualizar ref
      if (e.data?.type === 'guion_data') {
        guionRef.current = e.data.text || ''
        if (e.data.opciones) opcionesRef.current = e.data.opciones
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
        try {
          const parsed = JSON.parse(content)
          estadoPortadaRef.current = parsed.estado || null
          pending = { type: 'load_portada', estado: parsed.estado }
        } catch(e) { pending = null }
      } else {
        let guion = '', opciones = null
        try {
          const parsed = JSON.parse(content)
          guion = parsed.guion || ''
          opciones = parsed.opciones || null
        } catch(e) {
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

  // Pedir estado al iframe y abrir modal
  const handleClickSaveNew = () => {
    // Pedir estado antes de abrir el modal
    try {
      if (tipo === 'portada') {
        iframeRef.current?.contentWindow?.postMessage('get_portada', '*')
      } else {
        iframeRef.current?.contentWindow?.postMessage('get_guion', '*')
      }
    } catch(e) {}
    // Esperar 500ms a que llegue el estado, luego abrir modal
    setTimeout(() => setShowSaveModal(true), 500)
  }

  // Guardar nuevo proyecto usando los refs que ya están actualizados
  const handleSaveNew = async () => {
    setSaving(true)
    try {
      let content = ''
      if (tipo === 'portada') {
        content = JSON.stringify({ tipo: 'portada', estado: estadoPortadaRef.current })
      } else {
        content = JSON.stringify({ tipo: 'teleprompter', guion: guionRef.current, opciones: opcionesRef.current })
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
            <button className="btn btn-gold btn-sm" onClick={handleClickSaveNew}>
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
