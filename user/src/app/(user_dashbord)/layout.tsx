import { Suspense } from "react";
import ChatbotWidget from "@/components/ChatbotWidget";
import TrialEndedDialog from "@/components/user_dashboard/billing/TrialEndedDialog";
import TrialStartedDialog from "@/components/user_dashboard/billing/TrialStartedDialog";
import AccessChangedDialog from "@/components/user_dashboard/billing/AccessChangedDialog";
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
      {/*
        Both read `useSearchParams` (for ?trialPreview=), which forces the
        route to opt out of static rendering unless it sits behind a Suspense
        boundary — `next build` fails on it even though `next dev` does not, so
        without this the first Vercel deploy would be the thing that found out.
        There is nothing to fall back to: neither renders anything until its
        fetch resolves.
      */}
      <Suspense fallback={null}>
        <TrialEndedDialog />
        {/* The other end of the same story: said once, when a trial begins, so
            people know they have one, when it runs out, and that confirming
            their email adds a week to it while it is still running. */}
        <TrialStartedDialog />
        {/* Free access granted, extended or shortened by an admin. Shown to
            every member: it changes what the workspace can do, not what one
            person pays. */}
        <AccessChangedDialog />
      </Suspense>
      <ChatbotWidget />
    </>
  );
}
