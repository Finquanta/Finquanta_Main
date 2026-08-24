import ChatbotWidget from "@/components/ChatbotWidget";
import TrialEndedDialog from "@/components/user_dashboard/billing/TrialEndedDialog";
import DemoMigrationBanner from "@/components/demo/DemoMigrationBanner";

export default function UserDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* No-op unless the user just arrived from the Try-It Demo. */}
      <DemoMigrationBanner />
      {/* No-op unless a trial has just lapsed and nobody has been asked what
          to do about it. In the layout rather than on the dashboard page: a
          trial can lapse while somebody is sitting on Invoices or Reports, and
          the question should not wait for them to visit the home page. */}
      <TrialEndedDialog />
      <ChatbotWidget />
    </>
  );
}
