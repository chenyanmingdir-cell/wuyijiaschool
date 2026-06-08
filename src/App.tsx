import { useEffect, useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Splash from './components/Splash';
import WelcomeScreen from './components/WelcomeScreen';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function AppContent() {
  const { state } = useAppContext();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Splash screen
  if (!state.ready || !minTimeElapsed) {
    return <Splash />;
  }

  // New device: no workspaces yet — show onboarding
  if (state.workspaces.length === 0) {
    return <WelcomeScreen />;
  }

  // Normal app
  return (
    <Layout>
      <ErrorBoundary>
        <PageRouter />
      </ErrorBoundary>
    </Layout>
  );
}

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
      <AppContent />
    </AppProvider>
  );
}
