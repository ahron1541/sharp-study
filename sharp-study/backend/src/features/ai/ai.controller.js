const multer = require('multer');
const pdfParse = require('pdf-parse'); // Standard, clean import
const mammoth = require('mammoth');
const { supabaseAdmin } = require('../../config/supabase');
const { generateStudyGuide, generateFlashcards, generateQuiz } = require('./ai.service');
const { invalidateDashboardCache } = require('../dashboard/dashboard.cache');

// Multer — store file in memory (not disk), max 150MB, whitelist types
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'text/plain',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, and PPTX files are allowed.'));
    }
  },
}).single('file');

async function extractText(file) {
  if (file.mimetype === 'application/pdf') {
    // Safety check to ensure pdfParse loaded as a function
    if (typeof pdfParse !== 'function') {
      throw new Error('PDF parsing library is not configured correctly.');
    }
    const data = await pdfParse(file.buffer);
    return data.text;
  }
  
  if (file.mimetype.includes('wordprocessingml')) {
    const { value } = await mammoth.extractRawText({ buffer: file.buffer });
    return value;
  }
  
  if (file.mimetype === 'text/plain') {
    return file.buffer.toString('utf8');
  }
  
  // For PPTX: basic text extraction
  return file.buffer.toString('utf8').replace(/[^\x20-\x7E\n]/g, ' ').trim();
}

const generateMaterials = [
  // 1. Multer middleware first
  (req, res, next) => {
    upload(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  
  // 2. Main handler
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file uploaded.' });

      const generateOptions = JSON.parse(req.body.generate || '[]');
      if (!generateOptions.length) {
        return res.status(400).json({ error: 'Select at least one generation option.' });
      }

      // Extract text from the uploaded file
      const extractedText = await extractText(file);
      if (!extractedText || extractedText.trim().length < 100) {
        return res.status(422).json({ error: 'Could not extract enough text from this file. It might be an image-based PDF or too short.' });
      }

      const userId = req.user.id;
      const docTitle = file.originalname.replace(/\.[^.]+$/, '');
      const fileType = file.mimetype.includes('pdf')
        ? 'pdf'
        : file.mimetype.includes('word')
          ? 'docx'
          : file.mimetype.includes('presentationml')
            ? 'pptx'
            : null;

      // Save document record
      const { data: doc, error: docError } = await supabaseAdmin
        .from('documents')
        .insert({
          user_id: userId,
          title: docTitle,
          file_type: fileType,
          file_size_bytes: file.size,
          extracted_text: extractedText.substring(0, 50000), // cap DB storage
          status: 'processing',
        })
        .select()
        .single();

      if (docError) throw docError;

      // Run AI generation in parallel
      const tasks = [];

      if (generateOptions.includes('study_guide')) {
        tasks.push(
          generateStudyGuide(extractedText).then((content) =>
            supabaseAdmin.from('study_guides').insert({
              user_id: userId,
              document_id: doc.id,
              title: `Study Guide: ${docTitle}`,
              content,
            })
          )
        );
      }

      if (generateOptions.includes('flashcards')) {
        tasks.push(
          generateFlashcards(extractedText).then(async (cards) => {
            const { data: set } = await supabaseAdmin
              .from('flashcard_sets')
              .insert({ user_id: userId, document_id: doc.id, title: `Flashcards: ${docTitle}` })
              .select()
              .single();
              
            if (set && cards && cards.length > 0) {
              await supabaseAdmin.from('flashcards').insert(
                cards.map((c) => ({ set_id: set.id, front: c.front, back: c.back }))
              );
            }
          })
        );
      }

      if (generateOptions.includes('quiz')) {
        tasks.push(
          generateQuiz(extractedText).then(async (questions) => {
            const { data: quiz } = await supabaseAdmin
              .from('quizzes')
              .insert({ user_id: userId, document_id: doc.id, title: `Quiz: ${docTitle}` })
              .select()
              .single();
              
            if (quiz && questions && questions.length > 0) {
              await supabaseAdmin.from('quiz_questions').insert(
                questions.map((q) => ({
                  quiz_id: quiz.id,
                  question: q.question,
                  options: q.options,
                  correct_index: q.correct_index,
                }))
              );
            }
          })
        );
      }

      // Wait for all AI tasks and database inserts to finish
      await Promise.all(tasks);

      // Update document status
      await supabaseAdmin
        .from('documents')
        .update({ status: 'done' })
        .eq('id', doc.id);

      // Assuming this is synchronous or handled appropriately
      if (typeof invalidateDashboardCache === 'function') {
         invalidateDashboardCache(userId);
      }

      res.json({ success: true, generated: generateOptions });
    } catch (err) {
      console.error('AI generation error:', err);
      // Update document status to error if something goes wrong
      res.status(500).json({ error: 'AI generation failed. Please try again.' });
    }
  },
];

module.exports = { generateMaterials };