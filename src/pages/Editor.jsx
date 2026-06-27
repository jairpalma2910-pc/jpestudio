import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import './Editor.css'

// HTMLs base embebidos como strings (se cargan desde los archivos subidos)
const BASE_PORTADA_URL = '/jpestudio/portada.html'
const BASE_TELEPROMPTER_URL = '/jpestudio/teleprompter.html'

export default function Editor() {
  const { tipo, id } = useParams()
  const navigate = useNavigate()
  const iframeRef = useRef(null)
  const [project, setProject] = useState(null)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestMsg, setRequestMsg] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (id) loadProject()
    else {
      setNombre(tipo === 'portada' ? 'Nueva Portada' : 'Nuevo Teleprompter')
    }
  }, [id, tipo])

  const loadProject = async () => {
    try {
      const { data } = await api.get(`/api/projects/${id}`)
      setProject(data)
      setNombre(data.nombre)
      setHtmlContent(data.html_content)
    } catch (e) {
      alert('Error al cargar proyecto')
      navigate('/projects')
    }
  }

  const toggleFullscreen = useCallback(() => {
    const iframe = iframeRef.current
    if (!document.fullscreenElement) {
      if (iframe?.requestFullscreen) iframe.requestFullscreen()
      else if (iframe?.webkitRequestFullscreen) iframe.webkitRequestFullscreen()
      setFullscreen(true)
    } else {
      if (document.exitFullscreen) document.exitFullscreen()
      setFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const getIframeSrc = () => {
    if (htmlContent) {
      const blob = new Blob([htmlContent], { type: 'text/html' })
      return URL.createObjectURL(blob)
    }
    return tipo === 'portada' ? BASE_PORTADA_URL : BASE_TELEPROMPTER_URL
  }

  const captureHTML = () => {
    try {
      const iframe = iframeRef.current
      if (!iframe?.contentDocument) return null
      return '<!DOCTYPE html>' + iframe.contentDocument.documentElement.outerHTML
    } catch {
      return htmlContent
    }
  }

  const handleSave = async () => {
    const content = captureHTML()
    if (!content) return alert('No se pudo capturar el contenido')
    setSaving(true)
    try {
      if (id) {
        await api.put(`/api/projects/${id}`, { nombre, html_content: content })
      } else {
        const { data } = await api.post('/api/projects', { nombre, tipo, html_content: content })
        navigate(`/editor/${tipo}/${data.id}`, { replace: true })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      setShowSaveModal(false)
    } catch (e) {
      alert('Error al guardar: ' + (e.response?.data?.error || e.message))
    } finally {
      setSaving(false)
    }
  }

  const handleRequestDownload = async () => {
    if (!id) return alert('Guarda el proyecto primero')
    try {
      await api.post('/api/requests', { proyecto_id: id, mensaje: requestMsg })
      alert('✅ Solicitud enviada. El administrador la revisará pronto.')
      setShowRequestModal(false)
      setRequestMsg('')
    } catch (e) {
      alert(e.response?.data?.error || 'Error al enviar solicitud')
    }
  }

  return (
    <div className="editor-page">
      {/* Barra superior */}
      <div className="editor-topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>← Volver</button>
        <div className="editor-title">
          {tipo === 'portada' ? '🎬' : '📋'}
          <span>{nombre}</span>
          <span className="editor-tipo">{tipo}</span>
        </div>
        <div className="editor-actions">
          {saved && <span className="editor-saved">✓ Guardado</span>}
          <button className="btn btn-outline btn-sm" onClick={() => setShowSaveModal(true)}>💾 Guardar</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowRequestModal(true)}>📥 Solicitar descarga</button>
          <button
            className="btn btn-sm"
            style={{background:'#1a1a2e',color:'#C9A84C',border:'1px solid #C9A84C'}}
            onClick={toggleFullscreen}
            title="Pantalla completa (F11 para salir)"
          >
            {fullscreen ? '⊡ Salir' : '⛶ Presentar'}
          </button>
        </div>
      </div>

      {/* Iframe con el HTML */}
      <div className="editor-frame">
        <iframe
          ref={iframeRef}
          src={getIframeSrc()}
          title={`Editor ${tipo}`}
          className="editor-iframe"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
        />
      </div>

      {/* Modal guardar */}
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

      {/* Modal solicitar descarga */}
      {showRequestModal && (
        <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📥 Solicitar Descarga</div>
            <p style={{color:'#aaa',fontSize:13,marginBottom:16}}>
              Se enviará una solicitud al administrador para aprobar la descarga de <strong style={{color:'#fff'}}>"{nombre}"</strong>.
            </p>
            <label className="label">Mensaje (opcional)</label>
            <textarea
              className="input"
              style={{height:80,resize:'vertical'}}
              placeholder="Agrega un comentario si lo necesitas..."
              value={requestMsg}
              onChange={e => setRequestMsg(e.target.value)}
            />
            <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={() => setShowRequestModal(false)}>Cancelar</button>
              <button className="btn btn-gold" onClick={handleRequestDownload}>📤 Enviar solicitud</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
