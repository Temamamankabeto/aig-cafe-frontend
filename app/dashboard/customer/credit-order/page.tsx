"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { orderService } from "@/services/order-management/order.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CreditAgreement, CreditMealType } from "@/types/order-management";

type CartItem = { menu_item_id: string | number; quantity: number };

function agreementMealTypes(agreement?: CreditAgreement | null): CreditMealType[] {
  if (!agreement) return [];
  return (((agreement as any).meal_types ?? (agreement as any).mealTypes ?? []) as CreditMealType[])
    .filter((item) => item.is_active === undefined || item.is_active === true || item.is_active === 1);
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CustomerOrderPage() {
  const [search, setSearch] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");
  const [agreementId, setAgreementId] = useState("");
  const [mealTypeId, setMealTypeId] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["customer-credit-profile"],
    queryFn: () => orderService.myAuthorizedCreditProfile(),
  });

  const menuQuery = useQuery({
    queryKey: ["customer-order-menu", search],
    queryFn: () => orderService.authorizedCreditMenu(search),
  });

  const profile = profileQuery.data?.data ?? {};
  const isCreditAuthorized = Boolean(profile?.is_credit_authorized);
  const agreements = (profile?.agreements ?? []) as CreditAgreement[];
  const selectedAgreement = agreements.find((item) => String(item.id) === agreementId) ?? agreements[0] ?? null;
  const mealTypes = agreementMealTypes(selectedAgreement);
  const selectedMealType = mealTypes.find((item) => String(item.id) === mealTypeId) ?? mealTypes[0] ?? null;
  const menu = menuQuery.data ?? [];

  const total = useMemo(() => cart.reduce((sum, item) => {
    const menuItem = menu.find((row: any) => String(row.id) === String(item.menu_item_id));
    return sum + Number(menuItem?.price ?? 0) * item.quantity;
  }, 0), [cart, menu]);

  function addItem(id: string | number) {
    setCart((current) => {
      const existing = current.find((item) => String(item.menu_item_id) === String(id));
      if (existing) return current.map((item) => String(item.menu_item_id) === String(id) ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { menu_item_id: id, quantity: 1 }];
    });
  }

  function changeQty(id: string | number, delta: number) {
    setCart((current) => current
      .map((item) => String(item.menu_item_id) === String(id) ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  }

  async function submit() {
    if (!cart.length) return toast.error("Add at least one menu item");
    if (paymentType === "credit") {
      if (!isCreditAuthorized || !selectedAgreement) return toast.error("You are not authorized for an active credit agreement. Use cash order.");
      if (!selectedMealType) return toast.error("Select an allowed meal type");
    }

    setSubmitting(true);
    try {
      await orderService.createAuthorizedCreditOrder({
        payment_type: paymentType,
        credit_agreement_id: paymentType === "credit" ? selectedAgreement?.id : undefined,
        meal_type_id: paymentType === "credit" ? selectedMealType?.id : undefined,
        notes: notes.trim() || undefined,
        items: cart,
      });
      toast.success(paymentType === "credit" ? "Credit order submitted to cashier for confirmation" : "Cash order created successfully");
      setCart([]);
      setNotes("");
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? error?.message ?? "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Order</h1>
        <p className="text-muted-foreground">Choose menu items here. Cash is available to every customer; credit is available only when you are an authorized person on an active agreement.</p>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-semibold">{profile?.authorized_person?.full_name ?? "Customer"}</p></div>
          <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-semibold">{profile?.authorized_person?.phone ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Credit account</p><p className="font-semibold">{profile?.account?.name ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Credit status</p><Badge variant="outline">{isCreditAuthorized ? "Authorized" : "Not authorized"}</Badge></div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment type</Label>
                <Select value={paymentType} onValueChange={(value) => setPaymentType(value as "cash" | "credit")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit" disabled={!isCreditAuthorized || !agreements.length}>Credit</SelectItem>
                  </SelectContent>
                </Select>
                {!isCreditAuthorized && <p className="text-xs text-muted-foreground">Credit is unavailable because you are not an authorized person for an active agreement.</p>}
              </div>

              {paymentType === "credit" && (
                <div className="space-y-2">
                  <Label>Agreement</Label>
                  <Select value={String(selectedAgreement?.id ?? "")} onValueChange={(value) => { setAgreementId(value); setMealTypeId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Choose agreement" /></SelectTrigger>
                    <SelectContent>{agreements.map((agreement) => <SelectItem key={agreement.id} value={String(agreement.id)}>{agreement.meal_type || `Agreement #${agreement.id}`} · {agreement.start_date?.slice(0,10)} → {agreement.end_date?.slice(0,10)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {paymentType === "credit" && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Meal type</Label>
                  <Select value={String(selectedMealType?.id ?? "")} onValueChange={setMealTypeId}>
                    <SelectTrigger><SelectValue placeholder="Choose meal type" /></SelectTrigger>
                    <SelectContent>{mealTypes.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu..." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {menu.map((item: any) => (
              <Card key={item.id}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{item.name}</CardTitle><CardDescription>{item.category ?? item.type}</CardDescription></CardHeader>
                <CardContent>
                  <div className="mb-3 font-semibold">{money(item.price)} ETB</div>
                  <Button className="w-full" onClick={() => addItem(item.id)}><Plus className="mr-2 h-4 w-4" />Add</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />Your order</CardTitle><CardDescription>{paymentType === "credit" ? "Cashier confirmation is required before this becomes a credit order." : "Cash order"}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {cart.map((item) => {
              const menuItem = menu.find((row: any) => String(row.id) === String(item.menu_item_id));
              return (
                <div key={item.menu_item_id} className="flex items-center justify-between gap-3 border-b pb-3">
                  <div><p className="font-medium">{menuItem?.name ?? `Item #${item.menu_item_id}`}</p><p className="text-sm text-muted-foreground">{money(Number(menuItem?.price ?? 0) * item.quantity)} ETB</p></div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => changeQty(item.menu_item_id, -1)}><Minus className="h-4 w-4" /></Button>
                    <span className="w-6 text-center">{item.quantity}</span>
                    <Button size="icon" variant="outline" onClick={() => changeQty(item.menu_item_id, 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
            {!cart.length && <div className="py-8 text-center text-sm text-muted-foreground">No items selected.</div>}
            <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional order note" /></div>
            <div className="flex items-center justify-between text-lg font-semibold"><span>Estimated total</span><span>{money(total)} ETB</span></div>
            <Button className="w-full" disabled={submitting || !cart.length || (paymentType === "credit" && (!selectedAgreement || !selectedMealType))} onClick={submit}>{submitting ? "Submitting..." : paymentType === "credit" ? "Submit credit order" : "Place cash order"}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
