import type { Order, OrderItem, OrderMenuItem } from "@/types/order-management";

type PrintableOrder = Partial<Order> & Record<string, any>;

type TicketKind = "customer" | "kitchen" | "bar" | "bill";

const DEFAULT_VAT_RATE = 0.15;
const DEFAULT_SERVICE_CHARGE_RATE = 0;

const SELLER = {
  name: "AIG",
  address: "Ethiopia",
  tin: "TIN-0000000000",
  vatNo: "VAT-0000000000",
};

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : new Date().toLocaleString();
}

function numberValue(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  }
  return 0;
}

function orderItems(order?: PrintableOrder): OrderItem[] {
  return (order?.items ??
    order?.order_items ??
    order?.data?.items ??
    order?.data?.order_items ??
    []) as OrderItem[];
}

function menuOf(item: any): OrderMenuItem | Record<string, any> {
  return item?.menu_item ?? item?.menuItem ?? item?.menu ?? {};
}

function itemName(item: any) {
  const menu = menuOf(item);
  return (
    menu?.name ??
    item?.name ??
    item?.menu_item_name ??
    `Item ${item?.menu_item_id ?? ""}`
  );
}

function itemStation(item: any) {
  const menu = menuOf(item);
  const type = String(menu?.type ?? item?.type ?? "").toLowerCase();
  const station = String(item?.station ?? "").toLowerCase();
  if (station === "kitchen" || station === "bar") return station;
  if (type === "food") return "kitchen";
  if (type === "drink") return "bar";
  return "kitchen";
}

function orderNumber(order?: PrintableOrder) {
  return order?.order_number ?? order?.number ?? `#${order?.id ?? "NEW"}`;
}

function billNumber(order?: PrintableOrder) {
  return (
    order?.bill?.bill_number ??
    order?.billing?.bill_number ??
    `BILL-${orderNumber(order)}`
  );
}

function lineTotal(item: any) {
  const qty = Number(item?.quantity ?? 0);
  const unit = Number(
    item?.unit_price ?? item?.price ?? menuOf(item)?.price ?? 0,
  );
  return Number(item?.line_total ?? item?.total_price ?? qty * unit);
}

function subtotalFromItems(order?: PrintableOrder) {
  return orderItems(order).reduce((sum, item) => sum + lineTotal(item), 0);
}

function billingSummary(order?: PrintableOrder) {
  const bill = order?.bill ?? order?.billing ?? null;
  const subtotal = numberValue(
    bill?.subtotal,
    bill?.sub_total,
    bill?.items_total,
    order?.subtotal,
    order?.sub_total,
    order?.items_total,
    subtotalFromItems(order),
  );

  const serviceRate = numberValue(
    bill?.service_charge_rate,
    bill?.service_rate,
    order?.service_charge_rate,
    order?.service_rate,
    DEFAULT_SERVICE_CHARGE_RATE,
  );
  const vatRate = numberValue(
    bill?.vat_rate,
    bill?.tax_rate,
    order?.vat_rate,
    order?.tax_rate,
    DEFAULT_VAT_RATE,
  );

  const serviceCharge = numberValue(
    bill?.service_charge,
    bill?.service_charge_amount,
    order?.service_charge,
    order?.service_charge_amount,
    subtotal * serviceRate,
  );
  const vat = numberValue(
    bill?.vat,
    bill?.vat_amount,
    bill?.tax,
    bill?.tax_amount,
    order?.vat,
    order?.vat_amount,
    order?.tax,
    order?.tax_amount,
    subtotal * vatRate / (1 + vatRate),
  );
  const grandTotal = numberValue(
    bill?.grand_total,
    bill?.total_amount,
    bill?.total,
    order?.grand_total,
    order?.total_amount,
    order?.total,
    subtotal + serviceCharge,
  );
  const paidAmount = numberValue(bill?.paid_amount, order?.paid_amount, 0);
  const balance = numberValue(
    bill?.balance,
    bill?.balance_amount,
    order?.balance,
    order?.balance_amount,
    Math.max(grandTotal - paidAmount, 0),
  );

  return {
    subtotal,
    serviceRate,
    serviceCharge,
    vatRate,
    vat,
    grandTotal,
    paidAmount,
    balance,
    status: bill?.status ?? order?.payment_status ?? "issued",
  };
}

function rowsHtml(items: OrderItem[], includePrice: boolean) {
  if (!items.length) {
    return `<tr><td colspan="${includePrice ? 4 : 3}" class="empty">No items found.</td></tr>`;
  }

  return items
    .map((item: any) => {
      const qty = Number(item?.quantity ?? 0);
      const note = item?.notes || item?.note;
      return `
        <tr>
          <td>
            <strong>${itemName(item)}</strong>
            ${note ? `<div class="muted">Note: ${String(note)}</div>` : ""}
          </td>
          <td class="center">${qty}</td>
          ${includePrice ? `<td class="right">${money(item?.unit_price ?? item?.price ?? menuOf(item)?.price)}</td>` : ""}
          <td class="right">${includePrice ? money(lineTotal(item)) : String(itemStation(item)).toUpperCase()}</td>
        </tr>`;
    })
    .join("");
}

function baseInfo(order?: PrintableOrder) {
  const table =
    order?.table?.table_number ??
    order?.table?.name ??
    order?.table_number ??
    "—";
  const customer = order?.customer?.name ?? order?.customer_name ?? "Walk-in";
  const cashier = order?.creator?.name ?? order?.cashier?.name ?? "Cashier";
  const type = String(order?.order_type ?? "takeaway").replace(/_/g, " ");

  return `
    <div class="meta"><span>Order No</span><strong>${orderNumber(order)}</strong></div>
    <div class="meta"><span>Date</span><strong>${formatDate(order?.created_at)}</strong></div>
    <div class="meta"><span>Type</span><strong>${type}</strong></div>
    <div class="meta"><span>Table</span><strong>${table}</strong></div>
    <div class="meta"><span>Customer</span><strong>${customer}</strong></div>
    <div class="meta"><span>Cashier</span><strong>${cashier}</strong></div>
  `;
}

function waiterInfoHtml(order?: PrintableOrder) {
  const waiter =
    order?.waiter?.name ??
    order?.assigned_waiter?.name ??
    order?.waiter_name ??
    order?.created_by_user?.name ??
    order?.creator?.name ??
    "—";

  return `<div class="meta"><span>Waiter</span><strong>${waiter}</strong></div>`;
}

function customerTicketHeader() {
  return `
    <div class="header customer-header">
      <div class="brand">${SELLER.name}</div>
      <div class="subtitle">ORDER TICKET</div>
    </div>
  `;
}

function ratePercent(rate: number) {
  return Number(rate * 100).toFixed((rate * 100) % 1 === 0 ? 0 : 2);
}

function financialSummaryHtml(order?: PrintableOrder, includePaid = false) {
  const summary = billingSummary(order);
  return `
    <div class="money-line"><span>Subtotal</span><strong>${money(summary.subtotal)}</strong></div>
    <div class="money-line"><span>Service Charge (${ratePercent(summary.serviceRate)}%)</span><strong>${money(summary.serviceCharge)}</strong></div>
    <div class="money-line"><span>VAT (${ratePercent(summary.vatRate)}%)</span><strong>${money(summary.vat)}</strong></div>
    <div class="total"><span>Grand Total</span><span>${money(summary.grandTotal)}</span></div>
    ${includePaid ? `<div class="meta"><span>Paid Amount</span><strong>${money(summary.paidAmount)}</strong></div><div class="meta"><span>Balance</span><strong>${money(summary.balance)}</strong></div>` : ""}
  `;
}

function sellerHeader(title: string, subtitle: string) {
  return `
    <div class="header">
      <div class="brand">${SELLER.name}</div>
      <div class="subtitle">${title}</div>
      <div class="seller-lines">
        <div>${SELLER.address}</div>
        <div>TIN: ${SELLER.tin}</div>
        <div>VAT Reg. No: ${SELLER.vatNo}</div>
        <div>${subtitle}</div>
      </div>
    </div>
  `;
}

function fiscalInfoHtml(_order?: PrintableOrder) {
  return "";
}

function buyerInfoHtml(order?: PrintableOrder) {
 const creditAccount =
  order?.credit_account ??
  order?.credit_order?.credit_account ??
  (order as any)?.creditOrder?.creditAccount ??
  (order as any)?.creditOrder?.account;
  const customer =
    order?.customer?.name ??
    order?.customer_name ??
    creditAccount?.name ??
    creditAccount?.account_name ??
    "Walk-in Customer";
  const tin =
    order?.customer?.tin ??
    order?.customer_tin ??
    order?.tin_number ??
    creditAccount?.tin_number ??
    creditAccount?.tin ??
    "—";
  return `
    <div class="section-title">Buyer Information</div>
    <div class="meta"><span>Customer</span><strong>${customer}</strong></div>
    <div class="meta"><span>Customer TIN</span><strong>${tin}</strong></div>
  `;
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function qrPlaceholder(order?: PrintableOrder) {
  const payload = JSON.stringify({
    order_no: orderNumber(order),
    bill_no: billNumber(order),
    total: billingSummary(order).grandTotal,
    seller: SELLER.name,
  });
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(payload)}`;

  return `
    <div class="qr-box">
      <img class="qr-img" src="${escapeAttr(qrUrl)}" alt="QR Code" />
      <div class="muted">${orderNumber(order)}</div>
    </div>
  `;
}

function ticketDocumentHtml(title: string, body: string) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          @page { size: 80mm auto; margin: 6mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #111827; margin: 0; background: #fff; }
          .ticket { width: 100%; max-width: 80mm; margin: 0 auto; }
          .header { text-align: center; border-bottom: 1px dashed #9ca3af; padding-bottom: 10px; margin-bottom: 10px; }
          .brand { font-size: 17px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
          .subtitle { font-size: 12px; color: #111827; margin-top: 4px; text-transform: uppercase; letter-spacing: .12em; font-weight: 800; }
          .seller-lines { margin-top: 6px; font-size: 10px; color: #374151; line-height: 1.35; }
          .meta, .money-line { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; padding: 3px 0; }
          .meta span, .money-line span { color: #6b7280; }
          .section-title { margin-top: 12px; border-top: 1px dashed #9ca3af; padding-top: 10px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          th { text-align: left; border-bottom: 1px solid #e5e7eb; padding: 5px 0; color: #374151; }
          td { border-bottom: 1px solid #f3f4f6; padding: 6px 0; vertical-align: top; }
          .right { text-align: right; }
          .center { text-align: center; }
          .muted { color: #6b7280; font-size: 11px; margin-top: 2px; }
          .empty { text-align: center; color: #6b7280; padding: 14px 0; }
          .total { display: flex; justify-content: space-between; gap: 8px; border-top: 1px dashed #9ca3af; margin-top: 10px; padding-top: 10px; font-size: 15px; font-weight: 800; }
          .footer { text-align: center; color: #6b7280; margin-top: 14px; padding-top: 10px; border-top: 1px dashed #9ca3af; font-size: 11px; }
          .unpaid { margin-top: 10px; padding: 7px; border: 1px dashed #ef4444; color: #991b1b; text-align: center; font-weight: 800; font-size: 12px; }
          .qr-box { margin: 12px auto 0; width: 120px; text-align: center; font-size: 10px; }
          .qr-img { width: 110px; height: 110px; margin: 0 auto 4px; display:block; }
          .customer-ticket { padding: 4mm; }
          .customer-ticket .customer-header { padding: 5px 0 8px; margin-bottom: 7px; }
          .customer-ticket .brand { font-size: 15px; }
          .customer-ticket .subtitle { font-size: 10px; margin-top: 3px; }
          .customer-ticket .meta { font-size: 10px; padding: 2px 0; }
          .customer-ticket .section-title { margin-top: 8px; padding-top: 7px; font-size: 10px; }
          .customer-ticket table { margin-top: 5px; font-size: 10px; }
          .customer-ticket th { padding: 4px 0; }
          .customer-ticket td { padding: 4px 0; }
          .customer-ticket .muted { font-size: 9px; }
          .customer-ticket .footer { margin-top: 9px; padding-top: 7px; font-size: 9px; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>${body}</body>
    </html>
  `;
}

function printHtml(title: string, body: string) {
  const win = window.open("", "_blank", "width=420,height=720");
  if (!win) return;

  win.document.open();
  win.document.write(ticketDocumentHtml(title, body));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}

function customerOrderTicketBody(order?: PrintableOrder) {
  const items = orderItems(order);

  return `<div class="ticket customer-ticket">
    ${customerTicketHeader()}
    ${baseInfo(order)}
    ${waiterInfoHtml(order)}
    <div class="section-title">Ordered Items</div>
    <table><thead><tr><th>Item</th><th class="center">Qty</th><th class="right">Station</th></tr></thead><tbody>${rowsHtml(items, false)}</tbody></table>
    <div class="footer">Keep this ticket for pickup and billing.</div>
  </div>`;
}

export function getCustomerOrderTicketDocument(order?: PrintableOrder) {
  return ticketDocumentHtml(
    `Order Ticket ${orderNumber(order)}`,
    customerOrderTicketBody(order),
  );
}

export function printCustomerOrderTicket(order?: PrintableOrder) {
  printHtml(
    `Order Ticket ${orderNumber(order)}`,
    customerOrderTicketBody(order),
  );
}

export function printKitchenTicket(order?: PrintableOrder) {
  const items = orderItems(order).filter(
    (item) => itemStation(item) === "kitchen",
  );
  printHtml(
    `Kitchen Ticket ${orderNumber(order)}`,
    `<div class="ticket">
      ${sellerHeader("KITCHEN TICKET", "Preparation copy")}
      ${baseInfo(order)}
      <div class="section-title">Food Items</div>
      <table><thead><tr><th>Item</th><th class="center">Qty</th><th class="right">Station</th></tr></thead><tbody>${rowsHtml(items, false)}</tbody></table>
      <div class="footer">Kitchen copy - prepare immediately.</div>
    </div>`,
  );
}

export function printBarTicket(order?: PrintableOrder) {
  const items = orderItems(order).filter((item) => itemStation(item) === "bar");
  printHtml(
    `Bar Ticket ${orderNumber(order)}`,
    `<div class="ticket">
      ${sellerHeader("BAR TICKET", "Preparation copy")}
      ${baseInfo(order)}
      <div class="section-title">Drink Items</div>
      <table><thead><tr><th>Item</th><th class="center">Qty</th><th class="right">Station</th></tr></thead><tbody>${rowsHtml(items, false)}</tbody></table>
      <div class="footer">Bar copy - prepare immediately.</div>
    </div>`,
  );
}

export function printOrderBill(order?: PrintableOrder) {
  const items = orderItems(order);
  const summary = billingSummary(order);
  printHtml(
    `Bill ${billNumber(order)}`,
    `<div class="ticket">
      ${sellerHeader("TAX INVOICE / BILL", "Unpaid bill - payment pending")}
      <div class="meta"><span>Invoice / Bill No</span><strong>${billNumber(order)}</strong></div>
      ${baseInfo(order)}
      ${buyerInfoHtml(order)}
      <div class="section-title">Bill Items</div>
      <table><thead><tr><th>Item</th><th class="center">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead><tbody>${rowsHtml(items, true)}</tbody></table>
      <div class="section-title">Charges</div>
      ${financialSummaryHtml(order, true)}
      ${String(summary.status).toLowerCase() !== "paid" ? `<div class="unpaid">UNPAID BILL - NOT PAID RECEIPT</div>` : ""}
      ${qrPlaceholder(order)}
      <div class="footer">This is a Tax Invoice/Bill format. Final paid receipt is issued after payment.</div>
    </div>`,
  );
}
