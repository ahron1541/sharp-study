const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Initialize Nodemailer with your Gmail credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// Helper: Generate a secure 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

exports.requestSignupOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // 1. Check if email is already taken in the profiles table
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // 2. Generate OTP & Hash it
    const plainOtp = generateOTP();
    const hashedOtp = await bcrypt.hash(plainOtp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

    // 3. Save to database
    const { error: dbError } = await supabase
      .from('otp_codes')
      .insert([{
        email,
        code: hashedOtp,
        purpose: 'signup',
        expires_at: expiresAt,
        ip_address: req.ip
      }]);

    if (dbError) throw dbError;

    // 4. Send Email via Nodemailer & Gmail
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

// Dummy exports to prevent crashing before we build the rest
exports.verifySignupAndCreateUser = async (req, res) => { res.status(501).json({ error: 'Not implemented yet' }); };
exports.login = async (req, res) => { res.status(501).json({ error: 'Not implemented yet' }); };