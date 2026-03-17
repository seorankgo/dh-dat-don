export interface Order {
  id: string;
  orderCode: string;
  trackingCode?: string;
  orderName: string;
  shopId: string;
  staffId: string;
  staffEmail?: string; // For security rules
  shopPrice: number;
  dealPrice: number;
  purchasePrice: number;
  status: 'pending' | 'completed';
  isStaffCommChecked?: boolean;
  isLeaderCommChecked?: boolean;
  createdAt?: any;
  uid: string; // Owner UID
}

export interface Shop {
  id: string;
  name: string;
  uid: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string; // Staff's Google email
  uid: string;
}

export interface Payment {
  id: string;
  staffId: string;
  staffEmail: string;
  amount: number;
  date: any;
  note: string;
  status: 'pending' | 'confirmed';
  uid: string; // Leader UID
}

export interface CommissionResult {
  leaderCommission: number;
  staffCommission: number;
}
