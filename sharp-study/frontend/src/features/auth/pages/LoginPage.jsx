import { useSearchParams } from 'react-router-dom';
import AuthLayout from '../shared/components/AuthLayout';
import LoginForm  from '../login/components/LoginForm';

export default function LoginPage() {
  const [params] = useSearchParams();
  const timedOut = params.get('reason') === 'timeout';

  return (
    <AuthLayout>
      <LoginForm sessionTimeout={timedOut} />
    </AuthLayout>
  );
}