// Camera permission and device detection utilities

export interface CameraPermissionResult {
  hasPermission: boolean
  error?: string
}

export interface DeviceInfo {
  platform: string
  userAgent: string
  isMobile: boolean
  isIOS: boolean
  isAndroid: boolean
}

/**
 * Check if camera permission is available
 */
export async function checkCameraPermission(): Promise<CameraPermissionResult> {
  try {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        hasPermission: false,
        error: "Camera access not supported in this browser"
      }
    }

    // Try to get camera permission
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment' // Prefer back camera
      } 
    })

    // If successful, stop the stream and return success
    stream.getTracks().forEach(track => track.stop())
    
    return {
      hasPermission: true
    }

  } catch (error: any) {
    console.error('Camera permission error:', error)
    
    let errorMessage = "Camera access denied"
    
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      errorMessage = "No camera found on this device"
    } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorMessage = "Camera permission denied. Please allow camera access and try again."
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      errorMessage = "Camera is already in use by another application"
    } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
      errorMessage = "Camera constraints not supported"
    } else if (error.name === 'NotSupportedError') {
      errorMessage = "Camera not supported in this browser"
    } else if (error.name === 'TypeError') {
      errorMessage = "Camera access not supported"
    }

    return {
      hasPermission: false,
      error: errorMessage
    }
  }
}

/**
 * Get device information
 */
export function getDeviceInfo(): DeviceInfo {
  const userAgent = navigator.userAgent || ""
  const platform = navigator.platform || ""
  
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
  const isAndroid = /Android/.test(userAgent)

  return {
    platform,
    userAgent,
    isMobile,
    isIOS,
    isAndroid
  }
}

/**
 * Get camera constraints based on device
 */
export function getCameraConstraints() {
  const deviceInfo = getDeviceInfo()
  
  // Base constraints
  const constraints: MediaStreamConstraints = {
    video: {
      facingMode: 'environment', // Prefer back camera
      width: { ideal: 640 },
      height: { ideal: 480 }
    }
  }

  // Adjust for mobile devices
  if (deviceInfo.isMobile) {
    constraints.video = {
      ...constraints.video,
      width: { ideal: 320 },
      height: { ideal: 240 }
    }
  }

  return constraints
}

/**
 * Request camera permission with user-friendly messaging
 */
export async function requestCameraPermission(): Promise<CameraPermissionResult> {
  const deviceInfo = getDeviceInfo()
  
  try {
    const constraints = getCameraConstraints()
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    
    // Stop the stream immediately
    stream.getTracks().forEach(track => track.stop())
    
    return { hasPermission: true }
    
  } catch (error: any) {
    console.error('Camera permission request failed:', error)
    
    let errorMessage = `Camera access failed on ${deviceInfo.platform}`
    
    if (error.name === 'NotFoundError') {
      errorMessage = `No camera found on this ${deviceInfo.isMobile ? 'mobile device' : 'device'}`
    } else if (error.name === 'NotAllowedError') {
      errorMessage = `Camera permission denied. ${deviceInfo.isMobile ? 'Check your browser settings.' : 'Please allow camera access.'}`
    }
    
    return {
      hasPermission: false,
      error: errorMessage
    }
  }
}
