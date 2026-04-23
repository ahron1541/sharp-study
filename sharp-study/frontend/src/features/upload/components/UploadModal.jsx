import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, CheckSquare, Square, Loader } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { apiRequest } from '../../../config/api';
import { validators } from '../../../shared/utils/validators';
import Modal from '../../../shared/components/Modal';
import Button from '../../../shared/components/Button';
import toast from 'react-hot-toast';

const GENERATE_OPTIONS = [
  { id: 'study_guide',  label: '📖 Study Guide',  desc: 'Short, clear summaries' },
  { id: 'flashcards',   label: '🃏 Flashcards',    desc: '10 question/answer cards' },
  { id: 'quiz',         label: '❓ Quiz',           desc: '10 multiple-choice questions' },
];

const ALLOWED_TYPES = ['pdf', 'pptx', 'docx'];
const MAX_MB = 150;

export default function UploadModal({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [selected, setSelected] = useState(['study_guide', 'flashcards', 'quiz']);
  const [stage, setStage] = useState('idle'); // idle | uploading | generating | done
  const [progress, setProgress] = useState('');

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      toast.error('Only PDF, PPTX, and DOCX files under 150MB are allowed.');
      return;
    }
    const f = acceptedFiles[0];
    const typeErr = validators.fileType(ALLOWED_TYPES)(f);
    const sizeErr = validators.fileSize(MAX_MB)(f);
    if (typeErr) { toast.error(typeErr); return; }
    if (sizeErr) { toast.error(sizeErr); return; }
    setFile(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: MAX_MB * 1024 * 1024,
    multiple: false,
  });

  const toggleOption = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!file) { toast.error('Please upload a file first.'); return; }
    if (!selected.length) { toast.error('Please select at least one thing to generate.'); return; }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('generate', JSON.stringify(selected));
    formData.append('user_id', user.id);

    try {
      setStage('uploading');
      setProgress('Uploading your file...');

      const token = localStorage.getItem('sharp-study-token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      setStage('generating');
      setProgress('AI is reading your document...');

      const data = await res.json();
      setStage('done');
      toast.success(`Generated ${selected.length} material(s) successfully!`);
      setTimeout(() => {
        setFile(null);
        setSelected(['study_guide', 'flashcards', 'quiz']);
        setStage('idle');
        onSuccess();
      }, 1500);
    } catch (err) {
      toast.error(err.message);
      setStage('idle');
    }
  };

  const reset = () => { setFile(null); setStage('idle'); };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload & Generate Study Materials" size="lg">
      {stage === 'idle' || stage === 'done' ? (
        <>
          {/* Dropzone */}
          <div
            {...getRootProps()}
            role="button"
            tabIndex={0}
            aria-label="Upload file area. Click or drag and drop a file here."
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                       transition-all duration-200
                       ${isDragActive
                         ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                         : 'border-[var(--card-border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5'}`}
          >
            <input {...getInputProps()} aria-hidden="true" />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="text-[var(--accent)]" size={32} />
                <div className="text-left">
                  <p className="font-medium text-[var(--text-color)]">{file.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  aria-label="Remove file"
                  className="ml-2 p-1 rounded hover:bg-[var(--card-border)]"
                >
                  <X size={16} className="text-[var(--muted)]" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="text-[var(--accent)] mx-auto mb-3" size={36} />
                <p className="text-[var(--text-color)] font-medium mb-1">
                  {isDragActive ? 'Drop it here!' : 'Drag & drop your file here'}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  or click to browse · PDF, PPTX, DOCX · Max 150MB
                </p>
              </>
            )}
          </div>

          {/* Generation options (checkboxes) */}
          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-[var(--text-color)] mb-3">
              What should we generate? (select at least one)
            </legend>
            <div className="grid sm:grid-cols-3 gap-3">
              {GENERATE_OPTIONS.map((opt) => {
                const isChecked = selected.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer
                               transition-all duration-150
                               ${isChecked
                                 ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                                 : 'border-[var(--card-border)] hover:border-[var(--accent)]/50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(opt.id)}
                      className="sr-only"
                    />
                    <span aria-hidden="true">
                      {isChecked
                        ? <CheckSquare size={18} className="text-[var(--accent)] mt-0.5" />
                        : <Square size={18} className="text-[var(--muted)] mt-0.5" />}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-color)]">{opt.label}</p>
                      <p className="text-xs text-[var(--muted)]">{opt.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Button
            className="w-full mt-6"
            onClick={handleGenerate}
            disabled={!file || !selected.length}
          >
            Generate Study Materials
          </Button>
        </>
      ) : (
        // Processing state
        <div className="py-12 text-center">
          <Loader className="text-[var(--accent)] animate-spin mx-auto mb-4" size={48} />
          <p className="font-semibold text-[var(--text-color)] mb-2">{progress}</p>
          <p className="text-sm text-[var(--muted)]">
            {stage === 'uploading'
              ? 'Please wait while we upload your file securely...'
              : 'The AI is reading your document and generating content. This takes about 15–30 seconds.'}
          </p>
          {/* Progress bar */}
          <div
            className="mt-6 h-2 bg-[var(--card-border)] rounded-full overflow-hidden"
            role="progressbar"
            aria-label="Processing progress"
          >
            <div
              className={`h-full bg-[var(--accent)] rounded-full transition-all duration-1000
                          ${stage === 'uploading' ? 'w-1/3' : 'w-2/3'}`}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}