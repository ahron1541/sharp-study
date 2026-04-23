import AuthLayout    from '../shared/components/AuthLayout';
import SignupStepper from '../signup/components/SignupStepper';

export default function RegisterPage() {
  return (
    <AuthLayout>
      <SignupStepper />
    </AuthLayout>
  );
}