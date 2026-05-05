const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { z } = require('zod');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const signupTokenTtlMinutes = Number(process.env.SIGNUP_TOKEN_TTL_MINUTES || 20);
const resetTokenTtlMinutes = Number(process.env.RESET_TOKEN_TTL_MINUTES || 20);
const signupTokenSecret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
const usernamePattern = /^[a-z0-9_.-]{3,20}$/;
const namePattern = /^[A-Za-z][A-Za-z' -]{0,48}$/;

const emailSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

const otpVerificationSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

const completeSignupSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  signup_token: z.string().min(20),
  first_name: z.string().trim().min(1).max(50).regex(namePattern, 'Invalid first name'),
  middle_name: z.string().trim().max(50).regex(/^[A-Za-z' -]*$/, 'Invalid middle name').optional().or(z.literal('')),
  last_name: z.string().trim().min(1).max(50).regex(namePattern, 'Invalid last name'),
  username: z.string().trim().toLowerCase().regex(usernamePattern, 'Invalid username'),
  password: z.string().min(12).max(128)
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/[0-9]/, 'Password must include a number')
    .regex(/[^A-Za-z0-9]/, 'Password must include a special character'),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
});

const resetRequestSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
});

const resetSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  reset_token: z.string().min(20),
  password: z.string().min(12).max(128)
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/[0-9]/, 'Password must include a number')
    .regex(/[^A-Za-z0-9]/, 'Password must include a special character'),
});

let smtpTransporter = null;

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

function buildSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    throw new Error('SMTP credentials are not configured');
  }

  const port = Number(process.env.SMTP_PORT || 587);
  smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
    tls: {
      servername: process.env.SMTP_HOST || 'smtp.gmail.com',
      minVersion: 'TLSv1.2',
    },
  });

  return smtpTransporter;
}

function getEmailFromAddress() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (resend) return 'Sharp Study <onboarding@resend.dev>';
  return `"Sharp Study" <${process.env.EMAIL_USER}>`;
}

async function sendAuthEmail({ to, subject, html, text }) {
  if (resend) {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || getEmailFromAddress(),
      to,
      subject,
      html,
      text,
    });

    if (error) {
      throw new Error(error.message || 'Failed to send email with Resend');
    }
    return;
  }

  const transporter = buildSmtpTransporter();
  await transporter.sendMail({
    from: getEmailFromAddress(),
    to,
    subject,
    html,
    text,
  });
}

function parseSchema(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    return {
      error: result.error.issues[0]?.message || 'Invalid request payload',
      data: null,
    };
  }

  return { error: null, data: result.data };
}

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

async function getProfileByEmail(email, columns) {
  return supabase
    .from('profiles')
    .select(columns)
    .eq('email', email)
    .maybeSingle();
}

async function getProfileByUsername(username, columns) {
  return supabase
    .from('profiles')
    .select(columns)
    .eq('username', username)
    .maybeSingle();
}

async function getProfileByIdentifier(identifier, columns) {
  const normalized = normalizeIdentifier(identifier);
  return normalized.includes('@')
    ? getProfileByEmail(normalized, columns)
    : getProfileByUsername(normalized, columns);
}

async function replaceOtpCode({ email, code, purpose, expiresAt, ipAddress }) {
  const cleanupResult = await supabase
    .from('otp_codes')
    .delete()
    .eq('email', email)
    .eq('purpose', purpose);

  if (cleanupResult.error) throw cleanupResult.error;

  const insertResult = await supabase.from('otp_codes').insert([{
    email,
    code,
    purpose,
    expires_at: expiresAt,
    ip_address: ipAddress,
  }]);

  if (insertResult.error) throw insertResult.error;
}

function signProofToken(email, purpose, ttlMinutes) {
  const payload = Buffer.from(JSON.stringify({
    email,
    purpose,
    exp: Date.now() + ttlMinutes * 60 * 1000,
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', signupTokenSecret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

function verifyProofToken(token, expectedEmail, expectedPurpose) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', signupTokenSecret)
    .update(payload)
    .digest('base64url');

  if (signature.length !== expectedSignature.length) return false;

  const isValidSignature = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!isValidSignature) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed?.purpose === expectedPurpose
      && parsed?.email === expectedEmail
      && Number(parsed?.exp || 0) > Date.now();
  } catch {
    return false;
  }
}

function getIsoDateToday() {
  return new Date().toISOString().slice(0, 10);
}

function updateStreakPreferences(preferences = {}) {
  const nextPreferences = { ...preferences };
  const currentStreak = preferences?.streak || {};
  const history = Array.isArray(currentStreak.history) ? currentStreak.history : [];
  const today = getIsoDateToday();
  const lastDate = currentStreak.last_date;

  let current = Number(currentStreak.current || 0);
  const longest = Number(currentStreak.longest || 0);

  if (lastDate === today) {
    nextPreferences.streak = {
      ...currentStreak,
      current,
      longest: Math.max(longest, current),
      last_date: today,
      history: Array.from(new Set([...history, today])).sort(),
    };
    return nextPreferences;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);

  current = lastDate === yesterdayIso ? current + 1 : 1;

  nextPreferences.streak = {
    ...currentStreak,
    current,
    longest: Math.max(longest, current),
    last_date: today,
    history: Array.from(new Set([...history, today])).sort(),
  };

  return nextPreferences;
}

// --- 1. REQUEST OTP ---
exports.requestSignupOtp = async (req, res) => {
  try {
    const parsed = parseSchema(emailSchema, req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { email } = parsed.data;

    const { data: existingUser, error: userError } = await getProfileByEmail(email, 'id');

    if (userError) throw userError;
    if (existingUser) return res.status(400).json({ error: 'Email is already registered' });

    const plainOtp = generateOTP();
    const hashedOtp = await bcrypt.hash(plainOtp, 10);
    const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60000);

    await replaceOtpCode({
      email,
      code: hashedOtp,
      purpose: 'signup',
      expiresAt,
      ipAddress: req.ip,
    });

    await sendAuthEmail({
      to: email,
      subject: 'Your Verso Verification Code',
      html: `
        <div style="font-family: sans-serif; text-align: center; padding: 20px;">
          <h2>Verify your email</h2>
          <p>Your 6-digit verification code is:</p>
          <h1 style="letter-spacing: 5px; color: #4F46E5;">${plainOtp}</h1>
          <p>This code will expire in ${otpExpiryMinutes} minutes.</p>
        </div>
      `,
      text: `Your Sharp Study verification code is ${plainOtp}. It expires in ${otpExpiryMinutes} minutes.`,
    });

    res.status(200).json({
      message: 'OTP sent successfully',
      expires_in_seconds: otpExpiryMinutes * 60,
    });
  } catch (error) {
    console.error('OTP Request Error:', error);
    if (req.body?.email) {
      await supabase.from('otp_codes').delete().eq('email', normalizeIdentifier(req.body.email)).eq('purpose', 'signup');
    }
    res.status(500).json({ error: 'Unable to send verification code right now. Please try again.' });
  }
};

// --- 2. VERIFY OTP ONLY ---
exports.verifySignupOtp = async (req, res) => {
  try {
    const parsed = parseSchema(otpVerificationSchema, req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { email, otp } = parsed.data;
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('purpose', 'signup')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) throw otpError;
    if (!otpRecord) return res.status(400).json({ error: 'No valid code found' });
    if (new Date() > new Date(otpRecord.expires_at)) return res.status(400).json({ error: 'Code expired' });

    const isOtpValid = await bcrypt.compare(otp, otpRecord.code);
    if (!isOtpValid) return res.status(400).json({ error: 'Invalid code' });

    await supabase.from('otp_codes').delete().eq('email', email).eq('purpose', 'signup');

    res.status(200).json({
      message: 'OTP verified',
      signup_token: signProofToken(email, 'signup-complete', signupTokenTtlMinutes),
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

// --- 3. CHECK USERNAME AVAILABILITY ---
exports.checkUsername = async (req, res) => {
  try {
    const username = String(req.query.username || '').trim().toLowerCase();
    if (!username) return res.status(400).json({ error: 'Username is required' });
    if (!usernamePattern.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters and contain only letters, numbers, _ . -' });
    }

    const { data: existingUser, error } = await getProfileByUsername(username, 'id');

    if (error) throw error;
    res.status(200).json({ available: !existingUser });
  } catch (error) {
    console.error('Username Check Error:', error);
    res.status(500).json({ error: 'Failed to check username' });
  }
};

// --- 4. COMPLETE SIGNUP ---
exports.completeSignup = async (req, res) => {
  try {
    const parsed = parseSchema(completeSignupSchema, req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const {
      password,
      first_name,
      middle_name = '',
      last_name,
      username,
      email,
      signup_token: signupToken,
    } = parsed.data;

    if (!verifyProofToken(signupToken, email, 'signup-complete')) {
      return res.status(403).json({ error: 'Email verification has expired. Please request a new code.' });
    }

    const { data: existingProfile, error: existingProfileError } = await getProfileByEmail(email, 'id');
    if (existingProfileError) throw existingProfileError;
    if (existingProfile) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const { data: existingUsername, error: usernameError } = await getProfileByUsername(username, 'id');
    if (usernameError) throw usernameError;
    if (existingUsername) {
      return res.status(409).json({ error: 'This username is already taken.' });
    }

    // 1. Create the Auth Identity in Supabase
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email, 
      password, 
      email_confirm: true
    });

    // Handle case where user might already be in Auth table but failed at profile step
    if (authError) {
      if (authError.message.toLowerCase().includes('already registered')) {
        console.log(`Auth user already exists for ${email}. Proceeding to fix profile.`);
      } else {
        throw authError;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Get the ID (either from the new user or existing auth user)
    let userId = authUser?.user?.id;
    if (!userId) {
       const { data: existingAuth } = await supabase.auth.admin.listUsers();
       userId = existingAuth.users.find(u => u.email === email)?.id;
    }

    if (!userId) {
      return res.status(409).json({ error: 'A matching auth account could not be recovered. Please try signing up again.' });
    }

    // 2. Use .upsert() to overwrite any "ghost" profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email,
        username,
        first_name,
        middle_name,
        last_name,
        full_name: `${first_name} ${last_name}`.trim(),
        password_hash: hashedPassword,
        role: 'student'
      }, { onConflict: 'id' });

    if (profileError) throw profileError;

    // 3. Clean up OTP
    await supabase.from('otp_codes').delete().eq('email', email).eq('purpose', 'signup');
    
    res.status(201).json({ message: 'Account created successfully!' });
  } catch (error) {
    console.error('Complete Signup Error:', error);
    res.status(500).json({ error: 'Final registration step failed. Please try again.' });
  }
};

// --- 5. LOGIN (FINAL SECURE VERSION) ---
exports.login = async (req, res) => {
  try {
    const parsed = parseSchema(loginSchema, {
      identifier: req.body.identifier || req.body.email || req.body.username,
      password: req.body.password,
    });
    if (parsed.error) {
      return res.status(400).json({ error: 'Email/Username and Password are required' });
    }

    const { identifier, password } = parsed.data;

    const { data: user, error: userError } = await getProfileByIdentifier(
      identifier,
      'id, email, password_hash, is_blocked, username, preferences'
    );

    if (userError) throw userError;
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.is_blocked) return res.status(403).json({ error: 'Account is blocked' });

    // 3. Verify Password Hash
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Profile incomplete. Please sign up again.' });
    }

    // 4. Compare Password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 5. Sign in the user through Supabase so the frontend can store a valid auth session.
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (authError || !authData?.session) {
      console.error('Supabase sign-in failed during login:', authError?.message || authError);
      return res.status(500).json({ error: 'Failed to create auth session. Please try again.' });
    }

    await supabase.from('login_attempts').insert([{ 
      email: user.email, 
      ip_address: req.ip, 
      succeeded: true 
    }]);

    const nextPreferences = updateStreakPreferences(user.preferences || {});
    await supabase
      .from('profiles')
      .update({ preferences: nextPreferences })
      .eq('id', user.id);

    res.status(200).json({
      message: 'Login successful',
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      user: { id: user.id, email: user.email, username: user.username }
    });
  } catch (error) {
    console.error('Login Error:', error); // We keep this for debugging crashes
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- 6. REQUEST PASSWORD RESET OTP ---
exports.requestPasswordReset = async (req, res) => {
  try {
    const parsed = parseSchema(resetRequestSchema, {
      identifier: req.body.identifier || req.body.email,
    });
    if (parsed.error) return res.status(400).json({ error: 'Email or username is required' });

    const { data: user, error: userError } = await getProfileByIdentifier(parsed.data.identifier, 'id, email');

    if (userError) throw userError;
    if (!user) return res.status(404).json({ error: 'No account found with those details.' });

    // 3. Generate and save OTP using the user's ACTUAL email from the database
    const plainOtp = generateOTP();
    const hashedOtp = await bcrypt.hash(plainOtp, 10);
    const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60000);

    await replaceOtpCode({
      email: user.email,
      code: hashedOtp,
      purpose: 'password_reset',
      expiresAt,
      ipAddress: req.ip,
    });

    // 4. Send Email
    await sendAuthEmail({
      to: user.email,
      subject: 'Password Reset Code',
      html: `
        <div style="font-family: sans-serif; text-align: center; padding: 20px;">
          <h2>Reset Your Password</h2>
          <p>Your 6-digit password reset code is:</p>
          <h1 style="letter-spacing: 5px; color: #E53E3E;">${plainOtp}</h1>
          <p>This code will expire in ${otpExpiryMinutes} minutes.</p>
        </div>
      `,
      text: `Your Sharp Study password reset code is ${plainOtp}. It expires in ${otpExpiryMinutes} minutes.`,
    });

    res.status(200).json({ message: 'Reset OTP sent successfully' });
  } catch (error) {
    console.error('Password Reset OTP Error:', error);
    if (req.body?.identifier || req.body?.email) {
      const { data: user } = await getProfileByIdentifier(req.body.identifier || req.body.email, 'email');
      if (user?.email) {
        await supabase.from('otp_codes').delete().eq('email', user.email).eq('purpose', 'password_reset');
      }
    }
    res.status(500).json({ error: 'Unable to send reset code right now. Please try again.' });
  }
};

// --- 7. VERIFY RESET OTP ---
exports.verifyResetOtp = async (req, res) => {
  try {
    const otp = String(req.body.otp || '').trim();
    const identifier = normalizeIdentifier(req.body.email);
    if (!identifier) return res.status(400).json({ error: 'Email or username missing' });
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'OTP must be 6 digits' });

    const { data: user, error: userError } = await getProfileByIdentifier(identifier, 'email');

    if (userError) throw userError;
    if (!user) return res.status(400).json({ error: 'User not found' });

    const realEmail = user.email;

    // 2. Look for the OTP using the REAL email
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', realEmail)
      .eq('purpose', 'password_reset')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) throw otpError;
    if (!otpRecord) return res.status(400).json({ error: 'No valid code found' });
    if (new Date() > new Date(otpRecord.expires_at)) return res.status(400).json({ error: 'Code expired' });

    const isOtpValid = await bcrypt.compare(otp, otpRecord.code);
    if (!isOtpValid) return res.status(400).json({ error: 'Invalid code' });

    await supabase.from('otp_codes').delete().eq('email', realEmail).eq('purpose', 'password_reset');

    res.status(200).json({
      message: 'OTP verified',
      reset_token: signProofToken(realEmail, 'password-reset', resetTokenTtlMinutes),
    });
  } catch (error) {
    console.error('Verify Reset OTP Error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

// --- 8. FINALIZE PASSWORD RESET ---
exports.resetPassword = async (req, res) => {
  try {
    const parsed = parseSchema(resetSchema, {
      identifier: req.body.email || req.body.identifier,
      reset_token: req.body.reset_token,
      password: req.body.password || req.body.newPassword,
    });
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const { identifier, password: rawPassword, reset_token: resetToken } = parsed.data;

    const { data: profile, error: userError } = await getProfileByIdentifier(identifier, 'id, email');

    if (userError) throw userError;
    if (!profile) return res.status(404).json({ error: 'User not found' });
    if (!verifyProofToken(resetToken, profile.email, 'password-reset')) {
      return res.status(403).json({ error: 'Reset verification has expired. Please request a new code.' });
    }

    // 3. Hash the new password
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    // 4. Update Supabase Auth Vault
    const { error: authError } = await supabase.auth.admin.updateUserById(
      profile.id,
      { password: rawPassword }
    );
    if (authError) throw authError;

    // 5. Update your profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ password_hash: hashedPassword })
      .eq('id', profile.id);

    if (profileError) throw profileError;

    // 6. Clean up old OTPs using the real email
    await supabase.from('otp_codes').delete().eq('email', profile.email).eq('purpose', 'password_reset');

    res.status(200).json({ message: 'Password reset successfully!' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (newPassword.length < 12) {
      return res.status(400).json({ error: 'New password must be at least 12 characters long.' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('password_hash')
      .eq('id', req.user.id)
      .single();

    if (profileError) throw profileError;
    if (!profile?.password_hash) {
      return res.status(400).json({ error: 'Password data is not available for this account.' });
    }

    const isCurrentMatch = await bcrypt.compare(currentPassword, profile.password_hash);
    if (!isCurrentMatch) {
      return res.status(400).json({ error: 'Your current password is incorrect.' });
    }

    const isSameAsCurrent = await bcrypt.compare(newPassword, profile.password_hash);
    if (isSameAsCurrent) {
      return res.status(400).json({ error: 'Choose a new password that is different from your current password.' });
    }

    const { data: passwordHistory, error: historyError } = await supabase
      .from('password_history')
      .select('password_hash')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(8);

    if (historyError) throw historyError;

    for (const entry of passwordHistory || []) {
      const wasUsedBefore = await bcrypt.compare(newPassword, entry.password_hash);
      if (wasUsedBefore) {
        return res.status(400).json({ error: 'Please choose a password you have not used before.' });
      }
    }

    const nextHash = await bcrypt.hash(newPassword, 12);

    const { error: authError } = await supabase.auth.admin.updateUserById(req.user.id, {
      password: newPassword,
    });
    if (authError) throw authError;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ password_hash: nextHash })
      .eq('id', req.user.id);
    if (updateError) throw updateError;

    const { error: historyInsertError } = await supabase
      .from('password_history')
      .insert({ user_id: req.user.id, password_hash: nextHash });
    if (historyInsertError) throw historyInsertError;

    res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ error: 'Failed to update password.' });
  }
};

exports.resendEmailVerification = async (req, res) => {
  try {
    if (req.user.email_confirmed_at) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'Your email is already verified.',
      });
    }

    const resendOptions = {};
    if (process.env.APP_URL) {
      resendOptions.emailRedirectTo = `${process.env.APP_URL.replace(/\/$/, '')}/login`;
    }

    const { error } = await supabaseAuth.auth.resend({
      type: 'signup',
      email: req.user.email,
      options: resendOptions,
    });

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Verification email sent successfully.',
    });
  } catch (error) {
    console.error('Resend Email Verification Error:', error);
    res.status(500).json({ error: 'Failed to send verification email.' });
  }
};
