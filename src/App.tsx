import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Calculator, ShoppingBag, User, Store, DollarSign, TrendingUp, Copy, Filter, X, Settings2, LogIn, LogOut, Loader2, History, CheckCircle2, Clock, Download, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, Shop, Staff, Payment } from './types';
import { auth, db, googleProvider, handleFirestoreError, OperationType, initFirebase } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp } from 'firebase/firestore';

import { utils, writeFile } from 'xlsx';

const LEADER_EMAILS = ['seorankgo@gmail.com', 'ngannhishop@gmail.com', 'ntvh2012@gmail.com'];

const INITIAL_ORDER: Omit<Order, 'id'> = {
  orderCode: '',
  trackingCode: '',
  orderName: '',
  shopId: '',
  staffId: '',
  staffEmail: '',
  shopPrice: 0,
  dealPrice: 0,
  purchasePrice: 0,
  status: 'pending',
  isStaffCommChecked: false,
  isLeaderCommChecked: false,
  uid: '',
};

// Error Boundary Component
function ErrorDisplay({ error, onClear }: { error: string, onClear: () => void }) {
  let message = "Đã xảy ra lỗi không xác định.";
  try {
    const errObj = JSON.parse(error);
    if (errObj.error.includes("insufficient permissions")) {
      message = "Bạn không có quyền thực hiện thao tác này. Vui lòng kiểm tra lại đăng nhập.";
    } else {
      message = errObj.error;
    }
  } catch {
    message = error;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-red-600 text-white p-4 rounded-xl shadow-2xl z-50 flex items-center gap-4 max-w-md animate-bounce">
      <p className="text-sm font-medium">{message}</p>
      <button onClick={onClear} className="p-1 hover:bg-red-500 rounded-lg transition-all">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function App() {
  // Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isFirebaseInit, setIsFirebaseInit] = useState(false);

  // Data Lists
  const [shops, setShops] = useState<Shop[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // UI States
  const [activeTab, setActiveTab] = useState<'orders' | 'payments'>('orders');
  const [filterShopId, setFilterShopId] = useState<string>('all');
  const [filterStaffId, setFilterStaffId] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [showSettings, setShowSettings] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkImportShopId, setBulkImportShopId] = useState('');
  const [newShopName, setNewShopName] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editStaffEmail, setEditStaffEmail] = useState('');
  const [appError, setAppError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [myStaffId, setMyStaffId] = useState<string | null>(null);
  const [leaderUid, setLeaderUid] = useState<string | null>(null);

  // Payment Form State
  const [payStaffId, setPayStaffId] = useState('');
  const [payAmount, setPayAmount] = useState(0);
  const [payNote, setPayNote] = useState('');

  const isLeader = user?.email && LEADER_EMAILS.includes(user.email);
  const isStaff = !!myStaffId;
  const role = isLeader ? 'leader' : (isStaff ? 'staff' : 'guest');

  // Firebase Init
  useEffect(() => {
    initFirebase().then(() => {
      setIsFirebaseInit(true);
    });
  }, []);

  // Auth Listener
  useEffect(() => {
    if (!isFirebaseInit) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (!u) setIsLoading(false);
    });
    return () => unsubscribe();
  }, [isFirebaseInit]);

  // Firestore Listeners
  useEffect(() => {
    if (!isAuthReady || !user || !isFirebaseInit) {
      setShops([]);
      setStaff([]);
      setOrders([]);
      return;
    }

    setIsLoading(true);

    // If Leader, query all data (Rules will restrict to what they can see)
    if (isLeader) {
      const shopsQuery = query(collection(db, 'shops'));
      const staffQuery = query(collection(db, 'staff'));
      const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', sortOrder));
      const paymentsQuery = query(collection(db, 'payments'), orderBy('date', 'desc'));

      const unsubShops = onSnapshot(shopsQuery, (snapshot) => {
        setShops(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shop)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'shops'));

      const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
        setStaff(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Staff)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'staff'));

      const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
        setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
        setIsLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'orders');
        setIsLoading(false);
      });

      const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
        setPayments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
      });

      return () => {
        unsubShops();
        unsubStaff();
        unsubOrders();
        unsubPayments();
      };
    } else {
      // If not Leader, find if they are Staff
      const staffByEmailQuery = query(collection(db, 'staff'), where('email', '==', user.email));
      
      const unsubStaffCheck = onSnapshot(staffByEmailQuery, (snapshot) => {
        if (!snapshot.empty) {
          const staffDoc = snapshot.docs[0];
          const staffData = staffDoc.data() as Staff;
          setMyStaffId(staffDoc.id);
          setLeaderUid(staffData.uid);
          
          // Once we have leaderUid and myStaffId, query their data
          const shopsQuery = query(collection(db, 'shops'), where('uid', '==', staffData.uid));
          const ordersQuery = query(
            collection(db, 'orders'), 
            where('staffEmail', '==', user.email), 
            orderBy('createdAt', sortOrder)
          );
          const paymentsQuery = query(
            collection(db, 'payments'), 
            where('staffEmail', '==', user.email), 
            orderBy('date', 'desc')
          );

          const unsubShops = onSnapshot(shopsQuery, (snapshot) => {
            setShops(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shop)));
          }, (err) => handleFirestoreError(err, OperationType.LIST, 'shops'));

          const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
            setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
            setIsLoading(false);
          }, (err) => {
            handleFirestoreError(err, OperationType.LIST, 'orders');
            setIsLoading(false);
          });

          const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
            setPayments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
          }, (err) => handleFirestoreError(err, OperationType.LIST, 'payments'));

          // Note: We don't return cleanup here because it's inside another listener
          // The outer cleanup will handle unsubStaffCheck
        } else {
          setIsLoading(false);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'staff');
        setIsLoading(false);
      });

      return () => unsubStaffCheck();
    }
  }, [isAuthReady, user, sortOrder, isLeader]);

  // Actions
  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
        setAppError(err instanceof Error ? err.message : String(err));
      }
      console.error(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  const addOrder = async () => {
    if (!user) return;
    const path = 'orders';
    try {
      const newDocRef = doc(collection(db, path));
      await setDoc(newDocRef, {
        ...INITIAL_ORDER,
        uid: user.uid,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      setAppError(err instanceof Error ? err.message : String(err));
    }
  };

  const duplicateOrder = async (order: Order) => {
    if (!user) return;
    const path = 'orders';
    try {
      const { id, ...orderData } = order;
      const newDocRef = doc(collection(db, path));
      await setDoc(newDocRef, {
        ...orderData,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      setAppError(err instanceof Error ? err.message : String(err));
    }
  };

  const removeOrder = async (id: string) => {
    const path = `orders/${id}`;
    try {
      await deleteDoc(doc(db, 'orders', id));
    } catch (err) {
      setAppError(err instanceof Error ? err.message : String(err));
    }
  };

  const updateOrder = async (id: string, field: keyof Order, value: string | number) => {
    try {
      const updates: any = { [field]: value };
      
      // If updating staffId, also update staffEmail for security rules
      if (field === 'staffId') {
        const selectedStaff = staff.find(s => s.id === value);
        updates.staffEmail = selectedStaff?.email || '';
      }

      await updateDoc(doc(db, 'orders', id), updates);
    } catch (err) {
      setAppError(err instanceof Error ? err.message : String(err));
    }
  };

  const addShop = async () => {
    if (!newShopName.trim() || !user) return;
    try {
      const newDocRef = doc(collection(db, 'shops'));
      await setDoc(newDocRef, {
        name: newShopName,
        uid: user.uid
      });
      setNewShopName('');
    } catch (err) {
      setAppError(err instanceof Error ? err.message : String(err));
    }
  };

  const addStaff = async () => {
    if (!newStaffName.trim() || !newStaffEmail.trim() || !user) return;
    try {
      const newDocRef = doc(collection(db, 'staff'));
      await setDoc(newDocRef, {
        name: newStaffName,
        email: newStaffEmail.toLowerCase().trim(),
        uid: user.uid
      });
      setNewStaffName('');
      setNewStaffEmail('');
    } catch (err) {
      setAppError(err instanceof Error ? err.message : String(err));
    }
  };

  const removeShop = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'shops', id));
    } catch (err) {
      setAppError(err instanceof Error ? err.message : String(err));
    }
  };

  const removeStaff = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'staff', id));
    } catch (err) {
      setAppError(err instanceof Error ? err.message : String(err));
    }
  };

  const updateStaff = async (id: string, field: keyof Staff, value: string) => {
    try {
      const normalizedValue = field === 'email' ? value.toLowerCase().trim() : value;
      await updateDoc(doc(db, 'staff', id), { [field]: normalizedValue });
      
      // If email changed, we MUST update all orders and payments assigned to this staff
      // so they can see their history when they log in with the new email.
      if (field === 'email') {
        // Update Orders
        const ordersToUpdate = orders.filter(o => o.staffId === id);
        for (const order of ordersToUpdate) {
          await updateDoc(doc(db, 'orders', order.id), { staffEmail: normalizedValue });
        }
        // Update Payments
        const paymentsToUpdate = payments.filter(p => p.staffId === id);
        for (const payment of paymentsToUpdate) {
          await updateDoc(doc(db, 'payments', payment.id), { staffEmail: normalizedValue });
        }
      }
    } catch (err) {
      setAppError(err instanceof Error ? err.message : String(err));
    }
  };

  const addPayment = async () => {
    if (!payStaffId || !payAmount || !user) return;
    try {
      const selectedStaff = staff.find(s => s.id === payStaffId);
      const newDocRef = doc(collection(db, 'payments'));
      await setDoc(newDocRef, {
        staffId: payStaffId,
        staffEmail: selectedStaff?.email || '',
        amount: payAmount,
        date: serverTimestamp(),
        note: payNote,
        status: 'pending',
        uid: user.uid
      });
      setPayStaffId('');
      setPayAmount(0);
      setPayNote('');
    } catch (err) {
      setAppError(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmPayment = async (id: string) => {
    try {
      await updateDoc(doc(db, 'payments', id), { status: 'confirmed' });
    } catch (err) {
      setAppError(err instanceof Error ? err.message : String(err));
    }
  };

  const removePayment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'payments', id));
    } catch (err) {
      setAppError(err instanceof Error ? err.message : String(err));
    }
  };

  const exportToExcel = () => {
    const exportData = filteredOrders.map(order => {
      const shop = shops.find(s => s.id === order.shopId);
      const staffMember = staff.find(s => s.id === order.staffId);
      const leaderComm = order.isLeaderCommChecked ? (order.shopPrice - order.purchasePrice) : 0;
      const staffComm = order.isStaffCommChecked ? (order.dealPrice - order.purchasePrice) : 0;

      return {
        'Mã Đơn': order.orderCode,
        'Mã Vận Đơn': order.trackingCode,
        'Tên Đơn': order.orderName,
        'Shop': shop?.name || 'N/A',
        'Nhân Viên': staffMember?.name || 'N/A',
        'Giá Shop (k)': order.shopPrice / 1000,
        'Giá Deal (k)': order.dealPrice / 1000,
        'Giá Mua (k)': order.purchasePrice / 1000,
        'Lời Leader': leaderComm,
        'Lời Nhân Viên': staffComm,
        'Trạng Thái': order.status === 'completed' ? 'Hoàn thành' : 'Đang xử lý',
        'Ngày Tạo': formatDate(order.createdAt)
      };
    });

    const worksheet = utils.json_to_sheet(exportData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Đơn Hàng");
    
    // Auto-size columns
    const maxWidths = Object.keys(exportData[0] || {}).map(key => ({ wch: key.length + 5 }));
    worksheet['!cols'] = maxWidths;

    writeFile(workbook, `Bao_cao_don_hang_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportData = () => {
    const data = {
      shops,
      staff,
      orders,
      payments,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_order_manager_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        setIsLoading(true);

        // Import Shops
        if (Array.isArray(data.shops)) {
          for (const s of data.shops) {
            const { id, ...rest } = s;
            await setDoc(doc(collection(db, 'shops')), { ...rest, uid: user.uid });
          }
        }

        // Import Staff
        if (Array.isArray(data.staff)) {
          for (const st of data.staff) {
            const { id, ...rest } = st;
            await setDoc(doc(collection(db, 'staff')), { ...rest, uid: user.uid });
          }
        }

        // Import Orders
        if (Array.isArray(data.orders)) {
          for (const o of data.orders) {
            const { id, ...rest } = o;
            await setDoc(doc(collection(db, 'orders')), { 
              ...rest, 
              uid: user.uid,
              createdAt: serverTimestamp() // Reset timestamp to now for simplicity or try to parse old one
            });
          }
        }

        // Import Payments
        if (Array.isArray(data.payments)) {
          for (const p of data.payments) {
            const { id, ...rest } = p;
            await setDoc(doc(collection(db, 'payments')), { 
              ...rest, 
              uid: user.uid,
              date: serverTimestamp()
            });
          }
        }

        alert('Nhập dữ liệu thành công!');
      } catch (err) {
        setAppError('Lỗi khi nhập dữ liệu: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsLoading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    if (!bulkImportText.trim() || !user || !bulkImportShopId) {
      alert('Vui lòng nhập dữ liệu và chọn Shop mặc định');
      return;
    }
    
    const lines = bulkImportText.trim().split('\n');
    let successCount = 0;
    let errorCount = 0;

    setIsLoading(true);
    try {
      for (const line of lines) {
        // Excel copy-paste usually uses tabs, but we'll support multiple spaces too
        const cols = line.split(/\t/); 
        if (cols.length < 4) continue; // Minimum columns: Name, ShopPrice, DealPrice, PurchasePrice

        const orderName = cols[0]?.trim();
        const shopPrice = (parseFloat(cols[1]?.replace(/,/g, '').replace(/\./g, '')) || 0) * 1000;
        const dealPrice = (parseFloat(cols[2]?.replace(/,/g, '').replace(/\./g, '')) || 0) * 1000;
        const purchasePrice = (parseFloat(cols[3]?.replace(/,/g, '').replace(/\./g, '')) || 0) * 1000;
        const staffName = cols[4]?.trim();
        const orderCode = cols[5]?.trim() || '';

        // Find staffId by name
        const foundStaff = staff.find(s => s.name.toLowerCase().includes(staffName.toLowerCase()));
        
        const newDocRef = doc(collection(db, 'orders'));
        await setDoc(newDocRef, {
          ...INITIAL_ORDER,
          orderName,
          shopId: bulkImportShopId,
          shopPrice,
          dealPrice,
          purchasePrice,
          staffId: foundStaff?.id || '',
          staffEmail: foundStaff?.email || '',
          orderCode,
          uid: user.uid,
          createdAt: serverTimestamp(),
          status: 'pending'
        });
        successCount++;
      }
      alert(`Đã nhập thành công ${successCount} đơn hàng!`);
      setShowBulkImport(false);
      setBulkImportText('');
    } catch (err) {
      setAppError('Lỗi khi nhập dữ liệu: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered Data
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchShop = filterShopId === 'all' || order.shopId === filterShopId;
      const matchStaff = filterStaffId === 'all' || order.staffId === filterStaffId;
      return matchShop && matchStaff;
    });
  }, [orders, filterShopId, filterStaffId]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      return filterStaffId === 'all' || p.staffId === filterStaffId;
    });
  }, [payments, filterStaffId]);

  // Pagination logic
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const currentOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterShopId, filterStaffId]);

  const totals = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return filteredOrders.reduce((acc, order) => {
      const leaderComm = order.isLeaderCommChecked ? (order.shopPrice - order.purchasePrice) : 0;
      const staffComm = order.isStaffCommChecked ? (order.dealPrice - order.purchasePrice) : 0;
      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);

      const isToday = orderDate >= startOfDay;
      const isThisWeek = orderDate >= startOfWeek;
      const isThisMonth = orderDate >= startOfMonth;
      const isThisYear = orderDate >= startOfYear;

      return {
        leader: acc.leader + (isNaN(leaderComm) ? 0 : leaderComm),
        staff: acc.staff + (isNaN(staffComm) ? 0 : staffComm),
        purchase: acc.purchase + (isNaN(order.purchasePrice) ? 0 : order.purchasePrice),
        staffToday: acc.staffToday + (isToday ? staffComm : 0),
        staffWeek: acc.staffWeek + (isThisWeek ? staffComm : 0),
        staffMonth: acc.staffMonth + (isThisMonth ? staffComm : 0),
        staffYear: acc.staffYear + (isThisYear ? staffComm : 0),
      };
    }, { 
      leader: 0, 
      staff: 0, 
      purchase: 0,
      staffToday: 0,
      staffWeek: 0,
      staffMonth: 0,
      staffYear: 0
    });
  }, [filteredOrders]);

  const paymentTotals = useMemo(() => {
    return filteredPayments.reduce((acc, p) => {
      return {
        totalPaid: acc.totalPaid + p.amount,
        pending: acc.pending + (p.status === 'pending' ? p.amount : 0),
        confirmed: acc.confirmed + (p.status === 'confirmed' ? p.amount : 0),
      };
    }, { totalPaid: 0, pending: 0, confirmed: 0 });
  }, [filteredPayments]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '---';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatNumberInput = (value: number) => {
    if (!value && value !== 0) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseNumberInput = (value: string) => {
    const cleanValue = value.replace(/\./g, '');
    return parseFloat(cleanValue) || 0;
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Calculator className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Chào mừng bạn!</h1>
          <p className="text-slate-500 mb-8">Vui lòng đăng nhập để quản lý đơn hàng và lưu trữ dữ liệu vĩnh viễn.</p>
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-lg hover:shadow-indigo-200 active:scale-95"
          >
            {isLoggingIn ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <LogIn className="w-6 h-6" />
            )}
            {isLoggingIn ? 'Đang kết nối...' : 'Đăng nhập với Google'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans p-4 md:p-8">
      {appError && <ErrorDisplay error={appError} onClear={() => setAppError(null)} />}
      
      <div className="max-w-full mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <Calculator className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                DH đặt đơn hộ
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <img src={user.photoURL || ''} className="w-5 h-5 rounded-full" alt="avatar" />
                <span className="text-sm text-slate-500 font-medium">{user.displayName}</span>
                <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full uppercase font-bold tracking-wider">
                  {role}
                </span>
                <button onClick={handleLogout} className="text-xs text-red-500 hover:underline ml-2">Đăng xuất</button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex gap-1">
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Đơn hàng
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'payments' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Thanh toán
              </button>
            </div>
            {role === 'leader' && (
              <>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded-xl font-semibold transition-all shadow-sm hover:bg-slate-50 active:scale-95"
                >
                  <Settings2 className="w-5 h-5" />
                  <span className="hidden md:inline">Danh mục</span>
                </button>
                <button
                  onClick={exportToExcel}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-semibold transition-all shadow-sm active:scale-95"
                >
                  <Download className="w-5 h-5" />
                  <span className="hidden md:inline">Xuất Excel</span>
                </button>
                <button
                  onClick={() => setShowBulkImport(true)}
                  className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-indigo-600 px-4 py-3 rounded-xl font-semibold transition-all shadow-sm hover:bg-slate-50 active:scale-95"
                >
                  <Upload className="w-5 h-5" />
                  <span className="hidden md:inline">Nhập Excel</span>
                </button>
                <button
                  onClick={addOrder}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  Thêm Đơn
                </button>
              </>
            )}
          </div>
        </header>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
                {/* Shop Management */}
                <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Store className="w-5 h-5 text-indigo-600" />
                    Shop / Đại lý
                  </h3>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={newShopName}
                      onChange={(e) => setNewShopName(e.target.value)}
                      placeholder="Tên shop mới..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button onClick={addShop} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {shops.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg group">
                        <span className="text-sm">{s.name}</span>
                        <button onClick={() => removeShop(s.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Staff Management */}
                <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    Nhân viên
                  </h3>
                  <div className="flex flex-col gap-2 mb-4">
                    <input
                      type="text"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder="Tên nhân viên mới..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newStaffEmail}
                        onChange={(e) => setNewStaffEmail(e.target.value)}
                        placeholder="Email Google..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <button onClick={addStaff} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700">
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {staff.map(st => (
                      <div key={st.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg group">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{st.name}</p>
                          {editingStaffId === st.id ? (
                            <div className="flex gap-1 mt-1">
                              <input
                                type="email"
                                value={editStaffEmail}
                                onChange={(e) => setEditStaffEmail(e.target.value)}
                                className="flex-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500"
                                autoFocus
                              />
                              <button 
                                onClick={() => {
                                  updateStaff(st.id, 'email', editStaffEmail);
                                  setEditingStaffId(null);
                                }}
                                className="text-[10px] bg-indigo-600 text-white px-2 rounded"
                              >
                                Lưu
                              </button>
                              <button 
                                onClick={() => setEditingStaffId(null)}
                                className="text-[10px] bg-slate-200 text-slate-600 px-2 rounded"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <p 
                              className="text-[10px] text-slate-400 cursor-pointer hover:text-indigo-600 hover:underline"
                              onClick={() => {
                                setEditingStaffId(st.id);
                                setEditStaffEmail(st.email);
                              }}
                              title="Click để sửa email"
                            >
                              {st.email}
                            </p>
                          )}
                        </div>
                        <button onClick={() => removeStaff(st.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Backup Management */}
                <div className="md:col-span-2 pt-6 border-t border-slate-100">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-600" />
                    Sao lưu & Dự phòng
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={exportData}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-sm active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      Xuất dữ liệu (Backup)
                    </button>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".json"
                        onChange={importData}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        id="import-file"
                      />
                      <label
                        htmlFor="import-file"
                        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        Nhập dữ liệu (Restore)
                      </label>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-400 italic">
                    * Lưu ý: Khi nhập dữ liệu, các bản ghi sẽ được thêm mới vào hệ thống hiện tại.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk Import Modal */}
        <AnimatePresence>
          {showBulkImport && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Upload className="w-6 h-6 text-indigo-600" />
                    Nhập nhanh từ Excel
                  </h3>
                  <button onClick={() => setShowBulkImport(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-slate-700 mb-2">1. Chọn Shop mặc định cho các đơn này:</label>
                    <select
                      value={bulkImportShopId}
                      onChange={(e) => setBulkImportShopId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">-- Chọn Shop --</option>
                      {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-slate-700 mb-2">2. Dán dữ liệu từ Excel vào đây:</label>
                    <p className="text-xs text-slate-400 mb-2 italic">
                      Định dạng: Tên đơn [Tab] Giá shop [Tab] Giá deal [Tab] Giá mua [Tab] Tên NV [Tab] Mã đơn
                    </p>
                    <textarea
                      value={bulkImportText}
                      onChange={(e) => setBulkImportText(e.target.value)}
                      placeholder="Ví dụ: Cb4 Made trắng 915 950 935 Phương Anh 582731..."
                      className="w-full h-64 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowBulkImport(false)}
                      className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={handleBulkImport}
                      disabled={isLoading}
                      className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Bắt đầu nhập dữ liệu'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-8 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <Filter className="w-5 h-5" />
            <span>Bộ lọc:</span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Shop:</span>
            <select
              value={filterShopId}
              onChange={(e) => setFilterShopId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">Tất cả Shop</option>
              {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {role === 'leader' && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">Nhân viên:</span>
              <select
                value={filterStaffId}
                onChange={(e) => setFilterStaffId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="all">Tất cả Nhân viên</option>
                {staff.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Sắp xếp:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="desc">Mới nhất trước</option>
              <option value="asc">Cũ nhất trước</option>
            </select>
          </div>

          {(filterShopId !== 'all' || filterStaffId !== 'all') && (
            <button
              onClick={() => { setFilterShopId('all'); setFilterStaffId('all'); }}
              className="text-sm text-indigo-600 hover:underline font-medium"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {role === 'leader' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Tiền Công Leader</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.leader)}</div>
            </motion.div>
          )}

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Tiền Công Nhân Viên</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totals.staff)}</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="bg-slate-50 p-2 rounded-lg">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Hôm nay</p>
                <p className="text-xs font-bold text-slate-700">{formatCurrency(totals.staffToday)}</p>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Tuần này</p>
                <p className="text-xs font-bold text-slate-700">{formatCurrency(totals.staffWeek)}</p>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Tháng này</p>
                <p className="text-xs font-bold text-slate-700">{formatCurrency(totals.staffMonth)}</p>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Năm nay</p>
                <p className="text-xs font-bold text-slate-700">{formatCurrency(totals.staffYear)}</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Đã Thanh Toán</span>
            </div>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(paymentTotals.confirmed)}</div>
            <div className="mt-2 text-xs text-slate-400">
              Chờ xác nhận: <span className="font-bold text-amber-600">{formatCurrency(paymentTotals.pending)}</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Còn Lại</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totals.staff - paymentTotals.confirmed)}</div>
            <div className="mt-2 text-xs text-slate-400">
              Tổng thực nhận: <span className="font-bold text-slate-700">{formatCurrency(totals.staff)}</span>
            </div>
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'orders' ? (
            <motion.div
              key="orders"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative"
            >
              {isLoading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-bottom border-slate-100">
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày Giờ</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tên Shop</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tên Đơn Hàng</th>
                      {role === 'leader' && (
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Giá Shop (K)</th>
                      )}
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Giá Deal (K)</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Giá Mua (K)</th>
                      {role === 'leader' && (
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nhân Viên</th>
                      )}
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mã Đơn</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mã Vận Đơn</th>
                      <th className="p-4 text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50/30">Công Staff</th>
                      {role === 'leader' && (
                        <th className="p-4 text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50/30">Công Leader</th>
                      )}
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <AnimatePresence initial={false}>
                      {currentOrders.map((order) => {
                        const leaderComm = order.shopPrice - order.purchasePrice;
                        const staffComm = order.dealPrice - order.purchasePrice;

                        return (
                          <motion.tr
                            key={order.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="p-3 text-xs text-slate-500 font-mono">
                              {formatDate(order.createdAt)}
                            </td>
                            <td className="p-3">
                              <select
                                value={order.shopId || ''}
                                onChange={(e) => updateOrder(order.id, 'shopId', e.target.value)}
                                disabled={role === 'staff'}
                                className="w-full bg-transparent border-none focus:ring-0 text-sm outline-none font-medium disabled:opacity-100"
                              >
                                <option value="">Chọn Shop...</option>
                                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4 text-slate-400" />
                                <input
                                  type="text"
                                  value={order.orderName || ''}
                                  onChange={(e) => updateOrder(order.id, 'orderName', e.target.value)}
                                  placeholder="Tên sản phẩm..."
                                  className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium placeholder:text-slate-300 disabled:opacity-100"
                                  disabled={role === 'staff'}
                                />
                              </div>
                            </td>
                            {role === 'leader' && (
                              <td className="p-3">
                                <input
                                  type="text"
                                  value={formatNumberInput(order.shopPrice)}
                                  onChange={(e) => updateOrder(order.id, 'shopPrice', parseNumberInput(e.target.value))}
                                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-right font-mono"
                                />
                              </td>
                            )}
                            <td className="p-3">
                              <input
                                type="text"
                                value={formatNumberInput(order.dealPrice)}
                                onChange={(e) => updateOrder(order.id, 'dealPrice', parseNumberInput(e.target.value))}
                                className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-right font-mono disabled:opacity-100"
                                disabled={role === 'staff'}
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={formatNumberInput(order.purchasePrice)}
                                onChange={(e) => updateOrder(order.id, 'purchasePrice', parseNumberInput(e.target.value))}
                                className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-right font-mono disabled:opacity-100"
                                disabled={role === 'staff'}
                              />
                            </td>
                            {role === 'leader' && (
                              <td className="p-3">
                                <select
                                  value={order.staffId || ''}
                                  onChange={(e) => updateOrder(order.id, 'staffId', e.target.value)}
                                  className="w-full bg-transparent border-none focus:ring-0 text-sm outline-none"
                                >
                                  <option value="">Chọn NV...</option>
                                  {staff.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                                </select>
                              </td>
                            )}
                            <td className="p-3">
                              <div className="flex flex-col gap-1 relative">
                                <input
                                  type="text"
                                  value={order.orderCode || ''}
                                  onChange={(e) => updateOrder(order.id, 'orderCode', e.target.value)}
                                  placeholder="Mã đơn..."
                                  className="w-32 bg-transparent border-none focus:ring-0 text-sm font-mono placeholder:text-slate-300 disabled:opacity-100"
                                  disabled={role === 'staff'}
                                />
                                {order.orderCode && (
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => {
                                        const last4 = order.orderCode.slice(-4);
                                        navigator.clipboard.writeText(last4);
                                        setCopiedId(order.id);
                                        setTimeout(() => setCopiedId(null), 2000);
                                      }}
                                      className="text-[10px] text-left px-1 py-0.5 hover:bg-indigo-50 rounded transition-colors group flex items-center gap-1"
                                      title="Click để copy 4 số cuối"
                                    >
                                      <span className="text-slate-400">{order.orderCode.slice(0, -4)}</span>
                                      <span className="text-indigo-600 font-bold bg-indigo-50 px-1 rounded group-hover:bg-indigo-100">
                                        {order.orderCode.slice(-4)}
                                      </span>
                                    </button>
                                    <AnimatePresence>
                                      {copiedId === order.id && (
                                        <motion.span
                                          initial={{ opacity: 0, x: -5 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          exit={{ opacity: 0 }}
                                          className="text-[10px] text-emerald-600 font-medium whitespace-nowrap"
                                        >
                                          Đã chép!
                                        </motion.span>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={order.trackingCode || ''}
                                onChange={(e) => updateOrder(order.id, 'trackingCode', e.target.value)}
                                placeholder="Mã vận đơn..."
                                className="w-32 bg-transparent border-none focus:ring-0 text-sm font-mono placeholder:text-slate-300 disabled:opacity-100"
                                disabled={role === 'staff'}
                              />
                            </td>
                            <td className="p-3 bg-blue-50/20">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={!!order.isStaffCommChecked}
                                  onChange={(e) => updateOrder(order.id, 'isStaffCommChecked', e.target.checked)}
                                  disabled={role === 'staff'}
                                  className={`w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${role === 'staff' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                />
                                <span className={`text-sm font-bold ${staffComm >= 0 ? 'text-blue-600' : 'text-red-600'} ${!order.isStaffCommChecked ? 'opacity-40' : ''}`}>
                                  {formatCurrency(order.dealPrice - order.purchasePrice)}
                                </span>
                              </div>
                            </td>
                            {role === 'leader' && (
                              <td className="p-3 bg-indigo-50/20">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!order.isLeaderCommChecked}
                                    onChange={(e) => updateOrder(order.id, 'isLeaderCommChecked', e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  />
                                  <span className={`text-sm font-bold ${leaderComm >= 0 ? 'text-emerald-600' : 'text-red-600'} ${!order.isLeaderCommChecked ? 'opacity-40' : ''}`}>
                                    {formatCurrency(order.shopPrice - order.purchasePrice)}
                                  </span>
                                </div>
                              </td>
                            )}
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {role === 'leader' && (
                                  <>
                                    <button
                                      onClick={() => duplicateOrder(order)}
                                      className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                      title="Sao chép đơn hàng"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => removeOrder(order.id)}
                                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                      title="Xóa đơn hàng"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                  <div className="text-sm text-slate-500">
                    Hiển thị <span className="font-bold text-slate-700">{Math.min(filteredOrders.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span> - <span className="font-bold text-slate-700">{Math.min(filteredOrders.length, currentPage * ITEMS_PER_PAGE)}</span> trong tổng số <span className="font-bold text-slate-700">{filteredOrders.length}</span> đơn hàng
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {[...Array(totalPages)].map((_, i) => {
                        const pageNum = i + 1;
                        if (
                          pageNum === 1 || 
                          pageNum === totalPages || 
                          (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 rounded-lg font-bold text-xs transition-all ${
                                currentPage === pageNum 
                                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (
                          pageNum === currentPage - 2 || 
                          pageNum === currentPage + 2
                        ) {
                          return <span key={pageNum} className="text-slate-400">...</span>;
                        }
                        return null;
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="payments"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Payment Form (Leader Only) */}
              {role === 'leader' && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-fit">
                  <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-indigo-600" />
                    Thanh toán mới
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nhân viên</label>
                      <select
                        value={payStaffId}
                        onChange={(e) => setPayStaffId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="">Chọn nhân viên...</option>
                        {staff.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Số tiền</label>
                      <input
                        type="number"
                        value={payAmount}
                        onChange={(e) => setPayAmount(Number(e.target.value))}
                        placeholder="Nhập số tiền..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Ghi chú</label>
                      <textarea
                        value={payNote}
                        onChange={(e) => setPayNote(e.target.value)}
                        placeholder="Nội dung thanh toán..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"
                      />
                    </div>
                    <button
                      onClick={addPayment}
                      disabled={!payStaffId || !payAmount}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-4 rounded-xl font-bold transition-all shadow-md active:scale-95"
                    >
                      Xác nhận thanh toán
                    </button>
                  </div>
                </div>
              )}

              {/* Payment History */}
              <div className={`${role === 'leader' ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden`}>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    Lịch sử thanh toán
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-bottom border-slate-200">
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Ngày giờ</th>
                        {role === 'leader' && (
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Nhân viên</th>
                        )}
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Số tiền</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Ghi chú</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Trạng thái</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPayments.map((p) => {
                        const st = staff.find(s => s.id === p.staffId);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4">
                              <div className="text-sm text-slate-600">
                                {p.date?.toDate ? p.date.toDate().toLocaleString('vi-VN') : 'Đang lưu...'}
                              </div>
                            </td>
                            {role === 'leader' && (
                              <td className="p-4">
                                <span className="text-sm font-medium text-slate-900">{st?.name || 'N/A'}</span>
                              </td>
                            )}
                            <td className="p-4">
                              <span className="text-sm font-bold text-emerald-600">{formatCurrency(p.amount)}</span>
                            </td>
                            <td className="p-4">
                              <p className="text-sm text-slate-500 max-w-xs truncate">{p.note || '-'}</p>
                            </td>
                            <td className="p-4">
                              {p.status === 'confirmed' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Đã xác nhận
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-bold">
                                  <Clock className="w-3 h-3" />
                                  Chờ xác nhận
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {role === 'staff' && p.status === 'pending' && (
                                  <button
                                    onClick={() => confirmPayment(p.id)}
                                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-all"
                                  >
                                    Xác nhận
                                  </button>
                                )}
                                {role === 'leader' && (
                                  <button
                                    onClick={() => removePayment(p.id)}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {payments.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                            Chưa có lịch sử thanh toán nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {!isLoading && activeTab === 'orders' && filteredOrders.length === 0 && (
          <div className="mt-8 p-12 bg-white rounded-2xl border border-slate-100 text-center text-slate-400 italic">
            {orders.length === 0 ? 'Chưa có đơn hàng nào.' : 'Không tìm thấy đơn hàng phù hợp với bộ lọc.'}
          </div>
        )}
      </div>

        {/* Footer Info */}
        <footer className="mt-8 text-center text-slate-400 text-sm">
          <p>© 2026 Order Commission Manager • Dữ liệu được lưu trữ bảo mật trên Cloud</p>
        </footer>
      </div>
    );
  }
