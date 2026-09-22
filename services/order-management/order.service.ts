import api, { unwrap } from '@/lib/api';
import type { ApiEnvelope, Id, CreditAccount, CreditAccountPayload, CreditAgreement, CreditAgreementPayload, CreditMealType, CreditMealTypePayload, CreditOrder, CreditSettlementPayload, Order, OrderFilters, OrderPayload, PackageOrder, PackageOrderPayload, PackageOrderSchedulePayload, PackagePayload, PackageTemplate, PaginatedResponse, PrepTicket, PaymentPayload, ConvertCreditPayload, LiteUser, PaymentMethod } from '@/types/order-management';

function clean(params: Record<string, unknown> = {}) { const out: Record<string, unknown> = {}; Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== '' && v !== 'all') out[k] = v; }); return out; }
function rows<T>(body: any): T[] { const d = body?.data; if (Array.isArray(body)) return body; if (Array.isArray(d)) return d; if (Array.isArray(d?.data)) return d.data; return []; }
function meta(body: any, len: number) {
  const src = body?.data && !Array.isArray(body.data) ? body.data : body;
  const m = body?.meta ?? src ?? {};

  // Preserve report-specific metadata returned by the backend
  // (e.g. category_totals, filtered_subtotal, filtered_quantity)
  // while still normalizing the standard pagination values.
  return {
    ...m,
    current_page: Number(m.current_page ?? 1),
    per_page: Number(m.per_page ?? len ?? 10),
    total: Number(m.total ?? len ?? 0),
    last_page: Number(m.last_page ?? 1),
  };
}
function page<T>(body: any): PaginatedResponse<T> { const data = rows<T>(body); return { success: body?.success, message: body?.message, data, meta: meta(body, data.length) }; }
type OrderApiScope = 'waiter'|'cashier'|'public'|'admin'|'manager'|'food-controller';

function baseEndpoint(scope: OrderApiScope = 'admin') {
  if (scope === 'waiter') return '/waiter/orders';
  if (scope === 'cashier') return '/cashier/orders';
  if (scope === 'public') return '/public/orders';
  if (scope === 'manager') return '/manager/orders';
  if (scope === 'food-controller') return '/food-controller/orders';
  return '/admin/orders';
}

function listEndpoint(scope: OrderApiScope = 'admin') {
  // Backend waiter routes keep list under /waiter/orders/my, while create/actions stay under /waiter/orders.
  // This makes newly created waiter orders appear immediately without changing other scopes.
  if (scope === 'waiter') return '/waiter/orders/my';
  return baseEndpoint(scope);
}

function agreementForm(payload: CreditAgreementPayload) {
  const form = new FormData();
  Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'authorized_persons' || key === 'meal_type_ids') {
      form.append(key, JSON.stringify(value));
      return;
    }
    form.append(key, value as Blob | string);
  });
  return form;
}

export const orderService = {
  async waiters(search = '') { const res = await api.get('/cashier/waiters-lite', { params: clean({ search }) }); return rows<LiteUser>(res.data); },
  async orders(params: OrderFilters = {}, scope: OrderApiScope = 'admin') { const res = await api.get(listEndpoint(scope), { params: clean(params) }); return page<Order>(res.data); },
  async order(id: string|number, scope: OrderApiScope = 'admin') {
    const endpoints = scope === 'waiter'
      ? [`/waiter/orders/${id}`, `/admin/orders/${id}`, `/orders/${id}`]
      : scope === 'cashier'
        ? [`/cashier/orders/${id}`, `/admin/orders/${id}`, `/orders/${id}`]
        : [`${baseEndpoint(scope)}/${id}`, `/admin/orders/${id}`];

    let lastError: unknown;
    for (const endpoint of endpoints) {
      try {
        const res = await api.get(endpoint);
        return unwrap<ApiEnvelope<Order>>(res);
      } catch (error) {
        lastError = error;
      }
    }

    if (scope === 'waiter') {
      try {
        const res = await api.get('/waiter/orders/my', { params: { per_page: 200 } });
        const found = rows<Order>(res.data).find((order) => String(order.id) === String(id));
        if (found) return { success: true, data: found } as ApiEnvelope<Order>;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  },
  async cashierSoldItems(params: any = {}) {
  const res = await api.get('/cashier/sold-items', {
    params: clean(params),
  });

  return res.data;
},
  async createOrder(payload: OrderPayload, scope: OrderApiScope = 'waiter') { const res = await api.post(baseEndpoint(scope), payload); return unwrap<ApiEnvelope<Order>>(res); },
  async confirmOrder(id: string | number, scope: OrderApiScope = 'waiter') {
    const endpoint = scope === 'cashier'
      ? `/cashier/orders/${id}/confirm`
      : `/waiter/orders/${id}/confirm`;

    const res = await api.post(endpoint);
    return unwrap<ApiEnvelope<Order>>(res);
  },
  async serveOrder(id: string|number) { const res = await api.post(`/waiter/orders/${id}/serve`); return unwrap<ApiEnvelope<Order>>(res); },
  async requestCancel(id: string|number, reason: string) { const res = await api.post(`/waiter/orders/${id}/request-cancel`, { reason }); return unwrap<ApiEnvelope<Order>>(res); },
  async approveVoid(id: string|number, reason: string|undefined, scope: 'admin'|'manager'|'food-controller') {
    const res = await api.post(`${baseEndpoint(scope)}/${id}/approve-cancel`, { reason });
    return unwrap<ApiEnvelope<Order>>(res);
  },
  async recordBillPayment(billId: string|number, payload: PaymentPayload) { const res = await api.post(`/cashier/bills/${billId}/payments`, payload); return unwrap<ApiEnvelope<any>>(res); },
  async convertBillToCredit(billId: string|number, payload: ConvertCreditPayload) { const res = await api.post(`/credit/bills/${billId}/convert`, payload); return unwrap<ApiEnvelope<CreditOrder>>(res); },

  async addOrderItem(orderId: string|number, payload: { menu_item_id: Id; quantity: number; notes?: string | null }) { const res = await api.post(`/cashier/orders/${orderId}/items`, payload); return unwrap<ApiEnvelope<Order>>(res); },
  async updateOrderItem(orderId: string|number, itemId: string|number, payload: { quantity: number; notes?: string | null }) { const res = await api.put(`/cashier/orders/${orderId}/items/${itemId}`, payload); return unwrap<ApiEnvelope<Order>>(res); },
  async removeOrderItem(orderId: string|number, itemId: string|number) { const res = await api.delete(`/cashier/orders/${orderId}/items/${itemId}`); return unwrap<ApiEnvelope<Order>>(res); },
  async balanceAccounts(search = '') { const res = await api.get('/cashier/orders/balance-accounts', { params: clean({ search }) }); return rows<any>(res.data); },
  async receiveOrderPayment(orderId: string|number, payload: { customer_name?: string | null; customer_tin?: string | null; payment_method?: PaymentMethod; paid_amount?: number; payment_reference?: string; balance_user_id?: number }) { const res = await api.post(`/cashier/orders/${orderId}/receive-payment`, payload); return unwrap<ApiEnvelope<Order>>(res); },
  async printOrderBill(orderId: string|number, payload: { customer_name?: string | null; customer_tin?: string | null; payment_method?: PaymentMethod; paid_amount?: number }) { return this.receiveOrderPayment(orderId, payload); },

  async prepTickets(kind: 'kitchen'|'bar', params: OrderFilters = {}) { const res = await api.get(`/${kind}/tickets`, { params: clean(params) }); return page<PrepTicket>(res.data); },
  async prepTicketAction(kind: 'kitchen'|'bar', id: string|number, action: 'accept'|'ready'|'served'|'reject'|'delay') { const res = await api.post(`/${kind}/tickets/${id}/${action}`); return unwrap<ApiEnvelope<PrepTicket>>(res); },


  async creditMealTypes(params: Record<string, unknown> = {}) { const res = await api.get('/credit/meal-types', { params: clean(params) }); return rows<CreditMealType>(res.data); },
  async createCreditMealType(payload: CreditMealTypePayload) { const res = await api.post('/credit/meal-types', payload); return unwrap<ApiEnvelope<CreditMealType>>(res); },
  async updateCreditMealType(id: string|number, payload: CreditMealTypePayload) { const res = await api.put(`/credit/meal-types/${id}`, payload); return unwrap<ApiEnvelope<CreditMealType>>(res); },
  async deleteCreditMealType(id: string|number) { const res = await api.delete(`/credit/meal-types/${id}`); return unwrap<ApiEnvelope<null>>(res); },
  async pendingAuthorizedCreditOrders(params: Record<string, unknown> = {}) { const res = await api.get('/credit/pending-orders', { params: clean(params) }); return page<Order>(res.data); },
  async confirmAuthorizedCreditOrder(id: string|number) { const res = await api.post(`/credit/pending-orders/${id}/confirm`); return unwrap<ApiEnvelope<Order>>(res); },
  async myAuthorizedCreditProfile() { const res = await api.get('/customer/credit/profile'); return unwrap<ApiEnvelope<any>>(res); },
  async authorizedCreditMenu(search = '') { const res = await api.get('/customer/credit/menu', { params: clean({ search }) }); return rows<any>(res.data); },
  async myAuthorizedCreditOrders(params: Record<string, unknown> = {}) { const res = await api.get('/customer/credit/orders', { params: clean(params) }); return page<Order>(res.data); },
  async createAuthorizedCreditOrder(payload: { payment_type: 'cash'|'credit'; credit_agreement_id?: Id; meal_type_id?: Id; notes?: string; items: Array<{ menu_item_id: Id; quantity: number; notes?: string }> }) { const res = await api.post('/customer/credit/orders', payload); return unwrap<ApiEnvelope<Order>>(res); },

  async creditAccounts(params: OrderFilters = {}) { const res = await api.get('/credit/accounts', { params: clean(params) }); return page<CreditAccount>(res.data); },
  async createCreditAccount(payload: CreditAccountPayload) { const res = await api.post('/credit/accounts', payload); return unwrap<ApiEnvelope<CreditAccount>>(res); },
  async updateCreditAccount(id: string|number, payload: CreditAccountPayload) { const res = await api.put(`/credit/accounts/${id}`, payload); return unwrap<ApiEnvelope<CreditAccount>>(res); },
  async creditAgreements(accountId: string|number) { const res = await api.get(`/credit/accounts/${accountId}/agreements`, { params: { per_page: 100 } }); return page<CreditAgreement>(res.data); },
  async createCreditAgreement(accountId: string|number, payload: CreditAgreementPayload) { const form = agreementForm(payload); const res = await api.post(`/credit/accounts/${accountId}/agreements`, form, { headers: { 'Content-Type': 'multipart/form-data' } }); return unwrap<ApiEnvelope<CreditAgreement>>(res); },
  async updateCreditAgreement(accountId: string|number, agreementId: string|number, payload: CreditAgreementPayload) { const form = agreementForm(payload); const res = await api.post(`/credit/accounts/${accountId}/agreements/${agreementId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } }); return unwrap<ApiEnvelope<CreditAgreement>>(res); },
  async disableCreditAgreement(accountId: string|number, agreementId: string|number) { const res = await api.patch(`/credit/accounts/${accountId}/agreements/${agreementId}/disable`); return unwrap<ApiEnvelope<CreditAgreement>>(res); },
  async toggleCreditAccount(id: string|number) { const res = await api.patch(`/credit/accounts/${id}/toggle`); return unwrap<ApiEnvelope<CreditAccount>>(res); },
  async scanCreditCard(cardNumber: string) { const res = await api.get('/credit/cards/scan', { params: { card_number: cardNumber } }); return unwrap<ApiEnvelope<any>>(res); },
  async creditOrders(params: OrderFilters = {}) { const res = await api.get('/credit/orders', { params: clean(params) }); return page<CreditOrder>(res.data); },
  async creditAgreementStatement(agreementId: string|number) { const res = await api.get(`/credit/agreements/${agreementId}/statement`); const body = unwrap<ApiEnvelope<any>>(res); return body.data; },
  async settleCreditAgreementOrders(agreementId: string|number, payload: { order_ids: Id[]; payment_method: PaymentMethod; reference_number?: string | null; notes?: string | null }) { const res = await api.post(`/credit/agreements/${agreementId}/settle-orders`, payload); return unwrap<ApiEnvelope<CreditOrder[]>>(res); },
  async approveCreditOrder(id: string|number) { const res = await api.post(`/credit/orders/${id}/approve`); return unwrap<ApiEnvelope<CreditOrder>>(res); },
  async rejectCreditOrder(id: string|number, note?: string) { const res = await api.post(`/credit/orders/${id}/reject`, { note }); return unwrap<ApiEnvelope<CreditOrder>>(res); },
  async settleCreditOrder(id: string|number, payload: CreditSettlementPayload) { const res = await api.post(`/credit/orders/${id}/settlements`, payload); return unwrap<ApiEnvelope<CreditOrder>>(res); },
  async approveCreditSettlement(settlementId: string|number, note?: string) { const res = await api.post(`/credit/settlements/${settlementId}/approve`, { note }); return unwrap<ApiEnvelope<CreditOrder>>(res); },
  async approveCreditAgreementSettlements(agreementId: string|number, payload: { order_ids: Id[]; note?: string | null }) { const res = await api.post(`/credit/agreements/${agreementId}/approve-settlements`, payload); return unwrap<ApiEnvelope<CreditOrder[]>>(res); },

  async packages(params: OrderFilters = {}) { const res = await api.get('/packages', { params: clean(params) }); return page<PackageTemplate>(res.data); },
  async package(id: string|number) { const res = await api.get(`/packages/${id}`); return unwrap<ApiEnvelope<PackageTemplate>>(res); },
  async createPackage(payload: PackagePayload) { const res = await api.post('/packages', payload); return unwrap<ApiEnvelope<PackageTemplate>>(res); },
  async updatePackage(id: string|number, payload: PackagePayload) { const res = await api.put(`/packages/${id}`, payload); return unwrap<ApiEnvelope<PackageTemplate>>(res); },
  async deletePackage(id: string|number) { const res = await api.delete(`/packages/${id}`); return unwrap<ApiEnvelope<PackageTemplate>>(res); },
  async packageOrders(params: OrderFilters = {}) { const res = await api.get('/package-orders', { params: clean(params) }); return page<PackageOrder>(res.data); },
  async packageOrder(id: string|number) { const res = await api.get(`/package-orders/${id}`); return unwrap<ApiEnvelope<PackageOrder>>(res); },
  async createPackageOrder(payload: PackageOrderPayload) { const res = await api.post('/package-orders', payload); return unwrap<ApiEnvelope<PackageOrder>>(res); },
  async updatePackageOrder(id: string|number, payload: PackageOrderPayload) { const res = await api.put(`/package-orders/${id}`, payload); return unwrap<ApiEnvelope<PackageOrder>>(res); },
  async schedulePackageOrder(id: string|number, payload: PackageOrderSchedulePayload) { const res = await api.post(`/package-orders/${id}/schedule`, payload); return unwrap<ApiEnvelope<PackageOrder>>(res); },
  async packageOrderAction(id: string|number, action: 'approve'|'start-preparation'|'mark-ready'|'deliver'|'complete'|'cancel') { const res = await api.post(`/package-orders/${id}/${action}`); return unwrap<ApiEnvelope<PackageOrder>>(res); },
};
export default orderService;
