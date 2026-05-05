import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/context/AuthContext';
import { API_URL } from '../../../config/api';

/**
 * Fetches the current user's study materials from Supabase.
 * Returns study_guides, flashcard_sets, and quizzes with
 * loading and error states.
 */
export function useDashboard(options = {}) {
  const { limit = 12 } = options;
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
      const token = localStorage.getItem('sharp-study-token');
      if (token) {
        const response = await fetch(`${API_URL}/api/dashboard?limit=${limit}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setStudyGuides(data.items?.study_guides ?? []);
          setFlashcardSets(data.items?.flashcards ?? []);
          setQuizzes(data.items?.quizzes ?? []);
          return;
        }
      }

      const [guidesRes, cardsRes, quizzesRes] = await Promise.all([
        supabase
          .from('study_guides')
          .select('id, title, created_at, document_id')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(limit),

        supabase
          .from('flashcard_sets')
          .select('id, title, created_at, document_id')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(limit),

        supabase
          .from('quizzes')
          .select('id, title, created_at, document_id')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);

      if (guidesRes.error)   throw guidesRes.error;
      if (cardsRes.error)    throw cardsRes.error;
      if (quizzesRes.error)  throw quizzesRes.error;

      setStudyGuides(guidesRes.data ?? []);
      setFlashcardSets(cardsRes.data ?? []);
      setQuizzes(quizzesRes.data ?? []);
    } catch (err) {
      setError(err.message ?? 'Failed to load your materials.');
    } finally {
      setLoading(false);
    }
  }, [limit, supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchAll, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchAll]);

  return {
    items: {
      study_guides: studyGuides,
      flashcards: flashcardSets,
      quizzes,
    },
    studyGuides,
    flashcardSets,
    quizzes,
    loading,
    error,
    refetch: fetchAll,
  };
}
