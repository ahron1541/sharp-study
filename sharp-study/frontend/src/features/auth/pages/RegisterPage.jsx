import AuthLayout    from '../shared/components/AuthLayout';
import SignupStepper from '../signup/components/SignupStepper';

const signupImage = 'https://cdn.undraw.co/illustrations/sign-up_qamz.svg';

export default function RegisterPage() {
  return (
    <AuthLayout
      imageSrc={signupImage}
      imageTitle="Create a calmer way to study."
      imageSubtitle="Set up your account, then turn difficult lessons into guides, cards, and quizzes."
    >
      <SignupStepper />
    </AuthLayout>
  );
}
