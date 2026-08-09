"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ArrowLeft,
  Minus,
  Plus,
  Printer,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


import { useCreateOrderMutation } from "@/hooks/mutations/order-management";
import {
  useMenuCategoriesQuery,
  useMenuItemsQuery,
} from "@/hooks/queries/menu-management";
import {
  useCreditAccountsQuery,
  useWaitersLiteQuery,
} from "@/hooks/queries/order-management";
import { useTablesQuery } from "@/hooks/queries/table-management";

import type {
  CreditAgreement,
  Order,
  OrderItemPayload,
} from "@/types/order-management";
import { printCustomerOrderTicket } from "@/components/order-management/order-print-utils";

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function imageUrlFromMenu(item: any) {
  const raw =
    item?.image_url ||
    item?.image_path ||
    item?.image ||
    item?.photo_url ||
    item?.photo ||
    "";
  if (!raw) return "";
  if (String(raw).startsWith("http")) return String(raw);
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "")
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");
  const cleaned = String(raw).replace(/^\//, "");
  return base ? `${base}/${cleaned}` : `/${cleaned}`;
}

function normalizeCreatedOrder(value: unknown): Order | undefined {
  const response = value as any;
  return response?.data?.order ?? response?.data ?? response?.order ?? response;
}

function activeAgreements(account: any): CreditAgreement[] {
  const today = new Date().toISOString().slice(0, 10);
  const list =
    account?.active_agreements ??
    account?.activeAgreements ??
    account?.agreements ??
    [];
  return Array.isArray(list)
    ? list.filter((agreement: any) => {
        const status = String(agreement.status ?? "active").toLowerCase();
        const start = String(agreement.start_date ?? "").slice(0, 10);
        const end = String(agreement.end_date ?? "").slice(0, 10);
        return (
          status === "active" &&
          (!start || start <= today) &&
          (!end || end >= today)
        );
      })
    : [];
}

function agreementFileUrl(agreement?: CreditAgreement | null) {
  if (!agreement) return "";
  if (agreement.agreement_letter_url)
    return String(agreement.agreement_letter_url);
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "")
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");
  return `${base}/api/credit/agreements/${agreement.id}/file`;
}

function buildPrintableOrderFromSelection({
  created,
  submittedPayload,
  submittedItems,
  menuItems,
  tables,
  waiters,
  total,
}: {
  created?: Order;
  submittedPayload: any;
  submittedItems: OrderItemPayload[];
  menuItems: any[];
  tables: any[];
  waiters: any[];
  total: number;
}): Order {
  const printable: any = { ...(created ?? {}) };

  if (!printable.items?.length && !printable.order_items?.length) {
    printable.items = submittedItems.map((item) => {
      const menu = menuItems.find(
        (menuItem) => String(menuItem.id) === String(item.menu_item_id),
      );
      const quantity = Number(item.quantity ?? 0);
      const unitPrice = Number(menu?.price ?? 0);
      return {
        menu_item_id: item.menu_item_id,
        menu_item: menu,
        quantity,
        unit_price: unitPrice,
        line_total: quantity * unitPrice,
        station:
          String(menu?.type ?? "food").toLowerCase() === "drink"
            ? "bar"
            : "kitchen",
        item_status: "confirmed",
        notes: item.notes ?? item.note ?? null,
      };
    });
  }

  printable.order_type = printable.order_type ?? submittedPayload.order_type;
  printable.payment_type =
    printable.payment_type ?? submittedPayload.payment_type;
  printable.table_id = printable.table_id ?? submittedPayload.table_id;
  printable.waiter_id = printable.waiter_id ?? submittedPayload.waiter_id;
  printable.total = printable.total ?? printable.total_amount ?? total;
  printable.status = printable.status ?? "confirmed";
  printable.created_at = printable.created_at ?? new Date().toISOString();
  printable.credit_order_mode =
    printable.credit_order_mode ?? submittedPayload.credit_order_mode;
  printable.meal_type = printable.meal_type ?? submittedPayload.meal_type;
  printable.number_of_person =
    printable.number_of_person ?? submittedPayload.number_of_person;

  if (!printable.table && submittedPayload.table_id) {
    printable.table =
      tables.find(
        (table) => String(table.id) === String(submittedPayload.table_id),
      ) ?? null;
  }
  if (!printable.waiter && submittedPayload.waiter_id) {
    printable.waiter =
      waiters.find(
        (waiter) => String(waiter.id) === String(submittedPayload.waiter_id),
      ) ?? null;
  }
  if (!printable.bill) {
    printable.bill = {
      bill_number: `BILL-${printable.order_number ?? printable.id ?? "NEW"}`,
      total,
      paid_amount: 0,
      balance: total,
      status: "draft",
    };
  }
  return printable as Order;
}

export default function CashierPosCreateOrderPage() {
  const [scanText, setScanText] = useState("");

  const [menuSearch, setMenuSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [payload, setPayload] = useState({
    table_id: "",
    waiter_id: "",
    order_type: "takeaway",
    payment_type: "cash",
    credit_account_id: "",
    credit_account_user_id: "",
    credit_agreement_id: "",
    credit_order_mode: "order_based",
    meal_type: "Lunch",
    number_of_person: 1,
  });
  const [items, setItems] = useState<OrderItemPayload[]>([]);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [billCustomerName, setBillCustomerName] = useState("Guest");

  const menuQuery = useMenuItemsQuery(
    {
      per_page: 200,
      available: 1,
      is_available: 1,
      active: 1,
      is_active: 1,
      search: menuSearch,
    },
    "cashier",
  );
  const categoriesQuery = useMenuCategoriesQuery(
    {
      per_page: 200,
      active: 1,
      is_active: 1,
    },
    "cashier",
  );
  const tablesQuery = useTablesQuery(
    { per_page: 100, status: "available", is_active: 1 },
    "cashier",
  );
  const waitersQuery = useWaitersLiteQuery();
  const creditAccountsQuery = useCreditAccountsQuery({
    per_page: 100,
    status: "active",
  });
  const create = useCreateOrderMutation("cashier", () => {
    setItems([]);
    setPayload({
      table_id: "",
      waiter_id: "",
      order_type: "takeaway",
      payment_type: "cash",
      credit_account_id: "",
      credit_account_user_id: "",
      credit_agreement_id: "",
      credit_order_mode: "order_based",
      meal_type: "Lunch",
      number_of_person: 1,
    });
  });

  const menuItems = menuQuery.data?.data ?? [];
  const menuCategories = useMemo(
    () =>
      [...(categoriesQuery.data?.data ?? [])].sort(
        (left, right) =>
          Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0),
      ),
    [categoriesQuery.data?.data],
  );
  const filteredMenuItems = useMemo(
    () =>
      selectedCategory === "all"
        ? menuItems
        : menuItems.filter((item: any) => {
            const categoryId =
              item.category_id ??
              item.menu_category_id ??
              item.menu_category?.id ??
              item.category?.id;

            return String(categoryId) === selectedCategory;
          }),
    [menuItems, selectedCategory],
  );
  const tables = tablesQuery.data?.data ?? [];
  const waiters = waitersQuery.data ?? [];
  const creditAccounts = creditAccountsQuery.data?.data ?? [];
  const selectedCreditAccount = creditAccounts.find(
    (account) => String(account.id) === String(payload.credit_account_id),
  );
  const agreements = activeAgreements(selectedCreditAccount);
  const selectedAgreement =
    agreements.find(
      (agreement) =>
        String(agreement.id) === String(payload.credit_agreement_id),
    ) ?? agreements[0];
  const isCredit = payload.payment_type === "credit";
  const isBeefBased = isCredit && payload.credit_order_mode === "beef_based";
  const needsTable = payload.order_type === "dine_in";

  const cartTotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const menu = menuItems.find(
          (m) => String(m.id) === String(item.menu_item_id),
        );
        return sum + Number(menu?.price ?? 0) * item.quantity;
      }, 0),
    [items, menuItems],
  );

  const beefTotal = useMemo(() => {
    if (!selectedAgreement) return 0;
    return (
      Number(selectedAgreement.price_per_person ?? 0) *
      Math.max(1, Number(payload.number_of_person ?? 1))
    );
  }, [selectedAgreement, payload.number_of_person]);

  const total = isBeefBased ? beefTotal : cartTotal;

  const canSubmit =
    Boolean(payload.waiter_id) &&
    (!needsTable || Boolean(payload.table_id)) &&
    (!isCredit ||
      (Boolean(payload.credit_account_id) && Boolean(selectedAgreement))) &&
    (!isCredit ||
      payload.credit_order_mode !== "beef_based" ||
      (Boolean(payload.meal_type) && Number(payload.number_of_person) > 0)) &&
    (isBeefBased || items.length > 0);
    function parseCreditScan(
  input: string,
): { credit_account_id: string; credit_account_user_id: string } | null {
  if (!input) return null;

  // Expected format:
  // credit-account:123;authorized-user:456
  const accountMatch = input.match(/credit-account\s*:\s*(\d+)/i);
  const userMatch = input.match(/authorized-user\s*:\s*(\d+)/i);

  if (!accountMatch || !userMatch) return null;

  return {
    credit_account_id: accountMatch[1],
    credit_account_user_id: userMatch[1],
  };
}

 function applyScan() {
  const parsed = parseCreditScan(scanText);

  if (!parsed) {
    toast.error(
      "Invalid card scan. Expected credit-account:{id};authorized-user:{id}",
    );
    return;
  }

  setPayload((current) => ({
    ...current,
    payment_type: "credit",
    credit_account_id: parsed.credit_account_id,
    credit_account_user_id: parsed.credit_account_user_id,
  }));

  toast.success("Credit card scanned and selected");
}

  function addItem(id: string | number) {
    const exists = items.find((i) => String(i.menu_item_id) === String(id));
    setItems(
      exists
        ? items.map((i) =>
            String(i.menu_item_id) === String(id)
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          )
        : [...items, { menu_item_id: id, quantity: 1 }],
    );
  }

  function updateQty(id: string | number, quantity: number) {
    if (quantity <= 0) {
      setItems(
        items.filter((item) => String(item.menu_item_id) !== String(id)),
      );
      return;
    }
    setItems(
      items.map((item) =>
        String(item.menu_item_id) === String(id) ? { ...item, quantity } : item,
      ),
    );
  }

  function resetCreditAgreement(accountId: string) {
    const account = creditAccounts.find(
      (row) => String(row.id) === String(accountId),
    );
    const firstAgreement = activeAgreements(account)[0];
    setPayload((current) => ({
      ...current,
      credit_account_id: accountId,
      credit_agreement_id: firstAgreement ? String(firstAgreement.id) : "",
      credit_order_mode: String(
        firstAgreement?.agreement_type ??
          current.credit_order_mode ??
          "order_based",
      ),
      meal_type: firstAgreement?.meal_type ?? current.meal_type,
      number_of_person: Number(
        firstAgreement?.number_of_person ?? current.number_of_person ?? 1,
      ),
    }));
  }

  function submit() {
    if (!canSubmit) {
      toast.error(
        "Complete waiter, table when dine-in, active credit agreement, and required order details.",
      );
      return;
    }

    const submittedPayload = {
      ...payload,
      table_id: payload.table_id || null,
      waiter_id: payload.waiter_id || null,
      payment_type: isCredit ? "credit" : "cash",
      credit_account_id: isCredit ? payload.credit_account_id : null,
      credit_account_user_id: isCredit
        ? payload.credit_account_user_id || null
        : null,
      credit_agreement_id: isCredit
        ? String(selectedAgreement?.id ?? payload.credit_agreement_id)
        : null,
      credit_order_mode: isCredit ? payload.credit_order_mode : null,
      meal_type: isCredit ? payload.meal_type : null,
      number_of_person: isCredit ? Number(payload.number_of_person) : null,
      customer_name:
        selectedCreditAccount?.account_type === "single"
          ? billCustomerName || "Guest"
          : "Guest",
      items: isBeefBased ? [] : items,
    };

    const submittedItems = [...(isBeefBased ? [] : items)];
    const submittedTotal = total;

    create.mutate(submittedPayload as any, {
      onSuccess: (response) => {
        const normalized = normalizeCreatedOrder(response);
        const printable = buildPrintableOrderFromSelection({
          created: normalized,
          submittedPayload,
          submittedItems,
          menuItems: [...menuItems],
          tables: [...tables],
          waiters: [...waiters],
          total: submittedTotal,
        });
        setCreatedOrder(printable);
        setCartOpen(false);
        setBillCustomerName(
          printable.customer_name ||
            (selectedCreditAccount?.account_type === "single"
              ? selectedAgreement?.single_person_name || "Guest"
              : "Guest"),
        );
        setPrintDialogOpen(true);
        toast.success(
          "Order created. You can still add/edit items until the bill is printed.",
        );
      },
      onError: (error) =>
        toast.error(
          error instanceof Error ? error.message : "Failed to create order",
        ),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Button variant="outline" size="sm" asChild className="mb-3">
            <Link href="/dashboard/order-management/pos/orders">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to POS orders
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            Create POS Order
          </h1>
          <p className="text-muted-foreground">
            Cash or agreement-based credit order workflow.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="relative h-auto w-full justify-between rounded-2xl px-5 py-4 shadow-sm md:w-80"
          onClick={() => setCartOpen(true)}
        >
          <span className="flex items-center gap-3">
            <span className="relative rounded-xl bg-primary-foreground/15 p-2">
              <ShoppingCart className="h-5 w-5" />
              {items.length > 0 && (
                <Badge className="absolute -right-2 -top-2 h-5 min-w-5 justify-center rounded-full border-2 border-primary px-1 text-[10px]">
                  {items.reduce((sum, item) => sum + item.quantity, 0)}
                </Badge>
              )}
            </span>
            <span className="text-left">
              <span className="block text-xs font-medium opacity-80">
                View cart & order information
              </span>
              <span className="block text-lg font-bold">{money(total)} ETB</span>
            </span>
          </span>
          <span className="text-xs font-semibold">Open cart</span>
        </Button>
      </div>

      <div className="space-y-6">
        <Card className="hidden rounded-2xl">
          <CardHeader>
            <CardTitle>Order information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Order type</Label>
              <Select
                value={payload.order_type}
                onValueChange={(order_type) =>
                  setPayload({ ...payload, order_type })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="takeaway">Takeaway</SelectItem>
                  <SelectItem value="dine_in">Dine in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {needsTable && (
              <div className="space-y-2">
                <Label>Table</Label>
                <Select
                  value={payload.table_id}
                  onValueChange={(table_id) =>
                    setPayload({ ...payload, table_id })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table: any) => (
                      <SelectItem key={table.id} value={String(table.id)}>
                        {table.table_number ??
                          table.name ??
                          `Table ${table.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Waiter</Label>
              <Select
                value={payload.waiter_id}
                onValueChange={(waiter_id) =>
                  setPayload({ ...payload, waiter_id })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select waiter" />
                </SelectTrigger>
                <SelectContent>
                  {waiters.map((waiter: any) => (
                    <SelectItem key={waiter.id} value={String(waiter.id)}>
                      {waiter.name ??
                        waiter.full_name ??
                        waiter.email ??
                        `Waiter ${waiter.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment type</Label>
              <Select
                value={payload.payment_type}
                onValueChange={(payment_type) =>
                  setPayload({
                    ...payload,
                    payment_type,
                    credit_account_id:
                      payment_type === "credit"
                        ? payload.credit_account_id
                        : "",
                    credit_account_user_id:
                      payment_type === "credit"
                        ? payload.credit_account_user_id
                        : "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isCredit && (
              <div className="space-y-4 rounded-xl border p-3">
                <div className="space-y-2">
                  <Label>Credit account</Label>
                  <Select
                    value={payload.credit_account_id}
                    onValueChange={resetCreditAgreement}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select credit account" />
                    </SelectTrigger>
                    <SelectContent>
                      {creditAccounts.map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          {account.name} • {account.account_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedCreditAccount && (
                  <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
                    <div className="flex justify-between">
                      <span>Account type</span>
                      <strong className="capitalize">
                        {selectedCreditAccount.account_type}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>TIN</span>
                      <strong>{selectedCreditAccount.tin_number || "—"}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Representative</span>
                      <strong>
                        {selectedCreditAccount.representative_name || "—"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Phone</span>
                      <strong>
                        {selectedCreditAccount.representative_phone || "—"}
                      </strong>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Active agreement</Label>
                  <Select
                    value={String(
                      selectedAgreement?.id ?? payload.credit_agreement_id,
                    )}
                    onValueChange={(credit_agreement_id) => {
                      const agreement = agreements.find(
                        (row) => String(row.id) === String(credit_agreement_id),
                      );
                      setPayload({
                        ...payload,
                        credit_agreement_id,
                        credit_order_mode: String(
                          agreement?.agreement_type ??
                            payload.credit_order_mode,
                        ),
                        meal_type: agreement?.meal_type ?? payload.meal_type,
                        number_of_person: Number(
                          agreement?.number_of_person ??
                            payload.number_of_person,
                        ),
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select agreement" />
                    </SelectTrigger>
                    <SelectContent>
                      {agreements.length ? (
                        agreements.map((agreement) => (
                          <SelectItem
                            key={agreement.id}
                            value={String(agreement.id)}
                          >
                            {agreement.meal_type} •{" "}
                            {String(
                              agreement.agreement_type ?? "order_based",
                            ).replace("_", " ")}{" "}
                            • {String(agreement.start_date).slice(0, 10)} →{" "}
                            {String(agreement.end_date).slice(0, 10)}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No active agreement
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {selectedAgreement && (
                  <div className="rounded-lg border bg-background p-3 text-xs">
                    <div className="flex justify-between">
                      <span>Status</span>
                      <Badge>{selectedAgreement.status}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Price/person</span>
                      <strong>
                        {money(selectedAgreement.price_per_person)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Total agreement</span>
                      <strong>{money(selectedAgreement.total_price)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Agreement file</span>
                      {agreementFileUrl(selectedAgreement) ? (
                        <a
                          className="text-primary underline"
                          href={agreementFileUrl(selectedAgreement)}
                          target="_blank"
                        >
                          Open file
                        </a>
                      ) : (
                        <strong>—</strong>
                      )}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Credit order mode</Label>
                  <Select
                    value={payload.credit_order_mode}
                    onValueChange={(credit_order_mode) =>
                      setPayload({ ...payload, credit_order_mode })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="order_based">Order Based</SelectItem>
                      <SelectItem value="beef_based">Beef Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selectedCreditAccount?.account_type === "single" && (
                  <div className="space-y-2">
                    <Label>Customer name on bill</Label>
                    <Input
                      value={billCustomerName}
                      onChange={(event) =>
                        setBillCustomerName(event.target.value)
                      }
                      placeholder="Guest"
                    />
                  </div>
                )}
                {isBeefBased && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Meal</Label>
                      <Select
                        value={payload.meal_type}
                        onValueChange={(meal_type) =>
                          setPayload({ ...payload, meal_type })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Breakfast">Breakfast</SelectItem>
                          <SelectItem value="Lunch">Lunch</SelectItem>
                          <SelectItem value="Dinner">Dinner</SelectItem>
                          <SelectItem value="Refreshment">
                            Refreshment
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Number of persons</Label>
                      <Input
                        type="number"
                        min="1"
                        value={payload.number_of_person}
                        onChange={(event) =>
                          setPayload({
                            ...payload,
                            number_of_person: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                )}
                {!selectedAgreement && (
                  <p className="text-sm text-destructive">
                    No active agreement. Credit order is disabled.
                  </p>
                )}
              </div>
            )}

            <Button
              className="w-full"
              disabled={!canSubmit || create.isPending}
              onClick={submit}
            >
              {create.isPending ? "Creating..." : "Create order"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!isBeefBased && (
            <Card className="rounded-2xl">
              <CardHeader className="gap-4 border-b">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Menu items</CardTitle>
                    <CardDescription>
                      Select items, then open the cart to complete the order.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-between gap-3 rounded-xl sm:min-w-48"
                    onClick={() => setCartOpen(true)}
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Cart
                    </span>
                    <Badge variant="secondary">
                      {items.reduce((sum, item) => sum + item.quantity, 0)}
                    </Badge>
                  </Button>
                </div>
                <Input
                  value={menuSearch}
                  onChange={(event) => setMenuSearch(event.target.value)}
                  placeholder="Search menu items..."
                  className="h-11"
                />
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="-mx-1 overflow-x-auto px-1 pb-1">
                  <div
                    className="flex min-w-max gap-2"
                    role="tablist"
                    aria-label="Menu categories"
                  >
                    <Button
                      type="button"
                      role="tab"
                      aria-selected={selectedCategory === "all"}
                      variant={
                        selectedCategory === "all" ? "default" : "outline"
                      }
                      className="rounded-full"
                      onClick={() => setSelectedCategory("all")}
                    >
                      All
                      <Badge
                        variant={
                          selectedCategory === "all"
                            ? "secondary"
                            : "outline"
                        }
                        className="ml-2 rounded-full"
                      >
                        {menuItems.length}
                      </Badge>
                    </Button>

                    {menuCategories.map((category) => {
                      const categoryId = String(category.id);
                      const itemCount = menuItems.filter((item: any) => {
                        const itemCategoryId =
                          item.category_id ??
                          item.menu_category_id ??
                          item.menu_category?.id ??
                          item.category?.id;

                        return String(itemCategoryId) === categoryId;
                      }).length;

                      return (
                        <Button
                          key={category.id}
                          type="button"
                          role="tab"
                          aria-selected={selectedCategory === categoryId}
                          variant={
                            selectedCategory === categoryId
                              ? "default"
                              : "outline"
                          }
                          className="rounded-full"
                          onClick={() => setSelectedCategory(categoryId)}
                        >
                          {category.name}
                          <Badge
                            variant={
                              selectedCategory === categoryId
                                ? "secondary"
                                : "outline"
                            }
                            className="ml-2 rounded-full"
                          >
                            {itemCount}
                          </Badge>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {filteredMenuItems.map((item: any) => {
                    const image = imageUrlFromMenu(item);
                    return (
                      <Card
                        key={item.id}
                        className="overflow-hidden rounded-xl"
                      >
                        <div className="h-32 bg-muted">
                          {image ? (
                            <img
                              src={image}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                              No image
                            </div>
                          )}
                        </div>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">
                            {item.name}
                          </CardTitle>
                          <CardDescription>
                            {money(item.price)} • {item.type}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addItem(item.id)}
                          >
                            <Plus className="mr-2 h-4 w-4" /> Add to cart
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {!menuQuery.isLoading && filteredMenuItems.length === 0 && (
                  <div className="rounded-2xl border border-dashed px-4 py-12 text-center">
                    <p className="font-medium">
                      No menu items in this category
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Select another category or change the search term.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          <Card className="hidden rounded-2xl">
            <CardHeader>
              <CardTitle>
                {isBeefBased ? "Beef Based Summary" : "Add to cart"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isBeefBased ? (
                <div className="rounded-xl border p-4">
                  <p className="font-semibold">{payload.meal_type}</p>
                  <p className="text-sm text-muted-foreground">
                    Persons: {payload.number_of_person}
                  </p>
                  <p className="mt-2 text-xl font-bold">{money(beefTotal)}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length ? (
                        items.map((item) => {
                          const menu = menuItems.find(
                            (m: any) =>
                              String(m.id) === String(item.menu_item_id),
                          );
                          const line = Number(menu?.price ?? 0) * item.quantity;
                          return (
                            <TableRow key={String(item.menu_item_id)}>
                              <TableCell>
                                {menu?.name ?? item.menu_item_id}
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="w-24"
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(event) =>
                                    updateQty(
                                      item.menu_item_id,
                                      Number(event.target.value),
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell>{money(line)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    updateQty(item.menu_item_id, 0)
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="h-24 text-center text-muted-foreground"
                          >
                            No items added to cart.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b px-5 py-5 text-left">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div>
                <SheetTitle className="flex items-center gap-2 text-xl">
                  <ShoppingCart className="h-5 w-5" />
                  Current order
                </SheetTitle>
                <SheetDescription>
                  Review the cart and complete the order information.
                </SheetDescription>
              </div>
              <Badge variant="secondary" className="shrink-0 rounded-full">
                {items.reduce((sum, item) => sum + item.quantity, 0)} items
              </Badge>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <section className="space-y-4">
              <div>
                <h2 className="font-semibold">Order information</h2>
                <p className="text-sm text-muted-foreground">
                  Set service, waiter and payment information.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Order type</Label>
                  <Select
                    value={payload.order_type}
                    onValueChange={(order_type) =>
                      setPayload((current) => ({
                        ...current,
                        order_type,
                        table_id:
                          order_type === "dine_in" ? current.table_id : "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="takeaway">Takeaway</SelectItem>
                      <SelectItem value="dine_in">Dine in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {needsTable && (
                  <div className="space-y-2">
                    <Label>Table</Label>
                    <Select
                      value={payload.table_id}
                      onValueChange={(table_id) =>
                        setPayload((current) => ({ ...current, table_id }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select table" />
                      </SelectTrigger>
                      <SelectContent>
                        {tables.map((table: any) => (
                          <SelectItem key={table.id} value={String(table.id)}>
                            {table.table_number ??
                              table.name ??
                              `Table ${table.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Waiter</Label>
                  <Select
                    value={payload.waiter_id}
                    onValueChange={(waiter_id) =>
                      setPayload((current) => ({ ...current, waiter_id }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select waiter" />
                    </SelectTrigger>
                    <SelectContent>
                      {waiters.map((waiter: any) => (
                        <SelectItem key={waiter.id} value={String(waiter.id)}>
                          {waiter.name ??
                            waiter.full_name ??
                            waiter.email ??
                            `Waiter ${waiter.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Payment type</Label>
                  <Select
                    value={payload.payment_type}
                    onValueChange={(payment_type) =>
                      setPayload((current) => ({
                        ...current,
                        payment_type,
                        credit_account_id:
                          payment_type === "credit"
                            ? current.credit_account_id
                            : "",
                        credit_account_user_id:
                          payment_type === "credit"
                            ? current.credit_account_user_id
                            : "",
                        credit_agreement_id:
                          payment_type === "credit"
                            ? current.credit_agreement_id
                            : "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {isCredit && (
              <section className="space-y-4 rounded-2xl border bg-muted/20 p-4">
                <div>
                  <h2 className="font-semibold">Credit information</h2>
                  <p className="text-sm text-muted-foreground">
                    Scan a card or select the active agreement manually.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={scanText}
                    onChange={(event) => setScanText(event.target.value)}
                    placeholder="Scan credit card"
                  />
                  <Button type="button" variant="outline" onClick={applyScan}>
                    Apply scan
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Credit account</Label>
                  <Select
                    value={payload.credit_account_id}
                    onValueChange={resetCreditAgreement}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select credit account" />
                    </SelectTrigger>
                    <SelectContent>
                      {creditAccounts.map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          {account.name} • {account.account_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCreditAccount && (
                  <div className="grid gap-2 rounded-xl border bg-background p-3 text-sm sm:grid-cols-2">
                    <p>
                      <span className="block text-xs text-muted-foreground">
                        Account
                      </span>
                      <strong>{selectedCreditAccount.name}</strong>
                    </p>
                    <p>
                      <span className="block text-xs text-muted-foreground">
                        Type
                      </span>
                      <strong className="capitalize">
                        {selectedCreditAccount.account_type}
                      </strong>
                    </p>
                    <p>
                      <span className="block text-xs text-muted-foreground">
                        TIN
                      </span>
                      <strong>{selectedCreditAccount.tin_number || "—"}</strong>
                    </p>
                    <p>
                      <span className="block text-xs text-muted-foreground">
                        Representative
                      </span>
                      <strong>
                        {selectedCreditAccount.representative_name || "—"}
                      </strong>
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Active agreement</Label>
                  <Select
                    value={String(
                      selectedAgreement?.id ?? payload.credit_agreement_id,
                    )}
                    onValueChange={(credit_agreement_id) => {
                      const agreement = agreements.find(
                        (row) => String(row.id) === credit_agreement_id,
                      );
                      setPayload((current) => ({
                        ...current,
                        credit_agreement_id,
                        credit_order_mode: String(
                          agreement?.agreement_type ??
                            current.credit_order_mode,
                        ),
                        meal_type: agreement?.meal_type ?? current.meal_type,
                        number_of_person: Number(
                          agreement?.number_of_person ??
                            current.number_of_person,
                        ),
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select agreement" />
                    </SelectTrigger>
                    <SelectContent>
                      {agreements.length ? (
                        agreements.map((agreement) => (
                          <SelectItem
                            key={agreement.id}
                            value={String(agreement.id)}
                          >
                            {agreement.meal_type} •{" "}
                            {String(
                              agreement.agreement_type ?? "order_based",
                            ).replace("_", " ")}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No active agreement
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAgreement && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Agreement rate
                      </p>
                      <p className="font-semibold">
                        {money(selectedAgreement.price_per_person)} ETB/person
                      </p>
                    </div>
                    {agreementFileUrl(selectedAgreement) && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={agreementFileUrl(selectedAgreement)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open agreement
                        </a>
                      </Button>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Credit order mode</Label>
                  <Select
                    value={payload.credit_order_mode}
                    onValueChange={(credit_order_mode) =>
                      setPayload((current) => ({
                        ...current,
                        credit_order_mode,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="order_based">Order Based</SelectItem>
                      <SelectItem value="beef_based">Beef Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedCreditAccount?.account_type === "single" && (
                  <div className="space-y-2">
                    <Label>Customer name on bill</Label>
                    <Input
                      value={billCustomerName}
                      onChange={(event) =>
                        setBillCustomerName(event.target.value)
                      }
                      placeholder="Guest"
                    />
                  </div>
                )}

                {isBeefBased && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Meal</Label>
                      <Select
                        value={payload.meal_type}
                        onValueChange={(meal_type) =>
                          setPayload((current) => ({
                            ...current,
                            meal_type,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Breakfast">Breakfast</SelectItem>
                          <SelectItem value="Lunch">Lunch</SelectItem>
                          <SelectItem value="Dinner">Dinner</SelectItem>
                          <SelectItem value="Refreshment">
                            Refreshment
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Number of persons</Label>
                      <Input
                        type="number"
                        min="1"
                        value={payload.number_of_person}
                        onChange={(event) =>
                          setPayload((current) => ({
                            ...current,
                            number_of_person: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                {!selectedAgreement && (
                  <p className="text-sm font-medium text-destructive">
                    No active agreement. Credit order is disabled.
                  </p>
                )}
              </section>
            )}

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">
                    {isBeefBased ? "Beef based summary" : "Cart items"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {isBeefBased
                      ? "The total is calculated from the agreement rate."
                      : "Adjust quantities before creating the order."}
                  </p>
                </div>
                {!isBeefBased && items.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setItems([])}
                  >
                    Clear
                  </Button>
                )}
              </div>

              {isBeefBased ? (
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{payload.meal_type}</p>
                      <p className="text-sm text-muted-foreground">
                        {payload.number_of_person} persons
                      </p>
                    </div>
                    <p className="text-lg font-bold">
                      {money(beefTotal)} ETB
                    </p>
                  </div>
                </div>
              ) : items.length ? (
                <div className="space-y-2">
                  {items.map((item) => {
                    const menu = menuItems.find(
                      (row: any) =>
                        String(row.id) === String(item.menu_item_id),
                    );
                    const lineTotal =
                      Number(menu?.price ?? 0) * item.quantity;

                    return (
                      <div
                        key={String(item.menu_item_id)}
                        className="flex items-center gap-3 rounded-2xl border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {menu?.name ?? item.menu_item_id}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {money(menu?.price)} ETB each
                          </p>
                        </div>
                        <div className="flex items-center rounded-xl border">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl"
                            onClick={() =>
                              updateQty(item.menu_item_id, item.quantity - 1)
                            }
                            aria-label={`Decrease ${menu?.name ?? "item"}`}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center text-sm font-semibold">
                            {item.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl"
                            onClick={() =>
                              updateQty(item.menu_item_id, item.quantity + 1)
                            }
                            aria-label={`Increase ${menu?.name ?? "item"}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="w-24 text-right text-sm font-bold">
                          {money(lineTotal)}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive hover:text-destructive"
                          onClick={() => updateQty(item.menu_item_id, 0)}
                          aria-label={`Remove ${menu?.name ?? "item"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed px-4 py-10 text-center">
                  <ShoppingCart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">Your cart is empty</p>
                  <p className="text-sm text-muted-foreground">
                    Close the cart and select menu items.
                  </p>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-4 border-t bg-background px-5 py-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Order total</p>
                <p className="text-xs text-muted-foreground">
                  {isBeefBased
                    ? `${payload.number_of_person} persons`
                    : `${items.reduce(
                        (sum, item) => sum + item.quantity,
                        0,
                      )} selected items`}
                </p>
              </div>
              <p className="text-2xl font-bold">{money(total)} ETB</p>
            </div>
            <Button
              type="button"
              size="lg"
              className="w-full rounded-xl"
              disabled={!canSubmit || create.isPending}
              onClick={submit}
            >
              {create.isPending ? "Creating order..." : "Create order"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order created successfully</DialogTitle>
            <DialogDescription>
              Your confirmed cashier order has been created successfully.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/40 p-4 text-sm">
            <p className="text-muted-foreground">Order number</p>
            <p className="text-lg font-semibold">
              {createdOrder?.order_number ?? `#${createdOrder?.id ?? "NEW"}`}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              disabled={!createdOrder}
              onClick={() =>
                createdOrder && printCustomerOrderTicket(createdOrder)
              }
            >
              <Printer className="mr-2 h-4 w-4" />
              Order ticket
            </Button>
            <Button asChild disabled={!createdOrder}>
              <Link
                href={
                  createdOrder?.id
                    ? `/dashboard/order-management/pos/orders/${createdOrder.id}`
                    : "/dashboard/order-management/pos/orders"
                }
              >
                View POS order
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
