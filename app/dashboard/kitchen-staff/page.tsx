"use client";

import { ChefHat, ClipboardList, PackageCheck } from "lucide-react";
import { SecuredRoleDashboard } from "@/components/dashboards/secured-role-dashboard";

export default function KitchenStaffDashboardPage() {
  return <SecuredRoleDashboard roleKey="kitchen" title="Kitchen Staff Dashboard" description="Process kitchen tickets from acceptance through preparation, readiness, and service." endpoint="/kitchen/dashboard" icon={ChefHat} actions={[
    { label: "Kitchen Tickets", description: "Open the live kitchen preparation queue.", href: "/dashboard/modules/kitchen/tickets", icon: ClipboardList, permission: "kitchen.queue.read" },
    { label: "Preparing", description: "Review tickets currently being prepared.", href: "/dashboard/modules/kitchen/preparing", icon: ChefHat, permission: "kitchen.queue.read" },
    { label: "Ready Orders", description: "Review food ready for service.", href: "/dashboard/modules/kitchen/ready", icon: PackageCheck, permission: "kitchen.queue.read" },
  ]} />;
}
