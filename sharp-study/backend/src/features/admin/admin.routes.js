const express = require('express');
const { requireAdmin } = require('../../middleware/auth.middleware');
const { supabaseAdmin } = require('../../config/supabase');
const router = express.Router();

// All admin routes require admin role
router.use(requireAdmin);

// GET /api/admin/users — list all users
router.get('/users', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role, is_blocked, created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch users.' });
  res.json({ users: data });
});

// PATCH /api/admin/users/:id — block/unblock user
router.patch('/users/:id', async (req, res) => {
  const { is_blocked } = req.body;
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ is_blocked: Boolean(is_blocked) })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Update failed.' });
  res.json({ success: true });
});

// DELETE /api/admin/users/:id — delete user
router.delete('/users/:id', async (req, res) => {
  // Delete from auth (cascades to profiles via trigger)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
  if (error) return res.status(500).json({ error: 'Delete failed.' });
  res.json({ success: true });
});

module.exports = router;