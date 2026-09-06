"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, MoreHorizontal, Pencil, Plus, Printer, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { orderService } from "@/services/order-management/order.service";
import { authService } from "@/services/auth/auth.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CreditAccount, CreditAccountUser, CreditAgreement, CreditAgreementPayload, CreditMealType } from "@/types/order-management";

type AuthorizedPersonForm = {
  id?: string | number;
  full_name: string;
  phone: string;
  is_active: boolean;
};

type AgreementForm = {
  meal_type_ids: Array<string | number>;
  number_of_person: string;
  single_person_name: string;
  price_per_person: string;
  start_date: string;
  end_date: string;
  total_price: string;
  status: string;
  agreement_letter: File | null;
  authorized_persons: AuthorizedPersonForm[];
};

function emptyPerson(): AuthorizedPersonForm {
  return { full_name: "", phone: "", is_active: true };
}

function emptyAgreement(): AgreementForm {
  return {
    meal_type_ids: [],
    number_of_person: "1",
    single_person_name: "",
    price_per_person: "0",
    start_date: "",
    end_date: "",
    total_price: "",
    status: "active",
    agreement_letter: null,
    authorized_persons: [emptyPerson()],
  };
}

function active(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function agreementUsers(agreement: CreditAgreement): CreditAccountUser[] {
  return ((agreement as any).authorized_users ?? (agreement as any).authorizedUsers ?? []) as CreditAccountUser[];
}

function agreementMealTypes(agreement: CreditAgreement): CreditMealType[] {
  return ((agreement as any).meal_types ?? (agreement as any).mealTypes ?? []) as CreditMealType[];
}

function isAgreementActiveNow(agreement: CreditAgreement) {
  const today = new Date().toISOString().slice(0, 10);
  return String(agreement.status ?? "active") === "active"
    && String(agreement.start_date ?? "").slice(0, 10) <= today
    && String(agreement.end_date ?? "").slice(0, 10) >= today;
}

function formFromAgreement(agreement: CreditAgreement): AgreementForm {
  const users = agreementUsers(agreement);
  return {
    meal_type_ids: agreementMealTypes(agreement).map((mealType) => mealType.id),
    number_of_person: String(agreement.number_of_person ?? 1),
    single_person_name: agreement.single_person_name ?? "",
    price_per_person: String(agreement.price_per_person ?? 0),
    start_date: String(agreement.start_date ?? "").slice(0, 10),
    end_date: String(agreement.end_date ?? "").slice(0, 10),
    total_price: String(agreement.total_price ?? ""),
    status: String(agreement.status ?? "active"),
    agreement_letter: null,
    authorized_persons: users.length
      ? users.map((user) => ({
          id: user.id,
          full_name: user.full_name ?? "",
          phone: user.phone ?? "",
          is_active: user.is_active === undefined ? true : active(user.is_active),
        }))
      : [emptyPerson()],
  };
}

function payload(form: AgreementForm): CreditAgreementPayload {
  const persons = Math.max(1, Number(form.number_of_person || 1));
  const price = Number(form.price_per_person || 0);
  return {
    meal_type_ids: form.meal_type_ids,
    number_of_person: persons,
    single_person_name: form.single_person_name.trim() || null,
    price_per_person: price,
    start_date: form.start_date,
    end_date: form.end_date,
    total_price: form.total_price ? Number(form.total_price) : persons * price,
    status: form.status,
    agreement_letter: form.agreement_letter,
    authorized_persons: form.authorized_persons.map((person) => ({
      id: person.id,
      full_name: person.full_name.trim(),
      phone: person.phone.trim(),
      is_active: person.is_active,
    })),
  };
}

export default function CreditAccountDetailPage() {
  const currentRoles = authService.getStoredRoles().map((role) => String(role).trim().toLowerCase());
  const canManageMealTypes = currentRoles.some((role) => ["manager", "cafeteria-manager", "general admin", "general-admin", "admin"].includes(role));
  const params = useParams();
  const accountId = String(params?.id ?? "");
  const queryClient = useQueryClient();

  const [agreementOpen, setAgreementOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<CreditAgreement | null>(null);
  const [agreementForm, setAgreementForm] = useState<AgreementForm>(emptyAgreement());
  const [savingAgreement, setSavingAgreement] = useState(false);

  const [mealTypeOpen, setMealTypeOpen] = useState(false);
  const [editingMealType, setEditingMealType] = useState<CreditMealType | null>(null);
  const [mealTypeName, setMealTypeName] = useState("");
  const [mealTypeStatus, setMealTypeStatus] = useState(true);
  const [savingMealType, setSavingMealType] = useState(false);

  const accountQuery = useQuery({
    queryKey: ["credit-account-detail", accountId],
    queryFn: async () => (await api.get(`/credit/accounts/${accountId}`)).data?.data as CreditAccount,
    enabled: Boolean(accountId),
  });

  const mealTypesQuery = useQuery({
    queryKey: ["credit-meal-types"],
    queryFn: () => orderService.creditMealTypes(),
  });

  const account = accountQuery.data;
  const agreements = ((account as any)?.agreements ?? []) as CreditAgreement[];
  const mealTypes = mealTypesQuery.data ?? [];
  const activeMealTypes = mealTypes.filter((item) => active(item.is_active ?? true));
  const totalValue = useMemo(() => agreements.reduce((sum, row) => sum + Number(row.total_price ?? 0), 0), [agreements]);

  function refresh() {
    accountQuery.refetch();
    mealTypesQuery.refetch();
  }

  function openCreateAgreement() {
    setEditingAgreement(null);
    setAgreementForm(emptyAgreement());
    setAgreementOpen(true);
  }

  function openEditAgreement(agreement: CreditAgreement) {
    setEditingAgreement(agreement);
    setAgreementForm(formFromAgreement(agreement));
    setAgreementOpen(true);
  }

  async function saveAgreement() {
    if (!account) return;
    const data = payload(agreementForm);

    if (!data.meal_type_ids.length) return toast.error("Select at least one meal type");
    if (!data.start_date || !data.end_date) return toast.error("Date range is required");
    if (!data.authorized_persons?.length) return toast.error("Add at least one authorized person");
    if (data.authorized_persons.some((person) => !person.full_name || !person.phone)) {
      return toast.error("Full name and phone number are required for every authorized person");
    }
    if (data.status === "active" && !data.authorized_persons.some((person) => person.is_active !== false)) {
      return toast.error("At least one authorized person must be active");
    }

    setSavingAgreement(true);
    try {
      if (editingAgreement) {
        await orderService.updateCreditAgreement(account.id, editingAgreement.id, data);
        toast.success("Agreement updated");
      } else {
        await orderService.createCreditAgreement(account.id, data);
        toast.success("Agreement created");
      }
      setAgreementOpen(false);
      refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? error?.message ?? "Failed to save agreement");
    } finally {
      setSavingAgreement(false);
    }
  }

  async function disableAgreement(agreement: CreditAgreement) {
    if (!account) return;
    try {
      await orderService.disableCreditAgreement(account.id, agreement.id);
      toast.success("Agreement disabled");
      refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Failed to disable agreement");
    }
  }

  function openCreateMealType() {
    setEditingMealType(null);
    setMealTypeName("");
    setMealTypeStatus(true);
    setMealTypeOpen(true);
  }

  function openEditMealType(item: CreditMealType) {
    setEditingMealType(item);
    setMealTypeName(item.name);
    setMealTypeStatus(active(item.is_active ?? true));
    setMealTypeOpen(true);
  }

  async function saveMealType() {
    if (!mealTypeName.trim()) return toast.error("Meal type name is required");
    setSavingMealType(true);
    try {
      if (editingMealType) {
        await orderService.updateCreditMealType(editingMealType.id, { name: mealTypeName.trim(), is_active: mealTypeStatus });
        toast.success("Meal type updated");
      } else {
        await orderService.createCreditMealType({ name: mealTypeName.trim(), is_active: mealTypeStatus });
        toast.success("Meal type created");
      }
      setMealTypeOpen(false);
      refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? error?.message ?? "Failed to save meal type");
    } finally {
      setSavingMealType(false);
    }
  }

  async function deleteMealType(item: CreditMealType) {
    if (!window.confirm(`Delete meal type "${item.name}"?`)) return;
    try {
      await orderService.deleteCreditMealType(item.id);
      toast.success("Meal type deleted");
      refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? error?.message ?? "Failed to delete meal type");
    }
  }

  if (accountQuery.isLoading) return <div className="p-6 text-muted-foreground">Loading credit account...</div>;
  if (!account) return <div className="p-6 text-muted-foreground">Credit account was not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Button asChild variant="ghost" className="px-0">
            <Link href="/dashboard/order-management/credit-accounts"><ArrowLeft className="mr-2 h-4 w-4" />Back to credit accounts</Link>
          </Button>
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <p className="text-muted-foreground">{canManageMealTypes ? "Manage meal types, agreements, and authorized-person login access." : "Manage agreements and authorized-person login access."}</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><CardDescription>Account No.</CardDescription><CardTitle>CR-{String(account.id).padStart(6, "0")}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Account type</CardDescription><CardTitle className="capitalize">{account.account_type ?? "—"}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Agreements</CardDescription><CardTitle>{agreements.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Agreement value</CardDescription><CardTitle>{money(totalValue)}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account information</CardTitle>
          <CardDescription>Authorized persons receive a Customer login account. Their phone number is their login identifier and initial password.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Account name</p><p className="font-semibold">{account.name}</p></div>
          <div><p className="text-xs text-muted-foreground">TIN number</p><p className="font-semibold">{account.tin_number ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Status</p><Badge variant={String(account.status) === "active" ? "outline" : "destructive"}>{account.status ?? "active"}</Badge></div>
          <div><p className="text-xs text-muted-foreground">Representative</p><p className="font-semibold">{account.representative_name ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Representative phone</p><p className="font-semibold">{account.representative_phone ?? "—"}</p></div>
        </CardContent>
      </Card>

      {canManageMealTypes && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Meal types</CardTitle>
              <CardDescription>Create and maintain the meal types used by credit agreements and authorized-person orders.</CardDescription>
            </div>
            <Button onClick={openCreateMealType}><Plus className="mr-2 h-4 w-4" />Add meal type</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Agreements</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {mealTypes.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell><Badge variant={active(item.is_active ?? true) ? "outline" : "secondary"}>{active(item.is_active ?? true) ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell>{item.agreements_count ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditMealType(item)}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</Button>
                        <Button size="sm" variant="destructive" disabled={Number(item.agreements_count ?? 0) > 0} onClick={() => deleteMealType(item)}><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!mealTypes.length && <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No meal types created yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Agreements</CardTitle>
            <CardDescription>Each active agreement must have meal type(s) and at least one active authorized person.</CardDescription>
          </div>
          <Button onClick={openCreateAgreement}><FileText className="mr-2 h-4 w-4" />Add agreement</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meal type(s)</TableHead><TableHead>Person(s)</TableHead><TableHead>Price / person</TableHead>
                <TableHead>Date range</TableHead><TableHead>Total</TableHead><TableHead>Authorized persons</TableHead>
                <TableHead>File</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agreements.map((agreement) => {
                const canOrder = isAgreementActiveNow(agreement);
                const users = agreementUsers(agreement);
                const selectedMeals = agreementMealTypes(agreement);
                return (
                  <TableRow key={agreement.id}>
                    <TableCell className="font-medium">{selectedMeals.length ? selectedMeals.map((m) => m.name).join(", ") : agreement.meal_type}</TableCell>
                    <TableCell>{agreement.number_of_person ?? 1}</TableCell>
                    <TableCell>{money(agreement.price_per_person)}</TableCell>
                    <TableCell>{fmtDate(agreement.start_date)} → {fmtDate(agreement.end_date)}</TableCell>
                    <TableCell>{money(agreement.total_price)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {users.slice(0, 2).map((user) => <div key={user.id} className="text-sm">{user.full_name} · {user.phone}</div>)}
                        {users.length > 2 && <div className="text-xs text-muted-foreground">+{users.length - 2} more</div>}
                      </div>
                    </TableCell>
                    <TableCell>{agreement.agreement_letter_url ? <Button asChild size="sm" variant="outline"><a href={agreement.agreement_letter_url} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Open</a></Button> : "—"}</TableCell>
                    <TableCell><Badge variant={canOrder ? "outline" : "destructive"}>{canOrder ? "Active for order" : String(agreement.status ?? "expired")}</Badge></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditAgreement(agreement)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem disabled={String(agreement.status) !== "active"} onClick={() => disableAgreement(agreement)}>Disable</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!agreements.length && <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No agreements added yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={mealTypeOpen} onOpenChange={setMealTypeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingMealType ? "Edit meal type" : "Add meal type"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={mealTypeName} onChange={(e) => setMealTypeName(e.target.value)} placeholder="Breakfast, Lunch, Dinner..." /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={mealTypeStatus ? "active" : "inactive"} onValueChange={(value) => setMealTypeStatus(value === "active")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setMealTypeOpen(false)}>Cancel</Button><Button disabled={savingMealType} onClick={saveMealType}>{editingMealType ? "Update" : "Create"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={agreementOpen} onOpenChange={setAgreementOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingAgreement ? "Edit agreement" : "Add agreement"}</DialogTitle></DialogHeader>

          <div className="space-y-6">
            <div>
              <Label className="mb-3 block">Meal type(s) *</Label>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {activeMealTypes.map((item) => {
                  const checked = agreementForm.meal_type_ids.some((id) => String(id) === String(item.id));
                  return (
                    <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => setAgreementForm((current) => ({
                          ...current,
                          meal_type_ids: value
                            ? [...current.meal_type_ids, item.id]
                            : current.meal_type_ids.filter((id) => String(id) !== String(item.id)),
                        }))}
                      />
                      <span className="font-medium">{item.name}</span>
                    </label>
                  );
                })}
              </div>
              {!activeMealTypes.length && <p className="mt-2 text-sm text-destructive">Create an active meal type first.</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2"><Label>Person(s)</Label><Input type="number" min={1} value={agreementForm.number_of_person} onChange={(e) => setAgreementForm({ ...agreementForm, number_of_person: e.target.value })} /></div>
              <div className="space-y-2"><Label>Price / person</Label><Input type="number" min={0} step="0.01" value={agreementForm.price_per_person} onChange={(e) => setAgreementForm({ ...agreementForm, price_per_person: e.target.value })} /></div>
              <div className="space-y-2"><Label>Total</Label><Input type="number" min={0} step="0.01" value={agreementForm.total_price} onChange={(e) => setAgreementForm({ ...agreementForm, total_price: e.target.value })} placeholder="Auto if empty" /></div>
              <div className="space-y-2"><Label>Start date</Label><Input type="date" value={agreementForm.start_date} onChange={(e) => setAgreementForm({ ...agreementForm, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>End date</Label><Input type="date" value={agreementForm.end_date} onChange={(e) => setAgreementForm({ ...agreementForm, end_date: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={agreementForm.status} onValueChange={(status) => setAgreementForm({ ...agreementForm, status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="disabled">Disabled</SelectItem><SelectItem value="expired">Expired</SelectItem></SelectContent>
                </Select>
              </div>
              {account.account_type === "single" && <div className="space-y-2 md:col-span-2"><Label>Person name</Label><Input value={agreementForm.single_person_name} onChange={(e) => setAgreementForm({ ...agreementForm, single_person_name: e.target.value })} /></div>}
              <div className="space-y-2 md:col-span-3"><Label>Agreement letter file</Label><Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setAgreementForm({ ...agreementForm, agreement_letter: e.target.files?.[0] ?? null })} /></div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Authorized persons</h3>
                  <p className="text-sm text-muted-foreground">Full name, phone number and status only. New persons automatically receive a Customer account; phone = login and initial password.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setAgreementForm((current) => ({ ...current, authorized_persons: [...current.authorized_persons, emptyPerson()] }))}>
                  <UserPlus className="mr-2 h-4 w-4" />Add person
                </Button>
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Full name</TableHead><TableHead>Phone number</TableHead><TableHead>Status</TableHead><TableHead className="w-[70px]"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {agreementForm.authorized_persons.map((person, index) => (
                      <TableRow key={`${person.id ?? "new"}-${index}`}>
                        <TableCell><Input value={person.full_name} onChange={(e) => setAgreementForm((current) => ({ ...current, authorized_persons: current.authorized_persons.map((row, i) => i === index ? { ...row, full_name: e.target.value } : row) }))} placeholder="Full name" /></TableCell>
                        <TableCell><Input value={person.phone} onChange={(e) => setAgreementForm((current) => ({ ...current, authorized_persons: current.authorized_persons.map((row, i) => i === index ? { ...row, phone: e.target.value } : row) }))} placeholder="09..." /></TableCell>
                        <TableCell>
                          <Select value={person.is_active ? "active" : "inactive"} onValueChange={(value) => setAgreementForm((current) => ({ ...current, authorized_persons: current.authorized_persons.map((row, i) => i === index ? { ...row, is_active: value === "active" } : row) }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" disabled={agreementForm.authorized_persons.length === 1} onClick={() => setAgreementForm((current) => ({ ...current, authorized_persons: current.authorized_persons.filter((_, i) => i !== index) }))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAgreementOpen(false)}>Cancel</Button>
              <Button disabled={savingAgreement || !activeMealTypes.length} onClick={saveAgreement}>{editingAgreement ? "Update agreement" : "Save agreement"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
