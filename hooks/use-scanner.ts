import { useState, useEffect, useCallback } from 'react'

export interface ScanResult {
  success: boolean
  status: 'valid' | 'invalid' | 'used'
  message: string
  order: {
    id: string
    event_title?: string
    total_amount?: number
    user_id?: string
    created_at?: string
    status: string
    scanned_at?: string
    user_name?: string
    user_email?: string
  } | null
  vip_guest: {
    id: string
    name: string
    email: string
    status: string
    created_at: string
    notes?: string
    event_title?: string
  } | null
}

export interface ScanHistoryItem {
  id: string
  scanned_at: string
  created_at: string
  status: 'valid' | 'invalid' | 'used'
  scanner_name: string
  scanner_email?: string
  order: {
    id: string
    order_number?: string
    qr_code?: string
    status: string
    total_amount?: number
    created_at: string
    event_title?: string
    event_date?: string
    event_time?: string
    event_location?: string
    user_name?: string
    user_email?: string
  } | null
  vip_guest: {
    id: string
    name: string
    email: string
    status: string
    created_at: string
    notes?: string
    event_title?: string
    event_date?: string
    event_time?: string
    event_location?: string
  } | null
}

export function useScanner() {
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validate a ticket by QR code
  const validateTicket = async (qrCode: string, scannerId: string, eventId?: string) => {
    try {
      setLoading(true)
      setError(null)

      console.log("🚀 Sending validation request:", { qrCode, scannerId, eventId })

      const response = await fetch('/api/scanner/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qr_code: qrCode,
          scanner_id: scannerId,
          event_id: eventId
        })
      })

      console.log("📡 Response status:", response.status)
      console.log("📡 Response headers:", Object.fromEntries(response.headers.entries()))

      // Check if response is HTML (error page)
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const htmlText = await response.text()
        console.error("❌ Received HTML instead of JSON:", htmlText.substring(0, 200))
        throw new Error(`API returned HTML instead of JSON. Status: ${response.status}`)
      }

      const data = await response.json()
      console.log("📦 Response data:", data)

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Failed to validate ticket`)
      }

      setScanResult(data)

      // Refresh scan history after validation (show all scans, not filtered by scanner)
      await fetchScanHistory(eventId)

      return data

    } catch (err: any) {
      console.error('💥 Ticket validation error:', err)
      setError(err.message || 'Failed to validate ticket')
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Fetch scan history
  const fetchScanHistory = useCallback(async (eventId?: string, limit: number = 50) => {
    try {
      setHistoryLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (eventId) params.append('eventId', eventId)
      params.append('limit', limit.toString())

      console.log("📋 Fetching scan history:", { eventId, limit })

      const response = await fetch(`/api/scanner/history?${params}`)

      console.log("📡 History response status:", response.status)

      // Check if response is HTML (error page)
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const htmlText = await response.text()
        console.error("❌ History API returned HTML:", htmlText.substring(0, 200))
        throw new Error(`History API returned HTML instead of JSON. Status: ${response.status}`)
      }

      const data = await response.json()
      console.log("📊 History data:", data)

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Failed to fetch scan history`)
      }

      setScanHistory(data.scans || [])
      return data.scans || []

    } catch (err: any) {
      console.error('💥 Scan history fetch error:', err)
      setError(err.message || 'Failed to fetch scan history')
      setScanHistory([]) // Set empty array on error
      throw err
    } finally {
      setHistoryLoading(false)
    }
  }, []) // Empty dependency array since it doesn't depend on any props or state

  // Clear scan result
  const clearScanResult = () => {
    setScanResult(null)
    setError(null)
  }

  // Start scanning mode
  const startScanning = () => {
    setIsScanning(true)
    clearScanResult()
  }

  // Stop scanning mode
  const stopScanning = () => {
    setIsScanning(false)
  }

  return {
    // State
    isScanning,
    scanResult,
    scanHistory,
    loading,
    historyLoading,
    error,

    // Actions
    validateTicket,
    fetchScanHistory,
    clearScanResult,
    startScanning,
    stopScanning
  }
}

// Hook for managing scanner user session
export function useScannerAuth() {
  const [scannerId, setScannerId] = useState<string | null>(null)
  const [scannerName, setScannerName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Load scanner info from localStorage
    const savedScannerId = localStorage.getItem('scanner_id')
    const savedScannerName = localStorage.getItem('scanner_name')

    console.log("🔍 Scanner auth check:", { savedScannerId, savedScannerName })

    // Validate that the saved scanner ID is a valid UUID
    const isValidUUID = (str: string) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      return uuidRegex.test(str)
    }

    if (savedScannerId && isValidUUID(savedScannerId)) {
      console.log("✅ Valid scanner ID found:", savedScannerId)
      setScannerId(savedScannerId)
      if (savedScannerName) {
        setScannerName(savedScannerName)
      }
    } else if (savedScannerId) {
      // Clear invalid scanner ID (from old system)
      console.log("❌ Invalid scanner ID found, clearing:", savedScannerId)
      localStorage.removeItem('scanner_id')
      localStorage.removeItem('scanner_name')
      setScannerId(null)
      setScannerName(null)
    }
  }, [])

  const login = async (name: string) => {
    try {
      setIsLoading(true)

      console.log("🔐 Authenticating scanner:", name)

      const response = await fetch('/api/scanner/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          action: 'login'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 403) {
          // Access denied - user exists but wrong role
          throw new Error(data.message || data.error || 'Access denied')
        } else if (response.status === 404) {
          // User not found
          throw new Error(data.message || data.error || 'User not found')
        } else {
          throw new Error(data.error || 'Failed to authenticate scanner')
        }
      }

      if (data.success && data.scanner) {
        setScannerId(data.scanner.id)
        setScannerName(data.scanner.name)
        localStorage.setItem('scanner_id', data.scanner.id)
        localStorage.setItem('scanner_name', data.scanner.name)

        console.log("✅ Scanner authenticated:", data.scanner.id)
        return data.scanner
      } else {
        throw new Error(data.message || 'Invalid response from scanner auth')
      }
    } catch (error) {
      console.error('💥 Scanner auth error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setScannerId(null)
    setScannerName(null)
    localStorage.removeItem('scanner_id')
    localStorage.removeItem('scanner_name')
  }

  return {
    scannerId,
    scannerName,
    isAuthenticated: !!scannerId,
    isLoading,
    login,
    logout
  }
}
