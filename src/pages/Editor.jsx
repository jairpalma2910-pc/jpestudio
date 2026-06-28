import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [iframeReady, setIframeReady] = useState(false)

  // Refs para evitar stale closures
  const guionRef = useRef('')       // texto plano del guión
  const idRef = useRef(id)
  const nombreRef = useRef(nombre)
  const iframeReadyRef = useRef(false)
  const pendingGuionRef = useRef(null) // guión pendiente de enviar al iframe

  useEffect(() => { idRef.current = id }, [id])
  useEffect(() => { nombreRef.current = nombre }, [nombre])

  // Escuchar mensajes del iframe
  useEffect(() => {
    const handler = async (e) => {
      // APLICAR: el teleprompter envía el guión actualizado
      if (e.data?.type === 'save_guion') {
        const txt = e.data.text || ''
        guionRef.current = txt
        const currentId = idRef.current
        if (!currentId) return
        try {
          await api.put(`/api/projects/${currentId}`, {
            nombre: nombreRef.current,
            html_content: txt
          })
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        } catch (err) {
          console.error('Auto-save error:', err)
        }
      }
      // Respuesta a get_guion (para guardar nuevo proyecto)
      if (e.data?.type === 'guion_data') {
        guionRef.current = e.data.text || ''
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Cargar datos del proyecto
  useEffect(() => {
    if (!id) {
      setNombre(tipo === 'portada' ? 'Nueva Portada' : 'Nuevo Teleprompter')
      guionRef.current = ''
      return
    }
    loadProject()
  }, [id, tipo])

  const loadProject = async () => {
    try {
      const { data } = await api.get(`/api/projects/${id}`)
      setNombre(data.nombre)
      const content = data.html_content || ''
      // Detectar si es HTML legacy (versión anterior guardaba HTML completo)
      const isLegacyHTML = content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')
      if (isLegacyHTML) {
        // Extraer guión del HTML legacy
        const m = content.match(/window\.__GUION__\s*=\s*`([\s\S]*?)`;/)
        guionRef.current = m ? m[1].replace(/\\`/g, '`').replace(/\\\\/g, '\\') : ''
        if (!guionRef.current) {
          // Último fallback: extraer del DOM del HTML guardado
          const scMatch = content.match(/<div id="sc">([\s\S]*?)<\/div>\s*(?:<!--|<button)/)
          if (scMatch) {
            // convertir los .bloque a texto plano
            const bloques = scMatch[1].matchAll(/<div class="quien"[^>]*>(.*?)<\/div>[\s\S]*?<div class="texto"[^>]*>([\s\S]*?)<\/div>/g)
            let txt = ''
            for (const b of bloques) {
              txt += '[' + b[1].trim() + ']\n' + b[2].trim() + '\n\n'
            }
            guionRef.current = txt
          }
        }
      } else {
        guionRef.current = content
      }
      // Si el iframe ya está listo, enviar el guión ahora
      if (iframeReadyRef.current) {
        sendGuionToIframe()
      } else {
        // Guardar pendiente para enviar cuando el iframe esté listo
        pendingGuionRef.current = guionRef.current
      }
    } catch (e) {
      alert('Error al cargar proyecto')
      navigate('/projects')
    }
  }

  const sendGuionToIframe = () => {
    const txt = guionRef.current
    if (!txt || !iframeRef.current) return
    try {
      iframeRef.current.contentWindow.postMessage({ type: 'load_guion', text: txt }, '*')
    } catch(e) {}
  }

  // El iframe terminó de cargar
  const handleIframeLoad = () => {
    iframeReadyRef.current = true
    setIframeReady(true)
    // Si hay guión pendiente (proyecto existente cargó antes que el iframe)
    if (pendingGuionRef.current) {
      setTimeout(() => {
        try {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'load_guion', text: pendingGuionRef.current }, '*'
          )
        } catch(e) {}
        pendingGuionRef.current = null
      }, 100) // pequeño delay para que el JS del iframe esté listo
    }
    // Si ya teníamos el guión cargado (iframe cargó después)
    if (id && guionRef.current && !pendingGuionRef.current) {
      setTimeout(() => sendGuionToIframe(), 100)
    }
  }

  // Guardar nuevo proyecto
  const handleSaveNew = async () => {
    setSaving(true)
    try {
      const txt = await new Promise((resolve) => {
        const localHandler = (e) => {
          if (e.data?.type === 'guion_data') {
            window.removeEventListener('message', localHandler)
            clearTimeout(timeout)
            resolve(e.data.text || '')
          }
        }
        window.addEventListener('message', localHandler)
        const timeout = setTimeout(() => {
          window.removeEventListener('message', localHandler)
          resolve(guionRef.current)
        }, 3000)
        try {
          iframeRef.current?.contentWindow?.postMessage('get_guion', '*')
        } catch(e) {
          clearTimeout(timeout)
          window.removeEventListener('message', localHandler)
          resolve(guionRef.current)
        }
      })

      guionRef.current = txt
      const { data } = await api.post('/api/projects', {
        nombre,
        tipo,
        html_content: txt
      })
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
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>
          ← Volver
        </button>
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
