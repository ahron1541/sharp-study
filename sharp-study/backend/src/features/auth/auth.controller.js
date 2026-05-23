const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const dns = require('dns');
const net = require('net');
const { z } = require('zod');
const { getCache, setCache } = require('../../utils/cache');
const {
  USERNAME_RULE_MESSAGE,
  normalizeUsername,
  getUsernameValidationError,
  isValidUsername,
} = require('../../utils/usernamePolicy');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const emailProvider = String(
  process.env.EMAIL_PROVIDER || (
    process.env.NODE_ENV === 'production'
      ? process.env.BREVO_API_KEY ? 'brevo' : 'resend'
      : process.env.BREVO_API_KEY ? 'brevo' : process.env.RESEND_API_KEY ? 'resend' : process.env.EMAIL_USER ? 'smtp' : 'log'
  )
).trim().toLowerCase();
const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const signupTokenTtlMinutes = Number(process.env.SIGNUP_TOKEN_TTL_MINUTES || 20);
const resetTokenTtlMinutes = Number(process.env.RESET_TOKEN_TTL_MINUTES || 20);
const signupTokenSecret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
const namePattern = /^[A-Za-z][A-Za-z' -]{0,48}$/;
const minPasswordLength = 8;
const minPasswordScore = 4;

console.info('[Auth Email] Provider configuration', {
  provider: emailProvider,
  hasBrevoKey: Boolean(process.env.BREVO_API_KEY),
  hasResendKey: Boolean(process.env.RESEND_API_KEY),
  hasSmtpUser: Boolean(process.env.EMAIL_USER),
  hasSmtpPassword: Boolean(process.env.EMAIL_APP_PASSWORD),
  fromAddress: process.env.EMAIL_FROM || process.env.BREVO_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || null,
});

const emailSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

const otpVerificationSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

function getPasswordScore(password = '') {
  return [
    password.length >= 12,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
}

const passwordSchema = z.string()
  .min(minPasswordLength, `Password must be at least ${minPasswordLength} characters long`)
  .max(128)
  .refine(
    (value) => getPasswordScore(value) >= minPasswordScore,
    `Password must pass at least ${minPasswordScore} strength checks`
  );

const completeSignupSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  signup_token: z.string().min(20),
  first_name: z.string().trim().min(1).max(50).regex(namePattern, 'Invalid first name'),
  middle_name: z.string().trim().max(50).regex(/^[A-Za-z' -]*$/, 'Invalid middle name').optional().or(z.literal('')),
  last_name: z.string().trim().min(1).max(50).regex(namePattern, 'Invalid last name'),
  username: z.string()
    .trim()
    .transform(normalizeUsername)
    .refine(isValidUsername, USERNAME_RULE_MESSAGE),
  password: passwordSchema,
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
  password: passwordSchema,
});

let smtpTransporterPromise = null;

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
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

async function getProfileByEmail(email, columns) {
  return supabase
    .from('profiles')
    .select(columns)
    .eq('email', email)
    .maybeSingle();
}

async function getProfileByUsername(username, columns) {
  const normalized = normalizeUsername(username);
  return supabase
    .from('profiles')
    .select(columns)
    .eq('username', normalized)
    .maybeSingle();
}

async function getProfileByIdentifier(identifier, columns) {
  const normalized = normalizeIdentifier(identifier);
  return normalized.includes('@')
    ? getProfileByEmail(normalized, columns)
    : getProfileByUsername(normalized, columns);
}

async function getPasswordReuseError(userId, newPassword, currentHash = null) {
  if (currentHash) {
    const isSameAsCurrent = await bcrypt.compare(newPassword, currentHash);
    if (isSameAsCurrent) {
      return 'Choose a new password that is different from your current password.';
    }
  }

  const { data: passwordHistory, error: historyError } = await supabase
    .from('password_history')
    .select('password_hash')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(8);

  if (historyError) throw historyError;

  for (const entry of passwordHistory || []) {
    const wasUsedBefore = await bcrypt.compare(newPassword, entry.password_hash);
    if (wasUsedBefore) {
      return 'Please choose a password you have not used before.';
    }
  }

  return null;
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

async function resolveSmtpHost(hostname) {
  if (!hostname || net.isIP(hostname)) {
    return { host: hostname, servername: hostname };
  }

  try {
    const ipv4Addresses = await dns.promises.resolve4(hostname);
    if (ipv4Addresses.length > 0) {
      return { host: ipv4Addresses[0], servername: hostname };
    }
  } catch (error) {
    console.warn(`SMTP IPv4 resolution failed for ${hostname}:`, error.message);
  }

  return { host: hostname, servername: hostname };
}

async function buildSmtpTransporter() {
  if (smtpTransporterPromise) return smtpTransporterPromise;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    throw new Error('SMTP credentials are not configured');
  }

  smtpTransporterPromise = (async () => {
    const port = Number(process.env.SMTP_PORT || 587);
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const resolvedHost = await resolveSmtpHost(smtpHost);

    return nodemailer.createTransport({
      host: resolvedHost.host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
      disableFileAccess: true,
      disableUrlAccess: true,
      tls: {
        servername: resolvedHost.servername,
        minVersion: 'TLSv1.2',
      },
    });
  })();

  try {
    return await smtpTransporterPromise;
  } catch (error) {
    smtpTransporterPromise = null;
    throw error;
  }
}

function getEmailFromAddress() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (emailProvider === 'brevo') return process.env.BREVO_FROM_EMAIL || process.env.EMAIL_USER;
  if (emailProvider === 'resend') return process.env.RESEND_FROM_EMAIL || 'Sharp Study <onboarding@resend.dev>';
  return `"Sharp Study" <${process.env.EMAIL_USER}>`;
}

function parseEmailAddress(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(.*)<([^>]+)>$/);
  if (!match) {
    return {
      name: process.env.BREVO_FROM_NAME || process.env.EMAIL_FROM_NAME || 'Sharp Study',
      email: raw,
    };
  }

  return {
    name: match[1].trim().replace(/^"|"$/g, '') || 'Sharp Study',
    email: match[2].trim(),
  };
}

function mapEmailProviderError(error, provider) {
  const message = String(error?.message || error || '').toLowerCase();

  if (provider === 'brevo') {
    if (message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
      return 'Brevo is not configured correctly. Check BREVO_API_KEY in Render.';
    }
    if (message.includes('sender') || message.includes('from')) {
      return 'Brevo sender is not verified. Verify BREVO_FROM_EMAIL in Brevo, then redeploy.';
    }
    return 'Brevo could not send the email. Check your Brevo transactional sender and API key.';
  }

  if (provider === 'resend') {
    if (message.includes('api key')) {
      return 'Resend is not configured correctly. Check RESEND_API_KEY in Render.';
    }
    if (message.includes('verify a domain') || message.includes('verified domain') || message.includes('from address')) {
      return 'Resend sender is not verified. Set RESEND_FROM_EMAIL to a verified sender or use onboarding@resend.dev for testing.';
    }
    if (message.includes('testing emails') || message.includes('test emails')) {
      return 'Resend test mode can only send to your own Resend account email. Verify a sending domain to email other users.';
    }
    return 'Resend could not send the email. Check your Render RESEND_API_KEY and RESEND_FROM_EMAIL settings.';
  }

  if (provider === 'smtp') {
    if (message.includes('enetunreach') || message.includes('etimedout') || message.includes('timeout')) {
      return 'SMTP is blocked or unreachable from Render. Use Resend for deployed OTP delivery.';
    }
    return 'SMTP could not send the email. Check your SMTP host, port, and app password.';
  }

  if (provider === 'log') {
    return 'Email delivery is set to log mode. Configure a real email provider to send OTPs.';
  }

  return 'Email delivery is not configured.';
}

async function sendAuthEmail({ to, subject, html, text }) {
  if (emailProvider === 'log') {
    console.info(`[Auth Email] Email provider is set to log. OTP email to ${to} was not sent.`);
    return;
  }

  if (emailProvider === 'brevo') {
    if (!process.env.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY is missing.');
    }

    const sender = parseEmailAddress(getEmailFromAddress());
    if (!sender.email) {
      throw new Error('BREVO_FROM_EMAIL is missing.');
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || data.code || `Brevo email failed with status ${response.status}`);
    }

    return;
  }

  if (emailProvider === 'resend') {
    if (!resend) {
      throw new Error('RESEND_API_KEY is missing.');
    }

    const { error } = await resend.emails.send({
      from: getEmailFromAddress(),
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

  if (emailProvider === 'smtp') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP delivery is disabled in production. Configure BREVO_API_KEY and EMAIL_PROVIDER=brevo.');
    }

    try {
      const transporter = await buildSmtpTransporter();
      await transporter.sendMail({
        from: getEmailFromAddress(),
        to,
        subject,
        html,
        text,
      });
    } catch (error) {
      smtpTransporterPromise = null;
      throw error;
    }
    return;
  }

  throw new Error(`Unsupported EMAIL_PROVIDER value: ${emailProvider}`);
}

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
      subject: 'Your Sharp Study Verification Code',
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
      delivery: 'email',
    });
  } catch (error) {
    console.error('OTP Request Error:', error);
    if (req.body?.email) {
      await supabase.from('otp_codes').delete().eq('email', normalizeIdentifier(req.body.email)).eq('purpose', 'signup');
    }
    res.status(500).json({ error: mapEmailProviderError(error, emailProvider) });
  }
};

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

exports.checkUsername = async (req, res) => {
  try {
    const username = normalizeUsername(req.query.username);
    if (!username) return res.status(400).json({ error: 'Username is required' });

    const usernameError = getUsernameValidationError(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }

    const cacheKey = `auth:username:${username}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return res.status(200).json({ available: cached.available });
    }

    const { data: existingUser, error } = await getProfileByUsername(username, 'id');
    if (error) throw error;

    const available = !existingUser;
    setCache(cacheKey, { available }, 30);

    res.status(200).json({ available });
  } catch (error) {
    console.error('Username Check Error:', error);
    res.status(500).json({ error: 'Failed to check username' });
  }
};

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
    if (existingProfile) return res.status(409).json({ error: 'Email is already registered' });

    const { data: existingUsername, error: usernameError } = await getProfileByUsername(username, 'id');
    if (usernameError) throw usernameError;
    if (existingUsername) {
      setCache(`auth:username:${username}`, { available: false }, 30);
      return res.status(409).json({ error: 'This username is already taken.' });
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.toLowerCase().includes('already registered')) {
        console.info('Auth user already exists during signup completion. Attempting profile recovery.');
      } else {
        throw authError;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    let userId = authUser?.user?.id;

    if (!userId) {
      const { data: existingAuth } = await supabase.auth.admin.listUsers();
      userId = existingAuth.users.find((user) => user.email === email)?.id;
    }

    if (!userId) {
      return res.status(409).json({ error: 'A matching auth account could not be recovered. Please try signing up again.' });
    }

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
        role: 'student',
      }, { onConflict: 'id' });

    if (profileError) throw profileError;

    setCache(`auth:username:${username}`, { available: false }, 30);
    await supabase.from('otp_codes').delete().eq('email', email).eq('purpose', 'signup');
    res.status(201).json({ message: 'Account created successfully!' });
  } catch (error) {
    console.error('Complete Signup Error:', error);
    res.status(500).json({ error: 'Final registration step failed. Please try again.' });
  }
};

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
      'id, email, password_hash, is_blocked, username'
    );

    if (userError) throw userError;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.is_blocked) return res.status(403).json({ error: 'Account is blocked' });
    if (!user.password_hash) return res.status(401).json({ error: 'Profile incomplete. Please sign up again.' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

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
      succeeded: true,
    }]);

    res.status(200).json({
      message: 'Login successful',
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.requestPasswordReset = async (req, res) => {
  try {
    const parsed = parseSchema(resetRequestSchema, {
      identifier: req.body.identifier || req.body.email,
    });
    if (parsed.error) return res.status(400).json({ error: 'Email or username is required' });

    const { data: user, error: userError } = await getProfileByIdentifier(parsed.data.identifier, 'id, email');
    if (userError) throw userError;
    if (!user) return res.status(404).json({ error: 'No account found with those details.' });

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

    await sendAuthEmail({
      to: user.email,
      subject: 'Sharp Study Password Reset Code',
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

    res.status(200).json({ message: 'Reset OTP sent successfully', delivery: 'email' });
  } catch (error) {
    console.error('Password Reset OTP Error:', error);
    if (req.body?.identifier || req.body?.email) {
      const { data: user } = await getProfileByIdentifier(req.body.identifier || req.body.email, 'email');
      if (user?.email) {
        await supabase.from('otp_codes').delete().eq('email', user.email).eq('purpose', 'password_reset');
      }
    }
    res.status(500).json({ error: mapEmailProviderError(error, emailProvider) });
  }
};

exports.verifyResetOtp = async (req, res) => {
  try {
    const otp = String(req.body.otp || '').trim();
    const identifier = normalizeIdentifier(req.body.email);
    if (!identifier) return res.status(400).json({ error: 'Email or username missing' });
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'OTP must be 6 digits' });

    const { data: user, error: userError } = await getProfileByIdentifier(identifier, 'email');
    if (userError) throw userError;
    if (!user) return res.status(400).json({ error: 'User not found' });

    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', user.email)
      .eq('purpose', 'password_reset')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) throw otpError;
    if (!otpRecord) return res.status(400).json({ error: 'No valid code found' });
    if (new Date() > new Date(otpRecord.expires_at)) return res.status(400).json({ error: 'Code expired' });

    const isOtpValid = await bcrypt.compare(otp, otpRecord.code);
    if (!isOtpValid) return res.status(400).json({ error: 'Invalid code' });

    await supabase.from('otp_codes').delete().eq('email', user.email).eq('purpose', 'password_reset');

    res.status(200).json({
      message: 'OTP verified',
      reset_token: signProofToken(user.email, 'password-reset', resetTokenTtlMinutes),
    });
  } catch (error) {
    console.error('Verify Reset OTP Error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const parsed = parseSchema(resetSchema, {
      identifier: req.body.email || req.body.identifier,
      reset_token: req.body.reset_token,
      password: req.body.password || req.body.newPassword,
    });
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const { identifier, password: rawPassword, reset_token: resetToken } = parsed.data;
    const { data: profile, error: userError } = await getProfileByIdentifier(identifier, 'id, email, password_hash');
    if (userError) throw userError;
    if (!profile) return res.status(404).json({ error: 'User not found' });
    if (!verifyProofToken(resetToken, profile.email, 'password-reset')) {
      return res.status(403).json({ error: 'Reset verification has expired. Please request a new code.' });
    }

    const reuseError = await getPasswordReuseError(profile.id, rawPassword, profile.password_hash);
    if (reuseError) return res.status(400).json({ error: reuseError });

    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const { error: authError } = await supabase.auth.admin.updateUserById(profile.id, { password: rawPassword });
    if (authError) throw authError;

    const { error: profileError } = await supabase.from('profiles').update({ password_hash: hashedPassword }).eq('id', profile.id);
    if (profileError) throw profileError;

    const { error: historyInsertError } = await supabase.from('password_history').insert({
      user_id: profile.id,
      password_hash: hashedPassword,
    });
    if (historyInsertError) throw historyInsertError;

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

    if (newPassword.length < minPasswordLength || getPasswordScore(newPassword) < minPasswordScore) {
      return res.status(400).json({
        error: `New password must be at least ${minPasswordLength} characters and pass ${minPasswordScore} strength checks.`,
      });
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

    const reuseError = await getPasswordReuseError(req.user.id, newPassword, profile.password_hash);
    if (reuseError) return res.status(400).json({ error: reuseError });

    const nextHash = await bcrypt.hash(newPassword, 12);

    const { error: authError } = await supabase.auth.admin.updateUserById(req.user.id, { password: newPassword });
    if (authError) throw authError;

    const { error: updateError } = await supabase.from('profiles').update({ password_hash: nextHash }).eq('id', req.user.id);
    if (updateError) throw updateError;

    const { error: historyInsertError } = await supabase.from('password_history').insert({
      user_id: req.user.id,
      password_hash: nextHash,
    });
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
