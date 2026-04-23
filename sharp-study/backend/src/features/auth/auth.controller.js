const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD },
});

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// --- 1. REQUEST OTP ---
exports.requestSignupOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const { data: existingUser, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (userError) throw userError;
    if (existingUser) return res.status(400).json({ error: 'Email is already registered' });

    const plainOtp = generateOTP();
    const hashedOtp = await bcrypt.hash(plainOtp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 mins

    const { error: dbError } = await supabase.from('otp_codes').insert([{
      email, code: hashedOtp, purpose: 'signup', expires_at: expiresAt, ip_address: req.ip
    }]);

    if (dbError) throw dbError;

    const mailOptions = {
      from: `"Sharp Study" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Sharp Study Verification Code',
      html: `
        <div style="font-family: sans-serif; text-align: center; padding: 20px;">
          <h2>Verify your email</h2>
          <p>Your 6-digit verification code is:</p>
          <h1 style="letter-spacing: 5px; color: #4F46E5;">${plainOtp}</h1>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('OTP Request Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- 2. VERIFY OTP ONLY ---
exports.verifySignupOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
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

    res.status(200).json({ message: 'OTP verified' });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

// --- 3. CHECK USERNAME AVAILABILITY ---
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    const { data: existingUser, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

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
    const { email, password, first_name, middle_name, last_name, username } = req.body;

    // 1. Create the Auth Identity
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email, 
      password, 
      email_confirm: true
    });

    // If email already exists in Auth, we handle that specifically
    if (authError) {
      if (authError.message.includes('already been registered')) {
        return res.status(400).json({ error: 'This email is already registered.' });
      }
      throw authError;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // 2. Use .upsert() instead of .insert() to handle potential trigger conflicts
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authUser.user.id,
        email,
        username,
        first_name,
        middle_name,
        last_name,
        full_name: `${first_name} ${last_name}`.trim(),
        password_hash: hashedPassword,
        role: 'student'
      }, { onConflict: 'id' }); // This tells Supabase: "If the ID exists, just update it"

    if (profileError) throw profileError;

    // 3. Clean up OTP
    await supabase.from('otp_codes').delete().eq('email', email).eq('purpose', 'signup');
    
    res.status(201).json({ message: 'Account created successfully!' });
  } catch (error) {
    console.error('Complete Signup Error:', error);
    res.status(500).json({ error: 'Internal server error during final setup.' });
  }
};

// --- 5. LOGIN ---
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, password_hash, is_blocked, locked_until')
      .eq('email', email)
      .maybeSingle();

    if (userError || !user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.is_blocked) return res.status(403).json({ error: 'Account is blocked' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    await supabase.from('login_attempts').insert([
      { email, ip_address: req.ip, succeeded: true }
    ]);

    res.status(200).json({
      message: 'Login successful',
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};