import { useState } from 'react';
import { BookOpen, CreditCard, HelpCircle, Upload } from 'lucide-react';
import { useDashboard }         from '../hooks/useDashboard';
import MaterialCard             from '../components/MaterialCard';
import SkeletonMaterialCard     from '../components/SkeletonMaterialCard';
import DashboardEmptyState      from '../components/DashboardEmptyState';
import UploadModal              from '../../upload/components/UploadModal';
import { useAuth }              from '../../auth/context/AuthContext';

const SKELETON_COUNT = 4;

function Section({ title, icon: Icon, loading, items, type, emptyState }) {
  return (
    <section aria-labelledby={`section-${type}`} className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-accent" aria-hidden="true" />
        <h2
          id={`section-${type}`}
          className="text-base font-bold text-text"
        >
          {title}
        </h2>
        {!loading && (
          <span
            className="text-xs text-muted font-medium"
            aria-label={`${items.length} items`}
          >
            ({items.length})
          </span>
        )}
      </div>

      {loading ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          aria-label="Loading study materials"
          aria-busy="true"
        >
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <SkeletonMaterialCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        emptyState
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <MaterialCard
              key={item.id}
              id={item.id}
              title={item.title}
              type={type}
              createdAt={item.created_at}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const { profile }  = useAuth();
  const {
    studyGuides,
    flashcardSets,
    quizzes,
    loading,
    error,
    refetch,
  } = useDashboard();

  const [uploadOpen, setUploadOpen] = useState(false);

  const openUpload = () => setUploadOpen(true);

  return (
    <>
      <div className="p-6 max-w-[1400px] mx-auto">

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="
              mb-6 px-4 py-3 bg-red-50 border border-red-200
              text-red-700 text-sm rounded-xl
            "
          >
            {error} —{' '}
            <button
              onClick={refetch}
              className="underline font-semibold focus-visible:outline-none"
            >
              Retry
            </button>
          </div>
        )}

        {/* Recent Study Guides */}
        <Section
          title="Recent Study Guides"
          icon={BookOpen}
          type="study_guide"
          loading={loading}
          items={studyGuides}
          emptyState={
            <DashboardEmptyState
              icon={BookOpen}
              heading="No study guides yet"
              body="Upload a PDF, DOCX, or PPTX file to generate your first study guide automatically."
              cta={{ label: 'Upload a File', onClick: openUpload }}
            />
          }
        />

        {/* Flashcard Sets */}
        <Section
          title="Flashcard Sets"
          icon={CreditCard}
          type="flashcard_set"
          loading={loading}
          items={flashcardSets}
          emptyState={
            <DashboardEmptyState
              icon={CreditCard}
              heading="No flashcard sets yet"
              body="Upload a file and let the AI generate flashcards for you automatically."
              cta={{ label: 'Upload a File', onClick: openUpload }}
            />
          }
        />

        {/* Quizzes */}
        <Section
          title="Quizzes"
          icon={HelpCircle}
          type="quiz"
          loading={loading}
          items={quizzes}
          emptyState={
            <DashboardEmptyState
              icon={HelpCircle}
              heading="No quizzes yet"
              body="Upload a file to auto-generate multiple-choice quizzes from your lesson."
              cta={{ label: 'Upload a File', onClick: openUpload }}
            />
          }
        />
      </div>

      {/* Upload modal */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => { setUploadOpen(false); refetch(); }}
      />
    </>
  );
}