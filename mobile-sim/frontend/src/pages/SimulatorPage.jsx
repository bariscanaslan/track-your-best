import { useState, useRef, useCallback, useEffect } from 'react'
import { sendLocation } from '../services/api'
import { useGeolocation } from '../hooks/useGeolocation'

const SEND_INTERVAL_MS = 3000

const STATUS_COLOR = { idle: '#6b7280', connecting: '#f59e0b', active: '#10b981', error: '#ef4444' }

export default function SimulatorPage({ token, onLogout }) {
  const [deviceId, setDeviceId] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [tracking, setTracking] = useState(false)
  const [status, setStatus] = useState('idle')
  const [sendCount, setSendCount] = useState(0)
  const [error, setError] = useState(null)

  const intervalRef = useRef(null)
  const posRef = useRef(null)
  const credRef = useRef({ deviceId: '', secretKey: '' })

  const { position, error: geoError, start: startGeo, stop: stopGeo } = useGeolocation()

  useEffect(() => { posRef.current = position }, [position])

  const start = useCallback(() => {
    if (!deviceId.trim() || !secretKey.trim()) return
    credRef.current = { deviceId: deviceId.trim(), secretKey: secretKey.trim() }
    setError(null)
    setSendCount(0)
    setStatus('connecting')
    startGeo()
    setTracking(true)

    intervalRef.current = setInterval(async () => {
      const pos = posRef.current
      if (!pos) return
      try {
        await sendLocation(token, credRef.current.deviceId, credRef.current.secretKey, pos.latitude, pos.longitude)
        setStatus('active')
        setSendCount((n) => n + 1)
      } catch (err) {
        if (err.message.includes('401')) {
          onLogout()
          return
        }
        setStatus('error')
        setError(err.message)
      }
    }, SEND_INTERVAL_MS)
  }, [deviceId, secretKey, token, startGeo, onLogout])

  const stop = useCallback(() => {
    clearInterval(intervalRef.current)
    stopGeo()
    setTracking(false)
    setStatus('idle')
    setSendCount(0)
    setError(null)
  }, [stopGeo])

  useEffect(() => () => stop(), [])

  const statusLabel = {
    idle: 'Ready',
    connecting: 'Waiting for GPS fix…',
    active: `Active — ${sendCount} update${sendCount !== 1 ? 's' : ''} sent`,
    error: 'Error',
  }[status]

  return (
    <div className="page">
      <header className="topbar">
        <span className="topbar-title">TYB Simulator</span>
        <button className="btn-link" onClick={onLogout}>Logout</button>
      </header>

      <div className="content">
        <section className="form">
          <label className="field-label">Device ID</label>
          <input
            className="input"
            type="text"
            placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            disabled={tracking}
            autoCapitalize="none"
            spellCheck={false}
          />
          <label className="field-label">Secret Key</label>
          <input
            className="input"
            type="password"
            placeholder="Device secret key"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            disabled={tracking}
            autoComplete="off"
          />
        </section>

        <div className="status-row">
          <span className="status-dot" style={{ background: STATUS_COLOR[status] }} />
          <span className="status-label">{statusLabel}</span>
        </div>

        {position && (
          <div className="coords-box">
            <div className="coord-row">
              <span className="coord-label">Lat</span>
              <span className="coord-value">{position.latitude.toFixed(6)}</span>
            </div>
            <div className="coord-row">
              <span className="coord-label">Lon</span>
              <span className="coord-value">{position.longitude.toFixed(6)}</span>
            </div>
            <div className="coord-accuracy">±{Math.round(position.accuracy)} m</div>
          </div>
        )}

        {(geoError || error) && (
          <p className="error-msg">{geoError || error}</p>
        )}

        {!tracking ? (
          <button
            className="btn btn-primary btn--large"
            onClick={start}
            disabled={!deviceId.trim() || !secretKey.trim()}
          >
            Start Tracking
          </button>
        ) : (
          <button className="btn btn-danger btn--large" onClick={stop}>
            Stop Tracking
          </button>
        )}

        {tracking && (
          <p className="disclaimer">
            Keep this tab open and active. Mobile browsers may throttle GPS when
            the screen is off or the tab is backgrounded — this is expected for a
            web-based simulator.
          </p>
        )}
      </div>
    </div>
  )
}
