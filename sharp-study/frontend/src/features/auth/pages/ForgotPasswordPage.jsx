import AuthLayout         from '../shared/components/AuthLayout';
import ForgotPasswordFlow from '../forgot-password/components/ForgotPasswordFlow';

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <ForgotPasswordFlow />
    </AuthLayout>
  );
}