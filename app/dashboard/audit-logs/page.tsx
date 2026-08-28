"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuditLogsQuery } from "@/hooks/audit-log-management/use-audit-logs";

const PER_PAGE = 20;

export default function AuditLogsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo]);

  const query = useAuditLogsQuery({
    date_from: dateFrom,
    date_to: dateTo,
    page,
    per_page: PER_PAGE,
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const currentPage = meta?.current_page ?? page;
  const lastPage = Math.max(meta?.last_page ?? 1, 1);
  const total = meta?.total ?? rows.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Track system activity and security events.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Activity</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {total.toLocaleString()} audit {total === 1 ? "record" : "records"}
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">From date</label>
              <Input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">To date</label>
              <Input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-3 text-left font-semibold">Actor</th>
                  <th className="px-3 py-3 text-left font-semibold">Module</th>
                  <th className="px-3 py-3 text-left font-semibold">Action</th>
                  <th className="px-3 py-3 text-left font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {query.isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                      No audit logs found for the selected date range.
                    </td>
                  </tr>
                ) : (
                  rows.map((log) => {
                    const actor = log.user ?? log.actor;
                    const actorId = log.user_id ?? log.actor_id;

                    return (
                      <tr key={log.id} className="border-b last:border-0">
                        <td className="px-3 py-3 align-top">
                          <div className="font-medium">
                            {actor?.name ?? (actorId ? `User #${actorId}` : "System")}
                          </div>
                          {actor?.email ? (
                            <div className="text-xs text-muted-foreground">{actor.email}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-top">{log.module ?? log.entity_type ?? "—"}</td>
                        <td className="px-3 py-3 align-top">{log.action}</td>
                        <td className="px-3 py-3 align-top">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {lastPage}
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || query.isFetching}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= lastPage || query.isFetching}
                onClick={() => setPage((value) => Math.min(lastPage, value + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
