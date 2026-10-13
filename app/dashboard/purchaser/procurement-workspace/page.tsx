"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { procurementService } from "@/services/inventory-management/procurement.service";
import { formatMoney } from "@/lib/inventory-management";

export default function PurchaserProcurementWorkspacePage() {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["purchaser", "approved-requisitions", search],
    queryFn: () => procurementService.purchaseOrders({ search, per_page: 100 }, "purchaser"),
    retry: false,
  });
  const rows = (query.data?.data ?? []).filter((po) =>
    ["approved", "partially_received", "completed"].includes(po.status),
  );
  return <Card>
    <CardHeader>
      <CardTitle>Approved Purchase Requisitions</CardTitle>
      <CardDescription>Purchaser access is read-only. Finance prints approved requisitions and the Store Keeper receives goods.</CardDescription>
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search approved requisitions" />
    </CardHeader>
    <CardContent>
      {query.isLoading ? <p>Loading...</p> : query.isError ? <p>Unable to load approved requisitions.</p> :
        <Table><TableHeader><TableRow><TableHead>Requisition</TableHead><TableHead>Items</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((po) => <TableRow key={po.id}>
            <TableCell>{po.po_number ?? `PO-${po.id}`}</TableCell>
            <TableCell>{po.items?.length ?? 0}</TableCell>
            <TableCell>{formatMoney(po.total ?? 0)} ETB</TableCell>
            <TableCell><Badge variant="secondary">{po.status.replaceAll("_", " ")}</Badge></TableCell>
          </TableRow>)}</TableBody>
        </Table>}
      {!query.isLoading && !query.isError && !rows.length && <p className="py-5 text-sm text-muted-foreground">No approved requisitions available.</p>}
    </CardContent>
  </Card>;
}
