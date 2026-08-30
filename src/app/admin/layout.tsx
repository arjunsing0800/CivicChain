import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { AdminSidebar } from '@/components/layout/Navigation';

/** Admin workspace. Server-side role gate — never trust the client. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') {
    redirect(user.role === 'AUTHORITY' ? '/department/dashboard' : '/dashboard');
  }
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg">
      <AdminSidebar />
      <div className="lg:pl-64">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}