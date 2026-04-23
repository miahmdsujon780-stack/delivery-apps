import React, { useState, useEffect, useMemo } from 'react';
import { 
  HashRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate,
  Link
} from 'react-router-dom';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { SALES_OFFICERS, ADMIN_EMAIL, MONTHLY_TARGETS, GLOBAL_TARGETS } from './constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  LogOut, 
  PlusCircle, 
  LayoutDashboard, 
  ShieldCheck, 
  Package, 
  Users,
  Truck,
  TrendingUp,
  User as UserIcon,
  ClipboardList,
  PenTool,
  BookOpen,
  Calendar,
  Trash2,
  Edit,
  Check,
  X,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Download,
  Camera,
  Eye,
  UserCheck,
  Settings,
  Save
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

// --- Types ---
interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'so';
  uniqueId: string;
}

interface DeliveryEntry {
  id?: string;
  date: string;
  soName: string;
  soId: string;
  route: string;
  tissue: number;
  ballpen: number;
  exbook: number;
  timestamp: any;
}

interface AttendanceEntry {
  id?: string;
  date: string;
  soName: string;
  soId: string;
  checkInTime: string;
  status: 'On Time' | 'Late' | 'Absent';
  location?: string;
  locationName?: string;
  selfie?: string;
  timestamp: any;
}

interface Officer {
  id: string; // This is the unique ID (numeric string)
  name: string;
  docId?: string; // Firestore document ID
}

interface SystemConfig {
  attendanceEnabled: boolean;
}

// --- Components ---

const Login = ({ onLoginSuccess }: { 
  onLoginSuccess: (p: UserProfile) => void;
}) => {
  const [selectedSO, setSelectedSO] = useState('');
  const [soId, setSoId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleManualLogin = async () => {
    if (!selectedSO || !soId) {
      toast.error("Please select your name and enter your ID");
      return;
    }

    if (selectedSO === 'ADMIN') {
      if (soId !== '34261') {
        toast.error("Invalid Admin ID");
        return;
      }
    } else {
      const officer = SALES_OFFICERS.find(so => so.name === selectedSO);
      if (!officer || officer.id !== soId) {
        toast.error("Invalid Sales Officer ID");
        return;
      }
    }

    setLoading(true);
    try {
      // Create a persistent login using Email/Password with dummy email
      const dummyEmail = selectedSO === 'ADMIN' ? ADMIN_EMAIL : `${soId}@gulapgonj.app`;
      // Firebase requires passwords to be at least 6 characters. 
      // We'll prepend a prefix to ensure the password is long enough.
      const password = `GULAPGONJ_${soId}`; 

      let user: FirebaseUser;
      try {
        // Attempt to sign in
        const result = await signInWithEmailAndPassword(auth, dummyEmail, password);
        user = result.user;
      } catch (signInError: any) {
        // If user not found, auto-signup (one time)
        if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
          try {
            const result = await createUserWithEmailAndPassword(auth, dummyEmail, password);
            user = result.user;
          } catch (signUpError) {
            // If sign-up fails because user exists but password mismatch, it's an error
            throw signInError;
          }
        } else {
          throw signInError;
        }
      }
      
      const isActuallyAdmin = selectedSO === 'ADMIN';

      const profile: UserProfile = {
        uid: user.uid,
        name: selectedSO,
        email: dummyEmail,
        role: isActuallyAdmin ? 'admin' : 'so',
        uniqueId: soId
      };

      await setDoc(doc(db, 'users', user.uid), profile);
      onLoginSuccess(profile);
      toast.success(`Welcome, ${selectedSO}!`);
    } catch (error) {
      console.error(error);
      toast.error("Login failed. Check your ID and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-primary p-8 text-center">
            <div className="mx-auto w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4">
              <Package className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">GULAPGONJ TEAM</h1>
            <p className="text-white/80 text-sm font-medium mt-1 uppercase tracking-widest">Sales System</p>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500 ml-1">Select Sales Officer</Label>
                <Select onValueChange={setSelectedSO}>
                  <SelectTrigger className="h-14 rounded-xl border-slate-200 bg-slate-50 focus:ring-primary">
                    <SelectValue placeholder="Choose your name" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN" className="font-black text-primary">ADMIN</SelectItem>
                    {SALES_OFFICERS.map(so => (
                      <SelectItem key={so.id} value={so.name}>{so.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500 ml-1">Unique ID</Label>
                <Input 
                  type="password" 
                  placeholder="Enter your unique ID" 
                  className="h-14 rounded-xl border-slate-200 bg-slate-50 focus:ring-primary"
                  value={soId}
                  onChange={(e) => setSoId(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <Button 
                onClick={handleManualLogin} 
                className="w-full h-14 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? "Authenticating..." : "LOGIN"}
              </Button>
            </div>
            
            <p className="text-center text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
              Secure Cloud Access • Real-time Sync
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const DeliveryForm = ({ userProfile }: { userProfile: UserProfile }) => {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [route, setRoute] = useState('');
  const [tissue, setTissue] = useState('');
  const [ballpen, setBallpen] = useState('');
  const [exbook, setExbook] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast.error("Please select a date");
      return;
    }
    if (!route || !tissue || !ballpen || !exbook) {
      toast.error("Please fill all fields");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'deliveries'), {
        date,
        soName: userProfile.name,
        soId: userProfile.uniqueId,
        userId: userProfile.uid,
        route,
        tissue: Number(tissue),
        ballpen: Number(ballpen),
        exbook: Number(exbook),
        timestamp: serverTimestamp()
      });
      toast.success("Data Saved Successfully");
      // Clear form
      setRoute('');
      setTissue('');
      setBallpen('');
      setExbook('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'deliveries');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-none shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="bg-slate-50 border-b border-slate-100">
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <PlusCircle className="w-5 h-5 text-primary" />
          New Delivery Entry
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500 uppercase">Date</Label>
            <div className="relative">
              <Input 
                type="date" 
                className="h-12 rounded-xl border-slate-200 focus:ring-primary"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500 uppercase">SO Name</Label>
            <Input 
              value={userProfile.name} 
              disabled 
              className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-slate-700"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500 uppercase">Route Name</Label>
            <Input 
              placeholder="Enter route name" 
              className="h-12 rounded-xl border-slate-200 focus:ring-primary"
              value={route} 
              onChange={e => setRoute(e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase">Tissue Amount</Label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="number" 
                  placeholder="0" 
                  className="h-12 pl-10 rounded-xl border-slate-200 focus:ring-primary"
                  value={tissue} 
                  onChange={e => setTissue(e.target.value)} 
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase">Ballpen Amount</Label>
              <div className="relative">
                <PenTool className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="number" 
                  placeholder="0" 
                  className="h-12 pl-10 rounded-xl border-slate-200 focus:ring-primary"
                  value={ballpen} 
                  onChange={e => setBallpen(e.target.value)} 
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase">Exbook Amount</Label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="number" 
                  placeholder="0" 
                  className="h-12 pl-10 rounded-xl border-slate-200 focus:ring-primary"
                  value={exbook} 
                  onChange={e => setExbook(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-14 rounded-xl bg-green-600 hover:bg-green-700 text-lg font-bold shadow-lg shadow-green-200 transition-all active:scale-[0.98] mt-4" 
            disabled={submitting}
          >
            {submitting ? "Saving..." : "SUBMIT DATA"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const TargetProgress = ({ 
  label, 
  current, 
  target, 
  colorClass = "bg-primary" 
}: { 
  label: string; 
  current: number; 
  target: number; 
  colorClass?: string;
}) => {
  const percentage = Math.min(Math.round((current / target) * 100), 100);
  const isCompleted = current >= target;

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex justify-between items-end">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-slate-900">{current.toLocaleString()}</span>
            <span className="text-[9px] font-bold text-slate-300 uppercase">/ {target.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-xs font-black ${isCompleted ? 'text-green-600' : 'text-slate-900'}`}>
            {percentage}%
          </span>
          {isCompleted && (
            <span className="text-[8px] font-black text-green-500 uppercase tracking-tighter leading-none">Goal Achieved!</span>
          )}
        </div>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50 flex items-center p-[1px]">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${isCompleted ? 'bg-green-500' : colorClass} shadow-sm`}
        />
      </div>
    </div>
  );
};

const Dashboard = ({ userProfile, systemConfig }: { userProfile: UserProfile, systemConfig: SystemConfig }) => {
  const [entries, setEntries] = useState<DeliveryEntry[]>([]);
  const [targets, setTargets] = useState(MONTHLY_TARGETS); // Global/Team Targets
  const [allOfficerTargets, setAllOfficerTargets] = useState<Record<string, typeof MONTHLY_TARGETS>>({});
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [targetValues, setTargetValues] = useState(MONTHLY_TARGETS);
  const [selectedOfficerForTargetConfig, setSelectedOfficerForTargetConfig] = useState(SALES_OFFICERS[0].name);
  
  const [filterMonthlySO, setFilterMonthlySO] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<DeliveryEntry>>({});

  const handleToggleAttendance = async (enabled: boolean) => {
    if (userProfile.role !== 'admin') return;
    try {
      await setDoc(doc(db, 'settings', 'config'), { attendanceEnabled: enabled }, { merge: true });
      toast.success(`Attendance feature is now ${enabled ? 'ON' : 'OFF'}`);
    } catch (error) {
      toast.error("Failed to update attendance status");
    }
  };

  useEffect(() => {
    // 1. Fetch Global Team Targets
    const unsubGlobalTargets = onSnapshot(doc(db, 'settings', 'monthly_targets'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as typeof MONTHLY_TARGETS;
        setTargets(data);
      }
    });

    // 2. Fetch Individual Officer Targets
    const unsubOfficerTargets = onSnapshot(collection(db, 'officer_targets'), (snapshot) => {
      const targetMap: Record<string, typeof MONTHLY_TARGETS> = {};
      snapshot.docs.forEach(doc => {
        targetMap[doc.id] = doc.data() as typeof MONTHLY_TARGETS;
      });
      setAllOfficerTargets(targetMap);
      
      // If editing mode is off, sync preview values with the selected officer's current goal
      if (!isEditingTargets) {
        setTargetValues(targetMap[selectedOfficerForTargetConfig] || MONTHLY_TARGETS);
      }
    });

    const isAdmin = userProfile.role === 'admin';
    const q = isAdmin 
      ? query(collection(db, 'deliveries'), orderBy('timestamp', 'desc'))
      : query(
          collection(db, 'deliveries'),
          where('soId', '==', userProfile.uniqueId),
          orderBy('timestamp', 'desc')
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryEntry));
      setEntries(data);
    });

    return () => unsubscribe();
  }, [userProfile.uniqueId, userProfile.role]);

  useEffect(() => {
    if (!isEditingTargets) {
      setTargetValues(allOfficerTargets[selectedOfficerForTargetConfig] || MONTHLY_TARGETS);
    }
  }, [selectedOfficerForTargetConfig, allOfficerTargets, isEditingTargets]);

  const handleUpdateTargets = async () => {
    try {
      await setDoc(doc(db, 'officer_targets', selectedOfficerForTargetConfig), {
        tissue: Number(targetValues.tissue),
        ballpen: Number(targetValues.ballpen),
        exbook: Number(targetValues.exbook)
      });
      setIsEditingTargets(false);
      toast.success(`${selectedOfficerForTargetConfig}'s targets updated successfully`);
    } catch (error) {
      toast.error("Failed to update targets");
    }
  };

  const handleDelete = async (id: string | undefined) => {
    if (!id || !window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await deleteDoc(doc(db, 'deliveries', id));
      toast.success("Entry deleted successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'deliveries');
    }
  };

  const startEditing = (entry: DeliveryEntry) => {
    setEditingId(entry.id || null);
    setEditValues({
      tissue: entry.tissue,
      ballpen: entry.ballpen,
      exbook: entry.exbook,
      route: entry.route,
      date: entry.date
    });
  };

  const saveEdit = async (id: string | undefined) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'deliveries', id), {
        ...editValues,
        tissue: Number(editValues.tissue),
        ballpen: Number(editValues.ballpen),
        exbook: Number(editValues.exbook),
      });
      setEditingId(null);
      toast.success("Entry updated successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'deliveries');
    }
  };

  const totals = useMemo(() => {
    return entries.reduce((acc, curr) => ({
      tissue: acc.tissue + (curr.tissue || 0),
      ballpen: acc.ballpen + (curr.ballpen || 0),
      exbook: acc.exbook + (curr.exbook || 0),
    }), { tissue: 0, ballpen: 0, exbook: 0 });
  }, [entries]);

  const stats = useMemo(() => {
    const today = format(getBDDate(), 'yyyy-MM-dd');
    const todayEntries = entries.filter(e => e.date === today);
    
    // Add monthly logic
    const currentMonth = format(getBDDate(), 'yyyy-MM');
    const monthlyEntries = entries.filter(e => {
        const isThisMonth = e.date.startsWith(currentMonth);
        const matchSO = filterMonthlySO === 'all' || e.soName === filterMonthlySO;
        return isThisMonth && matchSO;
    });
    
    return {
      totalToday: todayEntries.length,
      itemsToday: todayEntries.reduce((acc, curr) => acc + (Number(curr.ballpen) || 0) + (Number(curr.exbook) || 0) + (Number(curr.tissue) || 0), 0),
      tissueToday: todayEntries.reduce((acc, curr) => acc + (Number(curr.tissue) || 0), 0),
      officersToday: new Set(todayEntries.map(e => e.soId)).size,
      officerNames: [...new Set(todayEntries.map(e => e.soName))].join(', '),
      // Monthly Stats
      monthlyTissue: monthlyEntries.reduce((acc, curr) => acc + (Number(curr.tissue) || 0), 0),
      monthlyBallpen: monthlyEntries.reduce((acc, curr) => acc + (Number(curr.ballpen) || 0), 0),
      monthlyExbook: monthlyEntries.reduce((acc, curr) => acc + (Number(curr.exbook) || 0), 0),
    };
  }, [entries, filterMonthlySO]);

  return (
    <div className="space-y-6">
      {/* Grand Total Card - MOVED TO TOP */}
      <Card className="bg-primary border-none shadow-lg p-5 rounded-2xl overflow-hidden relative group">
        <div className="absolute inset-0 flex items-center justify-center opacity-10 transition-transform group-hover:scale-110">
          <Truck className="w-32 h-32 text-white" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="text-[10px] font-black uppercase text-white/60 mb-2 leading-none tracking-[0.2em]">Total Inventory Dispatched</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-black text-white leading-none">
              {(totals.tissue + totals.ballpen + totals.exbook).toLocaleString()}
            </span>
          </div>
          <p className="text-[10px] font-bold text-white/40 uppercase mt-1">Total items</p>
          <div className="mt-6 flex justify-center gap-6 text-[12px] font-black text-white/70 uppercase tracking-widest border-t border-white/20 pt-4 w-full">
            <div className="flex flex-col items-center">
              <span className="text-white text-[13px] font-black leading-none mb-1">T: {totals.tissue.toLocaleString()}</span>
              <span className="text-[9px] opacity-70 font-black tracking-widest text-white/80">Tissue</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-white text-[13px] font-black leading-none mb-1">B: {totals.ballpen.toLocaleString()}</span>
              <span className="text-[9px] opacity-70 font-black tracking-widest text-white/80">Ballpen</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-white text-[13px] font-black leading-none mb-1">E: {totals.exbook.toLocaleString()}</span>
              <span className="text-[9px] opacity-70 font-black tracking-widest text-white/80">Exbook</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Activity Stats for Admin */}
      {userProfile.role === 'admin' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-white border-none shadow-sm p-4 rounded-2xl">
              <p className="text-[9px] font-black uppercase text-slate-400 mb-1 leading-none tracking-widest text-center">Today Tissue</p>
              <div className="flex flex-col items-center justify-center">
                <span className="text-[20px] font-black text-slate-800 leading-none">{stats.tissueToday.toLocaleString()}</span>
                <div className="mt-2 bg-green-50 p-1 rounded-lg">
                  <Package className="w-3.5 h-3.5 text-green-500" />
                </div>
              </div>
            </Card>
            <Card className="bg-white border-none shadow-sm p-4 rounded-2xl flex flex-col items-center justify-center">
              <p className="text-[9px] font-black uppercase text-slate-400 mb-2 leading-none tracking-widest text-center">submit delivery</p>
              <div className="flex flex-col items-center justify-center w-full">
                <span className="text-[11px] font-black text-slate-800 leading-tight text-center line-clamp-2 uppercase">
                  {stats.officerNames || "None"}
                </span>
                <div className="mt-2 bg-orange-50 p-1 rounded-lg">
                  <Users className="w-3.5 h-3.5 text-orange-500" />
                </div>
              </div>
            </Card>
          </div>

          {/* Attendance Controls */}
          <Card className="bg-white border-none shadow-sm p-4 rounded-2xl overflow-hidden relative">
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${systemConfig.attendanceEnabled ? 'bg-green-100' : 'bg-red-100'}`}>
                  <Clock className={`w-4 h-4 ${systemConfig.attendanceEnabled ? 'text-green-600' : 'text-red-600'}`} />
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Attendance System</h4>
                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">
                    Status: <span className={systemConfig.attendanceEnabled ? "text-green-600" : "text-red-500"}>{systemConfig.attendanceEnabled ? "ONLINE" : "OFFLINE"}</span>
                  </p>
                </div>
              </div>
              <div className="flex bg-slate-50 p-1 rounded-xl gap-1 border border-slate-100">
                <button 
                  onClick={() => handleToggleAttendance(true)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                    systemConfig.attendanceEnabled 
                      ? "bg-green-600 text-white shadow-sm" 
                      : "text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  Turn ON
                </button>
                <button 
                  onClick={() => handleToggleAttendance(false)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                    !systemConfig.attendanceEnabled 
                      ? "bg-red-600 text-white shadow-sm" 
                      : "text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  Turn OFF
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Monthly Goals and Targets for Admin - MOVED UP TO FILL SPACE */}
      {userProfile.role === 'admin' && (
        <div className="space-y-6">
           {/* Monthly Team Progress */}
           <Card className="bg-white border-none shadow-sm p-6 rounded-[32px] overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
              <TrendingUp className="w-24 h-24 text-slate-900" />
            </div>
            <div className="relative z-10 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-900/5 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-none lowercase italic tracking-tighter">
                      {filterMonthlySO === 'all' ? "Team's" : filterMonthlySO + "'s"} Monthly Goals
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">
                      Target Status for {format(getBDDate(), 'MMMM yyyy')}
                    </p>
                  </div>
                </div>

                <div className="w-full sm:w-48">
                  <Select onValueChange={setFilterMonthlySO} defaultValue="all">
                    <SelectTrigger className="h-9 text-xs font-bold rounded-xl border-slate-100 bg-slate-50">
                      <SelectValue placeholder="Select Officer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Team (All Officers)</SelectItem>
                      {SALES_OFFICERS.map(so => (
                        <SelectItem key={so.id} value={so.name}>{so.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-2">
                <TargetProgress 
                  label="Tissue Total" 
                  current={stats.monthlyTissue} 
                  target={filterMonthlySO === 'all' 
                    ? targets.tissue * SALES_OFFICERS.length 
                    : (allOfficerTargets[filterMonthlySO]?.tissue || targets.tissue)
                  } 
                />
                <TargetProgress 
                  label="Ballpen Total" 
                  current={stats.monthlyBallpen} 
                  target={filterMonthlySO === 'all' 
                    ? targets.ballpen * SALES_OFFICERS.length 
                    : (allOfficerTargets[filterMonthlySO]?.ballpen || targets.ballpen)
                  } 
                  colorClass="bg-blue-600"
                />
                <TargetProgress 
                  label="Exbook Total" 
                  current={stats.monthlyExbook} 
                  target={filterMonthlySO === 'all' 
                    ? targets.exbook * SALES_OFFICERS.length 
                    : (allOfficerTargets[filterMonthlySO]?.exbook || targets.exbook)
                  } 
                  colorClass="bg-indigo-600"
                />
              </div>
            </div>
          </Card>

          {/* Target Management Section */}
          <Card className="bg-slate-50 border-none p-6 rounded-[24px]">
            <div className="mb-6 pb-6 border-b border-white/40">
                <Label className="text-[10px] font-black font-mono uppercase text-slate-500 mb-3 block tracking-widest leading-none">1. Select Officer to Configure</Label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {SALES_OFFICERS.map(so => (
                        <button
                            key={so.id}
                            onClick={() => setSelectedOfficerForTargetConfig(so.name)}
                            disabled={isEditingTargets}
                            className={`p-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border-2 ${
                                selectedOfficerForTargetConfig === so.name 
                                    ? 'bg-slate-900 text-white border-slate-900 scale-105' 
                                    : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                            } ${isEditingTargets ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {so.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    Targets for <span className="text-primary italic">{selectedOfficerForTargetConfig}</span>
                </h3>
              </div>
              {!isEditingTargets ? (
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsEditingTargets(true)}
                    className="rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-100"
                >
                    Edit Targets
                </Button>
              ) : (
                <div className="flex gap-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsEditingTargets(false)}
                        className="rounded-xl text-slate-400 font-bold"
                    >
                        Cancel
                    </Button>
                    <Button 
                        size="sm" 
                        onClick={handleUpdateTargets}
                        className="rounded-xl bg-slate-900 font-bold"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Save Goals
                    </Button>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Monthly Tissue Goal</Label>
                <Input 
                    type="number"
                    disabled={!isEditingTargets}
                    value={targetValues.tissue}
                    onChange={e => setTargetValues({...targetValues, tissue: Number(e.target.value)})}
                    className="h-12 rounded-xl border-slate-200 bg-white font-black text-slate-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Monthly Ballpen Goal</Label>
                <Input 
                    type="number"
                    disabled={!isEditingTargets}
                    value={targetValues.ballpen}
                    onChange={e => setTargetValues({...targetValues, ballpen: Number(e.target.value)})}
                    className="h-12 rounded-xl border-slate-200 bg-white font-black text-slate-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Monthly Exbook Goal</Label>
                <Input 
                    type="number"
                    disabled={!isEditingTargets}
                    value={targetValues.exbook}
                    onChange={e => setTargetValues({...targetValues, exbook: Number(e.target.value)})}
                    className="h-12 rounded-xl border-slate-200 bg-white font-black text-slate-900"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Monthly Goals - ONLY FOR SALES OFFICERS */}
      {userProfile.role === 'so' && (
        <Card className="bg-white border-none shadow-sm p-6 rounded-[32px] overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
            <TrendingUp className="w-24 h-24 text-slate-900" />
          </div>
          <div className="relative z-10 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 leading-none">MY MONTHLY GOALS</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">
                  Target Status for {format(getBDDate(), 'MMMM yyyy')}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-5 pt-2">
              <TargetProgress 
                label="Tissue Delivery" 
                current={stats.monthlyTissue} 
                target={allOfficerTargets[userProfile.name]?.tissue || targets.tissue} 
              />
              <TargetProgress 
                label="Ballpen Delivery" 
                current={stats.monthlyBallpen} 
                target={allOfficerTargets[userProfile.name]?.ballpen || targets.ballpen} 
                colorClass="bg-blue-600"
              />
              <TargetProgress 
                label="Exbook Delivery" 
                current={stats.monthlyExbook} 
                target={allOfficerTargets[userProfile.name]?.exbook || targets.exbook} 
                colorClass="bg-indigo-600"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Entries List */}
      <div className="space-y-4 pb-20 lg:pb-0">
        {userProfile.role !== 'admin' && (
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest ml-1">
            Recent Submissions
          </h3>
        )}
        <AnimatePresence mode="popLayout">
          {userProfile.role !== 'admin' && entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 group"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {editingId === entry.id ? (
                    <div className="space-y-2 mb-2 pr-4">
                      <Input 
                        value={editValues.route} 
                        onChange={e => setEditValues({...editValues, route: e.target.value})}
                        className="h-9 text-sm font-bold bg-slate-50 border-slate-200"
                        placeholder="Route"
                      />
                      <Input 
                        type="date"
                        value={editValues.date} 
                        onChange={e => setEditValues({...editValues, date: e.target.value})}
                        className="h-9 text-sm font-bold bg-slate-50 border-slate-200"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900">{entry.route}</h4>
                        {userProfile.role === 'admin' && (
                          <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-black text-slate-500 uppercase">{entry.soName}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {entry.date} • ID: {entry.soId}
                      </p>
                    </>
                  )}
                </div>

                {userProfile.role === 'admin' && (
                  <div className="flex gap-1 shrink-0">
                    {editingId === entry.id ? (
                      <>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-green-600 bg-green-50 hover:bg-green-100 border border-green-200" onClick={() => saveEdit(entry.id)}>
                          <Check className="w-5 h-5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400 bg-slate-50 hover:bg-slate-100 border border-slate-200" onClick={() => setEditingId(null)}>
                          <X className="w-5 h-5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-500 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-all" onClick={() => startEditing(entry)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 transition-all" onClick={() => handleDelete(entry.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {editingId === entry.id ? (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-50">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold uppercase text-slate-400">Tissue</Label>
                    <Input 
                      type="number"
                      value={editValues.tissue} 
                      onChange={e => setEditValues({...editValues, tissue: Number(e.target.value)})}
                      className="h-9 text-sm text-center font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold uppercase text-slate-400">Ballpen</Label>
                    <Input 
                      type="number"
                      value={editValues.ballpen} 
                      onChange={e => setEditValues({...editValues, ballpen: Number(e.target.value)})}
                      className="h-9 text-sm text-center font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold uppercase text-slate-400">Exbook</Label>
                    <Input 
                      type="number"
                      value={editValues.exbook} 
                      onChange={e => setEditValues({...editValues, exbook: Number(e.target.value)})}
                      className="h-9 text-sm text-center font-bold"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-50">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tissue</span>
                    <span className="text-sm font-black text-primary">{entry.tissue}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Ballpen</span>
                    <span className="text-sm font-black text-blue-600">{entry.ballpen}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Exbook</span>
                    <span className="text-sm font-black text-indigo-600">{entry.exbook}</span>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {entries.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-slate-100">
            <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No entries found yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Helpers ---
const getBDDate = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
};

const Attendance = ({ userProfile }: { userProfile: UserProfile | null }) => {
  const [records, setRecords] = useState<AttendanceEntry[]>([]);
  const [filterWorker, setFilterWorker] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  
  const [bgLocation, setBgLocation] = useState<{lat: number, lon: number} | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  const bdNow = getBDDate();
  const today = format(bdNow, 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);

  // Sync selectedDate with actual today whenever the real date transitions (midnight check)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = getBDDate();
      const currentToday = format(now, 'yyyy-MM-dd');
      // If the actual day has changed and the user is still on the "previous" today, auto-switch
      if (currentToday !== today) {
        window.location.reload(); // Hard refresh at midnight to ensure full state reset
      }
    }, 60000); // Check every minute
    return () => clearInterval(timer);
  }, [today]);
  
  const myTodayRecord = useMemo(() => {
    if (!userProfile) return null;
    // Find if there's any record for this SO for the current date string
    return records.find(r => r.date === today && r.soId === userProfile.uniqueId);
  }, [records, today, userProfile]);

  useEffect(() => {
    if (!userProfile) return;

    // IMPORTANT: Filter by SO ID for non-admins to prevent "insufficient permissions" and improve performance
    const q = userProfile.role === 'admin'
      ? query(collection(db, 'attendance'), orderBy('timestamp', 'desc'))
      : query(
          collection(db, 'attendance'), 
          where('soId', '==', userProfile.uniqueId),
          orderBy('timestamp', 'desc')
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceEntry));
      setRecords(data);
    }, (error) => {
      console.error("Attendance Sync Error:", error);
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });
    return () => unsubscribe();
  }, [userProfile]);

  // Aggressive Persistent GPS Watch to force System Accuracy Dialog
  useEffect(() => {
    if (!userProfile) return;

    let isMounted = true;
    let watchId: number | null = null;
    
    const startGPSWatch = () => {
      if (!("geolocation" in navigator)) return;
      
      console.log("Attendance: Starting persistent GPS watch...");
      
      // watchPosition keeps the GPS hardware active and "loudly" requests accuracy
      // This is the most reliable way to trigger the Android "Location Accuracy" popup
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (isMounted) {
            console.log("GPS locked via watch:", pos.coords.accuracy);
            // We only stop and set it if we get a decent accuracy 
            // or if it's the first reading we get
            setBgLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
            setLocationLoading(false);
          }
        },
        (err) => {
          if (isMounted) {
            console.error("GPS Watch Error:", err.code, err.message);
            
            if (err.code === 1) { // Permission Denied
              toast.error("LOCATION PERMISSION DENIED", {
                description: "Please enable location in your browser and phone settings.",
                duration: 6000,
                id: 'gps-denied'
              });
              setLocationLoading(false);
            }
            // For code 2 (Position Unavailable) or 3 (Timeout), we keep watching
            // System often triggers the Accuracy popup during these states
          }
        },
        { 
          enableHighAccuracy: true, 
          timeout: 10000, 
          maximumAge: 0 
        }
      );
    };

    // Small delay to ensure browser context is active
    const initTimer = setTimeout(startGPSWatch, 800);

    return () => { 
      isMounted = false; 
      clearTimeout(initTimer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [userProfile]);

  useEffect(() => {
    if (showCamera && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [showCamera, stream]);

  const startCamera = async () => {
    try {
      setShowCamera(true);
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } } 
      });
      setStream(s);
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("Could not access camera. Please check permissions.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const handleResetDatabase = async () => {
    const workerName = filterWorker === 'all' ? 'ALL officers' : filterWorker;
    const confirmReset = window.confirm(`⚠️ WARNING: This will permanently delete attendance records for ${workerName} on ${selectedDate}. Are you sure?`);
    if (!confirmReset) return;

    try {
      setSubmitting(true);
      const batch = writeBatch(db);
      
      const recordsToReset = adminRecords.filter(r => 
        filterWorker === 'all' || r.soName === filterWorker
      );

      if (recordsToReset.length === 0) {
        toast.error("No matches found to reset");
        return;
      }

      recordsToReset.forEach(record => {
        if (record.id) {
          batch.delete(doc(db, 'attendance', record.id));
        }
      });
      await batch.commit();
      toast.success(`Records for ${workerName} have been reset successfully.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        // Compress and resize for Firestore (1MB limit)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        setCapturedPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  const handleMarkAttendance = async () => {
    if (!userProfile || myTodayRecord) return;
    if (!capturedPhoto) {
      toast.error("Please take a photo to verify your attendance");
      await startCamera();
      return;
    }
    
    setSubmitting(true);
    try {
      const bdTime = getBDDate();
      const checkInTime = format(bdTime, 'h:mm a');
      
      const hours = bdTime.getHours();
      const minutes = bdTime.getMinutes();
      
      let status: 'On Time' | 'Late' | 'Absent' = 'On Time';
      
      // Threshold: 08:00 AM. 08:01+ is Late.
      if (hours > 8 || (hours === 8 && minutes > 0)) {
        status = 'Late';
      }
      
      let locationLink = "";
      let locationName = "";
      try {
        const getGeo = () => new Promise<GeolocationPosition>((res, rej) => {
          // If we already have background location, use it for faster response
          if (bgLocation) {
            res({
              coords: {
                latitude: bgLocation.lat,
                longitude: bgLocation.lon,
                accuracy: 0,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
              },
              timestamp: Date.now()
            } as GeolocationPosition);
            return;
          }

          navigator.geolocation.getCurrentPosition(res, rej, { 
            enableHighAccuracy: true,
            timeout: 15000, 
            maximumAge: 0
          });
        });
        const pos = await getGeo();
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        locationLink = `https://www.google.com/maps?q=${lat},${lon}`;
        
        // --- Ultra Reliable Geocoding ---
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          
          const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
            signal: controller.signal,
            headers: { 'User-Agent': 'DMP-PRO-App/1.3' }
          });
          clearTimeout(timeoutId);
          
          const data = await resp.json();
          if (data && data.address) {
            const a = data.address;
            
            // Line 1: Basic Area, Division, Country
            const l1 = [a.city || a.town || a.village || a.suburb, a.state_district || a.state, a.country].filter(Boolean).join(', ');
            
            // Line 2: Specific Road/Area info
            const l2 = [a.road, a.neighbourhood, a.suburb, a.city_district].filter(Boolean).slice(0, 3).join(', ');
            
            // Line 3: Exact Coordinates
            const l3 = `Lat ${lat.toFixed(7)} / Long ${lon.toFixed(7)}`;
            
            locationName = `${l1}|${l2}|${l3}`;
          }
          
          // If geocoding didn't yield a friendly name, use coordinates
          if (!locationName || locationName === "GPS Location") {
            locationName = `Location Captured|Area Map Ready|Lat ${lat.toFixed(7)} / Long ${lon.toFixed(7)}`;
          }
        } catch (revError) {
          console.error("Geocoding failed", revError);
          locationName = `Location Captured|Area Map Ready|Lat ${lat.toFixed(7)} / Long ${lon.toFixed(7)}`;
        }
        // --------------------------------
      } catch (e: any) {
        console.log("Location capture issue:", e);
        if (e.code === 1) {
          toast.error("Location Permission Denied! Please enable GPS in browser.");
        } else if (e.code === 3) {
          toast.warning("GPS Signal Weak. Location not captured, but saving attendance.");
        } else {
          toast.info("Location capture skipped.");
        }
      }

      const attendanceData = {
        date: today,
        soName: userProfile.name,
        soId: userProfile.uniqueId,
        checkInTime,
        status,
        location: locationLink,
        locationName: locationName || "GPS Location", // Ensure it's never empty
        selfie: capturedPhoto,
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'attendance'), attendanceData);
      console.log("Attendance saved to Firestore successfully");
      
      toast.success("Hajira (Attendance) Recorded Successfully!");
      setCapturedPhoto(null);
      // Force status update locally if needed
      setRecords(prev => [{ ...attendanceData, timestamp: new Date() } as AttendanceEntry, ...prev]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const adminRecords = useMemo(() => {
    return records.filter(r => r.date === selectedDate);
  }, [records, selectedDate]);

  if (!userProfile) return null;

  return (
    <div className="max-w-2xl mx-auto w-full pt-12 pb-24 px-1">
      {userProfile.role === 'so' ? (
        <Card className="border-none shadow-2xl overflow-hidden rounded-[40px] bg-white">
          <div className="bg-primary p-12 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12 blur-xl" />
            
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              <Clock className="w-20 h-20 mx-auto mb-6 text-white drop-shadow-lg" />
            </motion.div>
            <h2 className="text-3xl font-black tracking-tighter italic">MORNING HAJIRA</h2>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="h-px w-8 bg-white/30" />
              <p className="text-white/80 text-xs font-bold uppercase tracking-[0.2em]">Daily Check-in</p>
              <span className="h-px w-8 bg-white/30" />
            </div>
            <div className="mt-4 bg-white/10 px-4 py-1.5 rounded-full border border-white/20 inline-block">
               <p className="text-[10px] font-black tracking-[0.1em] uppercase">Limit: 08:00 AM</p>
            </div>
          </div>

          <CardContent className="p-10 flex flex-col items-center gap-8">
            <div className="text-center space-y-1">
              <h3 className="text-5xl font-black text-slate-900 tracking-tighter">
                {format(getBDDate(), 'hh:mm:ss a')}
              </h3>
              <p className="text-slate-400 font-black uppercase tracking-widest text-xs">
                {format(getBDDate(), 'EEEE, MMMM do, yyyy')} (BD)
              </p>
            </div>

            {myTodayRecord ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full bg-green-50 border-4 border-green-100 rounded-[32px] p-8 text-center shadow-inner"
              >
                <div className="relative inline-block mb-6">
                  {myTodayRecord.selfie ? (
                    <div className="relative">
                      <img 
                        src={myTodayRecord.selfie} 
                        className="w-48 h-48 rounded-[28px] border-4 border-white shadow-2xl object-cover" 
                        referrerPolicy="no-referrer"
                        alt="Selfie"
                      />
                      <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-2xl p-2.5 border-4 border-white shadow-lg">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-green-500 rounded-[24px] flex items-center justify-center mx-auto shadow-lg shadow-green-200">
                      <CheckCircle2 className="w-12 h-12 text-white" />
                    </div>
                  )}
                </div>
                {myTodayRecord.locationName && (
                  <div className="mt-6 bg-white p-5 rounded-[24px] border border-slate-100 w-full max-w-[320px] mx-auto shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] text-left">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-red-50 rounded-lg flex items-center justify-center">
                        <MapPin className="w-3.5 h-3.5 text-red-500" />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verified Map Location</span>
                    </div>
                    <div className="space-y-1.5">
                      {myTodayRecord.locationName.split('|').map((line, i) => (
                        <p key={i} className={`leading-tight text-slate-800 ${
                          i === 0 ? 'text-[14px] font-black' : 
                          i === 1 ? 'text-[12px] font-semibold text-slate-600' : 
                          'text-[10px] font-mono text-slate-400 pt-1'
                        }`}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-green-600/70 font-bold uppercase text-[10px] tracking-widest mt-1">Visit logs to see details</p>
                
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                    <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Entry Time</p>
                    <p className="text-xl font-black text-slate-800">
                      {myTodayRecord.checkInTime.split(' ')[0]} <span className="text-[12px] ml-1">{myTodayRecord.checkInTime.split(' ')[1]}</span>
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                    <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Status</p>
                    <p className={`text-xl font-black ${
                      myTodayRecord.status === 'On Time' 
                        ? 'text-green-600' 
                        : myTodayRecord.status === 'Late' 
                          ? 'text-orange-500' 
                          : 'text-red-600'
                    }`}>
                      {myTodayRecord.status}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="w-full px-2 space-y-4">
                {capturedPhoto ? (
                  <div className="relative group mx-auto w-full max-w-[240px]">
                    <img 
                      src={capturedPhoto} 
                      className="w-full h-48 rounded-3xl object-cover border-4 border-white shadow-2xl" 
                      referrerPolicy="no-referrer"
                      alt="Captured"
                    />
                    <Button 
                      onClick={() => setCapturedPhoto(null)}
                      size="icon"
                      className="absolute -top-3 -right-3 h-10 w-10 bg-red-500 hover:bg-red-600 rounded-full border-4 border-white shadow-lg"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="outline"
                    onClick={startCamera}
                    className="w-full h-32 rounded-[32px] border-dashed border-4 border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-all group"
                  >
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Camera className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TAP TO TAKE SELFIE</span>
                  </Button>
                )}
                
                <Button 
                  onClick={handleMarkAttendance}
                  disabled={submitting || !bgLocation}
                  className={`w-full h-32 rounded-[32px] text-3xl font-black shadow-2xl transition-all active:scale-95 group relative overflow-hidden ${
                    (!bgLocation) 
                    ? 'bg-slate-400 cursor-not-allowed shadow-none font-medium' 
                    : 'bg-primary hover:bg-primary/90 shadow-primary/40'
                  }`}
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <span className="relative flex flex-col items-center">
                    {submitting 
                      ? "RECORDING..." 
                      : (!bgLocation) 
                        ? (
                          <div className="flex flex-col items-center">
                            <span>GPS SEARCHING...</span>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.reload();
                              }}
                              className="text-[10px] bg-white/20 px-3 py-1 rounded-full mt-2 hover:bg-white/30"
                            >
                              Retry GPS
                            </button>
                          </div>
                        )
                        : "PUNCH IN NOW"
                    }
                    <span className="text-[10px] font-bold text-white/50 tracking-[0.4em] mt-1 text-center">
                      {(!bgLocation) 
                        ? "WAITING FOR ACCURATE SIGNAL" 
                        : "CLICK TO MARK ATTENDANCE"
                      }
                    </span>
                  </span>
                </Button>
              </div>
            )}

            <div className="flex items-center gap-3 text-slate-400 bg-slate-50 px-6 py-3 rounded-full border border-slate-100">
              <AlertCircle className="w-4 h-4 text-orange-400" />
              <p className="text-[10px] font-bold uppercase tracking-tighter">
                Selfie and GPS will be verified by the admin
              </p>
            </div>

            {/* Previous Records for SO */}
            <div className="w-full mt-4 space-y-3">
              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Last 3 Days</h5>
              {records
                .filter(r => r.soId === userProfile.uniqueId && r.date !== today)
                .slice(0, 3)
                .map(r => (
                  <div key={r.id} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex justify-between items-center group">
                    <div className="flex-1 mr-4">
                      <p className="text-xs font-black text-slate-700">{format(new Date(r.date), 'MMM dd, yyyy')}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                          r.status === 'On Time' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>{r.status}</span>
                        {r.locationName && (
                          <div className="flex items-center gap-1 text-slate-400">
                            <MapPin className="w-2.5 h-2.5" />
                            <p className="text-[9px] font-bold uppercase truncate max-w-[120px]">
                              {r.locationName.split('|')[0]}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-500 block text-sm">{r.checkInTime}</span>
                      {r.location && (
                        <a href={r.location} target="_blank" rel="noreferrer" className="text-[8px] font-black text-primary uppercase flex items-center justify-end gap-0.5 mt-1 opacity-60 hover:opacity-100 transition-opacity">
                          View Map
                        </a>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 mt-4">
           <Card className="bg-slate-900 border-none shadow-2xl text-white rounded-[32px] overflow-hidden">
            <CardHeader className="p-8">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-3xl font-black italic tracking-tighter uppercase">ATTENDANCE</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">Monitor SO Movements • {format(new Date(selectedDate), 'dd MMMM yyyy')}</CardDescription>
                  
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3 bg-white/5 p-2 pr-4 rounded-2xl border border-white/10 w-full max-w-[220px]">
                      <div className="bg-white/10 p-2 rounded-xl">
                        <Calendar className="w-4 h-4 text-white" />
                      </div>
                      <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent text-white font-black text-sm outline-none cursor-pointer [color-scheme:dark] flex-1"
                      />
                    </div>

                    <div className="flex items-center gap-3 bg-white/5 p-2 pr-4 rounded-2xl border border-white/10 w-full max-w-[220px]">
                      <div className="bg-white/10 p-2 rounded-xl">
                        <UserCheck className="w-4 h-4 text-white" />
                      </div>
                      <select 
                        value={filterWorker}
                        onChange={(e) => setFilterWorker(e.target.value)}
                        className="bg-transparent text-white font-black text-sm outline-none cursor-pointer flex-1"
                      >
                        <option value="all" className="bg-slate-900">All Workers</option>
                        {SALES_OFFICERS.map(so => (
                          <option key={so.id} value={so.name} className="bg-slate-900">{so.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <div className="flex flex-col gap-2">
                    <Button 
                      onClick={() => {
                        const targets = adminRecords.filter(r => filterWorker === 'all' || r.soName === filterWorker);
                        if (targets.length === 0) {
                          toast.error("No records match your filter");
                          return;
                        }
                        const headers = ["Officer Name", "Officer ID", "Date", "Check-In Time", "Status", "Location Link"];
                        const csvContent = [
                          headers.join(","),
                          ...targets.map(r => {
                            const so = SALES_OFFICERS.find(s => s.id === r.soId);
                            return [
                              `"${so?.name || 'Unknown'}"`,
                              `"${r.soId}"`,
                              `"${r.date}"`,
                              `"${r.checkInTime}"`,
                              `"${r.status}"`,
                              `"${r.location || 'N/A'}"`
                            ].join(",");
                          })
                        ].join("\n");
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement("a");
                        const url = URL.createObjectURL(blob);
                        link.setAttribute("href", url);
                        link.setAttribute("download", `attendance_${filterWorker}_${selectedDate}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast.success("Filtered report exported!");
                      }}
                      className="bg-sky-500 hover:bg-sky-600 text-white font-black rounded-xl transition-all shadow-lg shadow-sky-200 h-10 w-10 p-0 flex items-center justify-center shrink-0"
                    >
                      <Download className="w-5 h-5" />
                    </Button>
                    <Button 
                      onClick={handleResetDatabase}
                      disabled={submitting}
                      variant="destructive"
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition-all shadow-lg shadow-red-200 h-10 w-10 p-0 flex items-center justify-center shrink-0"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                  <div className="bg-primary p-4 rounded-2xl shadow-lg shadow-primary/20 hidden md:block">
                    <Clock className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="space-y-3">
            {SALES_OFFICERS.filter(so => filterWorker === 'all' || so.name === filterWorker).map(so => {
              const record = adminRecords.find(r => r.soId === so.id);
              return (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={so.id} 
                  className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`relative w-14 h-14 rounded-[20px] flex items-center justify-center font-black text-xl text-white shadow-lg transition-colors overflow-hidden ${
                      record 
                        ? 'bg-green-500 shadow-green-100' 
                        : so.name === 'SUMIT' ? 'bg-indigo-500' :
                          so.name === 'PRIYAS' ? 'bg-rose-500' :
                          so.name === 'FOZLUR' ? 'bg-amber-500' :
                          so.name === 'RIDOY' ? 'bg-emerald-500' :
                          'bg-sky-500'
                    }`}>
                      <span className="absolute inset-0 flex items-center justify-center">{so.name.charAt(0)}</span>
                      {so.photo && (
                        <img 
                          src={so.photo} 
                          alt={so.name} 
                          className="absolute inset-0 w-full h-full object-cover z-10"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-lg leading-tight uppercase tracking-tight">{so.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">ID: {so.id}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    {record ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                            record.status === 'On Time' 
                              ? 'bg-green-50 text-green-600 border border-green-100' 
                              : record.status === 'Late'
                                ? 'bg-orange-50 text-orange-500 border border-orange-100'
                                : 'bg-red-50 text-red-600 border border-red-100'
                          }`}>
                            {record.status}
                          </span>
                          <span className="font-black text-slate-800 text-xl tracking-tighter">
                            {record.checkInTime.split(' ')[0]} <span className="text-[12px] ml-1">{record.checkInTime.split(' ')[1]}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {record.selfie && (
                             <button 
                               onClick={() => {
                                 const win = window.open("");
                                 win?.document.write(`<img src="${record.selfie}" style="max-width:100%; height:auto;">`);
                               }}
                               className="text-[9px] font-black text-blue-500 flex items-center gap-1 hover:opacity-70 transition-opacity"
                             >
                               <Camera className="w-3 h-3" />
                               PHOTO
                             </button>
                          )}
                          {record.location && (
                            <a href={record.location} target="_blank" rel="noreferrer" className="text-[9px] font-black text-slate-900 flex items-center gap-1 hover:opacity-70 transition-opacity bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                              <MapPin className="w-3 h-3 text-red-500" />
                              MAP
                            </a>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-300 font-black text-[10px] uppercase tracking-widest opacity-60">
                        <AlertCircle className="w-4 h-4" />
                        Awaiting
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Camera UI Overlay */}
      <AnimatePresence>
        {showCamera && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4"
          >
            <div className="relative w-full max-w-sm aspect-square bg-slate-900 rounded-[40px] overflow-hidden border-8 border-white shadow-2xl">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-dashed border-white/50 rounded-full" />
              </div>
            </div>
            
            <div className="mt-12 flex items-center gap-8">
              <Button 
                variant="ghost" 
                onClick={stopCamera}
                className="h-16 w-16 bg-white/10 hover:bg-white/20 text-white rounded-full border-2 border-white/20"
              >
                <X className="w-8 h-8" />
              </Button>
              <Button 
                onClick={takePhoto}
                className="h-24 w-24 bg-white hover:bg-slate-100 text-slate-900 rounded-full border-8 border-slate-300 shadow-2xl active:scale-90 transition-transform"
              />
              <div className="w-16 h-16" /> {/* Spacer */}
            </div>
            <p className="mt-8 text-white/60 font-black text-xs uppercase tracking-widest">Position your face within the circle</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminPanel = () => {
  const [allEntries, setAllEntries] = useState<DeliveryEntry[]>([]);
  
  const [filterSO, setFilterSO] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<DeliveryEntry>>({});
  
  useEffect(() => {
    const q = query(collection(db, 'deliveries'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryEntry)));
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string | undefined) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'deliveries', id));
      toast.success("Entry deleted successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'deliveries');
    }
  };

  const startEditing = (entry: DeliveryEntry) => {
    setEditingId(entry.id || null);
    setEditValues({
      tissue: entry.tissue,
      ballpen: entry.ballpen,
      exbook: entry.exbook,
      route: entry.route,
      date: entry.date
    });
  };

  const saveEdit = async (id: string | undefined) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'deliveries', id), {
        ...editValues,
        tissue: Number(editValues.tissue),
        ballpen: Number(editValues.ballpen),
        exbook: Number(editValues.exbook),
      });
      setEditingId(null);
      toast.success("Entry updated successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'deliveries');
    }
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast.error("No entries to export");
      return;
    }

    const headers = ["Officer", "Route", "Date", "Tissue", "Ballpen", "Exbook"];
    const csvContent = [
      headers.join(","),
      ...filtered.map(e => [
        `"${e.soName}"`,
        `"${e.route}"`,
        e.date,
        e.tissue,
        e.ballpen,
        e.exbook
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `delivery_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Logs exported successfully");
  };

  const handleClearAll = async () => {
    if (allEntries.length === 0) {
      toast.error("No entries to clear");
      return;
    }
    
    const confirmClear = window.confirm("⚠️ WARNING: This will PERMANENTLY delete ALL delivery logs. This action cannot be undone. Are you sure you want to proceed?");
    if (!confirmClear) return;

    try {
      const batch = writeBatch(db);
      allEntries.forEach((entry) => {
        if (entry.id) {
          batch.delete(doc(db, 'deliveries', entry.id));
        }
      });
      await batch.commit();
      toast.success("All logs cleared successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'deliveries');
    }
  };

  const filtered = useMemo(() => {
    return allEntries.filter(e => {
      const matchSO = filterSO === 'all' || e.soName === filterSO;
      const matchDate = !filterDate || e.date === filterDate;
      return matchSO && matchDate;
    });
  }, [allEntries, filterSO, filterDate]);

  const statistics = useMemo(() => {
    const today = format(getBDDate(), 'yyyy-MM-dd');
    const todayEntries = allEntries.filter(e => e.date === today);
    
    // Add monthly team/selected SO logic
    const currentMonth = format(getBDDate(), 'yyyy-MM');
    const monthlyFiltered = allEntries.filter(e => {
        const isThisMonth = e.date.startsWith(currentMonth);
        const matchSO = filterSO === 'all' || e.soName === filterSO;
        return isThisMonth && matchSO;
    });

    return {
      totalToday: todayEntries.length,
      itemsToday: todayEntries.reduce((acc, curr) => acc + (Number(curr.ballpen) || 0) + (Number(curr.exbook) || 0) + (Number(curr.tissue) || 0), 0),
      officersToday: new Set(todayEntries.map(e => e.soId)).size,
      // Use "filtered" here so it reacts to the UI filters
      totalTissue: filtered.reduce((acc, curr) => acc + (Number(curr.tissue) || 0), 0),
      totalBallpen: filtered.reduce((acc, curr) => acc + (Number(curr.ballpen) || 0), 0),
      totalExbook: filtered.reduce((acc, curr) => acc + (Number(curr.exbook) || 0), 0),
      grandTotal: filtered.reduce((acc, curr) => acc + (Number(curr.tissue) || 0) + (Number(curr.ballpen) || 0) + (Number(curr.exbook) || 0), 0),
      // Monthly Progress
      monthlyTissue: monthlyFiltered.reduce((acc, curr) => acc + (Number(curr.tissue) || 0), 0),
      monthlyBallpen: monthlyFiltered.reduce((acc, curr) => acc + (Number(curr.ballpen) || 0), 0),
      monthlyExbook: monthlyFiltered.reduce((acc, curr) => acc + (Number(curr.exbook) || 0), 0),
    };
  }, [allEntries, filtered, filterSO]);

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-xl bg-slate-900 text-white rounded-2xl overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                <span className="text-[9px] font-black uppercase text-primary/80 tracking-[0.4em] leading-none">System Live</span>
              </div>
              <div className="flex flex-col">
                <CardTitle className="text-3xl font-black tracking-tighter leading-none text-white flex items-baseline gap-2 pb-1">
                  ADMIN <span className="text-sky-400 italic">PANEL</span>
                </CardTitle>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 font-mono">
              <Button 
                size="sm" 
                variant="outline" 
                className="bg-slate-900 border-slate-800 text-white hover:text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/50 h-10 w-10 p-0 font-bold flex items-center justify-center rounded-xl border-2 transition-all active:scale-95 group"
                onClick={handleExportCSV}
              >
                <Download className="w-5 h-5 text-primary group-hover:text-sky-400 transition-colors" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pb-6 px-6 pt-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Filter Officer</Label>
              <Select onValueChange={setFilterSO} defaultValue="all">
                <SelectTrigger className="bg-slate-800 border-slate-700 h-10 text-xs text-white">
                  <SelectValue placeholder="All Officers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Officers</SelectItem>
                  {SALES_OFFICERS.map(so => (
                    <SelectItem key={so.id} value={so.name}>{so.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Filter Date</Label>
              <Input 
                type="date" 
                className="bg-slate-800 border-slate-700 h-10 text-xs text-white"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Team/Officer Goals Removed from here to Dashboard for Admin */}

      <Card className="bg-white border-2 border-slate-100 shadow-sm p-5 rounded-[24px]">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter italic">GRAND TOTAL</h3>
          </div>
          <div className="text-right">
             <span className="text-3xl font-black text-primary drop-shadow-sm">{statistics.grandTotal.toLocaleString()}</span>
             <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Sum of items</p>
          </div>
        </div>
      </Card>

      {/* Item Totals Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-white border-2 border-slate-50 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)] p-5 rounded-[24px] flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Tissue</p>
          <span className="text-[18px] font-black text-slate-900 leading-none">{statistics.totalTissue.toLocaleString()}</span>
        </Card>
        <Card className="bg-white border-2 border-slate-50 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)] p-5 rounded-[24px] flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Ballpen</p>
          <span className="text-[18px] font-black text-slate-900 leading-none">{statistics.totalBallpen.toLocaleString()}</span>
        </Card>
        <Card className="bg-white border-2 border-slate-50 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)] p-5 rounded-[24px] flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Exbook</p>
          <span className="text-[18px] font-black text-slate-900 leading-none">{statistics.totalExbook.toLocaleString()}</span>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Master Logs</h3>
            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold">
              {filtered.length} Entries
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearAll}
            className="text-[10px] font-black text-red-500 hover:text-red-600 hover:bg-red-50 px-3 h-8 border border-red-100 rounded-xl flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Trash2 className="w-3 h-3" />
            CLEAR ALL LOGS
          </Button>
        </div>
        
        <div className="space-y-3">
          {filtered.map((entry) => (
            <div key={entry.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 group relative">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {editingId === entry.id ? (
                    <div className="space-y-2 mb-2">
                      <Input 
                        value={editValues.route} 
                        onChange={e => setEditValues({...editValues, route: e.target.value})}
                        className="h-8 text-xs font-bold"
                        placeholder="Route"
                      />
                      <Input 
                        type="date"
                        value={editValues.date} 
                        onChange={e => setEditValues({...editValues, date: e.target.value})}
                        className="h-8 text-xs font-bold"
                      />
                    </div>
                  ) : (
                    <>
                      <h4 className="font-bold text-slate-900 text-sm">{entry.soName}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{entry.route} • {entry.date}</p>
                    </>
                  )}
                </div>
                <div className="flex gap-1">
                  {editingId === entry.id ? (
                    <>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-green-600 bg-green-50 hover:bg-green-100 border border-green-200" onClick={() => saveEdit(entry.id)}>
                          <Check className="w-5 h-5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400 bg-slate-50 hover:bg-slate-100 border border-slate-200" onClick={() => setEditingId(null)}>
                          <X className="w-5 h-5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-all font-bold" onClick={() => startEditing(entry)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-all font-bold" onClick={() => handleDelete(entry.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                  )}
                </div>
              </div>

              {editingId === entry.id ? (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-50">
                  <div className="space-y-1">
                    <Label className="text-[8px] font-bold uppercase text-slate-400">Tissue</Label>
                    <Input 
                      type="number"
                      value={editValues.tissue} 
                      onChange={e => setEditValues({...editValues, tissue: Number(e.target.value)})}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] font-bold uppercase text-slate-400">Ballpen</Label>
                    <Input 
                      type="number"
                      value={editValues.ballpen} 
                      onChange={e => setEditValues({...editValues, ballpen: Number(e.target.value)})}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[8px] font-bold uppercase text-slate-400">Exbook</Label>
                    <Input 
                      type="number"
                      value={editValues.exbook} 
                      onChange={e => setEditValues({...editValues, exbook: Number(e.target.value)})}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-50">
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Tissue</p>
                    <p className="text-sm font-black text-primary">{entry.tissue}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Ballpen</p>
                    <p className="text-sm font-black text-blue-600">{entry.ballpen}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Exbook</p>
                    <p className="text-sm font-black text-indigo-600">{entry.exbook}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ attendanceEnabled: true });

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) {
        setSystemConfig(snap.data() as SystemConfig);
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => {
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (user && profile) {
      // Trigger location permission prompt immediately after login
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          () => console.log("Location permission granted"),
          (error) => console.log("Location permission denied/error:", error.message),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
    }
  }, [user, profile]);

  const handleLogout = async () => {
    await signOut(auth);
    toast.success("Logged out successfully");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-white text-3xl font-black tracking-tighter uppercase"
        >
          GULAPGONJ TEAM
        </motion.div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col relative">
        <Toaster position="top-center" richColors />

        <Routes>
            <Route 
              path="/login" 
              element={user && profile ? <Navigate to="/" replace /> : <Login onLoginSuccess={setProfile} />} 
            />
          
          <Route 
            path="/*" 
            element={
              user && profile ? (
                <div className="flex flex-col h-screen overflow-hidden">
                  <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
                    <div className="flex items-center gap-2.5 font-black text-xl text-primary tracking-tighter uppercase">
                      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      GULAPGONJ TEAM
                    </div>
                    <div className="flex items-center gap-3">
                      {profile.role === 'admin' && (
                        <div className="hidden md:flex items-center mr-4 border-r pr-4 border-slate-200">
                          <Link to="/" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-primary mr-4 transition-colors">Home</Link>
                          {systemConfig.attendanceEnabled && (
                            <Link to="/attendance" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-primary mr-4 transition-colors flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Attendance
                            </Link>
                          )}
                          <Link to="/admin" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-primary transition-colors flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Admin
                          </Link>
                        </div>
                      )}
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Officer</span>
                        <span className="text-sm font-bold text-slate-700">{profile.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl">
                        <LogOut className="w-5 h-5" />
                      </Button>
                    </div>
                  </header>

                  <main className="flex-1 overflow-hidden p-4 sm:p-6 mb-16 lg:mb-0">
                    <Routes>
                      <Route index element={
                        <div className={`grid grid-cols-1 ${profile.role === 'admin' ? '' : 'lg:grid-cols-[420px_1fr]'} gap-6 h-full`}>
                          {profile.role !== 'admin' && (
                            <div className="overflow-y-auto custom-scrollbar">
                              <DeliveryForm userProfile={profile} />
                            </div>
                          )}
                          <div className="overflow-y-auto custom-scrollbar">
                            <Dashboard userProfile={profile} systemConfig={systemConfig} />
                          </div>
                        </div>
                      } />
                      <Route path="attendance" element={
                        systemConfig.attendanceEnabled || profile.role === 'admin' ? (
                          <div className="h-full overflow-y-auto custom-scrollbar">
                            <Attendance userProfile={profile} />
                          </div>
                        ) : (
                          <Navigate to="/" replace />
                        )
                      } />
                      {profile.role === 'admin' && (
                        <Route path="admin" element={
                          <div className="h-full overflow-y-auto custom-scrollbar">
                            <AdminPanel />
                          </div>
                        } />
                      )}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>

                  {/* Mobile Navigation Bar */}
                  <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-6 z-30 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
                    <Link to="/" className={`flex flex-col items-center gap-1 transition-colors ${window.location.hash === '#/' ? 'text-primary' : 'text-slate-400'}`}>
                      <LayoutDashboard className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase">Home</span>
                    </Link>
                    {(systemConfig.attendanceEnabled || profile.role === 'admin') && (
                      <Link to="/attendance" className={`flex flex-col items-center gap-1 transition-colors ${window.location.hash.includes('attendance') ? 'text-primary' : 'text-slate-400'}`}>
                        <Clock className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase">Attendance</span>
                      </Link>
                    )}
                    {profile.role === 'admin' && (
                      <Link to="/admin" className={`flex flex-col items-center gap-1 transition-colors ${window.location.hash.includes('admin') ? 'text-primary' : 'text-slate-400'}`}>
                        <ShieldCheck className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase">Admin</span>
                      </Link>
                    )}
                    <button onClick={handleLogout} className="flex flex-col items-center gap-1 text-slate-400 hover:text-red-500">
                      <LogOut className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase">Exit</span>
                    </button>
                  </div>
                </div>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
