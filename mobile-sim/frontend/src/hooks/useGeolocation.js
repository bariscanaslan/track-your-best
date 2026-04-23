import { useState, useEffect, useRef } from 'react'

/**
 * Wraps the browser Geolocation watchPosition API.
 * Returns { position, error, isWatching, start, stop }.
 *
 * Note: Mobile browsers throttle GPS updates when the tab is backgrounded.
 * This is expected and acceptable for a web-based simulator.
 */
export function useGeolocation() {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [isWatching, setIsWatching] = useState(false)
  const watchId = useRef(null)

  const start = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }
    setError(null)

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setError(null)
      },
      (err) => {
        const messages = {
          [err.PERMISSION_DENIED]: 'Location permission denied. Please enable it in browser settings.',
          [err.POSITION_UNAVAILABLE]: 'GPS signal unavailable. Move to an open area.',
          [err.TIMEOUT]: 'Location request timed out. Retrying...',
        }
        setError(messages[err.code] || 'Unknown location error.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )

    setIsWatching(true)
  }

  const stop = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    setIsWatching(false)
    setPosition(null)
  }

  // Clean up on unmount
  useEffect(() => () => stop(), [])

  return { position, error, isWatching, start, stop }
}
