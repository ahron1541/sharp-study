const { supabaseAdmin } = require('../config/supabase');

function cleanText(value = '', maxLength = 800) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

async function writeSystemLog({ level = 'info', source = 'system', message, metadata = {} }) {
  const cleanMessage = cleanText(message);
  if (!cleanMessage) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('system_logs')
      .insert({
        level: ['info', 'warning', 'error'].includes(level) ? level : 'info',
        source: cleanText(source, 120) || 'system',
        message: cleanMessage,
        metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {},
      })
      .select('id')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    if (error?.code !== '42P01') {
      console.warn('[SYSTEM_LOG] Failed to write system log:', error.message);
    }
    return null;
  }
}

module.exports = { writeSystemLog };
