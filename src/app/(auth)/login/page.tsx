import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

function LoginFormWrapper() {
  return <LoginForm />;
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginFormWrapper />
      </Suspense>
    </div>
  );
}
