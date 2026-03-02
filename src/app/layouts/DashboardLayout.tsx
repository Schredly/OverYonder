import { Outlet } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Toaster } from '../components/ui/sonner';

export function DashboardLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}
