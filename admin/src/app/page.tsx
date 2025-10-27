import Layout from "@/components/MainLayout";
import StatCard from "@/components/StatCard";
import RecentActivity, { ActivityItem } from "@/components/RecentActivity";
import Alerts, { Alert } from "@/components/Alerts";

// Mock data for Revenue chart
const revenueChartData = [
  { date: 'Jan 8', value: 4251 },
  { date: 'May 10', value: 3253 },
  { date: 'May 12', value: 3500 },
  { date: 'May 15', value: 4251 },
  { date: 'May 18', value: 3800 },
  { date: 'May 27', value: 4100 },
];

// Mock data for Userbase chart
const userbaseChartData = [
  { date: 'Jan 8', value: 3253 },
  { date: 'May 10', value: 3253 },
  { date: 'May 12', value: 3400 },
  { date: 'May 15', value: 3253 },
  { date: 'May 18', value: 3600 },
  { date: 'May 27', value: 3500 },
];

// Mock data for Recent Activity
const recentActivities: ActivityItem[] = [
  {
    id: '1',
    name: 'Mickey Mike',
    description: 'Unlocking intern',
    date: 'May 1, 2024',
    time: '08:00 AM',
    category: 'Support',
  },
  {
    id: '2',
    name: 'Hannah Noah',
    description: 'Unlocking intern',
    date: 'May 3, 2024',
    time: '09:00 AM',
    category: 'Content',
  },
  {
    id: '3',
    name: 'Kristin Watson',
    description: 'BD Manager',
    date: 'May 5, 2024',
    time: '08:08 AM',
    category: 'Content',
  },
  {
    id: '4',
    name: 'Cameron Williams',
    description: 'CEO',
    date: 'May 12, 2024',
    time: '08:00 AM',
    category: 'Finances',
  },
  {
    id: '5',
    name: 'Ahmad Ali',
    description: 'CTO',
    date: 'May 19, 2022',
    time: '08:00 AM',
    category: 'Security',
  },
];

// Mock data for Alerts
const alerts: Alert[] = [
  {
    id: '1',
    type: 'Bug',
    system: 'Fix Alert System',
    date: 'May 1, 2024',
    time: '08:00 AM',
  },
  {
    id: '2',
    type: 'Bug',
    system: 'Fix Alert System',
    date: 'May 1, 2024',
    time: '08:00 AM',
  },
  {
    id: '3',
    type: 'Bug',
    system: 'Fix Alert System',
    date: 'May 1, 2024',
    time: '08:00 AM',
  },
];

export default function Home() {
  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Revenue Card */}
            <StatCard
              title="Revenue"
              value="$22,135"
              subValue=".69"
              change="+23%"
              changeType="positive"
              period="vs last month"
              chartData={revenueChartData}
            />

            {/* Userbase Card */}
            <StatCard
              title="Userbase"
              value="24,263"
              subValue="Users"
              change="+23%"
              changeType="positive"
              period="vs last month"
              chartData={userbaseChartData}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Recent Activity */}
            <RecentActivity activities={recentActivities} />

            {/* Alerts */}
            <Alerts alerts={alerts} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
