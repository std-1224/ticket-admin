"use client"

import { useState, useEffect, useRef } from "react"
import { CheckCircle, QrCode, Loader2, User, AlertCircle, Camera, CameraOff, Upload, Calendar, CreditCard, Hash } from "lucide-react"
import QrReader from "react-qr-reader-es6"
import QrScanner from "qr-scanner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useScanner, useScannerAuth } from "@/hooks/use-scanner"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"

// Helper function for status badge variants
const getStatusBadgeVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case "valid":
      return "default"
    case "invalid":
      return "destructive"
    case "used":
      return "secondary"
    default:
      return "outline"
  }
}

export const QRScannerPage = () => {
  const {
    scanResult,
    scanHistory,
    loading,
    historyLoading,
    validateTicket,
    fetchScanHistory,
    clearScanResult
  } = useScanner()

  const [qrInput, setQrInput] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [scannerError, setScannerError] = useState("")
  const [isProcessingImage, setIsProcessingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const auth = useAuth();
  const scannerId = auth.user?.id;
  // const isScanner = auth.user?.user_metadata?.role === "scanner";
  const { toast } = useToast()

  // Handle QR code scanning from manual input (updated to work with camera result)
  const handleScanQR = async (codeToProcess?: string) => {
    const code = codeToProcess || qrInput

    if (!code.trim()) {
      toast({
        title: "Error",
        description: "Please enter a QR code",
        variant: "destructive"
      })
      return
    }
    // if (!isScanner) {
    //   toast({
    //     title: "Access Denied",
    //     description: "You do not have permission to scan tickets",
    //     variant: "destructive"
    //   })
    //   return
    // }
    try {
      const result = await validateTicket(code.trim(), scannerId || "")

      if (result.success) {
        toast({
          title: "✅ Entry Granted",
          description: "Valid Ticket",
          variant: "default"
        })
      } else {
        toast({
          title: "❌ Entry Denied",
          description: result.message,
          variant: "destructive"
        })
      }

      if (!codeToProcess) {
        setQrInput("") // Clear input after manual scan
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to validate ticket",
        variant: "destructive"
      })
    }
  }

  // Fetch scan history when component loads
  useEffect(() => {
    if (scannerId) {
      fetchScanHistory()
    }
  }, [scannerId]) // Remove fetchScanHistory from dependencies to prevent infinite loop

  // Handle QR code scanning from camera (copied from merch-admin)
  const handleQRScan = (result: any) => {
    if (result) {
      setQrInput(result)
      handleScanQR(result)
      setIsScanning(false)
    }
  }

  // Handle camera scan errors (copied from merch-admin)
  const handleScanError = (error: any) => {

    // Provide more specific error messages based on the error type
    let errorMessage = "Error scanning QR code."

    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorMessage = "Camera access denied. Please allow camera access in your browser."
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      errorMessage = "No camera found. Verify that your device has an available camera."
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      errorMessage = "Camera is being used by another application. Close other apps using the camera."
    } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
      errorMessage = "Camera doesn't meet requirements. Try with a different camera."
    } else if (error.name === 'NotSupportedError') {
      errorMessage = "Your browser doesn't support camera access. Try Chrome, Firefox or Safari."
    } else if (error.message && error.message.includes('getUserMedia')) {
      errorMessage = "Error accessing camera. Check browser permissions."
    }

    setScannerError(errorMessage)
  }

  // Check camera permission (Safari compatible)
  const checkCameraPermission = async () => {
    try {
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices) {
        return { hasPermission: false, error: "Camera access not supported in this browser. Try Chrome or Firefox." }
      }

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices.getUserMedia) {
        return { hasPermission: false, error: "Camera access not supported. Please use a modern browser." }
      }

      // For Safari, we need to be more careful with enumerateDevices
      try {
        if (navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices()
          devices.filter(device => device.kind === 'videoinput')
        }
      } catch (enumError: any) {
        // Continue anyway, as some browsers restrict this before permission is granted
      }

      // Try to get camera access with Safari-friendly constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Prefer back camera on mobile
          width: { min: 320, ideal: 640, max: 1920 },
          height: { min: 240, ideal: 480, max: 1080 }
        }
      })

      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => {
        track.stop()
      })

      return { hasPermission: true, error: null }
    } catch (error: any) {

      // Safari-specific error handling
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return { hasPermission: false, error: "No camera found on this device" }
      } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return { hasPermission: false, error: "Camera access denied. Please allow camera access in Safari settings." }
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        return { hasPermission: false, error: "Camera is being used by another application" }
      } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        return { hasPermission: false, error: "Camera doesn't meet requirements. Try a different camera." }
      } else if (error.name === 'NotSupportedError') {
        return { hasPermission: false, error: "Camera not supported in Safari. Try Chrome or Firefox." }
      } else if (error.name === 'TypeError' && error.message.includes('undefined')) {
        return { hasPermission: false, error: "Camera API not available in this Safari version. Please update Safari or use Chrome." }
      } else {
        return { hasPermission: false, error: `Camera error: ${error.message || 'Unknown error'}` }
      }
    }
  }

  // Get device info (Safari compatible)
  const getDeviceInfo = () => {
    const userAgent = navigator.userAgent
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
    const isDesktop = !isMobile
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent)
    const isIOS = /iPad|iPhone|iPod/.test(userAgent)
    const isChrome = /Chrome/.test(userAgent)
    const isFirefox = /Firefox/.test(userAgent)

    return {
      isMobile,
      isDesktop,
      isSafari,
      isIOS,
      isChrome,
      isFirefox,
      userAgent: userAgent.substring(0, 100) + "...",
      platform: (navigator as any).platform || 'unknown',
      vendor: (navigator as any).vendor || 'unknown'
    }
  }

  // Start camera scanning (Safari compatible)
  const handleStartScanning = async () => {
    // if (!isScanner) {
    //   toast({
    //     title: "Access Denied",
    //     description: "Please login as scanner first",
    //     variant: "destructive"
    //   })
    //   return
    // }
    setScannerError("") // Clear previous errors

    const deviceInfo = getDeviceInfo()

    // Safari-specific warning
    if (deviceInfo.isSafari) {
      toast({
        title: "🍎 Safari detected",
        description: "Please allow camera access when prompted.",
        variant: "default"
      })
    } else {
      toast({
        title: "🔄 Starting camera",
        description: "Please allow camera access when prompted.",
        variant: "default"
      })
    }

    // Check camera permission
    const { hasPermission, error } = await checkCameraPermission()
    if (!hasPermission) {
      let detailedError = error || "Camera access required."

      // Safari-specific error messages
      if (deviceInfo.isSafari && error?.includes("not supported")) {
        detailedError = `Safari camera access limited. Try Chrome or Firefox for better compatibility, or enter QR codes manually.`
      } else if (error?.includes("No camera found")) {
        detailedError = `No camera found on this device. You can enter QR codes manually.`
      } else if (deviceInfo.isSafari && error?.includes("denied")) {
        detailedError = `Camera access denied in Safari. Go to Safari Settings > Privacy & Security > Camera and allow access for this site.`
      }

      setScannerError(detailedError)
      return
    }

    setIsScanning(true)

    if (deviceInfo.isSafari) {
      toast({
        title: "✅ Safari camera started",
        description: "Point towards QR code.",
        variant: "default"
      })
    } else {
      toast({
        title: "✅ Camera started",
        description: "Point towards QR code.",
        variant: "default"
      })
    }

    // Clear success message after 3 seconds
    setTimeout(() => {
      // Message will auto-clear
    }, 3000)
  }

  // Stop camera scanning
  const handleStopScanning = () => {
    setIsScanning(false)
    setScannerError("")
  }

  // Handle QR code image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // if (!isScanner) {
    //   toast({
    //     title: "Access Denied",
    //     description: "You do not have permission to scan tickets",
    //     variant: "destructive"
    //   })
    //   return
    // }
    const file = event.target.files?.[0]
    if (!file) return

    if (!scannerId) {
      toast({
        title: "Error",
        description: "Please login as scanner first",
        variant: "destructive"
      })
      return
    }

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive"
      })
      return
    }

    setIsProcessingImage(true)
    setScannerError("")

    try {
      toast({
        title: "🔍 Scanning",
        description: "Scanning QR code from image...",
        variant: "default"
      })

      // Use QrScanner to read QR code from image
      const result = await QrScanner.scanImage(file)

      // Set the result in the input field and process it
      setQrInput(result)
      await handleScanQR(result)

      toast({
        title: "✅ Success",
        description: "QR code successfully read from image!",
        variant: "default"
      })

    } catch (error: any) {

      let errorMessage = "No QR code found in image"
      if (error.message?.includes("No QR code found")) {
        errorMessage = "No QR code detected in the uploaded image. Please try a clearer image."
      } else if (error.message?.includes("Invalid")) {
        errorMessage = "Invalid image format. Please upload a JPG, PNG, or other image file."
      }

      setScannerError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsProcessingImage(false)
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Handle upload button click
  const handleUploadClick = () => {
    console.log("handleUploadClick")
    // if (!isScanner) {
    //   console.log("not scanner")
    //   toast({
    //     title: "Access Denied",
    //     description: "Please login as scanner first",
    //     variant: "destructive"
    //   })
    //   return
    // }
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-3 sm:space-y-6 pb-20 md:pb-0">
      {/* Scanner Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Scanner:</span>
              <span className="font-medium">{auth.user?.user_metadata?.name || auth.user?.email}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg sm:text-xl">QR Scanner</CardTitle>
            <CardDescription className="text-sm">
              Scan attendee QR codes to validate them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* QR Input */}
            <div className="space-y-2">
              <Label htmlFor="qr-input">QR Code</Label>
              <div className="flex gap-2">
                <Input
                  id="qr-input"
                  placeholder="Scan or enter QR code..."
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScanQR()}
                  className="font-mono"
                />
                <Button
                  onClick={() => handleScanQR()}
                  disabled={loading || !qrInput.trim()}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Upload QR Code Image</Label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  onClick={handleUploadClick}
                  variant="outline"
                  disabled={isProcessingImage}
                  className="w-full"
                >
                  {isProcessingImage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload QR Image
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                📷 Upload a photo containing a QR code (JPG, PNG, etc.)
              </p>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or use camera</span>
              </div>
            </div>

            {/* Camera Controls */}
            <div className="flex gap-2">
              {!isScanning ? (
                <Button
                  onClick={handleStartScanning}
                  variant="outline"
                  className="w-full"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Start Camera
                </Button>
              ) : (
                <Button
                  onClick={handleStopScanning}
                  variant="outline"
                  className="w-full"
                >
                  <CameraOff className="mr-2 h-4 w-4" />
                  Stop Camera
                </Button>
              )}
            </div>

            {/* Safari Compatibility Notice */}
            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                🍎 <strong>Safari Users:</strong> If camera doesn't work, try Chrome or Firefox for better compatibility.
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                📱 <strong>Alternative:</strong> You can always enter QR codes manually in the text field above.
              </p>
            </div>

            {/* Camera View */}
            {isScanning && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="relative bg-black rounded-lg overflow-hidden w-[400px] h-[400px] text-center">
                    <QrReader
                      onScan={handleQRScan}
                      onError={handleScanError}
                      className="w-[400px] h-[400px] object-cover"
                    />
                    <div className="absolute inset-0 border-2 border-dashed border-white/50 m-8 rounded-lg flex items-center justify-center pointer-events-none">
                      <div className="text-white text-center">
                        <QrCode className="h-12 w-12 mx-auto mb-2 opacity-75" />
                        <p className="text-sm opacity-75">Point camera at QR code</p>
                      </div>
                    </div>
                    {/* Scanning animation overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 animate-pulse"></div>
                    </div>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    📱 Position the QR code within the frame to scan automatically
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      💡 <strong>Tips:</strong> Make sure the camera is well lit and the QR code is clean and visible.
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      🌐 <strong>Compatibility:</strong> Works best in Chrome, Firefox and Safari. Make sure to use HTTPS in production.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Scanner Error */}
            {scannerError && (
              <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-800 dark:text-red-200">
                  {scannerError}
                  {scannerError.includes("No camera found") && (
                    <div className="mt-2 text-sm">
                      💡 <strong>Alternative:</strong> You can enter QR codes manually in the field above.
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Status Display */}
            {!isScanning && (
            <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center relative overflow-hidden max-w-xs mx-auto">
              {!scanResult && !loading && (
                <div className="text-center">
                  <QrCode className="h-16 w-16 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Ready to scan</p>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-16 w-16 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Validating...</p>
                </div>
              )}

              {scanResult && !loading && (
                <div className="flex flex-col items-center gap-2 text-center p-4">
                  {scanResult.success ? (
                    <CheckCircle className="h-16 w-16 text-green-400" />
                  ) : (
                    <AlertCircle className="h-16 w-16 text-red-400" />
                  )}
                  <p className="text-sm font-medium">
                    {scanResult.success ? "Entry Granted" : "Entry Denied"}
                  </p>
                  <p className="text-xs text-muted-foreground">{scanResult.message}</p>
                </div>
              )}
            </div>
              
            )}

            {scanResult && (
              <Button
                onClick={clearScanResult}
                variant="outline"
                className="w-full"
              >
                Clear Result
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="h-max">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg sm:text-xl">Scan Result</CardTitle>
            <CardDescription className="text-sm">Details of the last scanned ticket.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center text-center h-full min-h-[150px] sm:min-h-[300px]">
            {!scanResult && !loading && (
              <div className="space-y-3 sm:space-y-4 text-muted-foreground">
                <QrCode className="h-12 w-12 sm:h-16 sm:w-16 mx-auto opacity-50" />
                <p className="text-sm">Scan a ticket to see results here</p>
              </div>
            )}

            {loading && (
              <div className="space-y-3 sm:space-y-4">
                <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground text-sm">Validating ticket...</p>
              </div>
            )}

            {scanResult && !loading && (
              <div className="space-y-4 w-full">
                {/* Status Header */}
                <div className="text-center space-y-3">
                  {scanResult.success ? (
                    <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-green-400 mx-auto" />
                  ) : (
                    <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-red-400 mx-auto" />
                  )}

                  <div>
                    <h3 className="text-lg sm:text-2xl font-bold">
                      {scanResult.success ? "Access Granted" : "Access Denied"}
                    </h3>
                    <p className="text-muted-foreground text-sm">{scanResult.message}</p>
                    <Badge variant={scanResult.success ? "default" : "destructive"} className="mt-2">
                      {scanResult.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Detailed Order or VIP Guest Information */}
                {(scanResult.order || scanResult.vip_guest) && (
                  <div className="space-y-4 text-left">
                    {/* Event Information */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {scanResult.order ? 'Order Information' : 'VIP Guest Information'}
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Event:</span>
                          <span className="font-medium text-right">
                            {scanResult.order?.event_title || scanResult.vip_guest?.event_title || 'Unknown Event'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <span className="font-medium capitalize">
                            {scanResult.order?.status || scanResult.vip_guest?.status}
                          </span>
                        </div>
                        {scanResult.order?.total_amount && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Amount:</span>
                            <span className="font-medium">${scanResult.order.total_amount}</span>
                          </div>
                        )}
                        {scanResult.vip_guest?.notes && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Notes:</span>
                            <span className="font-medium text-right">{scanResult.vip_guest.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* User Information */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {scanResult.order ? 'User Information' : 'Guest Information'}
                      </h4>
                      <div className="space-y-2 text-sm">
                        {(scanResult.order?.user_name || scanResult.vip_guest?.name) && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Name:</span>
                            <span className="font-medium">
                              {scanResult.order?.user_name || scanResult.vip_guest?.name}
                            </span>
                          </div>
                        )}
                        {(scanResult.order?.user_email || scanResult.vip_guest?.email) && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Email:</span>
                            <span className="font-medium">
                              {scanResult.order?.user_email || scanResult.vip_guest?.email}
                            </span>
                          </div>
                        )}
                        {scanResult.order?.user_id && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">User ID:</span>
                            <span className="font-mono text-xs">{scanResult.order.user_id.slice(0, 8)}...</span>
                          </div>
                        )}
                        {scanResult.vip_guest?.id && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Guest ID:</span>
                            <span className="font-mono text-xs">{scanResult.vip_guest.id.slice(0, 8)}...</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Purchase/Invitation Information */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        {scanResult.order ? 'Purchase Details' : 'Invitation Details'}
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {scanResult.order ? 'Order ID:' : 'Guest ID:'}
                          </span>
                          <span className="font-mono text-xs">
                            {(scanResult.order?.id || scanResult.vip_guest?.id)?.slice(0, 8)}...
                          </span>
                        </div>
                        {(scanResult.order?.created_at || scanResult.vip_guest?.created_at) && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {scanResult.order ? 'Purchased:' : 'Invited:'}
                            </span>
                            <span className="font-medium">
                              {new Date((scanResult.order?.created_at || scanResult.vip_guest?.created_at)!).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {(scanResult.order?.created_at || scanResult.vip_guest?.created_at) && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {scanResult.order ? 'Purchase Time:' : 'Invitation Time:'}
                            </span>
                            <span className="font-medium">
                              {new Date((scanResult.order?.created_at || scanResult.vip_guest?.created_at)!).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scan Information */}
                    {(scanResult.order?.scanned_at) && (
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          Scan History
                        </h4>
                        <div className="space-y-2 text-sm">
                          {(scanResult.order as any).scan_count && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Scans:</span>
                              <span className="font-medium">{(scanResult.order as any).scan_count}</span>
                            </div>
                          )}
                          {scanResult.order?.scanned_at && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Last Scan:</span>
                              <span className="font-medium">
                                {new Date(scanResult.order.scanned_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Status */}
                {scanResult.success && (
                  <div className="mt-4 p-4 bg-green-400/10 rounded-lg border border-green-400/20 text-center">
                    <p className="text-green-400 text-sm font-medium">
                      ✅ {scanResult.order ? 'Allow entry to event' : 'VIP guest access granted'}
                    </p>
                    <Button
                      className="mt-3 bg-green-600 hover:bg-green-700 text-white"
                      onClick={async () => {
                        try {
                          // Update scan status to 'used' when entry is confirmed
                          const response = await fetch('/api/scanner/confirm-entry', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              order_id: scanResult.order?.id,
                              vip_guest_id: scanResult.vip_guest?.id,
                              scanner_id: scannerId
                            })
                          })

                          if (response.ok) {
                            // Refresh scan history to show all scans
                            await fetchScanHistory()
                            toast({
                              title: "✅ Success",
                              description: "Entry confirmed and recorded",
                              variant: "default"
                            })
                          }

                        } catch (error) {
                          // Handle error silently
                        }

                        // Clear the result and prepare for next scan
                        clearScanResult()
                        setQrInput("")
                      }}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Confirm Entry - Scan Next
                    </Button>
                  </div>
                )}

                {!scanResult.success && (
                  <div className="mt-4 p-4 bg-red-400/10 rounded-lg border border-red-400/20 text-center">
                    <p className="text-red-400 text-sm font-medium">❌ {scanResult.message}</p>
                    <Button
                      variant="destructive"
                      className="mt-3"
                      onClick={() => {
                        clearScanResult()
                        setQrInput("")
                      }}
                    >
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Entry Denied - Try Again
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scan History */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg sm:text-xl">Scan History</CardTitle>
          <CardDescription className="text-sm">Record of the latest scanned order_items.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-12 w-12 mx-auto mb-2 opacity-50 animate-spin" />
              <p className="text-sm">Loading scan history...</p>
            </div>
          ) : scanHistory && scanHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <QrCode className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No scans yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px] text-xs sm:text-sm">Event</TableHead>
                    <TableHead className="min-w-[100px] text-xs sm:text-sm">Order/Guest</TableHead>
                    <TableHead className="min-w-[80px] text-xs sm:text-sm">Type</TableHead>
                    <TableHead className="min-w-[80px] text-xs sm:text-sm">Status</TableHead>
                    <TableHead className="min-w-[80px] text-xs sm:text-sm">Time</TableHead>
                    <TableHead className="text-right min-w-[100px] text-xs sm:text-sm">Scanner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scanHistory && scanHistory.map((scan) => (
                    <TableRow key={scan.id}>
                      <TableCell className="font-medium text-xs sm:text-sm">
                        {scan.order?.event_title || scan.vip_guest?.event_title || 'Unknown Event'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs sm:text-sm">
                        {scan.order ? 
                          (scan.order.order_number || scan.order.id?.slice(0, 8) || 'Unknown Order') :
                          (scan.vip_guest?.name || scan.vip_guest?.id?.slice(0, 8) || 'Unknown Guest')
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {scan.order ? 'ORDER' : 'VIP'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(scan.status)} className="text-xs">
                          {scan.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {new Date(scan.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">
                        {scan.scanner_name}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
