import { SharedLayout } from "@/components/shared-layout"
import { QRScannerPage } from "@/components/pages/qr-scanner-page"

export default function EscanerPage() {
  return (
    <SharedLayout>
      <QRScannerPage />
    </SharedLayout>
  )
}
