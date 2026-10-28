import { supabase } from '@/lib/supabase';

import { recordFor, useData, type Kind } from './store';

const PAGE = 500;
let running: Promise<SyncResult> | null = null;

export interface SyncResult { ok: boolean; pushed: number; pulled: number; error?: string }

/** Push local changes, then pull everything changed on the server since the last cursor. */
export function syncNow(): Promise<SyncResult> {
  if (!running) running = doSync().finally(() => { running = null; });
  return running;
}

async function doSync(): Promise<SyncResult> {
  if (!supabase) return { ok: false, pushed: 0, pulled: 0, error: '서버가 설정되지 않았어요' };
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return { ok: false, pushed: 0, pulled: 0, error: '로그인이 필요해요' };

  // push
  const state = useData.getState();
  const batch = state.dirty.map((k) => [k, recordFor(state, k)] as const).filter(([, r]) => r);
  let pushed = 0;
  for (let i = 0; i < batch.length; i += PAGE) {
    const chunk = batch.slice(i, i + PAGE);
    const rows = chunk.map(([, r]) => ({
      user_id: sess.session.user.id,
      kind: r!.kind, id: r!.id, data: r!.data, updated_at: r!.updatedAt, deleted: r!.deleted,
    }));
    const { error } = await supabase.from('records').upsert(rows, { onConflict: 'user_id,kind,id' });
    if (error) return { ok: false, pushed, pulled: 0, error: error.message };
    useData.getState().markPushed(chunk.map(([key, r]) => ({ key, updatedAt: r!.updatedAt })));
    pushed += rows.length;
  }

  // pull
  // Re-read the last minute: rows from transactions that committed late can carry an older timestamp.
  // Merging is idempotent, so the overlap is harmless.
  const saved = useData.getState().pulledAt;
  let cursor = saved ? new Date(new Date(saved).getTime() - 60_000).toISOString() : null;
  let pulled = 0;
  for (;;) {
    let q = supabase
      .from('records')
      .select('kind,id,data,updated_at,deleted,server_updated_at')
      .order('server_updated_at', { ascending: true })
      .limit(PAGE);
    if (cursor) q = q.gt('server_updated_at', cursor);
    const { data, error } = await q;
    if (error) return { ok: false, pushed, pulled, error: error.message };
    if (!data?.length) break;
    cursor = data[data.length - 1].server_updated_at as string;
    useData.getState().mergeRemote(
      data.map((r) => ({ kind: r.kind as Kind, id: r.id as string, data: r.data, updated_at: Number(r.updated_at), deleted: !!r.deleted })),
      cursor,
    );
    pulled += data.length;
    if (data.length < PAGE) break;
  }
  return { ok: true, pushed, pulled };
}

/** Debounced push after local edits. */
let timer: ReturnType<typeof setTimeout> | null = null;
export function startAutoSync() {
  return useData.subscribe((s, prev) => {
    if (s.dirty.length && s.dirty !== prev.dirty) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void syncNow(); }, 2500);
    }
  });
}
