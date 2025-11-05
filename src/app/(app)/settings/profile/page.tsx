import { auth } from '@/lib/auth/auth';
import { authService } from '@/lib/auth/auth-service';
import { redirect } from 'next/navigation';
import { ProfileForm } from '@/components/settings/profile-form';
import { ChangePasswordForm } from '@/components/settings/change-password-form';

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await authService.getUserById(session.user.id);

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ProfileForm user={user} />
        <ChangePasswordForm />
      </div>
    </div>
  );
}
