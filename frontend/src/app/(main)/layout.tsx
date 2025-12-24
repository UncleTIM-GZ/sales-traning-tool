import { Sidebar } from "@/components/ui/Sidebar";
import { Header } from "@/components/ui/Header";
import { MobileNav } from "@/components/ui/MobileNav";
import { AuthGuard } from "@/components/auth/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen w-full overflow-hidden">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden lg:flex h-full">
          <Sidebar />
        </div>

        <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-background-dark">
          <Header />
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8 pb-20 lg:pb-8">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 lg:gap-8">
              {children}
            </div>
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileNav />
      </div>
    </AuthGuard>
  );
}
