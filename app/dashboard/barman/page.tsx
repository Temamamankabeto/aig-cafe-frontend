"use client";

import { ClipboardList, PackageCheck, Wine } from "lucide-react";
import { SecuredRoleDashboard } from "@/components/dashboards/secured-role-dashboard";

export default function BarmanDashboardPage() {
  return <SecuredRoleDashboard roleKey="bar" title="Barman Dashboard" description="Process beverage tickets from acceptance through preparation, readiness, and service." endpoint="/bar/dashboard" icon={Wine} actions={[
    { label: "Bar Tickets", description: "Open the live beverage preparation queue.", href: "/dashboard/modules/bar/tickets", icon: ClipboardList, permission: "bar.queue.read" },
    { label: "Preparing", description: "Review beverages currently being prepared.", href: "/dashboard/modules/bar/preparing", icon: Wine, permission: "bar.queue.read" },
    { label: "Ready Orders", description: "Review beverages ready for service.", href: "/dashboard/modules/bar/ready", icon: PackageCheck, permission: "bar.queue.read" },
  ]} />;
}
