"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock3,
  Flame,
  RefreshCcw,
  Search,
  TimerReset,
  UtensilsCrossed,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type DisplayOrder = {
  order_id: number;
  order_number: string;
  table?: string | null;
  waiter?: string | null;
  status: string;
  age_minutes: number;
  tickets: Array<{
    id: number;
    status: string;
    item: string;
    quantity: number;
    note?: string | null;
  }>;
};

type DisplayData = {
  summary: {
    active: number;
    new: number;
    preparing: number;
    ready: number;
    delayed: number;
    avg_prep_minutes: number;
  };
  orders: DisplayOrder[];
};

type ApiResponse = { success: boolean; data?: DisplayData; message?: string };
type SortMode = "oldest" | "newest";

function statusLabel(status: string) {
  if (status === "new") return "New";
  if (status === "preparing") return "Preparing";
  if (status === "ready") return "Ready";
  if (status === "delayed") return "Delayed";
  return status.replaceAll("_", " ");
}

function statusClasses(status: string) {
  if (status === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "preparing") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "delayed") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function KitchenStaffDashboardPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("oldest");

  const query = useQuery({
    queryKey: ["kitchen-live-dashboard"],
    queryFn: async () => unwrap<ApiResponse>(await api.get("/kitchen/dashboard")),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const action = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "accept" | "ready" }) =>
      api.post(`/kitchen/tickets/${id}/${action}`),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["kitchen-live-dashboard"] }),
  });

  const data = query.data?.data;

  const orders = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();

    return data.orders
      .filter((order) => {
        const isDelayed = order.status === "delayed" || order.age_minutes > 20;
        const matchesStatus =
          status === "all" ||
          (status === "delayed" ? isDelayed : order.status === status);
        const matchesSearch =
          !term ||
          `${order.order_number} ${order.table ?? ""} ${order.waiter ?? ""} ${order.tickets
            .map((ticket) => ticket.item)
            .join(" ")}`
            .toLowerCase()
            .includes(term);

        return matchesStatus && matchesSearch;
      })
      .sort((a, b) =>
        sort === "oldest" ? b.age_minutes - a.age_minutes : a.age_minutes - b.age_minutes,
      );
  }, [data, status, search, sort]);

  if (query.isLoading && !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Kitchen dashboard could not be loaded</AlertTitle>
        <AlertDescription className="mt-2 flex items-center justify-between gap-3">
          <span>Please check the connection and try again.</span>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const summaryCards = [
    {
      label: "New Orders",
      value: data.summary.new,
      note: "Waiting to start",
      icon: UtensilsCrossed,
    },
    {
      label: "Preparing",
      value: data.summary.preparing,
      note: "Currently in kitchen",
      icon: Flame,
    },
    {
      label: "Ready to Serve",
      value: data.summary.ready,
      note: "Ready for pickup",
      icon: CheckCircle2,
    },
    {
      label: "Delayed",
      value: data.summary.delayed,
      note: "Needs attention",
      icon: AlertTriangle,
    },
  ];

  const filters = [
    ["all", `All ${data.summary.active}`],
    ["new", `New ${data.summary.new}`],
    ["preparing", `Preparing ${data.summary.preparing}`],
    ["ready", `Ready ${data.summary.ready}`],
    ["delayed", `Delayed ${data.summary.delayed}`],
  ];

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-muted/40">
                <ChefHat className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">Kitchen Operations</h1>
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  >
                    <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                    Live
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage food preparation from new order to ready-to-serve.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[11px] leading-none text-muted-foreground">Average prep</p>
                <p className="mt-1 text-sm font-semibold">{data.summary.avg_prep_minutes} min</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              className="rounded-xl"
            >
              <RefreshCcw
                className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, note, icon: Icon }) => (
          <Card key={label} className="rounded-2xl shadow-sm">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{note}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border bg-muted/30">
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="space-y-4 border-b p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">Kitchen Order Queue</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Only kitchen items from orders available to the kitchen are shown here.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="w-full rounded-xl pl-9 sm:w-[250px]"
                  placeholder="Search order, table, waiter..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="flex rounded-xl border bg-background p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={sort === "oldest" ? "secondary" : "ghost"}
                  className="rounded-lg"
                  onClick={() => setSort("oldest")}
                >
                  Oldest first
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={sort === "newest" ? "secondary" : "ghost"}
                  className="rounded-lg"
                  onClick={() => setSort("newest")}
                >
                  Newest
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={status === value ? "default" : "outline"}
                className="rounded-xl"
                onClick={() => setStatus(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-5">
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {orders.map((order) => {
              const delayed = order.status === "delayed" || order.age_minutes > 20;
              const pendingTickets = order.tickets.filter((ticket) =>
                ["pending", "confirmed"].includes(ticket.status),
              );
              const preparingTickets = order.tickets.filter(
                (ticket) => ticket.status === "preparing",
              );

              return (
                <Card
                  key={order.order_id}
                  className={`overflow-hidden rounded-2xl shadow-none ${
                    delayed ? "border-red-300" : ""
                  }`}
                >
                  <div
                    className={`h-1 ${
                      delayed
                        ? "bg-red-500"
                        : order.status === "ready"
                          ? "bg-emerald-500"
                          : order.status === "preparing"
                            ? "bg-amber-500"
                            : "bg-slate-300"
                    }`}
                  />
                  <CardContent className="p-0">
                    <div className="border-b p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-bold">{order.order_number}</h2>
                            <Badge
                              variant="outline"
                              className={`capitalize ${statusClasses(
                                delayed ? "delayed" : order.status,
                              )}`}
                            >
                              {delayed ? "Delayed" : statusLabel(order.status)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Table: <span className="font-medium text-foreground">{order.table ?? "—"}</span>
                            <span className="mx-2">•</span>
                            Waiter: <span className="font-medium text-foreground">{order.waiter ?? "—"}</span>
                          </p>
                        </div>

                        <div
                          className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm font-semibold ${
                            delayed ? "border-red-200 bg-red-50 text-red-700" : "bg-muted/30"
                          }`}
                        >
                          <Clock3 className="h-4 w-4" />
                          {order.age_minutes}m
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Kitchen items
                      </p>
                      {order.tickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="rounded-xl border bg-muted/10 px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold">
                                <span className="mr-2 inline-flex min-w-7 justify-center rounded-md bg-foreground px-1.5 py-0.5 text-xs text-background">
                                  {ticket.quantity}×
                                </span>
                                {ticket.item}
                              </p>
                              {ticket.note && (
                                <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                                  <span className="font-semibold">Note:</span> {ticket.note}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="shrink-0 capitalize">
                              {statusLabel(ticket.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>

                    {delayed && (
                      <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                        Preparation time is over 20 minutes.
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 border-t bg-muted/10 p-4">
                      {pendingTickets.map((ticket) => (
                        <Button
                          key={`accept-${ticket.id}`}
                          size="sm"
                          className="rounded-xl"
                          disabled={action.isPending}
                          onClick={() => action.mutate({ id: ticket.id, action: "accept" })}
                        >
                          <Flame className="mr-2 h-4 w-4" />
                          Start {ticket.item}
                        </Button>
                      ))}

                      {preparingTickets.map((ticket) => (
                        <Button
                          key={`ready-${ticket.id}`}
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          disabled={action.isPending}
                          onClick={() => action.mutate({ id: ticket.id, action: "ready" })}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark {ticket.item} Ready
                        </Button>
                      ))}

                      {!pendingTickets.length && !preparingTickets.length && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4" />
                          No pending kitchen action for this order.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {!orders.length && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/10 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-background">
                <ChefHat className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-semibold">No kitchen orders found</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                There are no orders matching the selected status or search.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Active Orders", data.summary.active, UtensilsCrossed],
            ["New", data.summary.new, ChefHat],
            ["Preparing", data.summary.preparing, Flame],
            ["Ready", data.summary.ready, CheckCircle2],
            ["Delayed", data.summary.delayed, AlertTriangle],
            ["Avg Prep", `${data.summary.avg_prep_minutes} min`, TimerReset],
          ].map(([label, value, Icon]: any) => (
            <div key={String(label)} className="flex items-center gap-3 rounded-xl border p-3">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-lg font-bold">{value}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
