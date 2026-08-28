"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DiningTable,
  useTablesQuery,
  useTransferTableOrdersMutation,
} from "@/hooks/table-management/table";

export function TransferOrdersModal({
  open,
  onOpenChange,
  table,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table?: DiningTable | null;
}) {
  const { data } = useTablesQuery({ per_page: 100, is_active: 1 });
  const transferMutation = useTransferTableOrdersMutation(() => onOpenChange(false));
  const [toTableId, setToTableId] = useState("");
  const [moveWaiters, setMoveWaiters] = useState(false);

  useEffect(() => {
    if (!open) return;
    setToTableId("");
    setMoveWaiters(false);
  }, [open]);

  const tables = (data?.data ?? []).filter((item) => String(item.id) !== String(table?.id));

  function submit() {
    if (!table?.id || !toTableId) return;

    transferMutation.mutate({
      id: table.id,
      payload: {
        to_table_id: toTableId,
        move_waiters: moveWaiters,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer active orders</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Move active orders from {table?.table_number} to another table.
          </p>

          <div className="space-y-2">
            <Label>Destination table</Label>
            <Select value={toTableId} onValueChange={setToTableId}>
              <SelectTrigger>
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.table_number} {item.name ? `- ${item.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 rounded-xl border p-3">
            <Checkbox
              checked={moveWaiters}
              onCheckedChange={(v) => setMoveWaiters(Boolean(v))}
            />
            <span className="text-sm">Move assigned waiters too</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={transferMutation.isPending || !toTableId}
          >
            {transferMutation.isPending ? "Transferring..." : "Transfer orders"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
