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
  const idRef = useRef(id)
  const nombreRef = useRef(nombre)

  useEffect(() => { idRef.current = id }, [id])
  useEffect(() => { nombreRef.current = nombre }, [nombre])

  // Escuchar save_guion del iframe (cuando usuario da APLICAR)
  useEffect(() => {
    const handler = async (e) => {
      if (e.data?.type !== 'save_guion') return
      const txt = e.data.text || ''
      const opciones = e.data.opciones || null
      console.log('[REACT] save_guion recibido, chars:', txt.length, 'id:', idRef.current)
      guionRef.current = txt
      if (opciones) opcionesRef.current = opciones
      const currentId = idRef.current
      if (!currentId) {
        console.warn('[REACT] Sin id, no se guarda')
        return
      }
      const payload = JSON.stringify({ guion: txt, opciones: opciones || opcionesRef.current })
      try {
        await api.put(`/api/projects/${currentId}`, {
          nombre: nombreRef.current,
          html_content: payload
        })
        console.log('[REACT] Guardado OK en proyecto', currentId)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (err) {
        console.error('[REACT] Error auto-save:', err)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Al montar: cargar proyecto o inicializar nuevo
  useEffect(() => {
    if (!id) {
      setNombre(tipo === 'portada' ? 'Nueva Portada' : 'Nuevo Teleprompter')
      guionRef.current = ''
    } else {
      loadProject()
    }
  }, [id, tipo])

  const loadProject = async () => {
    try {
      const { data } = await api.get(`/api/projects/${id}`)
      setNombre(data.nombre)
      const content = data.html_content || ''

      // Detectar HTML legacy vs texto plano
      const isHTML = content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')
      const isJSON = content.trim().startsWith('{')
      let guion = content
      let opciones = null
      if (isJSON) {
        try {
          const parsed = JSON.parse(content)
          guion = parsed.guion || ''
          opciones = parsed.opciones || null
        } catch(e) { guion = content }
      } else if (isHTML) {
        const m = content.match(/window\.__GUION__\s*=\s*`([\s\S]*?)`;/)
        guion = m ? m[1].replace(/\\`/g, '`').replace(/\\\\/g, '\\') : ''
        if (!guion) {
          let txt = ''
          const bloques = content.matchAll(/<div class="bloque">[\s\S]*?<div class="quien"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="texto"[^>]*>([\s\S]*?)<\/div>/g)
          for (const b of bloques) {
            txt += '[' + b[1].replace(/<[^>]+>/g,'').trim() + ']\n'
            txt += b[2].replace(/<[^>]+>/g,'').trim() + '\n\n'
          }
          guion = txt
        }
      }
      guionRef.current = guion
      if (opciones) opcionesRef.current = opciones

      // Enviar al iframe — intentar inmediatamente y reintentar cada 200ms
      // hasta que el iframe esté listo (máx 3s)
      enviarGuion(guion)
    } catch (e) {
      alert('Error al cargar proyecto')
      navigate('/projects')
    }
  }

  // Enviar guión al iframe con reintentos
  const enviarGuion = (txt) => {
    let intentos = 0
    const maxIntentos = 15  // 15 × 200ms = 3 segundos
    const enviar = () => {
      intentos++
      const iframe = iframeRef.current
      if (!iframe) {
        if (intentos < maxIntentos) setTimeout(enviar, 200)
        return
      }
      try {
        iframe.contentWindow.postMessage({ type: 'load_guion', text: txt, opciones: opcionesRef.current }, '*')
      } catch(e) {
        if (intentos < maxIntentos) setTimeout(enviar, 200)
      }
    }
    setTimeout(enviar, 300) // primer intento después de 300ms
  }

  // Guardar nuevo proyecto
  const handleSaveNew = async () => {
    setSaving(true)
    try {
      // Pedir el guión actual al iframe
      const result = await new Promise((resolve) => {
        const h = (e) => {
          if (e.data?.type === 'guion_data') {
            window.removeEventListener('message', h)
            clearTimeout(t)
            resolve({ text: e.data.text || '', opciones: e.data.opciones || null })
          }
        }
        window.addEventListener('message', h)
        const t = setTimeout(() => {
          window.removeEventListener('message', h)
          resolve({ text: guionRef.current, opciones: opcionesRef.current })
        }, 3000)
        iframeRef.current?.contentWindow?.postMessage('get_guion', '*')
      })

      const payload = JSON.stringify({ guion: result.text, opciones: result.opciones || opcionesRef.current })
      const { data } = await api.post('/api/projects', {
        nombre,
        tipo,
        html_content: payload
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
