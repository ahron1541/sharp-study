export const MATERIAL_TYPES = {
  study_guide: {
    key: 'study_guide',
    label: 'Study Guide',
    plural: 'Study Guides',
    table: 'study_guides',
    iconName: 'book',
    color: '#3B82F6',
    generateId: 'study_guide',
    route: '/study-guide',
  },
  flashcards: {
    key: 'flashcards',
    label: 'Flashcards',
    plural: 'Flashcards',
    table: 'flashcard_sets',
    iconName: 'cards',
    color: '#8B5CF6',
    generateId: 'flashcards',
    route: '/flashcards',
  },
  quiz: {
    key: 'quiz',
    label: 'Quiz',
    plural: 'Quizzes',
    table: 'quizzes',
    iconName: 'quiz',
    color: '#10B981',
    generateId: 'quiz',
    route: '/quiz',
  },
};

export const MATERIAL_TYPE_KEYS = Object.keys(MATERIAL_TYPES);
export const PAGE_SIZE = 9;

export function getMaterialRoute(type, id) {
  const meta = MATERIAL_TYPES[type] || MATERIAL_TYPES.study_guide;
  return `${meta.route}/${id}`;
}

export async function fetchMaterialCounts(supabase, userId, archived = false) {
  const results = await Promise.all(
    MATERIAL_TYPE_KEYS.map(async (typeKey) => {
      const meta = MATERIAL_TYPES[typeKey];
      const { count, error } = await supabase
        .from(meta.table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_archived', archived);

      if (error) throw error;
      return [typeKey, count || 0];
    })
  );

  return Object.fromEntries(results);
}

export async function fetchMaterialsPage({
  supabase,
  userId,
  type,
  archived = false,
  search = '',
  page = 1,
  pageSize = PAGE_SIZE,
}) {
  const meta = MATERIAL_TYPES[type];
  if (!meta) {
    throw new Error('Unknown material type.');
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from(meta.table)
    .select('id, title, created_at, document_id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_archived', archived)
    .order('created_at', { ascending: false });

  if (search.trim()) {
    query = query.ilike('title', `%${search.trim()}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    items: data || [],
    totalCount: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
  };
}

export async function archiveMaterial({ supabase, type, id, archived }) {
  const meta = MATERIAL_TYPES[type];
  if (!meta) throw new Error('Unknown material type.');

  const { error } = await supabase
    .from(meta.table)
    .update({ is_archived: archived })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteMaterial({ supabase, type, id }) {
  if (type === 'study_guide') {
    const { error } = await supabase.from('study_guides').delete().eq('id', id);
    if (error) throw error;
    return;
  }

  if (type === 'flashcards') {
    const { error: cardsError } = await supabase.from('flashcards').delete().eq('set_id', id);
    if (cardsError) throw cardsError;

    const { error: setError } = await supabase.from('flashcard_sets').delete().eq('id', id);
    if (setError) throw setError;
    return;
  }

  if (type === 'quiz') {
    const { error: questionsError } = await supabase.from('quiz_questions').delete().eq('quiz_id', id);
    if (questionsError) throw questionsError;

    const { error: quizError } = await supabase.from('quizzes').delete().eq('id', id);
    if (quizError) throw quizError;
  }
}
