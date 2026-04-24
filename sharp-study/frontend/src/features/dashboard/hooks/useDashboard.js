import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/context/AuthContext';

/**
 * Fetches the current user's study materials from Supabase.
 * Returns study_guides, flashcard_sets, and quizzes with
 * loading and error states.
 */
export function useDashboard() {
  const { supabase } = useAuth();
  const [studyGuides,    setStudyGuides]    = useState([]);
  const [flashcardSets,  setFlashcardSets]  = useState([]);
  const [quizzes,        setQuizzes]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [guidesRes, cardsRes, quizzesRes] = await Promise.all([
        supabase
          .from('study_guides')
          .select('id, title, created_at, document_id')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(12),

        supabase
          .from('flashcard_sets')
          .select('id, title, created_at, document_id')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(12),

        supabase
          .from('quizzes')
          .select('id, title, created_at, document_id')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(12),
      ]);

      if (guidesRes.error)   throw guidesRes.error;
      if (cardsRes.error)    throw cardsRes.error;
      if (quizzesRes.error)  throw quizzesRes.error;

      setStudyGuides(studyGuides   => guidesRes.data  ?? []);
      setFlashcardSets(sets        => cardsRes.data   ?? []);
      setQuizzes(quizzes           => quizzesRes.data ?? []);
    } catch (err) {
      setError(err.message ?? 'Failed to load your materials.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    studyGuides,
    flashcardSets,
    quizzes,
    loading,
    error,
    refetch: fetchAll,
  };
}