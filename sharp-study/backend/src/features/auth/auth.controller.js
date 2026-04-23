// --- PHASE 2: VERIFY OTP & CREATE ACCOUNT ---
exports.verifySignupAndCreateUser = async (req, res) => {
  try {
    const { email, otp, password, firstName, middleName, lastName, username } = req.body;

    // 1. Verify the OTP from your custom otp_codes table
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('purpose', 'signup')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) return res.status(400).json({ error: 'No valid code found' });
    if (new Date() > new Date(otpRecord.expires_at)) return res.status(400).json({ error: 'Code expired' });

    const isOtpValid = await bcrypt.compare(otp, otpRecord.code);
    if (!isOtpValid) return res.status(400).json({ error: 'Invalid code' });

    // 2. Create the Identity in Supabase Auth (Requirement for your FK constraint)
    // We use the service role key to auto-confirm the user since we verified the OTP ourselves
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;

    // 3. Hash the password for your local profiles/history tables
    const hashedPassword = await bcrypt.hash(password, 12);

    // 4. Create the Public Profile using the ID from Step 2
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{
        id: authUser.user.id,
        email,
        username,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        password_hash: hashedPassword, // Ensure you added this column to SQL
        role: 'student'
      }]);

    if (profileError) throw profileError;

    // 5. Log the initial password in password_history (as per your schema)
    await supabase.from('password_history').insert([
      { user_id: authUser.user.id, password_hash: hashedPassword }
    ]);

    // 6. Cleanup
    await supabase.from('otp_codes').delete().eq('id', otpRecord.id);

    res.status(201).json({ message: 'Account created successfully!' });

  } catch (error) {
    console.error('Signup Verification Error:', error);
    res.status(500).json({ error: 'Failed to complete signup' });
  }
};

// --- PHASE 3: LOGIN ---
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check for account block/lockout (using your schema fields)
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, password_hash, is_blocked, locked_until')
      .eq('email', email)
      .single();

    if (userError || !user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.is_blocked) return res.status(403).json({ error: 'Account is blocked' });
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      return res.status(403).json({ error: 'Account temporarily locked' });
    }

    // 2. Verify Password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      // Logic for failed attempt (incrementing login_attempts in your schema)
      await supabase.rpc('increment_login_attempts', { user_id: user.id });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3. Log the successful attempt
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