import { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function WelcomeScreen() {
  const { state, createWorkspace, switchWorkspace, flash } = useAppContext();
  const { workspaces } = state;

  // Auto-increment default name: 新建数据 1, 2, 3...
  const nextIndex = workspaces.length + 1;
  const defaultName = `新建数据 ${nextIndex}`;

  const [name, setName] = useState(defaultName);
  const [creating, setCreating] = useState(false);

  // Switch to existing workspace (password-protected)
  const [showSwitch, setShowSwitch] = useState(false);
  const [switchId, setSwitchId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createWorkspace(name.trim());
    } catch {
      flash('error', '创建失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '40px 24px',
    }}>
      {/* Icon */}
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'linear-gradient(135deg, var(--primary), var(--primary-strong))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 28, fontSize: 28, color: '#fff',
        boxShadow: '0 4px 16px rgba(124,111,247,0.25)',
      }}>
        ✦
      </div>

      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600,
        color: 'var(--text)', margin: '0 0 8px', textAlign: 'center',
      }}>
        欢迎使用舞艺嘉
      </h1>
      <p style={{
        fontSize: 14, color: 'var(--muted)', margin: '0 0 32px', textAlign: 'center',
        lineHeight: 1.6, maxWidth: 280,
      }}>
        每个人可以有自己的数据版本，互不影响。请先创建你的第一个数据版本。
      </p>

      {/* Create new workspace */}
      <div style={{ width: '100%', maxWidth: 320 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>数据版本名称</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：李老师的数据"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            autoFocus
          />
        </label>
        <button
          className="primary full"
          onClick={handleCreate}
          disabled={!name.trim() || creating}
        >
          {creating ? '创建中...' : '创建数据版本'}
        </button>
      </div>

      {/* Switch to existing version */}
      {!showSwitch ? (
        <button
          className="ghost"
          style={{ marginTop: 20, fontSize: 13 }}
          onClick={() => setShowSwitch(true)}
        >
          切换到已有数据版本
        </button>
      ) : (
        <div style={{ width: '100%', maxWidth: 320, marginTop: 20 }}>
          <div style={{
            borderTop: '1px solid rgba(0,0,0,0.06)',
            paddingTop: 20, marginBottom: 12,
          }}>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px', textAlign: 'center' }}>
              切换到已有版本需要管理员密码
            </p>
            <div className="form-grid" style={{ gap: 8 }}>
              <select value={switchId} onChange={(e) => { setSwitchId(e.target.value); setPasswordError(false); }}>
                <option value="">选择数据版本</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(false); }}
                placeholder="管理员密码"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && switchId) {
                    if (password === '135791') {
                      switchWorkspace(switchId);
                    } else {
                      setPasswordError(true);
                    }
                  }
                }}
              />
            </div>
            {passwordError ? (
              <p style={{ color: 'var(--danger)', fontSize: 12, margin: '8px 0 0', textAlign: 'center' }}>密码错误</p>
            ) : null}
            <div className="actions-row" style={{ marginTop: 12, justifyContent: 'center' }}>
              <button className="ghost" style={{ fontSize: 12 }} onClick={() => { setShowSwitch(false); setPassword(''); setPasswordError(false); }}>
                取消
              </button>
              <button className="primary" style={{ fontSize: 13 }} disabled={!switchId || !password} onClick={() => {
                if (password === '135791') {
                  switchWorkspace(switchId);
                } else {
                  setPasswordError(true);
                }
              }}>
                验证并切换
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
