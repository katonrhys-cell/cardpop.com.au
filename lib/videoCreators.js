// Saved video creators — the browser's reads and (admin-only, under RLS)
// writes. Shapes and rules live in utils/videoCreators.js.
import { supabase } from '@/lib/supabaseClient.js';
import {
  CREATOR_EVENT_COLUMNS,
  CREATOR_ORGANISER_COLUMNS,
  MAX_SAVED_CREATORS,
  VIDEO_CREATOR_COLUMNS,
  creatorSlug,
  creatorVideosFromRows,
  creatorVideosProbe,
  creditToCreatorRow,
} from '@/utils/videoCreators.js';

let savedPromise = null;

/** The saved creators, by name. Cached for the session; `fresh` re-reads. */
export function fetchSavedCreators({ fresh = false } = {}) {
  if (!savedPromise || fresh) {
    // Started inside a promise so a synchronous failure is a rejection too.
    savedPromise = Promise.resolve()
      .then(() => supabase.from('video_creators')
      .select(VIDEO_CREATOR_COLUMNS)
      .order('name', { ascending: true })
      .limit(MAX_SAVED_CREATORS))
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      })
      .catch((err) => { savedPromise = null; throw err; });
  }
  return savedPromise;
}

/** Save a credit as a new creator. Returns the saved row. */
export async function saveCreator(credit) {
  const row = creditToCreatorRow(credit);
  if (!row) throw new Error('Give the creator a name first');
  const base = creatorSlug(row.name) || 'creator';
  // The slug is the page address and must be unique: "name", "name-2", …
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    const { data, error } = await supabase
      .from('video_creators').insert({ ...row, slug }).select(VIDEO_CREATOR_COLUMNS).single();
    if (!error) { savedPromise = null; return data; }
    if (error.code !== '23505') throw error;
  }
  throw new Error('That name is taken several times over — change it slightly');
}

/** Update a saved creator from a credit. The database then updates every video crediting them. */
export async function updateCreator(id, credit) {
  const row = creditToCreatorRow(credit);
  if (!row) throw new Error('Give the creator a name first');
  const { data, error } = await supabase
    .from('video_creators').update(row).eq('id', id).select(VIDEO_CREATOR_COLUMNS).single();
  if (error) throw error;
  savedPromise = null;
  return data;
}

/** One saved creator by page slug, or null. */
export async function fetchCreatorBySlug(slug) {
  const { data, error } = await supabase
    .from('video_creators').select(VIDEO_CREATOR_COLUMNS).eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Every public video crediting a creator (see creatorVideosFromRows). */
export async function fetchCreatorVideos(creatorId) {
  const probe = creatorVideosProbe(creatorId);
  const [events, organisers] = await Promise.all([
    supabase.from('events_public').select(CREATOR_EVENT_COLUMNS)
      .contains('event_videos', probe).order('start_date', { ascending: false }).limit(200),
    supabase.from('event_organisers').select(CREATOR_ORGANISER_COLUMNS)
      .contains('videos', probe).limit(100),
  ]);
  if (events.error) throw events.error;
  // The organiser read is an extra: a creator's page still lists their event videos without it.
  return creatorVideosFromRows(creatorId, { events: events.data, organisers: organisers.error ? [] : organisers.data });
}
