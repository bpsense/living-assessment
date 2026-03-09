import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary-500">404</h1>
        <p className="mt-2 text-text-muted">Page not found</p>
        <Link to="/" className="mt-4 inline-block text-primary-500 underline">
          Go home
        </Link>
      </div>
    </div>
  )
}
