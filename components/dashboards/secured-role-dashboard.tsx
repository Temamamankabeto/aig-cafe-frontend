"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, RefreshCcw, type LucideIcon } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { authService } from "@/services/auth/auth.service";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardResponse = {
  success: boolean;
  message?: string;
  data?: {
    summary?: Record<string, string | number | null>;
  };
};

export type DashboardAction = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
};

type Props = {
  roleKey: string;
  title: string;
  description: string;
  endpoint: string;
  icon: LucideIcon;
  actions: DashboardAction[];
};

function labelFor(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function valueFor(key: string, value: string | number | null | undefined) {
  if (value == null) return "—";
  if (typeof value === "number" && /(sales|collection|amount|outstanding|spent)/i.test(key)) {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ETB`;
  }
  return typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : value;
}

export function SecuredRoleDashboard({ roleKey, title, description, endpoint, icon: RoleIcon, actions }: Props) {
  const permissions = authService.getStoredPermissions();
  const allowedActions = actions.filter((action) => !action.permission || permissions.includes(action.permission));
  const query = useQuery({
    queryKey: ["role-dashboard", roleKey],
    queryFn: async () => unwrap<DashboardResponse>(await api.get(endpoint)),
    staleTime: 30_000,
    retry: 1,
  });
  const summary = query.data?.data?.summary ?? {};

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary"><RoleIcon className="h-7 w-7" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh
        </Button>
      </section>

      {query.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Dashboard could not be loaded</AlertTitle>
          <AlertDescription>{query.error instanceof Error ? query.error.message : "Please try again."}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {query.isLoading
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)
          : Object.entries(summary).map(([key, value]) => (
              <Card key={key} className="rounded-2xl">
                <CardHeader className="pb-2"><CardDescription>{labelFor(key)}</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-bold tracking-tight">{valueFor(key, value)}</p></CardContent>
              </Card>
            ))}
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Quick actions</h2>
          <p className="text-sm text-muted-foreground">Only actions allowed by your assigned permissions are displayed.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {allowedActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.href} className="rounded-2xl transition hover:border-primary/40 hover:shadow-md">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <div className="rounded-xl bg-muted p-2"><Icon className="h-5 w-5" /></div>
                  <div className="space-y-1"><CardTitle className="text-base">{action.label}</CardTitle><CardDescription>{action.description}</CardDescription></div>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full"><Link href={action.href}>Open <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
