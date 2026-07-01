import { supabase } from './supabase';
import type { AppData, Workspace } from './types';

export { supabase };

type DbWorkspace = { id: string; name: string; data: AppData; created_at: string };

function toWorkspace(db: DbWorkspace): Workspace {
  return {
    id: db.id,
    name: db.name,
    data: db.data,
    createdAt: db.created_at,
  };
}

function isValidAppData(data: any): data is AppData {
  return (
    data &&
    typeof data === 'object' &&
    data.version === 1 &&
    Array.isArray(data.classes) &&
    Array.isArray(data.students) &&
    Array.isArray(data.courses) &&
    Array.isArray(data.courseCards) &&
    Array.isArray(data.attendanceRecords) &&
    Array.isArray(data.homeworkRecords)
  );
}

// ============================================================
// Workspaces
// ============================================================

export async function listWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as DbWorkspace[])
    .map(toWorkspace)
    .filter((ws) => {
      if (!isValidAppData(ws.data)) {
        console.warn('[db] 跳过数据格式不兼容的工作区:', ws.id, ws.name);
        return false;
      }
      return true;
    });
}

export async function createWorkspace(name: string, initialData: AppData): Promise<Workspace> {
  const { crypto } = window;
  const id = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const { data, error } = await supabase
    .from('workspaces')
    .insert({ id, name, data: initialData, created_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return toWorkspace(data as DbWorkspace);
}

export async function saveWorkspace(id: string, name: string, data: AppData): Promise<void> {
  const { error } = await supabase
    .from('workspaces')
    .update({ name, data, created_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteWorkspace(id: string): Promise<void> {
  const { error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
