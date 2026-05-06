require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function usage() {
  console.log('Usage: node scripts/create-admin.js <email> <password> <username> <first_name> <last_name> [middle_name]');
}

function validatePassword(password) {
  const checks = [
    { ok: password.length >= 8, message: 'at least 8 characters' },
    { ok: /[A-Z]/.test(password), message: 'one uppercase letter' },
    { ok: /[a-z]/.test(password), message: 'one lowercase letter' },
    { ok: /[0-9]/.test(password), message: 'one number' },
    { ok: /[^A-Za-z0-9]/.test(password), message: 'one special character' },
  ];

  const failed = checks.filter((check) => !check.ok).map((check) => check.message);
  return failed;
}

async function main() {
  const [, , emailArg, passwordArg, usernameArg, firstNameArg, lastNameArg, middleNameArg = ''] = process.argv;

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  }

  if (!emailArg || !passwordArg || !usernameArg || !firstNameArg || !lastNameArg) {
    usage();
    process.exitCode = 1;
    return;
  }

  const email = String(emailArg).trim().toLowerCase();
  const password = String(passwordArg);
  const username = String(usernameArg).trim().toLowerCase();
  const firstName = String(firstNameArg).trim();
  const lastName = String(lastNameArg).trim();
  const middleName = String(middleNameArg || '').trim();
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');

  const passwordIssues = validatePassword(password);
  if (passwordIssues.length) {
    throw new Error(`Weak password. Include ${passwordIssues.join(', ')}.`);
  }

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('id, email, role')
    .or(`email.eq.${email},username.eq.${username}`)
    .maybeSingle();

  if (existingProfileError) {
    throw existingProfileError;
  }

  if (existingProfile) {
    throw new Error(`A profile already exists for ${existingProfile.email}. Promote that account instead of creating a duplicate.`);
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      role: 'admin',
    },
  });

  if (authError || !authUser?.user?.id) {
    throw authError || new Error('Failed to create auth user.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: authUser.user.id,
      email,
      username,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      full_name: fullName,
      role: 'admin',
      is_blocked: false,
      password_hash: passwordHash,
    }, { onConflict: 'id' });

  if (profileError) {
    await supabase.auth.admin.deleteUser(authUser.user.id);
    throw profileError;
  }

  const { error: historyError } = await supabase
    .from('password_history')
    .insert({
      user_id: authUser.user.id,
      password_hash: passwordHash,
    });

  if (historyError) {
    console.warn('Admin account was created, but password_history insert failed:', historyError.message);
  }

  console.log('Admin account created successfully.');
  console.log(`Email: ${email}`);
  console.log(`Username: ${username}`);
  console.log(`Role: admin`);
  console.log(`User ID: ${authUser.user.id}`);
}

main().catch((error) => {
  console.error('Failed to create admin account:', error.message);
  process.exitCode = 1;
});
