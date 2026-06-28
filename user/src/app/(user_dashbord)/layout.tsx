import ChatbotWidget from "@/components/ChatbotWidget";

export default function UserDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatbotWidget />
    </>
  );
}
