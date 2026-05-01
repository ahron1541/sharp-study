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

    req.user = user;
    req.accessToken = token;
    next();
  } catch (err) {
    console.error("[ERROR] Auth Middleware Exception:", err.message);
    res.status(401).json({ error: 'Unauthorized: Server error during auth' });
  }
};

const requireAdmin = async (req, res, next) => {
  // Use requireAuth to verify identity first
  await requireAuth(req, res, async () => {
    try {
      const { supabaseAdmin } = require('../config/supabase');
      // Check the database to see if they have the admin role
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
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
