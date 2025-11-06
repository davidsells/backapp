import { auth } from '@/lib/auth/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { signOut } from '@/lib/auth/auth';
import { Button } from '@/components/ui/button';

async function SignOutButton() {
  return (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/login' });
      }}
    >
      <Button type="submit" variant="ghost" size="sm">
        Sign Out
      </Button>
    </form>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="text-xl font-bold">
              BackApp
            </Link>
            <nav className="flex space-x-6">
              <Link
                href="/dashboard"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                Dashboard
              </Link>
              <Link
                href="/configs"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                Configurations
              </Link>
              <Link
                href="/backups"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                Backups
              </Link>
              <Link
                href="/reports"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                Reports
              </Link>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              {session.user?.name || session.user?.email}
            </span>
            <Link href="/settings/profile">
              <Button variant="ghost" size="sm">
                Settings
              </Button>
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="container mx-auto p-6">{children}</main>
    </div>
  );
}
