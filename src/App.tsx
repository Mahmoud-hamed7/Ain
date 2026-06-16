import QueryProvider from './providers/QueryProvider';
import AppRouter from './router';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/Toast/ToastContainer';

export default function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <AppRouter />
        {/* Global toast portal — rendered above everything */}
        <ToastContainer />
      </QueryProvider>
    </ErrorBoundary>
  );
}