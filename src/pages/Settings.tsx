import { useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import Empty from '../components/Empty';
import { formatDate } from '../utils';

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export default function Settings() {
  const { state, flash, createCourse, updateCourse, deleteCourse, createWorkspace, switchWorkspace, renameWorkspace, deleteWorkspace, exportBackup, importBackup } = useAppContext();
  const { data, workspaceId, workspaceName, workspaces } = state;

  // Course editing
  const [editing, setEditing] = useState(false);
  const [courseName, setCourseName] = useState('');

  // Workspace
  const [showNewWs, setShowNewWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');

  // Delete confirmation
  const [deleteTargetId, setDeleteTargetId] = useState('');

  // Switch password verification
  const [switchTargetId, setSwitchTargetId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Rename password verification
  const [renameTargetId, setRenameTargetId] = useState('');
  const [renamePassword, setRenamePassword] = useState('');
  const [renameNewName, setRenameNewName] = useState('');
  const [renamePasswordError, setRenamePasswordError] = useState(false);

  const importRef = useRef<HTMLInputElement | null>(null);

  const handleImport = async (file: File | null) => {
    if (!file) return;
    try {
      await importBackup(file);
    } catch (e: any) {
      flash('error', e.message || '导入失败');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  return (
    <section className="grid-2">
      {/* Workspace Management */}
      <article className="panel" style={{ gridColumn: '1 / -1' }}>
        <div className="panel-head">
          <div>
            <h2>数据版本</h2>
            <p className="muted">每个人可以有自己的数据版本，互不影响。切换后自动保存当前数据。</p>
          </div>
        </div>

        {/* Current workspace + list */}
        <div className="cards">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className={`mini-card${ws.id === workspaceId ? ' active' : ''}`}
              style={ws.id === workspaceId ? { borderColor: 'var(--primary)', background: 'var(--panel-bg)' } : {}}
            >
              <div className="mini-card-title">
                <strong>
                  {ws.name}
                  {ws.id === workspaceId ? <span style={{ fontSize: 11, color: 'var(--primary)', marginLeft: 8 }}>当前使用</span> : null}
                </strong>
              </div>
              <div className="row" style={{ marginTop: 4 }}>
                <span className="muted" style={{ fontSize: 12 }}>创建于 {formatDate(ws.createdAt)}</span>
              </div>
              <div className="row" style={{ marginTop: 4 }}>
                <span style={{ fontSize: 12 }}>
                  班级 {ws.data.classes.length} · 学员 {ws.data.students.length}
                </span>
              </div>
              <div className="actions-row" style={{ marginTop: 8 }}>
                {ws.id !== workspaceId ? (
                  <button className="primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => { setSwitchTargetId(ws.id); setAdminPassword(''); setPasswordError(false); }}>
                    切换到此版本
                  </button>
                ) : null}
                {ws.id === workspaceId ? (
                  <button className="ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => { setRenameTargetId(ws.id); setRenameNewName(ws.name); setRenamePassword(''); setRenamePasswordError(false); }}>
                    重命名
                  </button>
                ) : null}
                {ws.id === workspaceId && workspaces.length > 1 ? (
                  <button className="ghost danger" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setDeleteTargetId(ws.id)}>
                    删除
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* New workspace */}
        {showNewWs ? (
          <div className="form-grid" style={{ marginTop: 12 }}>
            <label>
              <span>新版本名称</span>
              <input
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                placeholder="例如：李老师的数据"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newWsName.trim()) {
                    createWorkspace(newWsName).then(() => {
                      setNewWsName('');
                      setShowNewWs(false);
                    });
                  }
                }}
              />
            </label>
            <div className="actions-row">
              <button className="primary" disabled={!newWsName.trim()} onClick={async () => {
                await createWorkspace(newWsName);
                setNewWsName('');
                setShowNewWs(false);
              }}>创建</button>
              <button className="ghost" onClick={() => { setShowNewWs(false); setNewWsName(''); }}>取消</button>
            </div>
          </div>
        ) : (
          <div className="actions-row" style={{ marginTop: 12 }}>
            <button className="ghost" onClick={() => setShowNewWs(true)}>+ 新建数据版本</button>
          </div>
        )}
      </article>

      {/* Courses */}
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>课程设置</h2>
          </div>
          {!editing ? (
            <button className="ghost" style={{ fontSize: 13, padding: '6px 12px' }} onClick={() => setEditing(true)}>编辑</button>
          ) : (
            <button className="ghost" style={{ fontSize: 12 }} onClick={() => setEditing(false)}>收起</button>
          )}
        </div>

        <div className="cards">
          {data.courses.length === 0 ? <Empty text="当前还没有课程。" /> : null}
          {data.courses.map((course) => {
            const boundClasses = data.classes.filter((c) => c.courseId === course.id);
            const [renaming, setRenaming] = useState(false);
            const [newName, setNewName] = useState(course.name);
            const canDelete = boundClasses.length === 0 &&
              data.courseCards.filter((cc) => cc.courseId === course.id).length === 0;

            return (
            <div className="mini-card" key={course.id}>
              {!renaming ? (
                <div className="mini-card-title">
                  <strong>{course.name}</strong>
                  <span>{formatDate(course.createdAt)}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', fontSize: 14, minHeight: 'auto' }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newName.trim() && newName.trim() !== course.name) {
                        updateCourse(course.id, newName.trim());
                        setRenaming(false);
                      } else if (e.key === 'Escape') {
                        setRenaming(false);
                        setNewName(course.name);
                      }
                    }}
                  />
                  <button className="primary" style={{ padding: '8px 14px', fontSize: 13, minHeight: 'auto' }}
                    onClick={() => {
                      if (newName.trim() && newName.trim() !== course.name) {
                        updateCourse(course.id, newName.trim());
                      }
                      setRenaming(false);
                    }}
                    disabled={!newName.trim()}
                  >确认</button>
                  <button className="ghost" style={{ padding: '8px 12px', fontSize: 13, minHeight: 'auto' }}
                    onClick={() => { setRenaming(false); setNewName(course.name); }}
                  >取消</button>
                </div>
              )}
              <div className="row" style={{ marginBottom: boundClasses.length > 0 ? 6 : 0 }}>
                <span>关联班级 {boundClasses.length}</span>
                <span>课时卡 {data.courseCards.filter((cc) => cc.courseId === course.id).length}</span>
              </div>
              {boundClasses.length > 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: editing ? 8 : 0 }}>
                  班级：{boundClasses.map((c) => c.name).join('、')}
                </div>
              ) : null}
              {editing ? (
                <div className="actions-row" style={{ marginTop: 4, gap: 6 }}>
                  {!renaming ? (
                    <button className="ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => { setNewName(course.name); setRenaming(true); }}
                    >重命名</button>
                  ) : null}
                  <button className="ghost danger" style={{ fontSize: 12, padding: '4px 10px' }}
                    disabled={!canDelete}
                    onClick={() => deleteCourse(course.id)}
                    title={!canDelete ? '课程已被班级或课时卡引用，无法删除' : ''}
                  >删除</button>
                </div>
              ) : null}
            </div>
            );
          })}
        </div>

        {editing ? (
          <div style={{ marginTop: 12 }}>
            <div className="form-grid">
              <label>
                <span>新增课程</span>
                <input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="例如 舞蹈、数学" />
              </label>
              <div>
                <button className="primary" onClick={() => { createCourse(courseName); setCourseName(''); }}>
                  新增课程
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </article>

      {/* Backup */}
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>数据备份</h2>
            <p className="muted">导出当前「{workspaceName}」的数据为 JSON，可导入到其他版本或备份保存</p>
          </div>
        </div>
        <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => { void handleImport(e.target.files?.[0] ?? null); }} />
        <div className="actions-row">
          <button className="primary" onClick={() => {
            const json = exportBackup();
            downloadText(`wuyijiaschool-${workspaceName}-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json');
            flash('success', '已导出备份文件');
          }}>导出备份 JSON</button>
          <button className="ghost" onClick={() => importRef.current?.click()}>导入备份 JSON</button>
        </div>
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>导入会替换当前「{workspaceName}」的数据，请确认后再操作。</p>
      </article>

      {/* Delete Confirmation Sheet */}
      {deleteTargetId ? (() => {
        const targetWs = workspaces.find((w) => w.id === deleteTargetId);
        const targetName = targetWs?.name ?? '';
        return (
        <div className="sheet-backdrop" onClick={() => setDeleteTargetId('')}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <button className="ghost" onClick={() => setDeleteTargetId('')}>取消</button>
              <strong>确认删除</strong>
              <div />
            </div>
            <p style={{ textAlign: 'center', margin: '12px 0 16px', color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
              确定要删除数据版本「{targetName}」吗？<br />
              <span style={{ color: 'var(--danger)' }}>此操作不可恢复，建议先导出备份。</span>
            </p>
            <div className="cards" style={{ gap: 8 }}>
              <button className="primary" style={{ background: 'var(--danger)', width: '100%' }} onClick={() => { deleteWorkspace(deleteTargetId); setDeleteTargetId(''); }}>
                直接删除
              </button>
              <button className="primary" onClick={() => {
                const json = JSON.stringify({ name: targetName, exportedAt: new Date().toISOString(), data: targetWs?.data }, null, 2);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
                a.download = `wuyijiaschool-${targetName}-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
                flash('success', '已导出备份，可安全删除');
                setDeleteTargetId('');
              }}>
                导出备份（稍后自行删除）
              </button>
              <button className="ghost" onClick={() => setDeleteTargetId('')}>取消</button>
            </div>
          </div>
        </div>
        );
      })() : null}

      {/* Switch Workspace Password Sheet */}
      {switchTargetId ? (
        <div className="sheet-backdrop" onClick={() => { setSwitchTargetId(''); setPasswordError(false); }}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <button className="ghost" onClick={() => { setSwitchTargetId(''); setPasswordError(false); }}>取消</button>
              <strong>管理员验证</strong>
              <div />
            </div>
            <p style={{ textAlign: 'center', margin: '8px 0 16px', color: 'var(--muted)', fontSize: 13 }}>
              切换到「{workspaces.find((w) => w.id === switchTargetId)?.name ?? ''}」需要管理员密码
            </p>
            <div className="form-grid">
              <label>
                <span>管理员密码</span>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); setPasswordError(false); }}
                  placeholder="请输入密码"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (adminPassword === '135791') {
                        switchWorkspace(switchTargetId);
                        setSwitchTargetId('');
                        setAdminPassword('');
                      } else {
                        setPasswordError(true);
                      }
                    }
                  }}
                />
              </label>
              {passwordError ? (
                <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0, textAlign: 'center' }}>密码错误，请重试</p>
              ) : null}
            </div>
            <div className="actions-row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="ghost" onClick={() => { setSwitchTargetId(''); setPasswordError(false); }}>取消</button>
              <button className="primary" onClick={() => {
                if (adminPassword === '135791') {
                  switchWorkspace(switchTargetId);
                  setSwitchTargetId('');
                  setAdminPassword('');
                  setPasswordError(false);
                } else {
                  setPasswordError(true);
                }
              }}>验证并切换</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Rename Workspace Sheet */}
      {renameTargetId ? (
        <div className="sheet-backdrop" onClick={() => { setRenameTargetId(''); setRenamePasswordError(false); }}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <button className="ghost" onClick={() => { setRenameTargetId(''); setRenamePasswordError(false); }}>取消</button>
              <strong>重命名数据版本</strong>
              <div />
            </div>
            <p style={{ textAlign: 'center', margin: '8px 0 16px', color: 'var(--muted)', fontSize: 13 }}>
              重命名「{workspaces.find((w) => w.id === renameTargetId)?.name ?? ''}」需要管理员密码
            </p>
            <div className="form-grid">
              <label>
                <span>新名称</span>
                <input
                  value={renameNewName}
                  onChange={(e) => setRenameNewName(e.target.value)}
                  placeholder="输入新名称"
                  autoFocus
                />
              </label>
              <label>
                <span>管理员密码</span>
                <input
                  type="password"
                  value={renamePassword}
                  onChange={(e) => { setRenamePassword(e.target.value); setRenamePasswordError(false); }}
                  placeholder="请输入密码"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renameNewName.trim()) {
                      if (renamePassword === '135791') {
                        renameWorkspace(renameTargetId, renameNewName.trim());
                        setRenameTargetId('');
                      } else {
                        setRenamePasswordError(true);
                      }
                    }
                  }}
                />
              </label>
              {renamePasswordError ? (
                <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0, textAlign: 'center' }}>密码错误</p>
              ) : null}
            </div>
            <div className="actions-row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="ghost" onClick={() => { setRenameTargetId(''); setRenamePasswordError(false); }}>取消</button>
              <button className="primary" disabled={!renameNewName.trim() || !renamePassword} onClick={() => {
                if (renamePassword === '135791') {
                  renameWorkspace(renameTargetId, renameNewName.trim());
                  setRenameTargetId('');
                } else {
                  setRenamePasswordError(true);
                }
              }}>确认重命名</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
