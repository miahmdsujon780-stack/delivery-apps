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
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  writeBatch
} from './firebase';
import { getDocFromServer } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { DEALERS, SALES_OFFICERS, ADMIN_EMAIL, MONTHLY_TARGETS, GLOBAL_TARGETS } from './constants';
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
  Save,
  Fingerprint,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Map as PigeonMap, Marker, ZoomControl, Overlay } from "pigeon-maps";


// High-detail tile provider for better labels (Roadmap)
const googleTileProvider = (x: number, y: number, z: number) => {
  return `https://mt1.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`;
};

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
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  if (errMessage.includes('insufficient permissions')) {
    toast.error(`Permission Denied: Accessing ${path} failed.`);
  }

  // Only throw if not in a background listener context or if specifically needed
  // For this implementation, we throw to provide the JSON to the system
  throw new Error(JSON.stringify(errInfo));
};

// --- Types ---
interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'so';
  uniqueId: string;
  dealerId?: string; // <--- ADDED THIS
  assignedLocation?: {
    lat: number;
    lon: number;
    radius: number;
    name: string;
  };
}

interface DeliveryEntry {
  id?: string;
  date: string;
  soName: string;
  soId: string;
  userId?: string;
  route: string;
  tissue: number;
  ballpen: number;
  exbook: number;
  stationery: number;
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

  const handleGoogleLogin = async () => {
    if (!selectedSO || !soId) {
      toast.error("Please select your name and enter your ID");
      return;
    }

    if (selectedSO === 'ADMIN') {
      if (soId.trim() !== '34261') {
        toast.error("Invalid Admin ID");
        return;
      }
    } else {
      const officer = SALES_OFFICERS.find(so => so.name.trim() === selectedSO.trim());
      const normalizedInputId = soId.trim();
      if (!officer || officer.id !== normalizedInputId) {
        toast.error("Invalid Sales Officer ID");
        return;
      }
    }

    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const isActuallyAdmin = user.email === ADMIN_EMAIL || selectedSO === 'ADMIN';

      const profile = {
        name: selectedSO,
        email: user.email || '',
        role: isActuallyAdmin ? 'admin' : 'so',
        uniqueId: soId,
        uid: user.uid,
        lastLogin: serverTimestamp()
      };

      await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
      // The listener in AttendanceApp will pick up the full profile (including assignedLocation)
      toast.success(`স্বাগতম, ${selectedSO}!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser?.uid || 'unknown'}`);
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
                onClick={handleGoogleLogin} 
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
  const percentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  const isCompleted = current >= target;

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex justify-between items-end">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-slate-900">৳{(current ?? 0).toLocaleString()}</span>
            <span className="text-[9px] font-bold text-slate-300 uppercase">/ ৳{(target ?? 0).toLocaleString()}</span>
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

interface AssignedLocation {
  lat: number;
  lon: number;
  name: string;
  radius: number;
}

const Dashboard = ({ userProfile, systemConfig }: { userProfile: UserProfile, systemConfig: SystemConfig }) => {
  const isAdmin = userProfile.role === 'admin';
  const MapMarker = Marker as any;
  const [entries, setEntries] = useState<DeliveryEntry[]>([]);
  const [productEntries, setProductEntries] = useState<any[]>([]);
  const [targets, setTargets] = useState(MONTHLY_TARGETS); // Global/Team Targets
  const [allOfficerTargets, setAllOfficerTargets] = useState<Record<string, typeof MONTHLY_TARGETS>>({});
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [targetValues, setTargetValues] = useState(MONTHLY_TARGETS);
  const [selectedOfficerForTargetConfig, setSelectedOfficerForTargetConfig] = useState(SALES_OFFICERS[0].name);
  
  // Location Manager State
  const [assignedLocations, setAssignedLocations] = useState<Record<string, AssignedLocation>>({});
  const [selectedOfficerForLoc, setSelectedOfficerForLoc] = useState<string | null>(null);
  const [locRadius, setLocRadius] = useState(200);
  const [locName, setLocName] = useState('');
  const [manualCoords, setManualCoords] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  useEffect(() => {
    // Listen to all persistent pins
    const unsubPins = onSnapshot(collection(db, 'assigned_locations'), (snapshot) => {
      const pinMap: Record<string, AssignedLocation> = {};
      snapshot.docs.forEach(doc => {
        pinMap[doc.id] = doc.data() as AssignedLocation;
      });
      setAssignedLocations(pinMap);
    }, (error) => {
      console.error("Pins listener error:", error);
      handleFirestoreError(error, OperationType.LIST, 'assigned_locations');
    });
    return () => unsubPins();
  }, []);

  const [mapCenter, setMapCenter] = useState<[number, number]>([24.8949, 91.8687]);

  // Auto-center map when selecting an officer
  useEffect(() => {
    if (selectedOfficerForLoc && assignedLocations[selectedOfficerForLoc]) {
      const { lat, lon } = assignedLocations[selectedOfficerForLoc];
      setMapCenter([lat, lon]);
    }
  }, [selectedOfficerForLoc, assignedLocations]);

  const handlePinLocation = async (lat: number, lon: number) => {
    if (!selectedOfficerForLoc) {
      toast.error("প্রথমে একজন অফিসার সিলেক্ট করুন");
      return;
    }
    if (!locName) {
      toast.error("জায়গার নাম লিখুন (যেমন: অফিস বা গোলাপগঞ্জ)");
      return;
    }

    setPinLoading(true);
    try {
      const locationData = {
        lat,
        lon,
        radius: Math.max(locRadius, 50),
        name: locName,
        updatedAt: serverTimestamp()
      };

      // Store by Officer Name for persistence even before login
      await setDoc(doc(db, 'assigned_locations', selectedOfficerForLoc), locationData);
      
      toast.success(`সাফল্য! ${selectedOfficerForLoc}-এর পিন সেট করা হয়েছে: ${locName}`);
    } catch (error: any) {
      console.error("Pin error:", error);
      toast.error(`Error: ${error.message || "Failed to pin location"}`);
    } finally {
      setPinLoading(false);
    }
  };

  const handleRemovePin = async (officerName: string) => {
    try {
      await deleteDoc(doc(db, 'assigned_locations', officerName));
      toast.success(`Location pin removed for ${officerName}`);
    } catch (error) {
      toast.error("Failed to remove pin");
    }
  };

  const handleToggleAttendance = async (enabled: boolean) => {
    if (userProfile.role !== 'admin') return;
    try {
      await setDoc(doc(db, 'settings', 'config'), { attendanceEnabled: enabled }, { merge: true });
      toast.success(`Attendance feature is now ${enabled ? 'ON' : 'OFF'}`);
    } catch (error) {
      toast.error("Failed to update attendance status");
    }
  };

  const [filterMonthlySO, setFilterMonthlySO] = useState('all');

  useEffect(() => {
    if (userProfile.role !== 'admin' && filterMonthlySO === 'all') {
      setFilterMonthlySO(userProfile.name);
    }
  }, [userProfile.role, userProfile.name]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<DeliveryEntry>>({});

  useEffect(() => {
    // 1. Fetch Global Team Targets
    const unsubGlobalTargets = onSnapshot(doc(db, 'settings', 'monthly_targets'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTargets({
          tissue: data.tissue ?? MONTHLY_TARGETS.tissue,
          ballpen: data.ballpen ?? MONTHLY_TARGETS.ballpen,
          exbook: data.exbook ?? MONTHLY_TARGETS.exbook,
          stationery: data.stationery ?? MONTHLY_TARGETS.stationery
        });
      }
    }, (error) => {
      console.error("Global targets error:", error);
      handleFirestoreError(error, OperationType.GET, 'settings/monthly_targets');
    });

    // 2. Fetch Individual Officer Targets
    const unsubOfficerTargets = onSnapshot(collection(db, 'officer_targets'), (snapshot) => {
      const targetMap: Record<string, typeof MONTHLY_TARGETS> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        targetMap[doc.id] = {
           tissue: data.tissue ?? MONTHLY_TARGETS.tissue,
           ballpen: data.ballpen ?? MONTHLY_TARGETS.ballpen,
           exbook: data.exbook ?? MONTHLY_TARGETS.exbook,
           stationery: data.stationery ?? MONTHLY_TARGETS.stationery
        };
      });
      setAllOfficerTargets(targetMap);
      
      // If editing mode is off, sync preview values with the selected officer's current goal
      if (!isEditingTargets) {
        setTargetValues({ ...MONTHLY_TARGETS, ...(targetMap[selectedOfficerForTargetConfig] || {}) });
      }
    }, (error) => {
      console.error("Officer targets error:", error);
      handleFirestoreError(error, OperationType.LIST, 'officer_targets');
    });

    const q = query(collection(db, 'deliveries'));

    const unsubscribeDeliveries = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryEntry));
      // Local filtering
      if (!isAdmin) {
        data = data.filter(d => d.soId === userProfile.uniqueId || d.userId === userProfile.uid);
      }
      
      // Sort manually to include documents missing timestamp
      data.sort((a, b) => {
        const timeA = a.timestamp?.toMillis?.() || 0;
        const timeB = b.timestamp?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setEntries(data);
    }, (error) => {
      console.error("Deliveries sync error:", error);
      handleFirestoreError(error, OperationType.LIST, 'deliveries');
    });

    const pq = query(collection(db, 'product_entries'));

    const unsubscribeProductEntries = onSnapshot(pq, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Local filtering
      if (!isAdmin) {
        data = data.filter(d => d.soId === userProfile.uniqueId || d.userId === userProfile.uid);
      }
      // Sort manually
      data.sort((a, b) => {
        const timeA = a.timestamp?.toMillis?.() || 0;
        const timeB = b.timestamp?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setProductEntries(data);
    }, (error) => {
      console.error("Products sync error:", error);
    });

    return () => {
      unsubGlobalTargets();
      unsubOfficerTargets();
      unsubscribeDeliveries();
      unsubscribeProductEntries();
    };
  }, [userProfile.uniqueId, userProfile.role, selectedOfficerForTargetConfig, isEditingTargets]);

  useEffect(() => {
    if (!isEditingTargets) {
      setTargetValues({ ...MONTHLY_TARGETS, ...(allOfficerTargets[selectedOfficerForTargetConfig] || {}) });
    }
  }, [selectedOfficerForTargetConfig, allOfficerTargets, isEditingTargets]);

  const handleUpdateTargets = async () => {
    try {
      await setDoc(doc(db, 'officer_targets', selectedOfficerForTargetConfig), {
        tissue: Number(targetValues.tissue || 0),
        ballpen: Number(targetValues.ballpen || 0),
        exbook: Number(targetValues.exbook || 0),
        stationery: Number(targetValues.stationery || 0)
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

  const groupedProductEntries = useMemo(() => {
    const map = new Map<string, any>();
    productEntries.forEach(entry => {
      const routeStr = entry.route || 'No Route';
      const key = `${entry.date}_${entry.soId}_${routeStr}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          soName: entry.soName,
          date: entry.date,
          route: routeStr,
          soId: entry.soId,
          tissueP: 0, tissueV: 0,
          ballpenP: 0, ballpenV: 0,
          exbookP: 0, exbookV: 0,
          stationeryP: 0, stationeryV: 0,
          originalIds: []
        });
      }
      const group = map.get(key);
      group.originalIds.push(entry.id);
      const p = Number(entry.pieces) || 0;
      const v = Number(entry.value) || 0;
      if (entry.productName === 'Total tissue') {
        group.tissueP += p; group.tissueV += v;
      } else if (entry.productName === 'BALLPEN') {
        group.ballpenP += p; group.ballpenV += v;
      } else if (entry.productName === 'EXBOOK') {
        group.exbookP += p; group.exbookV += v;
      } else if (entry.productName === 'STATIONERY') {
        group.stationeryP += p; group.stationeryV += v;
      }
    });
    return Array.from(map.values()).sort((a,b) => b.date.localeCompare(a.date));
  }, [productEntries]);

  const totals = useMemo(() => {
    const acc = entries.reduce((acc, curr) => ({
      tissue: acc.tissue + (curr.tissue || 0),
      ballpen: acc.ballpen + (curr.ballpen || 0),
      exbook: acc.exbook + (curr.exbook || 0),
      stationery: acc.stationery + (curr.stationery || 0)
    }), { tissue: 0, ballpen: 0, exbook: 0, stationery: 0 });

    productEntries.forEach(curr => {
      const p = Number(curr.pieces) || 0;
      if (curr.productName === 'Total tissue') acc.tissue += p;
      else if (curr.productName === 'BALLPEN') acc.ballpen += p;
      else if (curr.productName === 'EXBOOK') acc.exbook += p;
      else if (curr.productName === 'STATIONERY') acc.stationery += p;
    });

    return acc;
  }, [entries, productEntries]);

  const valueTotals = useMemo(() => {
    const acc = { tissue: 0, ballpen: 0, exbook: 0, stationery: 0 };
    
    // For legacy entries, we treat the 'quantity' as 'value' as per previous app behavior
    entries.forEach(curr => {
      acc.tissue += (curr.tissue || 0);
      acc.ballpen += (curr.ballpen || 0);
      acc.exbook += (curr.exbook || 0);
      acc.stationery += (curr.stationery || 0);
    });

    productEntries.forEach(curr => {
      const v = Number(curr.value) || 0;
      if (curr.productName === 'Total tissue') acc.tissue += v;
      else if (curr.productName === 'BALLPEN') acc.ballpen += v;
      else if (curr.productName === 'EXBOOK') acc.exbook += v;
      else if (curr.productName === 'STATIONERY') acc.stationery += v;
    });
    return acc;
  }, [entries, productEntries]);

  const stats = useMemo(() => {
    const today = format(getBDDate(), 'yyyy-MM-dd');
    const yesterday = format(new Date(getBDDate().getTime() - 86400000), 'yyyy-MM-dd');
    
    // Current day's metrics
    const todayProducts = productEntries.filter(e => e.date === today);
    const todayLegacy = entries.filter(e => e.date === today);
    const totalTodayCount = todayLegacy.length + todayProducts.length;
    const todayOfficerNames = [...new Set([...todayLegacy.map(e => e.soName), ...todayProducts.map(e => e.soName)])].join(', ');

    // Yesterday's metrics for focus cards
    const yProducts = productEntries.filter(e => e.date === yesterday);
    const yLegacy = entries.filter(e => e.date === yesterday);
    
    // Add monthly logic
    const currentMonth = format(getBDDate(), 'yyyy-MM');
    const monthlyProducts = productEntries.filter(e => {
        const matchSO = filterMonthlySO === 'all' || 
                       e.soName === filterMonthlySO || 
                       (e.soName && e.soName.trim().toLowerCase() === filterMonthlySO.toLowerCase());
        return matchSO;
    });
    const monthlyLegacy = entries.filter(e => {
        const matchSO = filterMonthlySO === 'all' || 
                       e.soName === filterMonthlySO || 
                       (e.soName && e.soName.trim().toLowerCase() === filterMonthlySO.toLowerCase());
        return matchSO;
    });
    
    // Calculate Aggregate Team Targets based on individual settings
    const teamTargets = SALES_OFFICERS.reduce((acc, so) => {
      const t = allOfficerTargets[so.name] || targets;
      return {
        tissue: acc.tissue + (t.tissue || 0),
        ballpen: acc.ballpen + (t.ballpen || 0),
        exbook: acc.exbook + (t.exbook || 0),
        stationery: acc.stationery + (t.stationery || 0)
      };
    }, { tissue: 0, ballpen: 0, exbook: 0, stationery: 0 });

    return {
      totalToday: totalTodayCount,
      todayOfficerNames: todayOfficerNames,
      totalYesterday: yLegacy.length + yProducts.length,
      
      // Aggregate Team Targets
      teamTargets,
      
      // Yesterday Summary
      itemsYesterday: yLegacy.reduce((acc, curr) => acc + (Number(curr.ballpen) || 0) + (Number(curr.exbook) || 0) + (Number(curr.tissue) || 0) + (Number(curr.stationery) || 0), 0) +
                      yProducts.reduce((acc, curr) => acc + (Number(curr.pieces) || 0), 0),
      
      tissueYesterday: yLegacy.reduce((acc, curr) => acc + (Number(curr.tissue) || 0), 0) +
                       yProducts.filter(e => e.productName === 'Total tissue').reduce((acc, curr) => acc + (Number(curr.pieces) || 0), 0),
      
      tissueYesterdayV: yLegacy.reduce((acc, curr) => acc + (Number(curr.tissue) || 0), 0) +
                        yProducts.filter(e => e.productName === 'Total tissue').reduce((acc, curr) => acc + (Number(curr.value) || 0), 0),
      
      officersYesterday: new Set([...yLegacy.map(e => e.soId), ...yProducts.map(e => e.soId)]).size,
      officerNamesYesterday: [...new Set([...yLegacy.map(e => e.soName), ...yProducts.map(e => e.soName)])].join(', '),
      
      // Monthly Stats (Combine legacy and new)
      monthlyTissue: monthlyLegacy.reduce((acc, curr) => acc + (curr.tissue || 0), 0) +
                     monthlyProducts.filter(e => e.productName === 'Total tissue').reduce((acc, curr) => acc + (Number(curr.pieces) || 0), 0),
      monthlyBallpen: monthlyLegacy.reduce((acc, curr) => acc + (curr.ballpen || 0), 0) +
                      monthlyProducts.filter(e => e.productName === 'BALLPEN').reduce((acc, curr) => acc + (Number(curr.pieces) || 0), 0),
      monthlyExbook: monthlyLegacy.reduce((acc, curr) => acc + (curr.exbook || 0), 0) +
                     monthlyProducts.filter(e => e.productName === 'EXBOOK').reduce((acc, curr) => acc + (Number(curr.pieces) || 0), 0),
      monthlyStationery: monthlyLegacy.reduce((acc, curr) => acc + (curr.stationery || 0), 0) +
                         monthlyProducts.filter(e => e.productName === 'STATIONERY').reduce((acc, curr) => acc + (Number(curr.pieces) || 0), 0),
      
      // Monthly Value Stats (Legacy treated as value too)
      monthlyTissueV: monthlyLegacy.reduce((acc, curr) => acc + (curr.tissue || 0), 0) +
                      monthlyProducts.filter(e => e.productName === 'Total tissue').reduce((acc, curr) => acc + (Number(curr.value) || 0), 0),
      monthlyBallpenV: monthlyLegacy.reduce((acc, curr) => acc + (curr.ballpen || 0), 0) +
                       monthlyProducts.filter(e => e.productName === 'BALLPEN').reduce((acc, curr) => acc + (Number(curr.value) || 0), 0),
      monthlyExbookV: monthlyLegacy.reduce((acc, curr) => acc + (curr.exbook || 0), 0) +
                      monthlyProducts.filter(e => e.productName === 'EXBOOK').reduce((acc, curr) => acc + (Number(curr.value) || 0), 0),
      monthlyStationeryV: monthlyLegacy.reduce((acc, curr) => acc + (curr.stationery || 0), 0) +
                          monthlyProducts.filter(e => e.productName === 'STATIONERY').reduce((acc, curr) => acc + (Number(curr.value) || 0), 0),
    };

  }, [entries, productEntries, filterMonthlySO]);


  return (
    <div className="space-y-6">
      {/* Grand Total Card - MOVED TO TOP */}
      <Card className="bg-primary border-none shadow-lg p-5 rounded-2xl overflow-hidden relative group">
        <div className="absolute inset-0 flex items-center justify-center opacity-10 transition-transform group-hover:scale-110">
          <Truck className="w-32 h-32 text-white" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="text-[10px] font-black uppercase text-white/60 mb-2 leading-none tracking-[0.2em]">
            {isAdmin ? "Total Team Inventory Dispatched" : `${userProfile.name}'s Total Inventory`}
          </p>
          <div className="flex flex-col items-center justify-center gap-1">
            <span className="text-4xl font-black text-white leading-none">
              ৳{(valueTotals.tissue + valueTotals.ballpen + valueTotals.exbook + valueTotals.stationery).toLocaleString()}
            </span>
          </div>
          <p className="text-[10px] font-bold text-white/40 uppercase mt-2">
            {isAdmin ? "Team Breakdown" : "My Breakdown"}
          </p>
          <div className="mt-4 flex justify-between sm:justify-center gap-4 sm:gap-6 text-[12px] font-black text-white/70 uppercase tracking-widest border-t border-white/20 pt-4 w-full px-2">
            <div className="flex flex-col items-center">
              <span className="text-emerald-300 text-[9px] font-bold leading-none mb-1">৳{valueTotals.tissue.toLocaleString()}</span>
              <span className="text-[9px] opacity-70 font-black tracking-widest text-white/80">Tissue</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-emerald-300 text-[9px] font-bold leading-none mb-1">৳{valueTotals.ballpen.toLocaleString()}</span>
              <span className="text-[9px] opacity-70 font-black tracking-widest text-white/80">Ballpen</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-emerald-300 text-[9px] font-bold leading-none mb-1">৳{valueTotals.exbook.toLocaleString()}</span>
              <span className="text-[9px] opacity-70 font-black tracking-widest text-white/80">Exbook</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-emerald-300 text-[9px] font-bold leading-none mb-1">৳{valueTotals.stationery.toLocaleString()}</span>
              <span className="text-[9px] opacity-70 font-black tracking-widest text-white/80">Stationery</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Activity Stats Section */}
      <div className="space-y-4">
        {userProfile.role === 'admin' && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-white border-none shadow-sm p-4 rounded-2xl">
              <p className="text-[9px] font-black uppercase text-slate-400 mb-1 leading-none tracking-widest text-center">Yesterday Tissue</p>
              <div className="flex flex-col items-center justify-center">
                <span className="text-[20px] font-black text-slate-800 leading-none">৳{stats.tissueYesterdayV.toLocaleString()}</span>
                <div className="mt-2 bg-green-50 p-1 rounded-lg">
                  <Package className="w-3.5 h-3.5 text-green-500" />
                </div>
              </div>
            </Card>
            <Card className="bg-white border-none shadow-sm p-4 rounded-2xl flex flex-col items-center justify-center">
              <p className="text-[9px] font-black uppercase text-slate-400 mb-2 leading-none tracking-widest text-center">submit delivery ({stats.officersYesterday})</p>
              <div className="flex flex-col items-center justify-center w-full">
                <span className="text-[11px] font-black text-slate-800 leading-tight text-center uppercase">
                  {stats.officerNamesYesterday || "None"}
                </span>
                <div className="mt-2 bg-orange-50 p-1 rounded-lg">
                  <Users className="w-3.5 h-3.5 text-orange-500" />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Attendance System View */}
        {userProfile.role === 'admin' ? (
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
        ) : (
          <div className="p-3 bg-white/50 backdrop-blur-sm rounded-xl border border-slate-100 flex items-center justify-center gap-2">
             <Clock className={`w-3.5 h-3.5 ${systemConfig.attendanceEnabled ? 'text-emerald-500' : 'text-rose-500'}`} />
             <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
               Attendance System: <span className={systemConfig.attendanceEnabled ? 'text-emerald-600' : 'text-rose-600'}>{systemConfig.attendanceEnabled ? 'Active' : 'Offline'}</span>
             </p>
          </div>
        )}
      </div>

      {/* Monthly Goals and Targets - Visible to All */}
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
                      {filterMonthlySO === 'all' ? "Team's" : filterMonthlySO + "'s"} All Time Goals
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">
                      All Time Target Status
                    </p>
                  </div>
                </div>

                {isAdmin && (
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
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-2">
                <TargetProgress 
                  label="Tissue Total" 
                  current={stats.monthlyTissueV} 
                  target={filterMonthlySO === 'all' 
                    ? stats.teamTargets.tissue 
                    : (allOfficerTargets[filterMonthlySO]?.tissue || targets.tissue)
                  } 
                />
                <TargetProgress 
                  label="Ballpen Total" 
                  current={stats.monthlyBallpenV} 
                  target={filterMonthlySO === 'all' 
                    ? stats.teamTargets.ballpen 
                    : (allOfficerTargets[filterMonthlySO]?.ballpen || targets.ballpen)
                  } 
                  colorClass="bg-blue-600"
                />
                <TargetProgress 
                  label="Exbook Total" 
                  current={stats.monthlyExbookV} 
                  target={filterMonthlySO === 'all' 
                    ? stats.teamTargets.exbook 
                    : (allOfficerTargets[filterMonthlySO]?.exbook || targets.exbook)
                  } 
                  colorClass="bg-indigo-600"
                />
                <TargetProgress 
                  label="Stationery Total" 
                  current={stats.monthlyStationeryV} 
                  target={filterMonthlySO === 'all' 
                    ? stats.teamTargets.stationery 
                    : (allOfficerTargets[filterMonthlySO]?.stationery || targets.stationery)
                  } 
                  colorClass="bg-emerald-600"
                />
              </div>
            </div>
          </Card>

          {/* Target Management Section - ADMIN ONLY */}
          {isAdmin && (
            <>
              <Card className="bg-slate-50 border-none p-6 rounded-[24px]">
                <div className="mb-6 pb-6 border-b border-white/40">
                    <Label className="text-[10px] font-black font-mono uppercase text-slate-500 mb-3 block tracking-widest leading-none">1. Set Monthly Goals</Label>
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
              </Card>

              <Card className="bg-slate-50 border-none p-6 rounded-[24px] mt-4">
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
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Monthly Stationery Goal</Label>
                    <Input 
                        type="number"
                        disabled={!isEditingTargets}
                        value={targetValues.stationery}
                        onChange={e => setTargetValues({...targetValues, stationery: Number(e.target.value)})}
                        className="h-12 rounded-xl border-slate-200 bg-white font-black text-slate-900"
                    />
                  </div>
                </div>
              </Card>
            </>
          )}


        </div>

      {/* Entries List - ONLY FOR OFFICERS */}
      {userProfile.role !== 'admin' && (
        <div className="space-y-4 pb-20 lg:pb-0 mt-6">
          <div className="mt-8 space-y-4">
            <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-4">Recent Daily Submissions</h4>
            <AnimatePresence mode="popLayout">
              {groupedProductEntries.map((group: any) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-slate-900">{group.soName}</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                        {group.route} • {group.date} • ID: {group.soId}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 pt-4 border-t border-slate-50 pb-2">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tissue</p>
                      <p className="text-[9px] font-bold text-emerald-600 mt-1">৳{group.tissueV}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ballpen</p>
                      <p className="text-[9px] font-bold text-emerald-600 mt-1">৳{group.ballpenV}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Exbook</p>
                      <p className="text-[9px] font-bold text-emerald-600 mt-1">৳{group.exbookV}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Stationery</p>
                      <p className="text-[9px] font-bold text-emerald-600 mt-1">৳{group.stationeryV}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {groupedProductEntries.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-slate-100">
                <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No product entries found</p>
              </div>
            )}
          </div>
        </div>
      )}        {/* Location Pin Manager & Summary - ADMIN ONLY (Moved to Bottom) */}
        {userProfile.role === 'admin' && (
          <Card className="bg-slate-50 border-none p-5 rounded-[24px] mt-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div>
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">2. Location Pin Manager</h4>
                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">
                    Lock attendance tracking to a specific area
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Target Officer</Label>
                    <Select onValueChange={setSelectedOfficerForLoc} value={selectedOfficerForLoc || ''}>
                      <SelectTrigger className="h-9 text-xs font-bold rounded-xl border-slate-200 bg-white">
                        <SelectValue placeholder="Select Officer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">ADMIN (MYSELF)</SelectItem>
                        {SALES_OFFICERS.sort((a,b) => a.name.localeCompare(b.name)).map(so => (
                          <SelectItem key={so.id} value={so.name}>
                            {so.name} ({so.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Radius (Meters)</Label>
                    <Input 
                      type="number" 
                      value={locRadius}
                      onChange={e => setLocRadius(Number(e.target.value))}
                      className="h-9 text-xs font-bold rounded-xl shadow-inner border-slate-200"
                      placeholder="e.g. 200"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400">Location Name</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={locName}
                      onChange={e => setLocName(e.target.value)}
                      className="h-9 text-xs font-bold rounded-xl flex-1 shadow-inner border-slate-200"
                      placeholder="e.g. Office"
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 rounded-xl px-3 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if ("geolocation" in navigator) {
                          navigator.geolocation.getCurrentPosition((pos) => {
                            setMapCenter([pos.coords.latitude, pos.coords.longitude]);
                            handlePinLocation(pos.coords.latitude, pos.coords.longitude);
                          });
                        }
                      }}
                    >
                      <MapPin className="w-3 h-3 mr-1" />
                      Pin Mine
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400">Manual Coordinates</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={manualCoords}
                      onChange={e => setManualCoords(e.target.value)}
                      className="h-9 text-xs font-bold rounded-xl flex-1 shadow-inner border-slate-200"
                      placeholder="e.g. 24.8949, 91.8687"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const parts = manualCoords.split(',');
                          if (parts.length === 2) {
                            const lat = Number(parts[0].trim());
                            const lon = Number(parts[1].trim());
                            if (!isNaN(lat) && !isNaN(lon)) {
                              setMapCenter([lat, lon]);
                              handlePinLocation(lat, lon);
                            } else {
                              toast.error("ভুল কোঅর্ডিনেট (উদা: 24.8949, 91.8687)");
                            }
                          }
                        }
                      }}
                    />
                    <Button 
                      size="sm" 
                      className="h-9 rounded-xl px-4 bg-slate-900 font-black text-[10px] tracking-widest text-white shadow-lg active:scale-95 transition-all"
                      onClick={() => {
                        const parts = manualCoords.split(',');
                        if (parts.length === 2) {
                          const lat = Number(parts[0].trim());
                          const lon = Number(parts[1].trim());
                          if (!isNaN(lat) && !isNaN(lon)) {
                            setMapCenter([lat, lon]);
                            handlePinLocation(lat, lon);
                          } else {
                            toast.error("ভুল কোঅর্ডিনেট (উদা: 24.8949, 91.8687)");
                          }
                        } else {
                          toast.error("ভুল ফরম্যাট (উদা: 24.8949, 91.8687)");
                        }
                      }}
                    >
                      SET PIN
                    </Button>
                  </div>
                </div>

                {selectedOfficerForLoc && (
                  <div className="space-y-2 mt-2 pt-2 border-t border-white/40">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center py-1">
                      📍 Tap map to set {selectedOfficerForLoc}'s location
                    </p>
                    <div className="h-64 rounded-[24px] overflow-hidden border-2 border-white relative shadow-lg">
                      <PigeonMap 
                        height={256} 
                        center={mapCenter}
                        onBoundsChanged={({ center }) => setMapCenter(center)}
                        defaultZoom={13}
                        metaWheelZoom={false}
                        twoFingerDrag={true}
                        dprs={[1, 2]}
                        provider={googleTileProvider}
                        onClick={({ latLng }) => handlePinLocation(latLng[0], latLng[1])}
                      >
                        <ZoomControl />
                        {(Object.entries(assignedLocations) as [string, AssignedLocation][]).map(([name, loc]) => {
                          const CustomOverlay = Overlay as any;
                          return (
                            <CustomOverlay 
                              key={`lock-${name}`}
                              anchor={[loc.lat, loc.lon]}
                              offset={[0, 0]}
                            >
                              <div className="relative flex flex-col items-center">
                                <motion.div 
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className={`absolute -top-10 px-3 py-1 rounded-full shadow-xl whitespace-nowrap z-50 text-[10px] font-black border-2 ${
                                    selectedOfficerForLoc === name 
                                      ? "bg-red-600 text-white border-white" 
                                      : "bg-slate-900 text-white border-slate-700"
                                  }`}
                                >
                                  {name}: {loc.name}
                                </motion.div>
                                <div className={`rounded-full flex items-center justify-center shadow-lg border-2 transition-all ${
                                  selectedOfficerForLoc === name 
                                    ? "w-11 h-11 bg-white border-red-500 animate-bounce" 
                                    : "w-8 h-8 bg-slate-100 border-slate-400"
                                }`}>
                                  <MapPin className={`${
                                    selectedOfficerForLoc === name ? "w-6 h-6 text-red-600" : "w-4 h-4 text-slate-500"
                                  }`} />
                                </div>
                              </div>
                            </CustomOverlay>
                          );
                        })
                        }
                        {pinLoading && (
                          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 backdrop-blur-sm">
                            <motion.div 
                              animate={{ rotate: 360 }} 
                              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                              className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full shadow-xl"
                            />
                          </div>
                        )}
                      </PigeonMap>
                      
                      {/* Floating Marker to help center pinning */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
                         <div className="w-1.5 h-1.5 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)] border border-white" />
                         <div className="w-10 h-10 border-2 border-red-600/30 rounded-full animate-ping absolute -top-[17px] -left-[17px]" />
                      </div>

                      <Button 
                        size="sm"
                        onClick={() => handlePinLocation(mapCenter[0], mapCenter[1])}
                        disabled={pinLoading}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] px-6 py-5 rounded-full shadow-2xl border-4 border-white z-30 tracking-widest active:scale-95 transition-all"
                      >
                        {pinLoading ? "সেভ হচ্ছে..." : "পিন সেট করুন"}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${assignedLocations[selectedOfficerForLoc] ? 'bg-green-500' : 'bg-slate-300'}`} />
                        <p className="text-[10px] font-black text-slate-700 uppercase">
                          {assignedLocations[selectedOfficerForLoc] 
                            ? `Locked: ${assignedLocations[selectedOfficerForLoc].name}` 
                            : "No Location Locked"}
                        </p>
                      </div>
                      {assignedLocations[selectedOfficerForLoc] && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 text-[8px] font-black text-red-500 hover:bg-red-50"
                        >
                          REMOVE LOCK
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Active Pins Summary Table - ADMIN ONLY */}
            {isAdmin && (
              <div className="mt-8 pt-8 border-t border-slate-100">
                 <div className="flex items-center gap-2 mb-4">
                   <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
                     <ClipboardList className="w-4 h-4 text-indigo-600" />
                   </div>
                   <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Active Pins Summary</h4>
                 </div>
                 
                 <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="bg-slate-100/50">
                         <th className="px-3 py-2 text-[8px] font-black uppercase text-slate-400">Officer</th>
                         <th className="px-3 py-2 text-[8px] font-black uppercase text-slate-400">Lock Status</th>
                         <th className="px-3 py-2 text-[8px] font-black uppercase text-slate-400 text-right">Action</th>
                       </tr>
                     </thead>
                     <tbody>
                       {SALES_OFFICERS.sort((a,b) => a.name.localeCompare(b.name)).map(so => (
                         <tr key={so.id} className="border-t border-slate-100 bg-white">
                           <td className="px-3 py-2">
                             <p className="text-[10px] font-black text-slate-700 leading-tight">{so.name}</p>
                             <p className="text-[7px] text-slate-400 font-bold uppercase">{so.id}</p>
                           </td>
                           <td className="px-3 py-2">
                             {assignedLocations[so.name] ? (
                               <div className="flex flex-col">
                                 <div className="flex items-center gap-1">
                                   <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                   <p className="text-[9px] font-black text-green-600 uppercase tracking-tighter">
                                     {assignedLocations[so.name].lat.toFixed(6)}, {assignedLocations[so.name].lon.toFixed(6)}
                                   </p>
                                 </div>
                                 <p className="text-[7px] font-bold text-slate-400 pl-2.5">
                                   {assignedLocations[so.name].name} ({assignedLocations[so.name].radius}m)
                                 </p>
                               </div>
                             ) : (
                               <div className="flex items-center gap-1 opacity-40">
                                 <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">No Lock</p>
                               </div>
                             )}
                           </td>
                           <td className="px-3 py-2 text-right">
                             <div className="flex items-center justify-end gap-1">
                               {assignedLocations[so.name] && (
                                 <>
                                   <Button 
                                     variant="ghost" 
                                     size="sm" 
                                     onClick={() => {
                                       const loc = assignedLocations[so.name];
                                       setMapCenter([loc.lat, loc.lon]);
                                       setSelectedOfficerForLoc(so.name);
                                     }}
                                     className="h-6 w-6 p-0 text-indigo-500 hover:bg-indigo-50"
                                     title="ফোকাস অন ম্যাপ"
                                   >
                                     <MapPin className="w-3 h-3" />
                                   </Button>
                                   <Button 
                                     variant="ghost" 
                                     size="sm" 
                                     onClick={() => handleRemovePin(so.name)}
                                     className="h-6 w-6 p-0 text-red-500 hover:bg-red-50"
                                     title="রিমুভ পিন"
                                   >
                                     <Trash2 className="w-3 h-3" />
                                   </Button>
                                 </>
                               )}
                             </div>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
              </div>
            )}
          </Card>
        )}
      </div>
    );
  };

// --- Helpers ---
const MapOverlay = ({ 
  latLngToPixel, 
  pixelToLatLng, 
  setCenterZoom, 
  mapProps, 
  mapState, 
  children, 
  ...props 
}: any) => {
  return <div {...props}>{children}</div>;
};

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
};

const getBDDate = () => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
};

// Validate Connectivity
const testConnection = async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firebase Connection Error: The client is offline.");
    }
  }
};
testConnection();

const Product = ({ userProfile }: { userProfile: UserProfile | null }) => {
  const bdCurrentDate = getBDDate();
  const maxDate = format(bdCurrentDate, 'yyyy-MM-dd');
  const minDateObj = new Date(bdCurrentDate);
  minDateObj.setDate(minDateObj.getDate() - 1);
  const minDate = format(minDateObj, 'yyyy-MM-dd');

  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [pieces, setPieces] = useState('');
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entryDate, setEntryDate] = useState(minDate);
  const [route, setRoute] = useState('');
  const [memo, setMemo] = useState('');
  
  const isAdmin = userProfile?.role === 'admin';
  const [view, setView] = useState<'catalog' | 'records'>(isAdmin ? 'records' : 'catalog');
  const [recordViewType, setRecordViewType] = useState<'summary' | 'details' | 'daily'>('summary');
  
  const [records, setRecords] = useState<any[]>([]);
  const [legacyRecords, setLegacyRecords] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState('');
  const [filterSO, setFilterSO] = useState('all');

  useEffect(() => {
    if (userProfile && userProfile.role !== 'admin' && filterSO === 'all') {
      setFilterSO(userProfile.name);
    }
  }, [userProfile, filterSO]);

  const products = [
    { name: "BOX", category: "Packaging" },
    { name: "WALLET", category: "Accessory" },
    { name: "NAPKIN P", category: "Tissue" },
    { name: "Nap restaurant", category: "Tissue" },
    { name: "T-WHAITE", category: "Tissue" },
    { name: "T-PINK", category: "Tissue" },
    { name: "T-GOLD", category: "Tissue" },
    { name: "H/T-150", category: "Dispenser" },
    { name: "H/T-200", category: "Dispenser" },
    { name: "H/T-250", category: "Dispenser" },
    { name: "K/N", category: "Kitchen" },
    { name: "Total tissue", category: "Tissue" },
    { name: "EXBOOK", category: "Stationery" },
    { name: "BALLPEN", category: "Stationery" },
    { name: "STATIONERY", category: "Stationery" },
  ];

  useEffect(() => {
    const q = isAdmin 
      ? query(collection(db, 'product_entries'))
      : query(collection(db, 'product_entries'), where('soId', '==', userProfile.uniqueId || 'none'));
      
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      data.sort((a, b) => {
        const tA = a.timestamp?.toMillis?.() || 0;
        const tB = b.timestamp?.toMillis?.() || 0;
        return tA - tB; // Ascending for lists usually
      });
      setRecords(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'product_entries');
    });
    
    const qLegacy = isAdmin 
      ? query(collection(db, 'deliveries'))
      : query(collection(db, 'deliveries'), where('soId', '==', userProfile.uniqueId || 'none'));

    const unsubscribeLegacy = onSnapshot(qLegacy, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      data.sort((a, b) => {
        const tA = a.timestamp?.toMillis?.() || 0;
        const tB = b.timestamp?.toMillis?.() || 0;
        return tA - tB;
      });
      setLegacyRecords(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'deliveries');
    });

    return () => {
      unsubscribe();
      unsubscribeLegacy();
    };
  }, [isAdmin, userProfile.uniqueId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    if (!route || !route.trim()) {
      toast.error("প্রথমে রুটের নাম দিন (Enter Route Name first)");
      return;
    }

    const requiresBoth = ['BALLPEN', 'STATIONERY'].includes(selectedProduct || '');
    const requiresValueOnly = selectedProduct === 'EXBOOK' || selectedProduct === 'Total tissue';

    if (requiresValueOnly && !value) {
      toast.error("মূল্য প্রদান করুন");
      return;
    } else if (requiresBoth && (!pieces || !value)) {
      toast.error("পরিমাণ এবং মূল্য প্রদান করুন");
      return;
    } else if (!requiresValueOnly && !requiresBoth && !pieces) {
      toast.error("পরিমাণ প্রদান করুন");
      return;
    }

    setIsSubmitting(true);
    try {
      if (pieces && Number(pieces) > 0) {
        const assignedDealer = DEALERS.find(d => d.id === userProfile.dealerId);
        if (assignedDealer) {
          const stockQuery = query(
            collection(db, "stock_items"), 
            where("name", "==", selectedProduct?.trim() || ""), 
            where("dealer", "==", assignedDealer.name)
          );
          const stockSnap = await getDocs(stockQuery);
          
          if (!stockSnap.empty) {
            const stockDoc = stockSnap.docs[0];
            const currentQuantity = Number(stockDoc.data().quantity || 0);
            await updateDoc(doc(db, "stock_items", stockDoc.id), {
              quantity: currentQuantity - Number(pieces),
              updatedAt: serverTimestamp()
            });
          } else {
            toast.error("স্টক পাওয়া যায়নি। স্টক আপডেট হয়নি।");
            setIsSubmitting(false);
            return;
          }
        } else {
          toast.error("আপনার কোনো ডিলার অ্যাসাইন করা নেই। স্টক আপডেট হয়নি।");
          setIsSubmitting(false);
          return;
        }
      }

      await addDoc(collection(db, 'product_entries'), {
        date: entryDate,
        route: route || '',
        productName: selectedProduct,
        pieces: Number(pieces),
        value: Number(value),
        soName: userProfile.name,
        soId: userProfile.uniqueId,
        userId: userProfile.uid,
        memo: memo || '',
        timestamp: serverTimestamp()
      });

      toast.success(`${selectedProduct} সফলভাবে সাবমিট করা হয়েছে`);
      setSelectedProduct(null);
      setPieces('');
      setValue('');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, 'product_entries');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPieces, setEditPieces] = useState('');
  const [editValue, setEditValue] = useState('');

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই রেকর্ডটি মুছে ফেলতে চান?")) return;
    try {
      const record = records.find(r => r.id === id);
      if (record && record.pieces && !id.includes('_')) {
        const assignedDealer = DEALERS.find(d => d.id === userProfile.dealerId);
        if (assignedDealer) {
          const stockQuery = query(
            collection(db, "stock_items"), 
            where("name", "==", record.productName?.trim() || ""), 
            where("dealer", "==", assignedDealer.name)
          );
          const stockSnap = await getDocs(stockQuery);
          if (!stockSnap.empty) {
            const stockDoc = stockSnap.docs[0];
            const currentQuantity = Number(stockDoc.data().quantity || 0);
            await updateDoc(doc(db, "stock_items", stockDoc.id), {
              quantity: currentQuantity + Number(record.pieces),
              updatedAt: serverTimestamp()
            });
          }
        }
      }

      if (id.includes('_')) {
        const [origId, field] = id.split('_');
        if (origId && field) {
          await updateDoc(doc(db, 'deliveries', origId), { [field]: 0 });
        }
      } else {
        await deleteDoc(doc(db, 'product_entries', id));
      }
      toast.success("রেকর্ডটি মুছে ফেলা হয়েছে");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'product_entries');
    }
  };

  const startEditing = (record: any) => {
    setEditingId(record.id);
    setEditPieces(record.pieces.toString());
    setEditValue(record.value.toString());
  };

  const saveEdit = async (id: string) => {
    try {
      if (id.includes('_')) {
        const [origId, field] = id.split('_');
        if (origId && field) {
          // For legacy, value replaces quantity. Pieces are ignored (always 0)
          await updateDoc(doc(db, 'deliveries', origId), { [field]: Number(editValue) });
        }
      } else {
        const record = records.find(r => r.id === id);
        if (record && record.pieces) {
          const difference = Number(editPieces) - Number(record.pieces);
          if (difference !== 0) {
            const assignedDealer = DEALERS.find(d => d.id === userProfile.dealerId);
            if (assignedDealer) {
              const stockQuery = query(
                collection(db, "stock_items"), 
                where("name", "==", record.productName?.trim() || ""), 
                where("dealer", "==", assignedDealer.name)
              );
              const stockSnap = await getDocs(stockQuery);
              if (!stockSnap.empty) {
                const stockDoc = stockSnap.docs[0];
                const currentQuantity = Number(stockDoc.data().quantity || 0);
                await updateDoc(doc(db, "stock_items", stockDoc.id), {
                  quantity: currentQuantity - difference,
                  updatedAt: serverTimestamp()
                });
              }
            }
          }
        }
        await updateDoc(doc(db, 'product_entries', id), {
          pieces: Number(editPieces),
          value: Number(editValue)
        });
      }
      setEditingId(null);
      toast.success("রেকর্ডটি আপডেট করা হয়েছে");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'product_entries');
    }
  };

  const filteredRecords = useMemo(() => {
    const mainRecords = records.filter(r => {
      const matchSO = filterSO === 'all' || r.soName === filterSO;
      const matchDate = !filterDate || r.date === filterDate;
      return matchSO && matchDate;
    });

    // Map legacy deliveries to virtual product records
    const mappedLegacy: any[] = [];
    legacyRecords.filter(r => {
      const matchSO = filterSO === 'all' || r.soName === filterSO;
      const matchDate = !filterDate || r.date === filterDate;
      return matchSO && matchDate;
    }).forEach(r => {
      if (r.tissue > 0) mappedLegacy.push({ ...r, id: `${r.id}_tissue`, productName: 'Total tissue', pieces: 0, value: r.tissue, isLegacy: true });
      if (r.ballpen > 0) mappedLegacy.push({ ...r, id: `${r.id}_ballpen`, productName: 'BALLPEN', pieces: 0, value: r.ballpen, isLegacy: true });
      if (r.exbook > 0) mappedLegacy.push({ ...r, id: `${r.id}_exbook`, productName: 'EXBOOK', pieces: 0, value: r.exbook, isLegacy: true });
      if (r.stationery > 0) mappedLegacy.push({ ...r, id: `${r.id}_stationery`, productName: 'STATIONERY', pieces: 0, value: r.stationery, isLegacy: true });
    });

    return [...mainRecords, ...mappedLegacy];
  }, [records, legacyRecords, filterSO, filterDate]);

  const summary = useMemo(() => {
    return {
      totalPieces: filteredRecords.reduce((acc, curr) => acc + (Number(curr.pieces) || 0), 0),
      totalValue: filteredRecords.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)
    };
  }, [filteredRecords]);

  const productSummaryMap = useMemo(() => {
    const map = new Map<string, { pieces: number, value: number }>();
    filteredRecords.forEach(r => {
      const current = map.get(r.productName) || { pieces: 0, value: 0 };
      map.set(r.productName, {
        pieces: current.pieces + (Number(r.pieces) || 0),
        value: current.value + (Number(r.value) || 0)
      });
    });
    
    return Array.from(map.entries()).map(([name, stats]) => ({
      name,
      ...stats
    })).sort((a, b) => {
      const idxA = products.findIndex(p => p.name === a.name);
      const idxB = products.findIndex(p => p.name === b.name);
      return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
    });
  }, [filteredRecords, products]);

  const dayWiseSummaryMap = useMemo(() => {
    const map = new Map<string, { pieces: number, value: number }>();
    filteredRecords.forEach(r => {
      const current = map.get(r.date) || { pieces: 0, value: 0 };
      map.set(r.date, {
        pieces: current.pieces + (Number(r.pieces) || 0),
        value: current.value + (Number(r.value) || 0)
      });
    });
    
    return Array.from(map.entries()).map(([date, stats]) => ({
      date,
      ...stats
    })).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredRecords]);

  const getCategoryTheme = (category: string) => {
    switch(category) {
      case 'Tissue': return { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', hover: 'hover:border-rose-300', icon: 'text-rose-200/30' };
      case 'Stationery': return { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', hover: 'hover:border-blue-300', icon: 'text-blue-200/30' };
      case 'Dispenser': return { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', hover: 'hover:border-amber-300', icon: 'text-amber-200/30' };
      case 'Kitchen': return { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', hover: 'hover:border-emerald-300', icon: 'text-emerald-200/30' };
      case 'Packaging': return { bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-700', hover: 'hover:border-slate-300', icon: 'text-slate-200/30' };
      case 'Accessory': return { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', hover: 'hover:border-indigo-300', icon: 'text-indigo-200/30' };
      default: return { bg: 'bg-white', border: 'border-slate-100', text: 'text-slate-800', hover: 'hover:border-primary/30', icon: 'text-slate-100' };
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 relative flex flex-col h-full overflow-hidden">
      <div className="mb-6 text-center space-y-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Our Products</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1 mb-4">
            {isAdmin ? 'Product Records • প্রোডাক্ট তথ্য' : 'Delivery summary • ডেলিভারি সামারি'}
          </p>
          
          <div className="flex bg-slate-100 p-1 rounded-xl max-w-sm mx-auto mb-4">
            <button
               onClick={() => setView('catalog')}
               hidden={isAdmin}
               className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${view === 'catalog' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}
            >
               Order
            </button>
            <button
               onClick={() => setView('records')}
               className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${view === 'records' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}
            >
               {isAdmin ? 'All Records' : 'My Records'}
            </button>
          </div>

          {!isAdmin && view === 'catalog' && (
            <div className="mt-4 flex flex-col items-center justify-center gap-3">
              <Input 
                 type="date"
                 value={entryDate}
                 onChange={(e) => setEntryDate(e.target.value)}
                 className="w-48 text-center bg-white border-slate-200 font-bold text-slate-700 shadow-sm rounded-xl focus:ring-primary h-12"
              />
              <Input 
                 type="text"
                 placeholder="Route Name"
                 value={route}
                 onChange={(e) => setRoute(e.target.value)}
                 className="w-48 text-center bg-white border-slate-200 font-bold text-slate-700 shadow-sm rounded-xl focus:ring-primary h-12"
              />
              <Input 
                 type="text"
                 placeholder="Memo"
                 value={memo}
                 onChange={(e) => setMemo(e.target.value)}
                 className="w-48 text-center bg-white border-slate-200 font-bold text-slate-700 shadow-sm rounded-xl focus:ring-primary h-12"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {view === 'catalog' ? (
          <div className="space-y-8 pb-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {products.map((p, index) => {
                const theme = getCategoryTheme(p.category);
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => setSelectedProduct(p.name)}
                    className={`${theme.bg} rounded-2xl p-4 shadow-sm border ${theme.border} flex flex-col items-center justify-center text-center group hover:shadow-md hover:-translate-y-1 ${theme.hover} transition-all cursor-pointer aspect-square relative overflow-hidden`}
                  >
                    <h3 className={`text-xs font-black ${theme.text} uppercase tracking-tight z-10 leading-tight mt-2`}>
                      {p.name}
                    </h3>
                    <div className={`absolute bottom-2 right-2 p-1 ${theme.hover.replace('hover:', '')} bg-white/50 opacity-0 group-hover:opacity-100 rounded transition-opacity`}>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
            
            <div className="flex flex-col items-center mt-8 px-4 w-full">
              <Button 
                onClick={() => {
                   if (!route || !route.trim()) {
                     toast.error("রুটের নাম প্রদান করুন");
                     return;
                   }
                   if (!memo || !memo.trim()) {
                     toast.error("Memo প্রদান করুন");
                     return;
                   }
                   toast.success("প্রোডাক্ট এন্ট্রি সম্পন্ন হয়েছে");
                   setRoute('');
                   setMemo('');
                }}
                className="w-full max-w-sm h-14 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
              >
                Complete Submission
              </Button>
              
              <div className="w-full max-w-sm">
              {(() => {
                const todayRecords = records.filter(e => e.date === entryDate && e.userId === userProfile.uid);
                const totalPieces = todayRecords.reduce((sum, e) => sum + ((e as any).pieces || 0), 0);
                const totalValue = todayRecords.reduce((sum, e) => sum + ((e as any).value || 0), 0);
                
                return (
                  <Card className="mt-8 border shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="pb-2 bg-slate-50/50">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Today's Summary</CardTitle>
                        {todayRecords.length > 0 && (
                          <span className="text-[10px] font-bold text-slate-700 bg-white px-2 py-1 rounded-md border shadow-sm">
                            {totalPieces} pcs | ৳{totalValue}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 p-4">
                      {todayRecords.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic text-center py-2">No entries yet for today.</p>
                      ) : (
                        todayRecords.map((e, index) => (
                          <div key={e.id || index} className="text-[11px] bg-white p-2 rounded-lg flex justify-between items-center border border-slate-100 shadow-sm">
                            <span className="font-bold text-slate-800">{(e as any).productName}</span>
                            <span className="text-slate-600 font-medium">
                              {(e as any).pieces > 0 ? `${(e as any).pieces} pcs ` : ''}
                              {(e as any).value > 0 ? `৳${(e as any).value}` : ''}
                            </span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                );
              })()}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filters & Summary */}
            <Card className="border-none shadow-sm bg-slate-900 text-white rounded-2xl overflow-hidden">
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Filter Officer</Label>
                    <Select onValueChange={setFilterSO} defaultValue="all">
                      <SelectTrigger className="bg-slate-800 border-none h-10 text-[10px] text-white rounded-xl">
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
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Filter Date</Label>
                    <Input 
                      type="date" 
                      className="bg-slate-800 border-none h-10 text-[10px] text-white rounded-xl"
                      value={filterDate}
                      onChange={e => setFilterDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Pieces</p>
                    <p className="text-xl font-black text-white">{summary.totalPieces.toLocaleString()}</p>
                  </div>
                  <div className="text-center border-l border-slate-800">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Value</p>
                    <p className="text-xl font-black text-white">৳{summary.totalValue.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => setRecordViewType('summary')}
                className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${recordViewType === 'summary' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
              >
                Product
              </button>
              <button
                onClick={() => setRecordViewType('daily')}
                className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${recordViewType === 'daily' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
              >
                Day Wise
              </button>
              <button
                onClick={() => setRecordViewType('details')}
                className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${recordViewType === 'details' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
              >
                Detailed
              </button>
            </div>

            {recordViewType === 'daily' ? (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100 uppercase tracking-widest text-[9px] text-slate-500 font-bold">
                    <tr>
                      <th className="p-4 rounded-tl-2xl">Date</th>
                      <th className="p-4 text-right">Items</th>
                      <th className="p-4 text-right rounded-tr-2xl">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {dayWiseSummaryMap.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest border-t-0">No data found</td>
                      </tr>
                    ) : (
                      dayWiseSummaryMap.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-black text-slate-800">
                             {new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </td>
                          <td className="p-4 text-right font-bold text-slate-600">{item.pieces}</td>
                          <td className="p-4 text-right font-black text-primary">৳ {item.value.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : recordViewType === 'summary' ? (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100 uppercase tracking-widest text-[9px] text-slate-500 font-bold">
                    <tr>
                      <th className="p-4 rounded-tl-2xl">Product</th>
                      <th className="p-4 text-right">Pieces</th>
                      <th className="p-4 text-right rounded-tr-2xl">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {productSummaryMap.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest border-t-0">No data found</td>
                      </tr>
                    ) : (
                      productSummaryMap.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-black text-slate-800">{item.name}</td>
                          <td className="p-4 text-right font-bold text-slate-600">{item.pieces}</td>
                          <td className="p-4 text-right font-black text-primary">৳ {item.value}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No entries found</p>
                  </div>
                ) : (
                filteredRecords.map((record) => (
                  <div key={record.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 group relative">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">{record.productName}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">
                          {record.soName} • {record.date}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {editingId === record.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(record.id)}
                              className="w-8 h-8 flex items-center justify-center text-green-500 bg-green-50 rounded-xl hover:bg-green-100 transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="w-8 h-8 flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditing(record)}
                              className="w-8 h-8 flex items-center justify-center text-blue-500 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(record.id)}
                              className="w-8 h-8 flex items-center justify-center text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Pieces</p>
                        {editingId === record.id ? (
                          <input 
                            type="number"
                            value={editPieces}
                            onChange={e => setEditPieces(e.target.value)}
                            className="w-full text-sm font-black border-b border-primary focus:outline-none"
                          />
                        ) : (
                          <p className="text-sm font-black text-slate-800">{record.pieces}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Value</p>
                        {editingId === record.id ? (
                          <input 
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="w-full text-sm font-black text-right border-b border-primary focus:outline-none"
                          />
                        ) : (
                          <p className="text-sm font-black text-primary">৳ {record.value}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
    <AnimatePresence mode="wait">
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{selectedProduct}</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                  {(selectedProduct === 'EXBOOK' || selectedProduct === 'Total tissue') ? 'মূল্য প্রদান করুন' : ['BALLPEN', 'STATIONERY'].includes(selectedProduct || '') ? 'পরিমাণ এবং মূল্য প্রদান করুন' : 'পরিমাণ প্রদান করুন'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {(selectedProduct !== 'EXBOOK' && selectedProduct !== 'Total tissue') && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Pieces (পিস)</label>
                    <input
                      type="number"
                      value={pieces}
                      onChange={(e) => setPieces(e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-900 font-bold focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300"
                      required={(selectedProduct !== 'EXBOOK' && selectedProduct !== 'Total tissue') && !['BALLPEN', 'STATIONERY'].includes(selectedProduct || '') ? true : undefined}
                    />
                  </div>
                )}
                {(selectedProduct === 'EXBOOK' || selectedProduct === 'Total tissue' || ['BALLPEN', 'STATIONERY'].includes(selectedProduct || '')) && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Value (মূল্য)</label>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-900 font-bold focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300"
                      required
                    />
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="flex-1 bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-primary text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Attendance = ({ userProfile }: { userProfile: UserProfile | null }) => {
  const [records, setRecords] = useState<AttendanceEntry[]>([]);
  const [filterWorker, setFilterWorker] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [lockLocation, setLockLocation] = useState<any>(null);

  useEffect(() => {
    if (userProfile?.name) {
      const unsub = onSnapshot(doc(db, 'assigned_locations', userProfile.name), (snap) => {
        if (snap.exists()) {
          setLockLocation(snap.data());
        } else {
          setLockLocation(null);
        }
      }, (error) => {
        console.error("Lock location listener error:", error);
        // We don't necessarily want to throw here if it's just a common case but logged error is good
        handleFirestoreError(error, OperationType.GET, `assigned_locations/${userProfile.name}`);
      });
      return () => unsub();
    }
  }, [userProfile?.name]);

  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  
  const parseCoords = (locationName?: string) => {
    if (!locationName) return null;
    const parts = locationName.split('|');
    if (parts.length < 3) return null;
    const coordLine = parts[2];
    const latMatch = coordLine.match(/Lat ([\d.-]+)/);
    const lonMatch = coordLine.match(/Long ([\d.-]+)/);
    if (latMatch && lonMatch) {
      return [parseFloat(latMatch[1]), parseFloat(lonMatch[1])] as [number, number];
    }
    return null;
  };

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
    return records.find(r => r.date === today && (r.userId === userProfile.uid || r.soId === userProfile.uniqueId));
  }, [records, today, userProfile]);

  useEffect(() => {
    if (!userProfile) return;

    // IMPORTANT: Filter by userId for non-admins to prevent "insufficient permissions" and improve performance
    const q = userProfile.role === 'admin'
      ? query(collection(db, 'attendance'), orderBy('timestamp', 'desc'))
      : query(
          collection(db, 'attendance'), 
          where('soName', 'in', [userProfile.name, userProfile.name.split(' ')[0]]),
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
      toast.error("প্রথমে আপনার একটি ছবি (Selfie) তুলুন।");
      await startCamera();
      return;
    }
    
    setSubmitting(true);
    try {
      // Fetch latest lock directly to be absolutely sure
      let finalLock = lockLocation;
      if (userProfile?.name) {
        const lockDoc = await getDoc(doc(db, 'assigned_locations', userProfile.name));
        if (lockDoc.exists()) finalLock = lockDoc.data();
      }

      const bdTime = getBDDate();
      const checkInTime = format(bdTime, 'h:mm a');
      const hours = bdTime.getHours();
      const minutes = bdTime.getMinutes();
      
      let status: 'On Time' | 'Late' | 'Absent' = 'On Time';
      if (hours > 8 || (hours === 8 && minutes > 0)) status = 'Late';
      
      let locationLink = "";
      let locationName = "";
      let currentLat = 0;
      let currentLon = 0;
      let hasValidGPS = false;

      // 2. Attempt to capture GPS (Priority to background location for instant response)
      try {
        const getGeo = () => new Promise<GeolocationPosition>((res, rej) => {
          if (bgLocation) {
            res({
              coords: {
                latitude: bgLocation.lat,
                longitude: bgLocation.lon,
                accuracy: 10,
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
            timeout: 8000, 
            maximumAge: 0
          });
        });

        const pos = await getGeo();
        currentLat = pos.coords.latitude;
        currentLon = pos.coords.longitude;
        hasValidGPS = true;
        locationLink = `https://www.google.com/maps?q=${currentLat},${currentLon}`;

        // 3. Location Pin Enforcement (STRICT)
        if (finalLock) {
          const lat1 = currentLat;
          const lon1 = currentLon;
          const lat2 = finalLock.lat;
          const lon2 = finalLock.lon;
          
          const dist = getDistance(lat1, lon1, lat2, lon2);
          const maxAllowed = finalLock.radius || 200;
          
          // Debugging log for support
          console.log("Strict Check (Live):", { dist, maxAllowed, current: [lat1, lon1], target: [lat2, lon2] });
          
          if (dist > maxAllowed) {
            toast.error(`লোকেশন লক করা হয়েছে! আপনি ${finalLock.name} থেকে ${Math.round(dist)} মিটার দূরে আছেন। চেক-ইন করার জন্য আপনাকে ওই এলাকার ${maxAllowed} মিটারের মধ্যে থাকতে হবে।`, {
              duration: 10000,
              icon: '📍'
            });
            setSubmitting(false);
            return;
          } else {
            locationName = `📍 [লকড এরিয়া] ${finalLock.name}|পরিমাপ: ${Math.round(dist)} মিটার ভেতরে|Lat ${currentLat.toFixed(7)} / Long ${currentLon.toFixed(7)}`;
          }
        }
      } catch (gpsError: any) {
        console.error("GPS Verification Error:", gpsError);
        
        // Block if location is required but GPS failed
        if (finalLock) {
          toast.error("লোকেশন যাচাই করা যাচ্ছে না। দয়া করে আপনার ফোনের GPS (Location) অপশনটি চালু করুন এবং এই অ্যাপটিকে পারমিশন দিন।");
          setSubmitting(false);
          return;
        }
        
        toast.warning("GPS সিগন্যাল পাওয়া যায়নি। লোকেশন ছাড়াই সেভ করা হচ্ছে।");
      }

      // 4. Geocoding (only if not already set by lock label)
      if (hasValidGPS && !locationName) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 7000);
          
          const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${currentLat}&lon=${currentLon}&zoom=18&addressdetails=1`, {
            signal: controller.signal,
            headers: { 'User-Agent': 'DMP-PRO-App/1.5' }
          });
          clearTimeout(timeoutId);

          if (resp.status === 429) {
            console.warn("Nominatim Rate Limit Hit - Falling back to coordinates");
            locationName = `Coordinates Only|Network Busy|Lat ${currentLat.toFixed(7)} / Long ${currentLon.toFixed(7)}`;
          } else if (resp.ok) {
            const data = await resp.json();
            if (data && data.address) {
              const a = data.address;
              const l1 = [a.city || a.town || a.village || a.suburb, a.state_district || a.state, a.country].filter(Boolean).join(', ');
              const l2 = [a.road, a.neighbourhood, a.suburb, a.city_district].filter(Boolean).slice(0, 3).join(', ');
              const l3 = `Lat ${currentLat.toFixed(7)} / Long ${currentLon.toFixed(7)}`;
              locationName = `${l1}|${l2}|${l3}`;
            } else {
              locationName = `Location Identified|Map Available|Lat ${currentLat.toFixed(7)} / Long ${currentLon.toFixed(7)}`;
            }
          } else {
            locationName = `Location Recorded|Direct GPS Mode|Lat ${currentLat.toFixed(7)} / Long ${currentLon.toFixed(7)}`;
          }
        } catch (revError) {
          console.error("Geocoding failed:", revError);
          locationName = `Manual GPS Fix|System Offline|Lat ${currentLat.toFixed(7)} / Long ${currentLon.toFixed(7)}`;
        }
      }

      const attendanceData = {
        date: today,
        soName: userProfile.name,
        soId: userProfile.uniqueId,
        userId: userProfile.uid,
        checkInTime,
        status,
        location: locationLink,
        locationName: locationName || "GPS Location",
        selfie: capturedPhoto,
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'attendance'), attendanceData);
      
      toast.success("হাজিরা সফলভাবে সম্পন্ন হয়েছে!");
      setCapturedPhoto(null);
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
    <div className="max-w-4xl mx-auto w-full pt-12 pb-24 px-0 overflow-x-hidden">
      {userProfile.role === 'so' ? (
        <Card className="border-none shadow-none overflow-hidden rounded-none bg-white">
          {/* Location Lock Banner */}
          {lockLocation ? (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="bg-red-600 text-white px-6 py-4 flex flex-col shadow-lg relative z-30"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none mb-1">Target Location Locked</p>
                    <h4 className="text-sm font-black uppercase tracking-tight leading-none">
                      {lockLocation.name} 
                    </h4>
                  </div>
                </div>
                <div className="px-3 py-1 bg-white/10 rounded-full border border-white/20">
                  <p className="text-[9px] font-black uppercase tracking-tighter">ENFORCED</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                   <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-90">
                     Allowed Radius: {lockLocation.radius || 200}m
                   </p>
                </div>
                {bgLocation && (
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    Live Distance: {Math.round(getDistance(bgLocation.lat, bgLocation.lon, lockLocation.lat, lockLocation.lon))}m
                  </p>
                )}
              </div>

              {bgLocation && getDistance(bgLocation.lat, bgLocation.lon, lockLocation.lat, lockLocation.lon) > (lockLocation.radius || 200) && (
                <div className="mt-3 bg-white text-red-600 p-2 rounded-xl text-center shadow-inner font-black text-[10px] uppercase">
                   ⚠️ আপনি সীমার বাইরে আছেন। চেক-ইন করতে {lockLocation.name} এ যান।
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="bg-slate-100 text-slate-500 px-6 py-3 flex items-center justify-between border-b border-slate-200"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest leading-none">No Location Lock Active</p>
              </div>
              <p className="text-[8px] font-bold uppercase tracking-tighter opacity-60">ADMIN PIN NOT SET</p>
            </motion.div>
          )}

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

          <CardContent className="px-0 py-6 flex flex-col items-center gap-4">
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
                className="w-full bg-green-50/50 border-y border-green-100 py-4 px-0 text-center"
              >
                <div className="relative inline-block mb-1">
                  {myTodayRecord.selfie ? (
                    <div className="relative">
                      <img 
                        src={myTodayRecord.selfie} 
                        className="w-48 h-48 rounded-[28px] border-4 border-white shadow-xl object-cover" 
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
                  <div className="mt-0 w-full space-y-0">
                    {/* Visual Map */}
                    <div className="w-full relative h-48 overflow-hidden border-y border-white bg-slate-100">
                      {parseCoords(myTodayRecord.locationName) ? (
                        <PigeonMap 
                          height={192} 
                          defaultCenter={parseCoords(myTodayRecord.locationName)!} 
                          defaultZoom={17}
                          metaWheelZoom={false}
                          twoFingerDrag={true}
                          dprs={[1, 2]}
                          provider={googleTileProvider}
                        >
                          <ZoomControl />
                          <Marker 
                            width={40} 
                            anchor={parseCoords(myTodayRecord.locationName)!} 
                          >
                            <MapOverlay className="w-8 h-8 bg-white rounded-full shadow-lg border-2 border-red-500 flex items-center justify-center">
                              <div className="w-3 h-3 bg-red-500 rounded-full" />
                            </MapOverlay>
                          </Marker>
                        </PigeonMap>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                          Map View Restricted
                        </div>
                      )}
                      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-100 shadow-sm z-10">
                        <p className="text-[8px] font-bold text-slate-900 uppercase">Verified Location</p>
                      </div>
                    </div>

                    <div className="bg-white/50 px-6 py-2 border-b border-slate-100 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 bg-red-50 rounded-lg flex items-center justify-center">
                          <MapPin className="w-3.5 h-3.5 text-red-500" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verified Map Location</span>
                      </div>
                      <div className="space-y-0.5 px-1">
                        {myTodayRecord.locationName.split('|').map((line, i) => (
                          <p key={i} className={`leading-tight text-slate-800 ${
                            i === 0 ? 'text-[14px] font-black' : 
                            i === 1 ? 'text-[12px] font-semibold text-slate-600' : 
                            'text-[10px] font-mono text-slate-400'
                          }`}>
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <p className="text-green-600/70 font-bold uppercase text-[10px] tracking-widest mt-1">Visit logs to see details</p>
                
                <div className="mt-2 grid grid-cols-2 gap-3 px-6 pb-2">
                  <div className="bg-white rounded-2xl p-2.5 shadow-sm border border-green-100">
                    <p className="text-[9px] uppercase font-black text-slate-400 mb-0.5">Entry Time</p>
                    <p className="text-lg font-black text-slate-800">
                      {myTodayRecord.checkInTime.split(' ')[0]} <span className="text-[10px] ml-0.5 opacity-60">{myTodayRecord.checkInTime.split(' ')[1]}</span>
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl p-2.5 shadow-sm border border-green-100">
                    <p className="text-[9px] uppercase font-black text-slate-400 mb-0.5">Status</p>
                    <p className={`text-lg font-black ${
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
              <div className="w-full px-0 space-y-0">
                <div className="px-6 pb-8">
                  {capturedPhoto ? (
                    <div className="relative group mx-auto w-full max-w-[280px]">
                      <img 
                        src={capturedPhoto} 
                        className="w-full h-56 rounded-3xl object-cover border-4 border-white shadow-2xl" 
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
                      onClick={startCamera}
                      variant="outline"
                      className="w-full h-40 rounded-[32px] border-dashed border-4 border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-3 hover:bg-slate-100 transition-all group"
                    >
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <Camera className="w-7 h-7 text-slate-400 group-hover:text-primary transition-colors" />
                      </div>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">TAP TO TAKE SELFIE</span>
                    </Button>
                  )}
                </div>

                {/* Pre-punch Map Preview */}
                {bgLocation && !myTodayRecord && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full h-40 overflow-hidden border-y border-white shadow-sm relative bg-slate-100 group"
                  >
                    <PigeonMap 
                      height={160} 
                      center={[bgLocation.lat, bgLocation.lon]} 
                      zoom={17}
                      metaWheelZoom={false}
                      twoFingerDrag={true}
                      dprs={[1, 2]}
                      provider={googleTileProvider}
                    >
                      <ZoomControl />
                      <Marker 
                        width={45} 
                        anchor={[bgLocation.lat, bgLocation.lon]} 
                      >
                        <MapOverlay className="relative flex items-center justify-center">
                          <div className="absolute w-12 h-12 bg-blue-500/20 rounded-full animate-ping" />
                          <div className="relative w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-blue-500">
                            <div className="w-3 h-3 bg-blue-500 rounded-full" />
                          </div>
                        </MapOverlay>
                      </Marker>
                    </PigeonMap>
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 z-10">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <p className="text-[10px] font-black uppercase text-blue-900 tracking-wider">High Accuracy GPS</p>
                    </div>
                  </motion.div>
                )}
                
                <div className="relative flex items-center justify-center py-16 w-full mb-4">
                  {/* Ripples - Multi-layered sonar effect */}
                  {bgLocation && !submitting && (
                    <>
                      {[0, 0.5, 1, 1.5].map((delay, index) => (
                        <motion.div
                          key={index}
                          className="absolute w-32 h-32 rounded-full border border-white/40 bg-white/5 blur-[3px]"
                          initial={{ scale: 1, opacity: 0.8 }}
                          animate={{ scale: 2.2, opacity: 0 }}
                          transition={{ 
                            repeat: Infinity, 
                            duration: 2, 
                            ease: "easeOut", 
                            delay: delay 
                          }}
                        />
                      ))}
                    </>
                  )}

                  {/* Main Punch Button */}
                  <motion.button 
                    onClick={handleMarkAttendance}
                    disabled={submitting || !bgLocation}
                    whileHover={bgLocation ? { scale: 1.05 } : {}}
                    whileTap={bgLocation ? { scale: 0.95 } : {}}
                    className={`relative z-10 w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 shadow-[0_0_50px_rgba(0,0,0,0.3)] transition-all ${
                      (!bgLocation) 
                      ? 'bg-slate-400 cursor-not-allowed shadow-none' 
                      : 'bg-[#ccccca] shadow-[#ccccca]/40 hover:bg-[#b8b8b8] text-slate-900'
                    }`}
                  >
                    {submitting ? (
                      <div className="flex flex-col items-center">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        >
                          <Clock className="w-10 h-10 text-primary" />
                        </motion.div>
                        <span className="text-[10px] font-black mt-2 uppercase tracking-widest leading-none">RECORDING</span>
                      </div>
                    ) : (!bgLocation) ? (
                      <div className="flex flex-col items-center text-white px-2">
                        <MapPin className="w-8 h-8 opacity-50 mb-1" />
                        <span className="text-[9px] font-black uppercase text-center leading-tight">GPS SEARCHING</span>
                        <span 
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.reload();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              window.location.reload();
                            }
                          }}
                          className="text-[8px] bg-white/20 px-2 py-0.5 rounded-full mt-2 hover:bg-white/30 font-bold uppercase transition-colors cursor-pointer"
                        >
                          Retry
                        </span>
                      </div>
                    ) : (
                      <>
                        <Fingerprint className="w-16 h-16" />
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">PUNCH</span>
                          <span className="text-[8px] font-bold text-slate-700 uppercase mt-1 tracking-widest animate-pulse">TAP NOW</span>
                        </div>
                      </>
                    )}
                  </motion.button>
                </div>
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
                .filter(r => (r.soName === userProfile.name || r.soName === userProfile.name.split(' ')[0]) && r.date !== today)
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
                  className="bg-white p-6 border-b border-slate-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`relative w-10 h-10 rounded-[14px] flex items-center justify-center font-black text-base text-white shadow-lg transition-colors overflow-hidden ${
                      record 
                        ? 'bg-green-500 shadow-green-100' 
                        : so.name === 'Sumit Das' ? 'bg-indigo-500' :
                          so.name === 'Priyas Malakar' ? 'bg-rose-500' :
                          so.name === 'Fazlur Rahman' ? 'bg-amber-500' :
                          so.name === 'Ridoy Ahmed' ? 'bg-emerald-500' :
                          so.name === 'Promit Das' ? 'bg-violet-500' :
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
                      <h4 className="font-black text-slate-800 text-sm leading-tight uppercase tracking-tight">{so.name}</h4>
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

import { PRODUCTS, DEALERS } from './constants';
// ... rest of the imports that might be needed, assuming they're already there.
// Since I cannot view all imports easily I will just use PRODUCTS directly as it's a named import added.

const StockPanel = () => {
  const [stock, setStock] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [dealer, setDealer] = useState(DEALERS[0].name); // Default
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineQuantity, setInlineQuantity] = useState('');
  const [inlineRate, setInlineRate] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "stock_items"), (snapshot) => {
      setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const saveItem = async () => {
    if (!name || (!quantity && quantity !== '0') || (!rate && rate !== '0')) return;
    
    const existingItem = stock.find(
      s => s.name.trim().toLowerCase() === name.trim().toLowerCase() && s.dealer === dealer
    );

    try {
      if (existingItem) {
        const newQuantity = (Number(existingItem.quantity) || 0) + Number(quantity);
        await updateDoc(doc(db, "stock_items", existingItem.id), {
          quantity: newQuantity,
          rate: Number(rate),
          updatedAt: serverTimestamp()
        });
        toast.success("Existing product updated (+ Quantity)");
      } else {
        await addDoc(collection(db, "stock_items"), {
          name: name.trim(),
          dealer,
          quantity: Number(quantity),
          rate: Number(rate),
          createdAt: serverTimestamp()
        });
        toast.success("New product added");
      }
      
      setName('');
      setQuantity('');
      setRate('');
    } catch (error) {
      console.error(error);
      toast.error("Failed to save item");
    }
  };

  const startInlineEdit = (item: any) => {
    setInlineEditId(item.id);
    setInlineQuantity(item.quantity?.toString() || '0');
    setInlineRate(item.rate?.toString() || '0');
  };

  const saveInlineEdit = async (item: any) => {
    try {
      await updateDoc(doc(db, "stock_items", item.id), {
        quantity: Number(inlineQuantity),
        rate: Number(inlineRate),
        updatedAt: serverTimestamp()
      });
      setInlineEditId(null);
      toast.success("Updated successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update");
    }
  };

  const deleteItem = async (id: string) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await deleteDoc(doc(db, "stock_items", id));
      toast.success("Deleted successfully");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-black text-slate-900 uppercase">Stock Inventory</h1>
      
      <Card className="p-6 border-slate-100 shadow-sm rounded-2xl bg-white relative z-20">
        <h2 className="font-bold text-lg mb-4">Add New Item</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
             <input 
               list="product-suggestions" 
               value={name} 
               onChange={(e) => setName(e.target.value)} 
               placeholder="Item Name" 
               className="p-2 border rounded-xl w-full"
             />
             <datalist id="product-suggestions">
               {PRODUCTS.filter(p => p.name !== "Total tissue").map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
             </datalist>
          </div>
          <select value={dealer} onChange={(e) => setDealer(e.target.value)} className="p-2 border rounded-xl bg-white">
             {DEALERS.map(d => <option key={d.name} value={d.name}>{d.name} ({d.id})</option>)}
          </select>
          <Input type="number" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <Input type="number" placeholder="Rate (৳)" value={rate} onChange={(e) => setRate(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={saveItem} className="bg-slate-900 text-white rounded-xl flex-grow">Add</Button>
          </div>
        </div>
      </Card>
      
      {DEALERS.map(d => (
        <div key={d.id} className="space-y-4">
          <h2 className="text-2xl font-black text-slate-700">{d.name} ({d.id})</h2>
          <div className="bg-white overflow-hidden shadow-sm border border-slate-100 rounded-2xl">
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Rate</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stock
                    .filter(item => item.dealer === d.name)
                    .sort((a, b) => {
                       const indexA = PRODUCTS.findIndex(p => p.name === a.name);
                       const indexB = PRODUCTS.findIndex(p => p.name === b.name);
                       return (indexA > -1 ? indexA : 999) - (indexB > -1 ? indexB : 999);
                    })
                    .map(item => (
                    <tr key={item.id} className="bg-white border-b border-slate-100">
                      <td className="px-4 py-4 font-bold">{item.name}</td>
                      <td className="px-4 py-4">
                        {inlineEditId === item.id ? (
                          <input type="number" 
                                 value={inlineQuantity} 
                                 onChange={e => setInlineQuantity(e.target.value)} 
                                 className="w-20 p-2 border border-slate-300 rounded-lg outline-none focus:border-primary relative z-10" />
                        ) : item.quantity}
                      </td>
                      <td className="px-4 py-4">
                        {inlineEditId === item.id ? (
                          <div className="flex items-center">
                            <span className="mr-1">৳</span>
                            <input type="number" 
                                   value={inlineRate} 
                                   onChange={e => setInlineRate(e.target.value)} 
                                   className="w-20 p-2 border border-slate-300 rounded-lg outline-none focus:border-primary relative z-10" />
                          </div>
                        ) : `৳${item.rate}`}
                      </td>
                      <td className="px-4 py-4 font-black text-primary">৳{((item.quantity || 0) * (item.rate || 0)).toLocaleString()}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          {inlineEditId === item.id ? (
                            <>
                              <Button onClick={() => saveInlineEdit(item)} className="text-xs h-8 bg-primary text-white rounded-lg">Save</Button>
                              <Button onClick={() => setInlineEditId(null)} className="text-xs h-8 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg">Cancel</Button>
                            </>
                          ) : (
                            <>
                              <Button onClick={() => startInlineEdit(item)} className="text-xs h-8 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg">Edit</Button>
                              <Button onClick={() => deleteItem(item.id)} className="text-xs h-8 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg">Delete</Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const OfficerManager = () => {
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      setPersonnel(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDealerChange = async (uid: string, dealerId: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        dealerId: dealerId
      });
      toast.success("Dealer assigned successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to assign dealer");
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen p-6">
      <h3 className="text-xl font-black uppercase text-slate-800 mb-6 tracking-tight">Officer Profiles</h3>
      {loading ? (
        <p className="text-sm text-slate-500 font-bold">Loading officers...</p>
      ) : personnel.length === 0 ? (
        <p className="text-sm text-slate-500 font-bold">No officers found.</p>
      ) : (
        <div className="space-y-4">
          {personnel.map(so => (
            <div key={so.uid} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="font-black text-slate-900">{so.name || "Unknown"}</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                  ID: {so.uniqueId || "N/A"} • Email: {so.email}
                </p>
              </div>
              <div className="w-full sm:w-auto">
                <Label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Assigned Dealer</Label>
                <select 
                  className="w-full sm:w-64 p-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white transition-colors"
                  value={so.dealerId || ''}
                  onChange={(e) => handleDealerChange(so.uid, e.target.value)}
                >
                  <option value="">-- No Dealer Assigned --</option>
                  {DEALERS.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AdminPanel = () => {
  const [legacyEntries, setLegacyEntries] = useState<any[]>([]);
  const [productGroups, setProductGroups] = useState<any[]>([]);
  
  const allEntries = useMemo(() => {
    return [...legacyEntries, ...productGroups];
  }, [legacyEntries, productGroups]);
  
  const [filterSO, setFilterSO] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<DeliveryEntry>>({});
  
  useEffect(() => {
    // 1. Sync Legacy Deliveries
    const qLegacy = query(collection(db, 'deliveries'), orderBy('timestamp', 'desc'));
    const unsubLegacy = onSnapshot(qLegacy, (snapshot) => {
      setLegacyEntries(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        fromCollection: 'deliveries' 
      })));
    }, (error) => {
      console.error("Legacy deliveries sync error:", error);
    });

    // 2. Sync Product Entries
    const qProducts = query(collection(db, 'product_entries'), orderBy('timestamp', 'desc'));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const pEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const map = new Map<string, any>();
      pEntries.forEach((entry: any) => {
        const key = `${entry.date}_${entry.soId}_${entry.route || 'No Route'}`;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            soName: entry.soName,
            soId: entry.soId,
            userId: entry.userId,
            date: entry.date,
            route: entry.route || 'No Route',
            tissue: 0,
            ballpen: 0,
            exbook: 0,
            stationery: 0,
            originalIds: [],
            fromCollection: 'product_entries',
            timestamp: entry.timestamp
          });
        }
        const group = map.get(key);
        group.originalIds.push(entry.id);
        const val = Number(entry.value) || 0;
        if (entry.productName === 'Total tissue') group.tissue += val;
        else if (entry.productName === 'BALLPEN') group.ballpen += val;
        else if (entry.productName === 'EXBOOK') group.exbook += val;
        else if (entry.productName === 'STATIONERY') group.stationery += val;
      });
      
      setProductGroups(Array.from(map.values()));
    }, (error) => {
      console.error("Product entries sync error:", error);
    });

    return () => {
      unsubLegacy();
      unsubProducts();
    };
  }, []);

  const handleDelete = async (entry: any) => {
    const confirmDelete = window.confirm("আপনি কি এই এন্ট্রিটি মুছে ফেলতে চান?");
    if (!confirmDelete) return;

    try {
      if (entry.fromCollection === 'deliveries') {
        await deleteDoc(doc(db, 'deliveries', entry.id));
      } else {
        const batch = writeBatch(db);
        entry.originalIds.forEach((id: string) => {
          batch.delete(doc(db, 'product_entries', id));
        });
        await batch.commit();
      }
      toast.success("Entry deleted successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, entry.fromCollection || 'deliveries');
    }
  };

  const startEditing = (entry: DeliveryEntry) => {
    setEditingId(entry.id || null);
    setEditValues({
      tissue: entry.tissue,
      ballpen: entry.ballpen,
      exbook: entry.exbook,
      stationery: entry.stationery || 0,
      route: entry.route,
      date: entry.date
    });
  };

  const saveEdit = async (entry: any) => {
    try {
      if (entry.fromCollection === 'deliveries') {
        await updateDoc(doc(db, 'deliveries', entry.id), {
          ...editValues,
          tissue: Number(editValues.tissue),
          ballpen: Number(editValues.ballpen),
          exbook: Number(editValues.exbook),
          stationery: Number(editValues.stationery || 0),
        });
      } else {
        const batch = writeBatch(db);
        const q = query(collection(db, 'product_entries'), where('__name__', 'in', entry.originalIds));
        const snapshot = await getDocs(q);
        
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          let newValue = data.value;
          if (data.productName === 'Total tissue') newValue = Number(editValues.tissue);
          else if (data.productName === 'BALLPEN') newValue = Number(editValues.ballpen);
          else if (data.productName === 'EXBOOK') newValue = Number(editValues.exbook);
          else if (data.productName === 'STATIONERY') newValue = Number(editValues.stationery);
          
          batch.update(docSnap.ref, {
            value: newValue,
            route: editValues.route,
            date: editValues.date
          });
        });
        await batch.commit();
      }
      
      setEditingId(null);
      toast.success("Entry updated successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, entry.fromCollection || 'deliveries');
    }
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast.error("No entries to export");
      return;
    }

    const headers = ["Officer", "Route", "Date", "Tissue", "Ballpen", "Exbook", "Stationery"];
    const csvContent = [
      headers.join(","),
      ...filtered.map(e => [
        `"${e.soName}"`,
        `"${e.route}"`,
        e.date,
        e.tissue,
        e.ballpen,
        e.exbook,
        e.stationery || 0
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
    if (filtered.length === 0) {
      toast.error("মুছে ফেলার জন্য কোনো ডাটা নেই");
      return;
    }
    
    const targetMsg = filterSO === 'all' 
      ? "সকল অফিসারের সকল ডেলিভারি রিপোর্ট" 
      : `${filterSO}-এর সকল ডেলিভারি রিপোর্ট`;
      
    const confirmClear = window.confirm(`⚠️ সতর্কতা: এটি ${targetMsg} স্থায়ীভাবে মুছে ফেলবে। এটি আর ফিরিয়ে আনা যাবে না। আপনি কি নিশ্চিত?`);
    if (!confirmClear) return;

    try {
      const batch = writeBatch(db);
      filtered.forEach((entry) => {
        if (entry.fromCollection === 'deliveries') {
          batch.delete(doc(db, 'deliveries', entry.id));
        } else if (entry.originalIds) {
          entry.originalIds.forEach((id: string) => {
            batch.delete(doc(db, 'product_entries', id));
          });
        }
      });
      await batch.commit();
      toast.success(filterSO === 'all' ? "সব রিপোর্ট সফলভাবে মুছে ফেলা হয়েছে" : `${filterSO}-এর রিপোর্ট মুছে ফেলা হয়েছে`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'clear_reports');
    }
  };

  const filtered = useMemo(() => {
    const list = allEntries.filter(e => {
      const matchSO = filterSO === 'all' || e.soName === filterSO;
      const matchDate = !filterDate || e.date === filterDate;
      return matchSO && matchDate;
    });

    return list.sort((a, b) => {
      const dA = a.date || "";
      const dB = b.date || "";
      if (dA !== dB) {
        return sortOrder === 'asc' ? dA.localeCompare(dB) : dB.localeCompare(dA);
      }
      const tA = a.timestamp?.seconds || 0;
      const tB = b.timestamp?.seconds || 0;
      return sortOrder === 'asc' ? tA - tB : tB - tA;
    });
  }, [allEntries, filterSO, filterDate, sortOrder]);

  const statistics = useMemo(() => {
    const yesterday = format(new Date(getBDDate().getTime() - 86400000), 'yyyy-MM-dd');
    const todayEntries = allEntries.filter(e => e.date === yesterday);
    
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
      totalStationery: filtered.reduce((acc, curr) => acc + (Number(curr.stationery) || 0), 0),
      grandTotal: filtered.reduce((acc, curr) => acc + (Number(curr.tissue) || 0) + (Number(curr.ballpen) || 0) + (Number(curr.exbook) || 0) + (Number(curr.stationery) || 0), 0),
      // Monthly Progress
      monthlyTissue: monthlyFiltered.reduce((acc, curr) => acc + (Number(curr.tissue) || 0), 0),
      monthlyBallpen: monthlyFiltered.reduce((acc, curr) => acc + (Number(curr.ballpen) || 0), 0),
      monthlyExbook: monthlyFiltered.reduce((acc, curr) => acc + (Number(curr.exbook) || 0), 0),
    };
  }, [allEntries, filtered, filterSO]);

  const handleClearAllAttendance = async () => {
    const targetMsg = filterSO === 'all' 
      ? "সকল অফিসারের হাজিরা রিপোর্ট" 
      : `${filterSO}-এর সকল হাজিরা রিপোর্ট`;

    const confirmClear = window.confirm(`⚠️ সতর্কতা: এটি ${targetMsg} স্থায়ীভাবে মুছে ফেলবে। আপনি কি নিশ্চিত?`);
    if (!confirmClear) return;

    try {
      let q = query(collection(db, 'attendance'));
      if (filterSO !== 'all') {
        q = query(collection(db, 'attendance'), where('soName', '==', filterSO));
      }
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      toast.success(filterSO === 'all' ? "সব হাজিরা রিপোর্ট মুছে ফেলা হয়েছে" : `${filterSO}-এর হাজিরা রিপোর্ট মুছে ফেলা হয়েছে`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
    }
  };

  const [adminTab, setAdminTab] = useState<'logs' | 'officers'>('logs');

  return (
    <div className="space-y-0 -mt-6">
      <Card className="border-none shadow-none bg-slate-950 text-white rounded-none overflow-hidden">
        <CardHeader className="py-8 px-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                <span className="text-[9px] font-black uppercase text-primary/80 tracking-[0.4em] leading-none">System Live</span>
              </div>
              <div className="flex flex-col">
                <CardTitle className="text-3xl font-black tracking-tighter leading-none text-white flex items-baseline gap-2 pb-1">
                  ADMIN <span className="text-sky-400 italic font-medium">PANEL</span>
                </CardTitle>
              </div>
            </div>
          </div>
        </CardHeader>
        <div className="px-6 pb-6 pt-2 flex gap-4 border-b border-slate-800">
          <button 
            className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${adminTab === 'logs' ? 'text-white border-white' : 'text-slate-400 hover:text-white border-transparent'}`}
            onClick={() => setAdminTab('logs')}
          >
            Master Logs
          </button>
          <button 
            className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${adminTab === 'officers' ? 'text-white border-white' : 'text-slate-400 hover:text-white border-transparent'}`}
            onClick={() => setAdminTab('officers')}
          >
            Officers
          </button>
        </div>
      </Card>

      {adminTab === 'officers' ? (
        <OfficerManager />
      ) : (
        <>
          <div className="bg-slate-950 px-6 py-6 border-b border-slate-800">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest pl-1">Filter Officer</Label>
                <Select onValueChange={setFilterSO} defaultValue="all">
                  <SelectTrigger className="bg-slate-900 border-slate-800 h-11 text-xs text-white rounded-xl">
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
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest pl-1">Filter Date</Label>
                <Input 
                  type="date" 
                  className="bg-slate-900 border-slate-800 h-11 text-xs text-white rounded-xl"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest pl-1">Sort Order</Label>
                <Select onValueChange={(val: 'asc' | 'desc') => setSortOrder(val)} value={sortOrder}>
                  <SelectTrigger className="bg-slate-900 border-slate-800 h-11 text-xs text-white rounded-xl">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest First</SelectItem>
                    <SelectItem value="asc">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-6">
              <Button 
                  variant="destructive"
                  size="sm"
                  className="rounded-xl px-3 text-[10px] font-black"
                  onClick={handleClearAllAttendance}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  {filterSO === 'all' ? "RESET ATTENDANCE" : `RESET ${filterSO.toUpperCase()}`}
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="bg-slate-900 border-slate-800 text-white hover:text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/50 w-auto px-4 font-bold flex items-center justify-center rounded-xl transition-all"
                onClick={handleExportCSV}
              >
                <Download className="w-3 h-3 mr-2" /> EXPORT CSV
              </Button>
            </div>
          </div>

          <div className="bg-sky-50/50 border-b border-sky-100 p-8 flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tighter italic">GRAND TOTAL</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest">Team Performance Sum</p>
        </div>
        <div className="text-right">
           <span className="text-4xl font-black text-slate-900 drop-shadow-sm">{statistics.grandTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Item Totals Grid */}
      <div className="grid grid-cols-4 bg-white border-b border-slate-100">
        <div className="p-8 flex flex-col items-center justify-center text-center border-r border-slate-50">
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest leading-none">Tissue</p>
          <span className="text-xl font-black text-slate-900 leading-none">{statistics.totalTissue.toLocaleString()}</span>
        </div>
        <div className="p-8 flex flex-col items-center justify-center text-center border-r border-slate-50">
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest leading-none">Ballpen</p>
          <span className="text-xl font-black text-slate-900 leading-none">{statistics.totalBallpen.toLocaleString()}</span>
        </div>
        <div className="p-8 flex flex-col items-center justify-center text-center border-r border-slate-50">
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest leading-none">Exbook</p>
          <span className="text-xl font-black text-slate-900 leading-none">{statistics.totalExbook.toLocaleString()}</span>
        </div>
        <div className="p-8 flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest leading-none">Stationery</p>
          <span className="text-xl font-black text-slate-900 leading-none">{statistics.totalStationery.toLocaleString()}</span>
        </div>
      </div>

      <div className="pt-8 pb-4">
        <div className="flex justify-between items-center px-6 mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Master Logs</h3>
            <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-black">
              {filtered.length}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearAll}
            className="text-[10px] font-black text-red-500 hover:text-red-400 px-0 h-auto bg-transparent border-none flex items-center gap-1.5 transition-all active:scale-95 tracking-widest"
          >
            <Trash2 className="w-3 h-3" />
            {filterSO === 'all' ? "CLEAR ALL" : `CLEAR ${filterSO.toUpperCase()}`}
          </Button>
        </div>
        
        <div className="space-y-0">
          {filtered.map((entry) => (
            <div key={entry.id} className="bg-white p-6 border-b border-slate-50 flex flex-col gap-4 group relative">
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
                      <h4 className="font-bold text-slate-900 text-sm">
                        {entry.soName} 
                        {entry.originalIds?.length > 1 && (
                          <span className="ml-2 bg-slate-100 text-slate-500 text-[8px] px-1.5 py-0.5 rounded-full font-black">
                             {entry.originalIds.length} ITEMS
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{entry.route} • {entry.date}</p>
                    </>
                  )}
                </div>
                <div className="flex gap-1">
                  {editingId === entry.id ? (
                    <>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-green-600 bg-green-50 hover:bg-green-100 border border-green-200" onClick={() => saveEdit(entry)}>
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
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-all font-bold" onClick={() => handleDelete(entry)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                  )}
                </div>
              </div>

              {editingId === entry.id ? (
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-50">
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
                  <div className="space-y-1">
                    <Label className="text-[8px] font-bold uppercase text-slate-400">Stationery</Label>
                    <Input 
                      type="number"
                      value={editValues.stationery} 
                      onChange={e => setEditValues({...editValues, stationery: Number(e.target.value)})}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4 pt-2 border-t border-slate-50">
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Tissue</p>
                    <p className="text-sm font-black text-primary">৳{entry.tissue}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Ballpen</p>
                    <p className="text-sm font-black text-blue-600">৳{entry.ballpen}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Exbook</p>
                    <p className="text-sm font-black text-indigo-600">৳{entry.exbook}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Stationery</p>
                    <p className="text-sm font-black text-emerald-600">৳{entry.stationery || 0}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ attendanceEnabled: true });

  async function handleLogout() {
    await signOut(auth);
    toast.success("Logged out successfully");
  }

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) {
        setSystemConfig(snap.data() as SystemConfig);
      }
    }, (error) => {
      console.error("Config listener error:", error);
      handleFirestoreError(error, OperationType.GET, 'settings/config');
    });

    let unsubProfile: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Real-time listener for current user profile
        unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            profileData.uid = firebaseUser.uid;
            
            // Check if Sales Officer session is valid (only for SO role)
            if (profileData.role === 'so') {
              const currentSO = SALES_OFFICERS.find(s => s.name === profileData.name);
              
              if (!currentSO) {
                // Name was changed in code, session is stale. Logout.
                console.warn("Invalid officer name detected. Forcing logout.");
                handleLogout();
                return;
              }

              if (currentSO.id !== profileData.uniqueId) {
                console.warn("Stale profile ID detected. Updating profile.");
                updateDoc(doc(db, 'users', firebaseUser.uid), {
                  uniqueId: currentSO.id
                }).catch(console.error);
              }
            }

            setProfile(profileData);
          }
          setLoading(false);
        }, (err) => {
          console.error("Profile listener error", err);
          setLoading(false);
        });
      } else {
        if (unsubProfile) unsubProfile();
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubConfig();
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  useEffect(() => {
    if (user && profile) {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          () => console.log("Location permission granted"),
          (error) => console.log("Location permission denied/error:", error.message),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
    }
  }, [user, profile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
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
                          <Link to="/product" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-primary mr-4 transition-colors flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            Product
                          </Link>
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
                          <div className="overflow-y-auto custom-scrollbar h-full">
                            <Dashboard userProfile={profile} systemConfig={systemConfig} />
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
                      <Route path="product" element={
                        <div className="h-full overflow-y-auto custom-scrollbar">
                          <Product userProfile={profile} />
                        </div>
                      } />
                      {profile.role === 'admin' && (
                        <Route path="admin" element={
                          <div className="h-full overflow-y-auto custom-scrollbar">
                            <AdminPanel />
                          </div>
                        } />
                      )}
                      {profile.role === 'admin' && (
                        <Route path="stock" element={
                          <div className="h-full overflow-y-auto custom-scrollbar">
                            <StockPanel />
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
                    <Link to="/product" className={`flex flex-col items-center gap-1 transition-colors ${window.location.hash.includes('product') ? 'text-primary' : 'text-slate-400'}`}>
                      <Package className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase">Product</span>
                    </Link>
                    {profile.role === 'admin' && (
                      <Link to="/admin" className={`flex flex-col items-center gap-1 transition-colors ${window.location.hash.includes('admin') ? 'text-primary' : 'text-slate-400'}`}>
                        <ShieldCheck className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase">Admin</span>
                      </Link>
                    )}
                    {profile.role === 'admin' && (
                      <Link to="/stock" className={`flex flex-col items-center gap-1 transition-colors ${window.location.hash.includes('stock') ? 'text-primary' : 'text-slate-400'}`}>
                        <Package className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase">Stock</span>
                      </Link>
                    )}
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
