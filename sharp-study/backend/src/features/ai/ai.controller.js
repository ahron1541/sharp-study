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

function getFileExtension(fileName = '') {
  const cleanName = String(fileName).trim().toLowerCase();
  const match = cleanName.match(/\.([a-z0-9]+)$/i);
  return match ? match[1] : '';
}

function looksLikeZipBuffer(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 4
    && buffer[0] === 0x50
    && buffer[1] === 0x4b
    && buffer[2] === 0x03
    && buffer[3] === 0x04;
}

function resolveUploadKind(file) {
  const mime = String(file?.mimetype || '').toLowerCase();
  const extension = getFileExtension(file?.originalname);

  if (mime === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (mime === 'text/plain' || extension === 'txt') return 'txt';
  if (mime.includes('wordprocessingml') || extension === 'docx') return 'docx';
  if (mime.includes('presentationml') || extension === 'pptx') return 'pptx';

  if (mime === 'application/vnd.ms-powerpoint') {
    return looksLikeZipBuffer(file?.buffer) || extension === 'pptx' ? 'pptx' : 'ppt';
  }

  return extension || 'unknown';
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
  const uploadKind = resolveUploadKind(file);

  if (uploadKind === 'pdf') {
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
  
  if (uploadKind === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer: file.buffer });
    return value;
  }
  
  if (uploadKind === 'txt') {
    return file.buffer.toString('utf8');
  }

  if (uploadKind === 'pptx') {
    try {
      return extractPptxText(file.buffer);
    } catch (err) {
      console.error('PPTX parsing failed:', err);
      throw new Error('Failed to parse PPTX document.');
    }
  }

  if (uploadKind === 'ppt') {
    throw new Error('Legacy PPT files are not supported yet. Please export or re-save the file as PPTX first.');
  }

  throw new Error('Unsupported document format. Please upload TXT, PDF, DOCX, or PPTX.');
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
      const cleanedExtractedText = String(extractedText || '').replace(/\s+/g, ' ').trim();

      if (!cleanedExtractedText) {
        return res.status(422).json({
          error: 'No readable text was found in this file. Please upload a text-based TXT, PDF, DOCX, or PPTX file with selectable text.',
        });
      }

      if (cleanedExtractedText.length < 30) {
        return res.status(422).json({
          error: 'Only a very small amount of readable text was found in this file. Please upload a clearer file with more selectable text.',
        });
      }

      userId = req.user.id;
      const docTitle = file.originalname.replace(/\.[^.]+$/, '');
      const resolvedType = resolveUploadKind(file);
      const fileType = resolvedType === 'pdf' || resolvedType === 'docx' || resolvedType === 'pptx'
        ? resolvedType
        : null;

      const { data: doc, error: docError } = await supabaseAdmin
        .from('documents')
        .insert({
          user_id: userId,
          title: docTitle,
          file_type: fileType,
          file_size_bytes: file.size,
          extracted_text: cleanedExtractedText.substring(0, 50000),
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
          const content = await generateStudyGuide(cleanedExtractedText, requestOptions);
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
          const cards = await generateFlashcards(cleanedExtractedText, requestOptions);
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
          const questions = await generateQuiz(cleanedExtractedText, requestOptions);
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
