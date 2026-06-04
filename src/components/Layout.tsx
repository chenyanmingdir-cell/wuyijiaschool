import type { ReactNode } from 'react';
import { useAppContext, type TabKey } from '../context/AppContext';
import InstallPrompt from './InstallPrompt';

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'dashboard', label: '工作台', icon: '☰' },
  { key: 'classes', label: '班级', icon: '◫' },
  { key: 'reports', label: '报表', icon: '▦' },
  { key: 'settings', label: '设置', icon: '⌂' },
];

function pageTitle(tab: TabKey) {
  if (tab === 'dashboard') return '舞艺嘉学校';
  if (tab === 'classes') return '班级';
  if (tab === 'reports') return '报表';
  return '设置';
}

function pageSubtitle(_tab: TabKey) {
  return '';
}

export default function Layout({ children }: { children: ReactNode }) {
  const { state, dispatch } = useAppContext();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-copy" style={{ textAlign: 'center' }}>
          <h1>{pageTitle(state.tab)}</h1>
          <p>{pageSubtitle(state.tab)}</p>
        </div>
        <div className="topbar-spacer" />
      </header>

      {state.flash ? (
        <div className={`flash ${state.flash.kind}`}>{state.flash.text}</div>
      ) : null}

      <main className="content">{children}</main>

      <nav className="tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            className={item.key === state.tab ? 'tab active' : 'tab'}
            onClick={() => dispatch({ type: 'SET_TAB', tab: item.key })}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <InstallPrompt />
    </div>
  );
}
