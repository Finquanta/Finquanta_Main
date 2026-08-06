import ChatbotWidget from "@/components/ChatbotWidget";
import DemoMigrationBanner from "@/components/demo/DemoMigrationBanner";

export default function UserDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* No-op unless the user just arrived from the Try-It Demo. */}
      <DemoMigrationBanner />
      <ChatbotWidget />
    </>
  );
}
