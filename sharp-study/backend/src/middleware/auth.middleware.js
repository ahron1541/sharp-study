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
    // 1. Check if the frontend sent the Bearer token
    const authHeader = req.headers.authorization;
    
    // DEBUG TRAP: Print exactly what arrived from the frontend
    console.log("DEBUG - Received Auth Header:", authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("[ERROR] Auth Error: Missing or improperly formatted Authorization header.");
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    // 2. Extract the actual token string
    const token = authHeader.split(' ')[1];

    // 3. Ask Supabase if this token is valid and who it belongs to
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.log("[ERROR] Auth Error: Token rejected by Supabase.", error?.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    // 4. Success! Attach the user to the request and let them through
    req.user = user;
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