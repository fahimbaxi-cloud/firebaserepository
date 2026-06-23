export type UserRole = 'customer' | 'admin' | 'delivery' | 'super-admin';

export type VegNonVeg = 'Veg' | 'Non-Veg';

export type TimeSlot = 'Morning' | 'Noon';

export type OrderStatus = 'Pending' | 'Assigned' | 'Picked Up' | 'Out for Delivery' | 'Delivered' | 'Cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'partial';

export interface Unit {
  id: string;
  name: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface IncomeCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface RawItemConversion {
  unitId: string;
  factor: number; // 1 [Base Unit] = [Factor] * [This Unit]
}

export interface MenuItemIngredient {
  rawItemId: string;
  quantity: number;
  unitId: string;
}

export interface MenuItem {
  id: string;
  name: string;
  type: VegNonVeg;
  slot: TimeSlot;
  price: number;
  description: string;
  imageUrl: string;
  ingredients?: MenuItemIngredient[];
  show?: boolean;
}

export interface BroadcastPackage {
  id: string;
  name: string;
  type: 'daily' | 'monthly';
  dateContext: string; // e.g., "March 15, 2024" or "March 2024"
  itemsCount: number;
  price: number;
  message: string;
  createdAt: string;
  imageUrl?: string;
  items?: string[]; // IDs of menu items included
  monthlyAssignments?: Record<string, string[]>;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  packageName?: string;
  packageQuantity: number;
  address: string;
  mobile: string;
  items: {
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;
    type: VegNonVeg;
  }[];
  total: number;
  type: 'Daily' | 'Subscription';
  slot: TimeSlot;
  deliveryTime: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  assignedTo?: string; // Delivery boy ID
  referenceDate?: string; // Date when the order was given (Booking Date)
  createdAt: Date;
  dailyStatuses?: Record<string, OrderStatus>;
}

export interface User {
  id: string;
  bacchabiteId: string; // Unique BacchaBite ID used for login
  email: string;
  mobileNumber: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  address: string;
  createdAt: string;
  updatedAt: string;
  password?: string; // Included for mock management purposes
}

export interface AppConfig {
  id: string;
  faviconUrl?: string;
  appIconUrl?: string;
  webAppIconUrl?: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  customerId: string;
  customerName: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  read?: boolean;
  createdAt: string;
}

export interface PurchaseItem {
  rawItemId: string;
  quantity: number;
  unitId: string;
  rate: number;
  amount: number;
}

export interface Purchase {
  id: string;
  supplierId: string;
  date: string;
  items: PurchaseItem[];
  totalAmount: number;
  status: 'Pending' | 'Received';
  createdAt: string;
}

export interface Payment {
  id: string;
  supplierId?: string;
  supplierName: string;
  date: string;
  amount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer';
  notes?: string;
  createdAt: string;
}

export interface CustomerReceipt {
  id: string;
  customerId: string;
  customerName: string;
  orderIds: string[];
  amount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer';
  date: string;
  notes?: string;
  createdAt: string;
}

export interface GeneralTransaction {
  id: string;
  type: 'Income' | 'Expense';
  categoryId: string;
  categoryName: string;
  amount: number;
  date: string;
  paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer';
  notes?: string;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  debitAccountId: string; // ID of account to debit
  debitAccountName: string;
  creditAccountId: string; // ID of account to credit
  creditAccountName: string;
  amount: number;
  notes: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  createdAt: string;
}

export interface RawItem {
  id: string;
  name: string;
  baseUnitId: string;
  categoryId: string;
  conversions?: RawItemConversion[];
  openingStock: number; // Stock level at the beginning of tracking
  openingValue: number; // Monetary value of opening stock
  currentStock: number; // Computed or cached stock level
  createdAt: string;
}

export type GLAccountGroup = 
  | 'Capital' 
  | 'Secured Loan' 
  | 'Drawings' 
  | 'Creditors' 
  | 'Unsecured Loan' 
  | 'Outstanding Expense' 
  | 'Pre-received Income' 
  | 'Fixed Assets' 
  | 'Investment' 
  | 'Cash' 
  | 'Bank' 
  | 'UPI'
  | 'Profit & Loss'
  | 'Advance Given' 
  | 'Advance Received' 
  | 'Debtors' 
  | 'Loan Given' 
  | 'Reserves and Surplus' 
  | 'Outstanding Income' 
  | 'Pre-paid Expense';

export interface GLAccount {
  id: string;
  name: string;
  group: GLAccountGroup;
  openingBalance: number;
  openingType: 'Debit' | 'Credit';
  createdAt: string;
}

export interface ManufacturingLog {
  id: string;
  packageId: string;
  packageName: string;
  quantity: number;
  date: string;
  ingredientsUsed: {
    rawItemId: string;
    name: string;
    quantity: number;
    unitName: string;
  }[];
}
