import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-bg px-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-text">Something went wrong.</h1>
            <p className="mt-2 text-sm text-text-muted">Please reload the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
