const { z } = require('zod');

// Reusable validation schemas
const schemas = {
  register: z.object({
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
    full_name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name too long')
      .regex(/^[a-zA-Z\s\-'.]+$/, 'Name contains invalid characters'),
  }),

  flashcard: z.object({
    front: z.string().min(1).max(500).trim(),
    back: z.string().min(1).max(1000).trim(),
    set_id: z.string().uuid('Invalid set ID'),
  }),

  quizQuestion: z.object({
    question: z.string().min(5).max(500).trim(),
    options: z.array(z.string().min(1).max(200)).length(4),
    correct_index: z.number().int().min(0).max(3),
    quiz_id: z.string().uuid(),
  }),
};

// Middleware factory
const validate = (schemaName) => (req, res, next) => {
  const schema = schemas[schemaName];
  if (!schema) return next();

  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  req.body = result.data; // use parsed and trimmed data
  next();
};

module.exports = { validate };