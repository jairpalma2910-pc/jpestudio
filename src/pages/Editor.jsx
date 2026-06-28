import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import './Editor.css'

const BASE_PORTADA_URL = '/jpestudio/portada.html'
const BASE_TELEPROMPTER_URL = '/jpestudio/teleprompter.html'

export default function Editor() {
  const { tipo, id } = useParams()
  const navigate = useNavigate()
  const iframeRef = useRef(null)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [htmlContent, setHtmlContent] = useState('')
  const [iframeSrc, setIframeSrc] = useState('')
  const idRef = useRef(id)
  const nombreRef = useRef(nombre)

  useEffect(() => { idRef.current = id }, [id])
  useEffect(() => { nombreRef.current = nombre }, [nombre])

  useEffect(() => {
    if (id) loadProject()
    else {
      setNombre(tipo === 'portada' ? 'Nueva Portada' : 'Nuevo Teleprompter')
      setIframeSrc(tipo === 'portada' ? BASE_PORTADA_URL : BASE_TELEPROMPTER_URL)
    }
  }, [id, tipo])

  // Escuchar save_html del iframe — auto-guardar si proyecto existente
  useEffect(() => {
    const handler = async (e) => {
      if (e.data?.type !== 'save_html' || !e.data?.html) return
      const content = e.data.html
      setHtmlContent(content)

      // Si hay id guardamos automáticamente
      const currentId = idRef.current
      if (currentId) {
        try {
          await api.put(`/api/projects/${currentId}`, { nombre: nombreRef.current, html_content: content })
          setSaved(true)
          setTimeout(() => setSaved(false), 3000)
        } catch (err) {
          console.error('Auto-save error:', err)
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const loadProject = async () => {
    try {
      const { data } = await api.get(`/api/projects/${id}`)
      setNombre(data.nombre)
      setHtmlContent(data.html_content)
      const blob = new Blob([data.html_content], { type: 'text/html' })
      setIframeSrc(URL.createObjectURL(blob))
    } catch (e) {
      alert('Error al cargar proyecto')
      navigate('/projects')
    }
  }

  const requestHTMLFromIframe = () => {
    return new Promise((resolve) => {
      const iframe = iframeRef.current
      if (!iframe) { resolve(htmlContent); return }

      const handler = (e) => {
        if (e.data?.type === 'save_html' && e.data?.html) {
          window.removeEventListener('message', handler)
          clearTimeout(timeout)
          resolve(e.data.html)
        }
      }
      window.addEventListener('message', handler)

      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler)
        resolve(htmlContent)
      }, 3000)

      try {
        iframe.contentWindow.postMessage('get_html', '*')
      } catch(e) {
        clearTimeout(timeout)
        window.removeEventListener('message', handler)
        resolve(htmlContent)
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const content = await requestHTMLFromIframe()
      if (!content) { alert('No se pudo obtener el contenido'); setSaving(false); return }

      if (id) {
        await api.put(`/api/projects/${id}`, { nombre, html_content: content })
        setHtmlContent(content)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
        setShowSaveModal(false)
      } else {
        const { data } = await api.post('/api/projects', { nombre, tipo, html_content: content })
        navigate(`/editor/${tipo}/${data.id}`, { replace: true })
      }
    } catch (e) {
      alert('Error al guardar: ' + (e.response?.data?.error || e.message))
    } finally {
      setSaving(false)
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
          <button className="btn btn-gold btn-sm" onClick={() => id ? handleSave() : setShowSaveModal(true)}>
            💾 {id ? 'Guardar' : 'Guardar proyecto'}
          </button>
        </div>
      </div>

      <div className="editor-frame">
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title={`Editor ${tipo}`}
          className="editor-iframe"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
        />
      </div>

      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">💾 Guardar Proyecto</div>
            <label className="label">Nombre del proyecto</label>
            <input
              className="input"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Portada 14va Sesión Ordinaria"
              autoFocus
            />
            <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={() => setShowSaveModal(false)}>Cancelar</button>
              <button className="btn btn-gold" onClick={handleSave} disabled={saving || !nombre.trim()}>
                {saving ? '⏳ Guardando...' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
