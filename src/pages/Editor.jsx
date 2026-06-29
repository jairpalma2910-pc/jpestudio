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

  const guionRef = useRef('')
  const opcionesRef = useRef(null)
  const estadoPortadaRef = useRef(null)
  const idRef = useRef(id)
  const nombreRef = useRef(nombre)
  const iframeReadyRef = useRef(false) // REF no estado — evita stale closures

  useEffect(() => { idRef.current = id }, [id])
  useEffect(() => { nombreRef.current = nombre }, [nombre])

  // Escuchar mensajes del iframe
  useEffect(() => {
    const handler = async (e) => {
      if (e.data?.type === 'save_portada') {
        const estado = e.data.estado
        estadoPortadaRef.current = estado
        const currentId = idRef.current
        console.log('[REACT] save_portada recibido. id:', currentId, 'nombre:', nombreRef.current)
        if (!currentId) { console.warn('[REACT] Sin ID - no se guarda'); return }
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
      if (e.data?.type === 'portada_data') {
        estadoPortadaRef.current = e.data.estado
        return
      }
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
      let msg = null

      if (tipo === 'portada') {
        try {
          const parsed = JSON.parse(content)
          estadoPortadaRef.current = parsed.estado || null
          msg = { type: 'load_portada', estado: parsed.estado }
        } catch(e) { msg = null }
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
        msg = { type: 'load_guion', text: guion, opciones }
      }

      if (!msg) return

      // Enviar al iframe — si ya está listo enviar ahora, sino reintentar
      const enviar = (intentos) => {
        if (!iframeRef.current) {
          if (intentos < 20) setTimeout(() => enviar(intentos + 1), 200)
          return
        }
        if (!iframeReadyRef.current) {
          // Iframe montado pero JS no listo aún, esperar
          if (intentos < 20) setTimeout(() => enviar(intentos + 1), 200)
          return
        }
        try {
          iframeRef.current.contentWindow.postMessage(msg, '*')
        } catch(e) {
          if (intentos < 20) setTimeout(() => enviar(intentos + 1), 200)
        }
      }
      enviar(0)
    } catch (e) {
      alert('Error al cargar proyecto')
      navigate('/projects')
    }
  }

  const handleIframeLoad = () => {
    // La portada es ~1.3MB y tiene recursos pesados, esperar más
    const delay = tipo === 'portada' ? 1500 : 500
    setTimeout(() => {
      iframeReadyRef.current = true
    }, delay)
  }

  const handleClickSaveNew = () => {
    try {
      if (tipo === 'portada') {
        iframeRef.current?.contentWindow?.postMessage('get_portada', '*')
      } else {
        iframeRef.current?.contentWindow?.postMessage('get_guion', '*')
      }
    } catch(e) {}
    setTimeout(() => setShowSaveModal(true), 600)
  }

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
