import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import './Editor.css'

const BASE_TELEPROMPTER_URL = '/jpestudio/teleprompter.html'
const BASE_PORTADA_URL = '/jpestudio/portada.html'

export default function Editor() {
  const { tipo, id } = useParams()
  const navigate = useNavigate()
  const iframeRef = useRef(null)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [iframeSrc] = useState(
    tipo === 'portada' ? BASE_PORTADA_URL : BASE_TELEPROMPTER_URL
  )
  // Guardamos el guión en texto plano aquí en React
  const guionRef = useRef('')
  const idRef = useRef(id)
  const nombreRef = useRef(nombre)

  useEffect(() => { idRef.current = id }, [id])
  useEffect(() => { nombreRef.current = nombre }, [nombre])

  // Escuchar mensajes del iframe
  useEffect(() => {
    const handler = async (e) => {
      // El teleprompter envía el guión actualizado cuando el usuario da APLICAR
      if (e.data?.type === 'save_guion') {
        const txt = e.data.text || ''
        guionRef.current = txt
        // Auto-guardar si proyecto existente
        const currentId = idRef.current
        if (!currentId) return
        try {
          await api.put(`/api/projects/${currentId}`, {
            nombre: nombreRef.current,
            html_content: txt   // guardamos texto plano
          })
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        } catch (err) {
          console.error('Auto-save error:', err)
        }
      }
      // Respuesta al 'get_guion' para guardar proyecto nuevo
      if (e.data?.type === 'guion_data') {
        guionRef.current = e.data.text || ''
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Cargar proyecto existente y enviar guión al iframe
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
      // html_content puede ser texto plano del guión O HTML legacy
      // Detectar: si empieza con <!DOCTYPE o <html es HTML legacy
      const content = data.html_content || ''
      const isLegacyHTML = content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')

      if (isLegacyHTML) {
        // Proyecto guardado con la arquitectura anterior (HTML completo)
        // Extraer el guión del HTML
        const guionMatch = content.match(/window\.__GUION__\s*=\s*`([\s\S]*?)`;/)
        const guion = guionMatch ? guionMatch[1].replace(/\\`/g,'`').replace(/\\\\/g,'\\') : ''
        guionRef.current = guion
      } else {
        // Texto plano del guión
        guionRef.current = content
      }
    } catch (e) {
      alert('Error al cargar proyecto')
      navigate('/projects')
    }
  }

  // Cuando el iframe carga, si hay proyecto, enviar el guión
  const handleIframeLoad = () => {
    if (!id) return // nuevo: no enviar nada, el iframe arranca vacío
    if (!guionRef.current) return
    try {
      iframeRef.current?.contentWindow?.postMessage({
        type: 'load_guion',
        text: guionRef.current
      }, '*')
    } catch(e) {}
  }

  // Pedir guión al iframe y guardar nuevo proyecto
  const handleSaveNew = async () => {
    setSaving(true)
    try {
      // Pedir guión actual al iframe
      const txt = await new Promise((resolve) => {
        const handler = (e) => {
          if (e.data?.type === 'guion_data') {
            window.removeEventListener('message', handler)
            clearTimeout(timeout)
            resolve(e.data.text || '')
          }
        }
        window.addEventListener('message', handler)
        const timeout = setTimeout(() => {
          window.removeEventListener('message', handler)
          resolve(guionRef.current)
        }, 3000)
        try {
          iframeRef.current?.contentWindow?.postMessage('get_guion', '*')
        } catch(e) {
          clearTimeout(timeout)
          window.removeEventListener('message', handler)
          resolve(guionRef.current)
        }
      })

      guionRef.current = txt
      const { data } = await api.post('/api/projects', {
        nombre,
        tipo,
        html_content: txt  // texto plano del guión
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
          src={iframeSrc}
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
              <button className="btn btn-ghost" onClick={() => setShowSaveModal(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-gold"
                onClick={handleSaveNew}
                disabled={saving || !nombre.trim()}
              >
                {saving ? '⏳ Guardando...' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
