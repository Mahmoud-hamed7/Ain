import  { Component, type ErrorInfo, type ReactNode } from 'react';
import Button from './Button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 text-center">
          <h1 className="text-3xl font-bold mb-4 text-red-500">Oops! Something went wrong.</h1>
          <p className="text-gray-400 mb-8 max-w-md">
            {this.state.error?.message || "An unexpected error occurred. Our team has been notified."}
          </p>
          <div className="flex gap-4">
            <Button onClick={() => window.location.reload()} variant="primary">Try Again</Button>
            <Button onClick={this.handleReset} variant="secondary">Go Home</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}