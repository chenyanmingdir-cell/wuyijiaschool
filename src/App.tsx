import { useEffect, useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Splash from './components/Splash';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function PageRouter() {
  const { state } = useAppContext();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Enforce minimum 2s splash display
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Show splash until both data is ready AND min time elapsed
  if (!state.ready || !minTimeElapsed) {
    return <Splash />;
  }

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
