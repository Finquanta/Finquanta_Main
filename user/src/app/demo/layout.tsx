import { DemoSessionProvider } from '@/lib/demo/DemoSessionProvider';
import DemoShell from '@/components/demo/DemoShell';
import ConfirmProvider from '@/components/user_dashboard/ConfirmProvider';

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoSessionProvider>
      <ConfirmProvider>
        <DemoShell>{children}</DemoShell>
      </ConfirmProvider>
    </DemoSessionProvider>
  );
}
