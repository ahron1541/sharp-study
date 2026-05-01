const multer = require('multer');
const { PDFParse } = require('pdf-parse'); // Correctly import the v2 class
const mammoth = require('mammoth');
const { supabaseAdmin } = require('../../config/supabase');
const { generateStudyGuide, generateFlashcards, generateQuiz } = require('./ai.service');
const { invalidateDashboardCache } = require('../dashboard/dashboard.cache');

// Multer - store file in memory (not disk), max 150MB, whitelist types
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
    try {
      // Use the new v2 API structure
      const parser = new PDFParse({ data: file.buffer });
      const result = await parser.getText();
      
      // Clean up memory if the method is available
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
      
      return result.text;
    } catch (err) {
      console.error('PDF parsing failed:', err);
      throw new Error('Failed to parse PDF document.');
    }
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
  (req, res, next) => {
    upload(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file uploaded.' });

      const generateOptions = JSON.parse(req.body.generate || '[]');
      if (!generateOptions.length) {
        return res.status(400).json({ error: 'Select at least one generation option.' });
      }

      console.log('--- STARTING GENERATION PROCESS ---');

      const extractedText = await extractText(file);
      if (!extractedText || extractedText.trim().length < 100) {
        return res.status(422).json({ error: 'Could not extract enough text from this file.' });
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

      const { data: doc, error: docError } = await supabaseAdmin
        .from('documents')
        .insert({
          user_id: userId,
          title: docTitle,
          file_type: fileType,
          file_size_bytes: file.size,
          extracted_text: extractedText.substring(0, 50000), 
          status: 'processing',
        })
        .select()
        .single();

      if (docError) throw docError;

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

      await Promise.all(tasks);

      await supabaseAdmin
        .from('documents')
        .update({ status: 'done' })
        .eq('id', doc.id);

      if (typeof invalidateDashboardCache === 'function') {
         invalidateDashboardCache(userId);
      }

      console.log('--- GENERATION COMPLETE ---');
      res.json({ success: true, generated: generateOptions });
    } catch (err) {
      console.error('AI generation error:', err);
      
      // Check if it's an overloaded API error
      if (err.status === 503 || (err.message && err.message.includes('503'))) {
        return res.status(503).json({ 
          error: 'The AI is currently experiencing high demand. Please wait a few seconds and try again.' 
        });
      }

      // Default fallback error
      res.status(500).json({ error: 'AI generation failed. Please try again.' });
    }
  },
];

module.exports = { generateMaterials };