import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import AuthLayout from '../shared/components/AuthLayout';
import LoginForm  from '../login/components/LoginForm';

const loginImage = 'https://cdn.undraw.co/illustrations/secure-login_m11a.svg';

export default function LoginPage() {
  const [params] = useSearchParams();
  const [authBusy, setAuthBusy] = useState({ active: false, label: '' });
  const timedOut = params.get('reason') === 'timeout';

  return (
    <AuthLayout
      busy={authBusy.active}
      busyLabel={authBusy.label || 'Preparing your dashboard...'}
      imageSrc={loginImage}
      imageTitle="Welcome back to your study space."
      imageSubtitle="Pick up your guides, cards, quizzes, and progress where you left them."
    >
      <LoginForm sessionTimeout={timedOut} onBusyChange={setAuthBusy} />
    </AuthLayout>
  );
}
