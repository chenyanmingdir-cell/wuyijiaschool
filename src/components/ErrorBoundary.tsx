import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>页面加载出错</h2>
          <p style={{ color: '#666', marginBottom: 16, fontSize: 14 }}>{this.state.error.message}</p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ borderRadius: 20, padding: '10px 24px', border: 'none', background: '#7c3aed', color: '#fff', fontSize: 15 }}
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
