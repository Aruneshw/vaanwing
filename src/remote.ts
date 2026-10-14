// Backend orchestration: initial sync, uploads with live processing progress, URL/text sources.
import { useCallback } from 'react';
import { api, toResource, type RemoteResource } from './api';
import { registerConcepts, type Chunk, type Subject } from './data';
import { useStore } from './store';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useRemote() {
  const { actions, toast, backend } = useStore();

  /** Pull everything the backend owns for this user into the local store. */
  const syncAll = useCallback(async () => {
    const [resources, courses, mastery] = await Promise.all([api.sources(), api.courses(), api.mastery().catch(() => [])]);
    const ready = resources.filter((r) => r.status === 'ready');
    const chunkLists = await Promise.all(ready.map((r) => api.chunks(r.id).catch(() => [] as Chunk[])));
    const details = await Promise.all(courses.map((c) => api.course(c.id).catch(() => null)));
    for (const d of details)
      if (d?.concepts)
        registerConcepts(d.concepts.map((c) => ({ id: c.id, name: c.name, subjectId: d.id, lessonId: c.lessonId ?? undefined, source: c.source, summary: c.summary })));
    const subjects: Subject[] = courses.map(({ id, name, icon, theme, modules }) => ({ id, name, icon, theme, modules, remote: true }));
    const chunks = chunkLists.flat();
    actions.mergeRemote(resources.map(toResource), chunks, subjects);
    const m: Record<string, number> = {};
    for (const row of mastery) if (row.mastery !== null) m[row.concept] = row.mastery;
    actions.setMasteryMany(m);
    return { resources, chunks, subjects };
  }, [actions]);

  /** Follow a source through the backend pipeline, mirroring its progress in the Analyzed Content card. */
  const follow = useCallback(
    async (first: RemoteResource) => {
      let r = first;
      actions.setAnalysis(Math.min(r.progress, 99));
      while (r.status === 'processing') {
        await wait(1000);
        try {
          r = await api.source(r.id);
        } catch {
          continue;
        }
        actions.setResourceStatus(r.id, toResource(r));
        actions.setAnalysis(Math.min(Math.max(r.progress, 5), 99));
      }
      const synced = await syncAll();
      actions.setAnalysis(100);
      if (r.status === 'failed') {
        toast(`Couldn't process “${r.name}”: ${r.error ?? 'unknown error'}`);
        return;
      }
      const chunks = synced.chunks.filter((c) => c.resourceId === r.id);
      const subject = synced.subjects.find((s) => s.id === r.subjectId) ?? null;
      const topics = new Set(chunks.map((c) => c.topic.split(':')[0])).size;
      actions.announceSource({ id: r.id, name: r.name, meta: r.meta }, chunks.length, topics, subject);
      toast(`Indexed “${r.name}” — ${chunks.length} excerpts`);
    },
    [actions, syncAll, toast],
  );

  const start = useCallback(
    async (create: () => Promise<RemoteResource>, label: string) => {
      try {
        const r = await create();
        await syncAll();
        toast(`Uploading “${label}” — processing on the server…`);
        void follow(r);
        return true;
      } catch (e) {
        toast(`Upload failed: ${(e as Error).message}`);
        return false;
      }
    },
    [follow, syncAll, toast],
  );

  return {
    online: backend.online,
    syncAll,
    uploadFile: (f: File) => start(() => api.upload(f), f.name),
    addUrl: (url: string, kind: 'youtube' | 'web') => start(() => api.addUrl(url, kind), url),
    addText: (title: string, text: string) => start(() => api.addText(title, text), title),
  };
}
