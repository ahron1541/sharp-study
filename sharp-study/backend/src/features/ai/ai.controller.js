const multer = require('multer');
const { PDFParse } = require('pdf-parse'); // Correctly import the v2 class
const mammoth = require('mammoth');
const AdmZip = require('adm-zip');
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

function decodeXmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#xA;/gi, '\n')
    .replace(/&#10;/g, '\n');
}

function extractPptxText(buffer) {
  const zip = new AdmZip(buffer);
  const slideEntries = zip
    .getEntries()
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.entryName))
    .sort((a, b) => {
      const aNumber = Number(a.entryName.match(/slide(\d+)\.xml/i)?.[1] || 0);
      const bNumber = Number(b.entryName.match(/slide(\d+)\.xml/i)?.[1] || 0);
      return aNumber - bNumber;
    });

  const slides = slideEntries
    .map((entry) => {
      const xml = entry.getData().toString('utf8');
      const textRuns = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi))
        .map((match) => decodeXmlEntities(match[1]).trim())
        .filter(Boolean);

      return textRuns.join('\n').trim();
    })
    .filter(Boolean)
    .map((slideText, index) => `Slide ${index + 1}\n${slideText}`);

  return slides.join('\n\n').trim();
}

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

  if (file.mimetype.includes('presentationml')) {
    try {
      return extractPptxText(file.buffer);
    } catch (err) {
      console.error('PPTX parsing failed:', err);
      throw new Error('Failed to parse PPTX document.');
    }
  }

  throw new Error('Legacy PPT files are not supported yet. Please upload PPTX instead.');
}

const generateMaterials = [
  (req, res, next) => {
    upload(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  
  async (req, res) => {
    const abortController = new AbortController();
    let requestAborted = false;
    let documentId = null;
    let userId = null;
    const handleAbort = () => {
      requestAborted = true;
      abortController.abort();
    };

    const handleClose = () => {
      if (!res.writableEnded) {
        handleAbort();
      }
    };

    req.on('aborted', handleAbort);
    req.on('close', handleClose);

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

      userId = req.user.id;
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
      documentId = doc.id;

      const requestOptions = { signal: abortController.signal };
      const generators = [];
      const createdRecords = {};
      if (generateOptions.includes('study_guide')) {
        generators.push(async () => {
          const content = await generateStudyGuide(extractedText, requestOptions);
          const { data: studyGuide, error: studyGuideError } = await supabaseAdmin.from('study_guides').insert({
            user_id: userId,
            document_id: doc.id,
            title: `Study Guide: ${docTitle}`,
            content,
          }).select('id, title').single();

          if (studyGuideError) throw studyGuideError;
          createdRecords.study_guide = studyGuide;
        });
      }

      if (generateOptions.includes('flashcards')) {
        generators.push(async () => {
          const cards = await generateFlashcards(extractedText, requestOptions);
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

          createdRecords.flashcards = set ? { id: set.id, title: set.title } : null;
        });
      }

      if (generateOptions.includes('quiz')) {
        generators.push(async () => {
          const questions = await generateQuiz(extractedText, requestOptions);
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

          createdRecords.quiz = quiz ? { id: quiz.id, title: quiz.title } : null;
        });
      }

      for (const runGeneration of generators) {
        if (abortController.signal.aborted) {
          throw new Error('Generation aborted.');
        }
        await runGeneration();
      }

      await supabaseAdmin
        .from('documents')
        .update({ status: 'done' })
        .eq('id', doc.id);

      if (typeof invalidateDashboardCache === 'function') {
         invalidateDashboardCache(userId);
      }

      console.log('--- GENERATION COMPLETE ---');
      res.json({ success: true, generated: generateOptions, created: createdRecords });
    } catch (err) {
      console.error('AI generation error:', err);

      if (documentId) {
        const nextStatus = 'error';
        await supabaseAdmin.from('documents').update({ status: nextStatus }).eq('id', documentId);
      }

      if (requestAborted || abortController.signal.aborted) {
        return;
      }
      
      if (err.message === 'Generation aborted.') {
        return res.status(499).json({ error: 'Generation was cancelled.' });
      }

      if (err.status === 429 || err.status === 503 || (err.message && /(429|503)/.test(err.message))) {
        return res.status(503).json({ 
          error: 'Gemini AI is busy right now. Please wait a bit and try again.'
        });
      }

      res.status(500).json({ error: 'AI generation failed. Please try again.' });
    } finally {
      req.off('aborted', handleAbort);
      req.off('close', handleClose);
    }
  },
];

module.exports = { generateMaterials };
