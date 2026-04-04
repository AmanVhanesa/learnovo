import React from 'react'

// Shared QueryClient reference — set via setErrorBoundaryQueryClient() so we can
// clear stale/errored query cache before retrying, preventing the same crash loop.
let _queryClient = null
export function setErrorBoundaryQueryClient(qc) { _queryClient = qc }

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, retryKey: 0 }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
  }

  handleRetry = () => {
    // Clear all React Query caches so stale error data doesn't cause the same crash
    if (_queryClient) {
      _queryClient.removeQueries()
    }
    // Increment retryKey to force unmount+remount of the entire child tree
    this.setState(prev => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryKey: prev.retryKey + 1
    }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#000000] flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white dark:bg-[#1C1C1E] rounded-lg shadow-lg p-6 sm:p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Something went wrong
              </h2>
              <p className="text-gray-600 dark:text-[#8E8E93] mb-6">
                We're sorry for the inconvenience. The page encountered an unexpected error.
              </p>
              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.href = '/app/dashboard'}
                  className="w-full bg-gray-200 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-[#38383A] transition-colors"
                >
                  Go to Dashboard
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-gray-200 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-[#38383A] transition-colors"
                >
                  Reload Page
                </button>
              </div>
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white">
                    Error Details (Dev Only)
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 dark:bg-[#2C2C2E] p-4 rounded overflow-auto max-h-48 text-gray-900 dark:text-white">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )
    }

    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>
  }
}

export default ErrorBoundary
