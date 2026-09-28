'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RefreshCcw } from 'lucide-react';
import { complaintService } from '@/services/complaint-management/complaint.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const categories = ['Food Quality', 'Service Delay', 'Staff Behavior', 'Wrong Order', 'Missing Item', 'Billing/Payment', 'Cleanliness', 'Table/Facility', 'Delivery/Takeaway', 'Product Quality', 'Safety', 'Other'];
const statuses = ['new', 'acknowledged', 'assigned', 'in_progress', 'resolved', 'closed', 'reopened'];
const priorities = ['low', 'medium', 'high', 'critical'];

const emptyReport = { rows: [], by_category: [], by_status: [], by_priority: [], by_department: [] };
const label = (value: unknown) => String(value ?? 'Unspecified').replaceAll('_', ' ');
const dateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString() : '—';

type ChartRow = { label: string; count: number };

function ComplaintBarChart({ title, rows }: { title: string; rows: ChartRow[] }) {
  const chartRows = (rows ?? []).map((row) => ({ ...row, displayLabel: label(row.label) }));

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {chartRows.length ? (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 10, right: 12, left: -10, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="displayLabel" angle={-30} textAnchor="end" interval={0} height={75} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value) => [Number(value), 'Complaints']} />
                <Bar dataKey="count" name="Complaints" fill="currentColor" className="text-primary" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">No data for the selected filters.</div>}
      </CardContent>
    </Card>
  );
}

export default function ComplaintReport() {
  const [data, setData] = useState<any>(emptyReport);
  const [options, setOptions] = useState<any>({ departments: [], staff: [] });
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<any>({ from: '', to: '', status: '', priority: '', category: '', department_id: '', assigned_to: '', search: '' });

  const availableStaff = useMemo(() => {
    if (!filters.department_id) return options.staff ?? [];
    return (options.staff ?? []).filter((staff: any) => String(staff.department_id ?? '') === String(filters.department_id));
  }, [filters.department_id, options.staff]);

  const load = async () => {
    setBusy(true);
    try {
      const [report, reportOptions] = await Promise.all([complaintService.report(filters), complaintService.options()]);
      setData(report ?? emptyReport);
      setOptions(reportOptions ?? { departments: [], staff: [] });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-5">
          <Input type="date" aria-label="From date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <Input type="date" aria-label="To date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}><option value="">All priorities</option>{priorities.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.department_id} onChange={(e) => setFilters({ ...filters, department_id: e.target.value, assigned_to: '' })}><option value="">All departments</option>{options.departments?.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.assigned_to} onChange={(e) => setFilters({ ...filters, assigned_to: e.target.value })}><option value="">All assigned staff</option>{availableStaff.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <Input placeholder="Search complaint, subject or customer..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <Button className="md:col-span-1 xl:col-span-2" onClick={load} disabled={busy}><RefreshCcw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{busy ? 'Loading' : 'Apply Filters'}</Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Complaint Report</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-sm">
            <thead><tr className="border-b bg-muted/40 text-left"><th className="p-3">Complaint Number</th><th className="p-3">Creator</th><th className="p-3">Order No.</th><th className="p-3">Category</th><th className="p-3">Priority</th><th className="p-3">Department</th><th className="p-3">Assigned Staff</th><th className="p-3">Status</th><th className="p-3">Closed At</th></tr></thead>
            <tbody>
              {(data.rows ?? []).map((row: any) => <tr key={row.id} className="border-b last:border-0"><td className="p-3 font-medium">{row.complaint_no}</td><td className="p-3">{row.creator || row.customer || '—'}</td><td className="p-3">{row.order_number || '—'}</td><td className="p-3">{row.category || '—'}</td><td className="p-3"><Badge variant="outline" className="capitalize">{label(row.priority)}</Badge></td><td className="p-3">{row.department || '—'}</td><td className="p-3">{row.assigned_staff || '—'}</td><td className="p-3"><Badge className="capitalize">{label(row.status)}</Badge></td><td className="p-3 whitespace-nowrap">{dateTime(row.closed_at)}</td></tr>)}
              {!data.rows?.length && <tr><td colSpan={9} className="p-10 text-center text-muted-foreground">No complaints found for the selected filters.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <ComplaintBarChart title="Complaints by Category" rows={data.by_category ?? []} />
        <ComplaintBarChart title="Complaints by Status" rows={data.by_status ?? []} />
        <ComplaintBarChart title="Complaints by Priority" rows={data.by_priority ?? []} />
        <ComplaintBarChart title="Complaints by Department" rows={data.by_department ?? []} />
      </div>
    </div>
  );
}
