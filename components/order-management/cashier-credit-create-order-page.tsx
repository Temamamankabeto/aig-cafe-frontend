"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ShoppingCart } from "lucide-react";
import { authService } from "@/services/auth/auth.service";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMenuItemsQuery } from "@/hooks/queries/menu-management";
import { useTablesQuery } from "@/hooks/queries/table-management";
import { useCreditAccountsQuery, useWaitersLiteQuery } from "@/hooks/queries/order-management";
import { useCreateOrderMutation } from "@/hooks/mutations/order-management";
import type { CreditAccount, CreditAccountUser, OrderItemPayload } from "@/types/order-management";
import { CreateOrderPage as DefaultCreateOrderPage } from "./order-pages";

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function imageUrl(item: any) {
  const raw = item?.image_url || item?.image_path || item?.image || item?.photo_url || item?.photo || "";
  if (!raw) return "";
  if (String(raw).startsWith("http")) return String(raw);
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/api\/?$/, "").replace(/\/$/, "");
  const cleaned = String(raw).replace(/^\//, "");
  return base ? `${base}/${cleaned}` : `/${cleaned}`;
}

function activeAgreements(account?: CreditAccount | null): any[] {
  const value = account as any;
  if (Array.isArray(value?.active_agreements)) return value.active_agreements;
  if (Array.isArray(value?.activeAgreements)) return value.activeAgreements;
  if (Array.isArray(value?.agreements)) {
    const today = new Date().toISOString().slice(0, 10);
    return value.agreements.filter((agreement: any) => String(agreement.status ?? "active") === "active" && String(agreement.start_date ?? "").slice(0, 10) <= today && String(agreement.end_date ?? "").slice(0, 10) >= today);
  }
  return [];
}

function agreementUsers(agreement?: any): CreditAccountUser[] {
  if (Array.isArray(agreement?.authorized_users)) return agreement.authorized_users;
  if (Array.isArray(agreement?.authorizedUsers)) return agreement.authorizedUsers;
  return [];
}

function isActiveAuthorizedUser(user: CreditAccountUser) {
  const raw = (user as any).is_active;
  return raw === undefined || raw === null || raw === true || raw === 1 || raw === "1";
}

export function CashierCreditCreateOrderPage() {
  const initialPayload = {
    table_id: "",
    waiter_id: "",
    order_type: "takeaway",
    payment_type: "regular",
    credit_account_id: "",
    credit_account_user_id: "",
    credit_agreement_id: "",
    credit_notes: "",
    notes: "",
  };

  const [payload, setPayload] = useState(initialPayload);
  const [selectedAuthorizedUserIds, setSelectedAuthorizedUserIds] = useState<string[]>([]);
  const [items, setItems] = useState<OrderItemPayload[]>([]);
  const [menuSearch, setMenuSearch] = useState("");

  const menuQuery = useMenuItemsQuery({ per_page: 200, available: 1, is_available: 1, active: 1, is_active: 1, search: menuSearch }, "cashier");
  const tablesQuery = useTablesQuery({ per_page: 100, status: "available", is_active: 1 }, "cashier");
  const waitersQuery = useWaitersLiteQuery();
  const creditAccountsQuery = useCreditAccountsQuery({ per_page: 100, status: "active" });

  const isCredit = payload.payment_type === "credit";

  const create = useCreateOrderMutation("cashier", () => {
    setItems([]);
    setSelectedAuthorizedUserIds([]);
    setPayload(initialPayload);
  });

  const menuItems = menuQuery.data?.data ?? [];
  const tables = tablesQuery.data?.data ?? [];
  const waiters = waitersQuery.data ?? [];
  const creditAccounts = creditAccountsQuery.data?.data ?? [];

  const selectedCreditAccount = creditAccounts.find((account) => String(account.id) === String(payload.credit_account_id));
  const selectedActiveAgreements = activeAgreements(selectedCreditAccount);
  const selectedAgreement = selectedActiveAgreements.find((agreement: any) => String(agreement.id) === String(payload.credit_agreement_id)) ?? selectedActiveAgreements[0];
  const authorizedUsers = agreementUsers(selectedAgreement).filter(isActiveAuthorizedUser);

  useEffect(() => {
    if (!isCredit || !payload.credit_account_id || !selectedActiveAgreements.length) return;
    if (payload.credit_agreement_id && selectedActiveAgreements.some((agreement: any) => String(agreement.id) === String(payload.credit_agreement_id))) return;
    setPayload((current) => ({ ...current, credit_agreement_id: String(selectedActiveAgreements[0].id), credit_account_user_id: "" }));
  }, [isCredit, payload.credit_account_id, payload.credit_agreement_id, selectedActiveAgreements]);

  const hasActiveAgreement = !isCredit || Boolean(selectedAgreement);
  const needsTable = payload.order_type === "dine_in";

  const total = useMemo(() => items.reduce((sum, item) => {
    const menu = menuItems.find((m) => String(m.id) === String(item.menu_item_id));
    return sum + Number(menu?.price ?? 0) * Number(item.quantity ?? 0);
  }, 0), [items, menuItems]);

  const canSubmit =
    items.length > 0 &&
    (!needsTable || Boolean(payload.table_id)) &&
    Boolean(payload.waiter_id) &&
    (!isCredit || (Boolean(payload.credit_account_id) && hasActiveAgreement && Boolean(payload.credit_agreement_id || selectedAgreement?.id) && selectedAuthorizedUserIds.length > 0));

  function addItem(id: string | number) {
    setItems((current) => {
      const exists = current.find((item) => String(item.menu_item_id) === String(id));
      if (exists) {
        return current.map((item) => String(item.menu_item_id) === String(id) ? { ...item, quantity: Number(item.quantity) + 1 } : item);
      }
      return [...current, { menu_item_id: id, quantity: 1 }];
    });
  }

  function updateQty(id: string | number, quantity: number) {
    if (quantity <= 0) {
      setItems((current) => current.filter((item) => String(item.menu_item_id) !== String(id)));
      return;
    }
    setItems((current) => current.map((item) => String(item.menu_item_id) === String(id) ? { ...item, quantity } : item));
  }

  function submit() {
    if (!canSubmit) return;
    create.mutate({
      order_type: payload.order_type as any,
      table_id: needsTable ? payload.table_id : null,
      waiter_id: payload.waiter_id,
      payment_type: payload.payment_type as any,
      credit_account_id: isCredit ? payload.credit_account_id : null,
      credit_account_user_id: isCredit ? selectedAuthorizedUserIds[0] ?? null : null,
      credit_account_user_ids: isCredit ? selectedAuthorizedUserIds : [],
      credit_agreement_id: isCredit && (payload.credit_agreement_id || selectedAgreement?.id) ? (payload.credit_agreement_id || selectedAgreement?.id) : null,
      credit_notes: payload.credit_notes,
      notes: payload.notes,
      items,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create POS Order</h1>
        <p className="text-muted-foreground">Cashier can create dine-in or takeaway orders, select the responsible waiter, and create credit orders only when the account has an active agreement.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Order information</CardTitle>
              <CardDescription>Select waiter and credit account only when this order is sold on credit.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Order type</Label>
                <Select value={payload.order_type} onValueChange={(order_type) => setPayload((p) => ({ ...p, order_type, table_id: order_type === "takeaway" ? "" : p.table_id }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="takeaway">Takeaway</SelectItem>
                    <SelectItem value="dine_in">Dine in</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Responsible waiter</Label>
                <Select value={payload.waiter_id} onValueChange={(waiter_id) => setPayload((p) => ({ ...p, waiter_id }))}>
                  <SelectTrigger><SelectValue placeholder="Choose waiter" /></SelectTrigger>
                  <SelectContent>
                    {waiters.map((waiter: any) => <SelectItem key={waiter.id} value={String(waiter.id)}>{waiter.name ?? waiter.email ?? `Waiter #${waiter.id}`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {needsTable && (
                <div className="space-y-2">
                  <Label>Table</Label>
                  <Select value={payload.table_id} onValueChange={(table_id) => setPayload((p) => ({ ...p, table_id }))}>
                    <SelectTrigger><SelectValue placeholder="Choose table" /></SelectTrigger>
                    <SelectContent>
                      {tables.map((table: any) => <SelectItem key={table.id} value={String(table.id)}>{table.name ?? table.table_number ?? `Table #${table.id}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Payment type</Label>
                <Select value={payload.payment_type} onValueChange={(payment_type) => { if (payment_type !== "credit") setSelectedAuthorizedUserIds([]); setPayload((p) => ({ ...p, payment_type, credit_account_id: payment_type === "credit" ? p.credit_account_id : "", credit_agreement_id: payment_type === "credit" ? p.credit_agreement_id : "", credit_account_user_id: "" })); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isCredit && (
                <>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Credit account</Label>
                    <Select value={payload.credit_account_id} onValueChange={(credit_account_id) => { setSelectedAuthorizedUserIds([]); setPayload((p) => ({ ...p, credit_account_id, credit_agreement_id: "", credit_account_user_id: "" })); }}>
                      <SelectTrigger><SelectValue placeholder="Choose credit account" /></SelectTrigger>
                      <SelectContent>
                        {creditAccounts.map((account) => {
                          const activeAgreementCount = activeAgreements(account).length;
                          return <SelectItem key={account.id} value={String(account.id)}>{account.name} • {account.account_type === "single" ? "Single" : "Bulky"} • {activeAgreementCount ? `${activeAgreementCount} active agreement` : "No active agreement"}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Active agreement</Label>
                    <Select value={payload.credit_agreement_id || (selectedAgreement?.id ? String(selectedAgreement.id) : "")} onValueChange={(credit_agreement_id) => { setSelectedAuthorizedUserIds([]); setPayload((p) => ({ ...p, credit_agreement_id, credit_account_user_id: "" })); }} disabled={!payload.credit_account_id || !selectedActiveAgreements.length}>
                      <SelectTrigger><SelectValue placeholder={!payload.credit_account_id ? "Choose credit account first" : selectedActiveAgreements.length ? "Choose agreement" : "No active agreement"} /></SelectTrigger>
                      <SelectContent>
                        {selectedActiveAgreements.length ? selectedActiveAgreements.map((agreement: any) => (
                          <SelectItem key={agreement.id} value={String(agreement.id)}>{agreement.meal_type} • {String(agreement.start_date ?? "").slice(0, 10)} → {String(agreement.end_date ?? "").slice(0, 10)}</SelectItem>
                        )) : <SelectItem value="none" disabled>No active agreement</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3 md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Authorized person(s)</Label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={authorizedUsers.length > 0 && selectedAuthorizedUserIds.length === authorizedUsers.length} onCheckedChange={(checked) => setSelectedAuthorizedUserIds(checked ? authorizedUsers.map((user) => String(user.id)) : [])} disabled={!selectedAgreement || !authorizedUsers.length} />
                        Select all
                      </label>
                    </div>
                    <div className="overflow-hidden rounded-xl border">
                      <Table>
                        <TableHeader><TableRow><TableHead className="w-14">Check</TableHead><TableHead>Full name</TableHead><TableHead>Phone number</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {authorizedUsers.map((user) => { const id = String(user.id); return <TableRow key={id}><TableCell><Checkbox checked={selectedAuthorizedUserIds.includes(id)} onCheckedChange={(checked) => setSelectedAuthorizedUserIds((current) => checked ? [...new Set([...current, id])] : current.filter((value) => value !== id))} /></TableCell><TableCell className="font-medium">{user.full_name}</TableCell><TableCell>{user.phone || "—"}</TableCell><TableCell>Active</TableCell></TableRow>; })}
                          {!authorizedUsers.length && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No active authorized persons for this agreement.</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="rounded-xl border p-3 text-sm md:col-span-2">
                    <div className="flex justify-between"><span>Active agreement</span><strong>{selectedAgreement?.meal_type ?? "Not available"}</strong></div>
                    <div className="flex justify-between"><span>Agreement date</span><strong>{selectedAgreement ? `${String(selectedAgreement.start_date).slice(0, 10)} → ${String(selectedAgreement.end_date).slice(0, 10)}` : "—"}</strong></div>
                    <div className="flex justify-between"><span>Current cart total</span><strong>{money(total)}</strong></div>
                    {!selectedAgreement && <p className="mt-2 text-sm text-destructive">Credit order is not allowed because this account has no active agreement.</p>}
                  </div>
                </>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={payload.notes} onChange={(event) => setPayload((p) => ({ ...p, notes: event.target.value, credit_notes: event.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Menu items</CardTitle>
              <CardDescription>All available food and drink items are displayed as cards with images.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search food or drink" value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {menuItems.map((item: any) => (
                  <button key={item.id} type="button" onClick={() => addItem(item.id)} className="overflow-hidden rounded-2xl border text-left transition hover:bg-muted/40">
                    <div className="h-32 bg-muted">
                      {imageUrl(item) ? <img src={imageUrl(item)} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No image</div>}
                    </div>
                    <div className="space-y-1 p-3">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">{item.type ?? item.category?.name ?? "Menu item"}</div>
                      <div className="font-semibold">{money(item.price)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Cart</CardTitle>
            <CardDescription>{items.length} selected items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.length ? items.map((cartItem) => {
              const menu = menuItems.find((item: any) => String(item.id) === String(cartItem.menu_item_id));
              const qty = Number(cartItem.quantity ?? 0);
              const price = Number(menu?.price ?? 0);
              return (
                <div key={String(cartItem.menu_item_id)} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <div className="font-medium">{menu?.name ?? `Item #${cartItem.menu_item_id}`}</div>
                    <div className="text-sm text-muted-foreground">{money(price)} × {qty}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateQty(cartItem.menu_item_id, qty - 1)}>-</Button>
                    <span className="w-6 text-center">{qty}</span>
                    <Button size="sm" variant="outline" onClick={() => updateQty(cartItem.menu_item_id, qty + 1)}>+</Button>
                  </div>
                </div>
              );
            }) : <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">No items in cart yet.</div>}

            <div className="flex justify-between rounded-xl bg-muted p-4 text-lg font-semibold"><span>Total</span><span>{money(total)}</span></div>
            {!payload.waiter_id && <p className="text-sm text-muted-foreground">Select the responsible waiter before creating the order.</p>}
            {isCredit && selectedAgreement && selectedAuthorizedUserIds.length === 0 && <p className="text-sm text-destructive">Select the authorized person for the selected agreement before creating this credit order.</p>}
            <Button className="w-full" disabled={!canSubmit || create.isPending} onClick={submit}>Submit order</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function RoleAwareCreateOrderPage() {
  const [isCashier, setIsCashier] = useState(false);

  useEffect(() => {
    const user = authService.getStoredUser();
    const roles = authService.getStoredRoles();
    const values = [...roles, user?.role, ...(user?.roles ?? [])]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());

    setIsCashier(values.includes("cashier"));
  }, []);

  if (isCashier) return <CashierCreditCreateOrderPage />;
  return <DefaultCreateOrderPage scope="waiter" title="Create order" />;
}
