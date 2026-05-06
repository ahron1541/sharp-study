import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import AuthLayout from '../shared/components/AuthLayout';
import LoginForm  from '../login/components/LoginForm';

export default function LoginPage() {
  const [params] = useSearchParams();
  const [authBusy, setAuthBusy] = useState({ active: false, label: '' });
  const timedOut = params.get('reason') === 'timeout';

  return (
    <AuthLayout busy={authBusy.active} busyLabel={authBusy.label || 'Preparing your dashboard...'}>
      <LoginForm sessionTimeout={timedOut} onBusyChange={setAuthBusy} />
    </AuthLayout>
  );
}
