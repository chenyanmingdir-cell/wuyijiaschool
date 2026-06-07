import type { ReactNode } from 'react';
import { useAppContext, type TabKey } from '../context/AppContext';
import { StudentCalendarScreen } from '../pages/Classes';
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
  const { state, setTab, closeStudentCalendar } = useAppContext();

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
            onClick={() => setTab(item.key)}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <InstallPrompt />

      {/* Global Student Calendar Overlay */}
      {state.activeStudentCalendarId ? (
        <div className="sheet-backdrop" onClick={closeStudentCalendar}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '100vh', borderRadius: 0, maxWidth: '100%', padding: '16px calc(16px + var(--safe-right)) calc(16px + var(--safe-bottom)) calc(16px + var(--safe-left))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <button className="ghost" onClick={closeStudentCalendar}>← 关闭</button>
              <strong style={{ fontSize: 17 }}>学员日历</strong>
              <div style={{ width: 48 }} />
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 80px)' }}>
              <StudentCalendarScreen studentId={state.activeStudentCalendarId} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
