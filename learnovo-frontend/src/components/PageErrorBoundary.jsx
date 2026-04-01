import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { QueryClient } from '@tanstack/react-query'

// Shared reference — set by the provider wrapper so the boundary can clear cache on retry
let _queryClient = null
export function setPageErrorBoundaryQueryClient(qc) { _queryClient = qc }

class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, retryKey: 0 }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[PageErrorBoundary] Error in ${this.props.name || 'page'}:`, error, errorInfo)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.name !== this.props.name && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  handleRetry = () => {
    // Clear all query caches so stale/error data doesn't cause the same crash
    if (_queryClient) {
      _queryClient.removeQueries()
    }
    // Increment retryKey to force React to unmount and remount children,
    // which gives React Query a clean slate to refetch
    this.setState(prev => ({
      hasError: false,
      error: null,
      retryKey: prev.retryKey + 1
    }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] px-4 animate-fade-in">
          <div className="max-w-sm w-full text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 ring-1 ring-red-100 dark:ring-red-500/20 flex items-center justify-center mb-5">
              <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              This section encountered an error
            </h3>
            <p className="text-sm text-gray-500 dark:text-[#8E8E93] mb-5">
              Something went wrong loading this page. The rest of the app is unaffected.
            </p>
            <button
              onClick={this.handleRetry}
              className="btn btn-primary gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-5 text-left">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs bg-gray-50 dark:bg-[#2C2C2E] p-3 rounded-xl overflow-auto max-h-32 text-gray-700 dark:text-[#8E8E93] ring-1 ring-gray-100 dark:ring-[#38383A]">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>
  }
}

export default PageErrorBoundary
