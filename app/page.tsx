export default function Home() {
  // This page will be handled by AuthGuard
  // - If user is not authenticated: redirect to /auth
  // - If user is authenticated: redirect to /resumen
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
    </div>
  )
}
