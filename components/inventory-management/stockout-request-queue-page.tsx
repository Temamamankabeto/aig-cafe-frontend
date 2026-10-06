"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import inventoryService from "@/services/inventory-management/inventory.service";
import { formatBaseQuantity } from "@/lib/inventory-management";

type QueueMode = "validation" | "approval" | "issue";
type ActionType = "validate" | "approve" | "reject" | "issue";

export function StockoutRequestQueuePage({ mode }: { mode: QueueMode }) {
  const client = useQueryClient();
  const [status, setStatus] = useState(mode === "issue" ? "approved" : "all");
  const [detailRow, setDetailRow] = useState<any>(null);
  const [actionRow, setActionRow] = useState<any>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [note, setNote] = useState("");

  const scope = mode === "validation" ? "food-controller" : mode === "approval" ? "manager" : "stock-keeper";
  const query = useQuery({
    queryKey: ["stockout-requests", scope, status],
    queryFn: () => inventoryService.stockoutRequestQueue(scope, status),
  });

  const closeAction = () => {
    setActionRow(null);
    setActionType(null);
    setNote("");
  };

  const action = useMutation({
    mutationFn: ({ row, type }: { row: any; type: ActionType }) =>
      type === "validate"
        ? inventoryService.validateStockoutRequest(row.id, note.trim() || undefined)
        : type === "approve"
          ? inventoryService.approveStockoutRequest(row.id, note.trim() || undefined)
          : type === "reject"
            ? inventoryService.rejectStockoutRequest(row.id, note.trim())
            : inventoryService.issueStockoutRequest(row.id),
    onSuccess: (response: any) => {
      toast.success(response?.message ?? "Request updated");
      closeAction();
      setDetailRow(null);
      client.invalidateQueries({ queryKey: ["stockout-requests"] });
      client.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Action failed"),
  });

  const rows = query.data?.data ?? [];
  const title =
    mode === "validation"
      ? "Stock-out Request Validation"
      : mode === "approval"
        ? "Stock-out Manager Approval"
        : "Approved Stock-out Requests";

  const description =
    mode === "validation"
      ? "Review full request details, validate department stock-out requests and send them to Manager approval."
      : mode === "approval"
        ? "Review full request details and approve only F&B Controller validated requests before Store Keeper issue."
        : "Receive Manager-approved stock-out requests. Stock and inventory movement are posted when Store Keeper issues.";

  const openAction = (row: any, type: ActionType) => {
    setActionRow(row);
    setActionType(type);
    setNote("");
  };

  const unitFor = (row: any) => row.inventory_item?.base_unit ?? row.inventoryItem?.base_unit ?? "pcs";
  const itemFor = (row: any) => row.inventory_item?.name ?? row.inventoryItem?.name ?? "—";
  const responsibleFor = (row: any) => row.responsible_user?.name ?? row.responsibleUser?.name ?? row.requester?.name ?? "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(mode === "validation"
              ? ["all", "submitted", "validated", "approved", "rejected", "issued", "received"]
              : mode === "approval"
                ? ["all", "validated", "approved", "rejected", "issued", "received"]
                : ["approved", "issued", "received", "all"]
            ).map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All Statuses" : value.replace(/^./, (c) => c.toUpperCase())}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead><TableHead>Department</TableHead><TableHead>Requested by</TableHead>
              <TableHead>Responsible user</TableHead><TableHead>Item</TableHead><TableHead>Quantity</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow><TableCell colSpan={8} className="py-10 text-center">Loading requests...</TableCell></TableRow>
            ) : rows.length ? rows.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.request_number}</TableCell>
                <TableCell>{row.department?.name ?? "—"}</TableCell>
                <TableCell>{row.requester?.name ?? "—"}</TableCell>
                <TableCell>{responsibleFor(row)}</TableCell>
                <TableCell>{itemFor(row)}</TableCell>
                <TableCell>{formatBaseQuantity(row.quantity, unitFor(row))}</TableCell>
                <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDetailRow(row)}>Details</Button>
                    {mode === "validation" && row.status === "submitted" && <>
                      <Button size="sm" onClick={() => openAction(row, "validate")}>Validate</Button>
                      <Button size="sm" variant="destructive" onClick={() => openAction(row, "reject")}>Reject</Button>
                    </>}
                    {mode === "approval" && row.status === "validated" && <>
                      <Button size="sm" onClick={() => openAction(row, "approve")}>Review & Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => openAction(row, "reject")}>Reject</Button>
                    </>}
                    {mode === "issue" && row.status === "approved" &&
                      <Button size="sm" onClick={() => openAction(row, "issue")}>Receive & Issue</Button>}
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No requests found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detailRow} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Stock-out request details</DialogTitle>
            <DialogDescription>Complete request, workflow and responsibility information.</DialogDescription>
          </DialogHeader>
          {detailRow && <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Request No.", detailRow.request_number],
                ["Status", detailRow.status],
                ["Department", detailRow.department?.name ?? "—"],
                ["Requested By", detailRow.requester?.name ?? "—"],
                ["Responsible User", responsibleFor(detailRow)],
                ["Inventory Item", itemFor(detailRow)],
                ["Quantity", formatBaseQuantity(detailRow.quantity, unitFor(detailRow))],
                ["F&B Validator", detailRow.validator?.name ?? "—"],
                ["Manager Approver", detailRow.approver?.name ?? "—"],
                ["Issued By", detailRow.issuer?.name ?? "—"],
                ["Validated At", detailRow.validated_at ? new Date(detailRow.validated_at).toLocaleString() : "—"],
                ["Approved At", detailRow.approved_at ? new Date(detailRow.approved_at).toLocaleString() : "—"],
              ].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value}</div>
              </div>)}
            </div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Reason</div><div className="mt-1 whitespace-pre-wrap">{detailRow.reason || "—"}</div></div>
            {detailRow.validation_note && <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">F&B Validation Note</div><div className="mt-1">{detailRow.validation_note}</div></div>}
            {detailRow.approval_note && <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Manager Approval Note</div><div className="mt-1">{detailRow.approval_note}</div></div>}
            {detailRow.rejection_reason && <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Rejection Reason</div><div className="mt-1">{detailRow.rejection_reason}</div></div>}
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setDetailRow(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionRow && !!actionType} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {actionType === "validate" ? "Validate stock-out request" :
               actionType === "approve" ? "Manager stock-out approval" :
               actionType === "reject" ? "Reject stock-out request" : "Receive & issue stock"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "validate" ? "Confirm the request details before sending it to Manager approval." :
               actionType === "approve" ? "Confirm the F&B validated request before authorizing Store Keeper issue." :
               actionType === "reject" ? "Provide the reason for rejecting this request." :
               "Confirm issue. This is the point where stock is reduced and the inventory movement is recorded."}
            </DialogDescription>
          </DialogHeader>
          {actionRow && <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Request</div><div className="font-semibold">{actionRow.request_number}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Department</div><div className="font-semibold">{actionRow.department?.name ?? "—"}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Responsible User</div><div className="font-semibold">{responsibleFor(actionRow)}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Item / Quantity</div><div className="font-semibold">{itemFor(actionRow)} — {formatBaseQuantity(actionRow.quantity, unitFor(actionRow))}</div></div>
            </div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Reason</div><div className="mt-1">{actionRow.reason || "—"}</div></div>
            {(actionType === "validate" || actionType === "approve" || actionType === "reject") && <div>
              <Label>{actionType === "reject" ? "Rejection reason *" : actionType === "validate" ? "F&B validation note" : "Manager approval note"}</Label>
              <Textarea className="mt-2" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={actionType === "reject" ? "Enter mandatory rejection reason..." : "Optional note..."} />
            </div>}
          </div>}
          <DialogFooter>
            <Button variant="outline" onClick={closeAction}>Cancel</Button>
            <Button
              variant={actionType === "reject" ? "destructive" : "default"}
              disabled={action.isPending || (actionType === "reject" && !note.trim())}
              onClick={() => actionRow && actionType && action.mutate({ row: actionRow, type: actionType })}
            >
              {action.isPending ? "Processing..." :
               actionType === "validate" ? "Confirm Validation" :
               actionType === "approve" ? "Confirm Approval" :
               actionType === "reject" ? "Reject Request" : "Confirm Receive & Issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
