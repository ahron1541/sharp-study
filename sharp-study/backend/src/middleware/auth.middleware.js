const { createClient } = require('@supabase/supabase-js');

// Initialize a standard Supabase client for auth checking
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("[WARNING] Missing SUPABASE_URL or SUPABASE_ANON_KEY in backend environment variables!");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    const { supabaseAdmin } = require('../config/supabase');
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, is_blocked')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ error: 'Unauthorized: Profile not found' });
    }

    if (profile.is_blocked) {
      return res.status(403).json({ error: 'Account is blocked' });
    }

    req.user = user;
    req.profile = profile;
    req.accessToken = token;
    next();
  } catch (err) {
    console.error("[ERROR] Auth Middleware Exception:", err.message);
    res.status(401).json({ error: 'Unauthorized: Server error during auth' });
  }
};

const requireAdmin = async (req, res, next) => {
  await requireAuth(req, res, async () => {
    try {
      if (!req.profile || req.profile.role !== 'admin') {
        console.log(`[ERROR] Admin Auth Error: User ${req.user.id} attempted to access an admin route.`);
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }
      
      next();
    } catch (err) {
      console.error("[ERROR] Admin Middleware Exception:", err.message);
      res.status(500).json({ error: 'Server error verifying permissions' });
    }
  });
};

module.exports = { requireAuth, requireAdmin };
