const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authentication token provided.' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }

  req.user = user;
  next();
};

const requireAdmin = async (req, res, next) => {
  await requireAuth(req, res, async () => {
    const { supabaseAdmin } = require('../config/supabase');
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_blocked')
      .eq('id', req.user.id)
      .single();

    if (!profile || profile.role !== 'admin' || profile.is_blocked) {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  });
};

module.exports = { requireAuth, requireAdmin };