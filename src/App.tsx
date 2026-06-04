import { AppProvider, useAppContext } from './context/AppContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function PageRouter() {
  const { state } = useAppContext();

  switch (state.tab) {
    case 'dashboard': return <Dashboard />;
    case 'classes': return <Classes />;
    case 'reports': return <Reports />;
    case 'settings': return <Settings />;
    default: return <Dashboard />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <Layout>
        <ErrorBoundary>
          <PageRouter />
        </ErrorBoundary>
      </Layout>
    </AppProvider>
  );
}
