import { DemoSessionProvider } from '@/lib/demo/DemoSessionProvider';
import DemoShell from '@/components/demo/DemoShell';

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoSessionProvider>
      <DemoShell>{children}</DemoShell>
    </DemoSessionProvider>
  );
}
