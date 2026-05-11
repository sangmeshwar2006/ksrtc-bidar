/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  Search, 
  Bell, 
  ArrowRightLeft, 
  Map as MapIcon, 
  Home as HomeIcon, 
  Ticket, 
  User, 
  History, 
  Filter,
  ArrowRight,
  Clock,
  Compass,
  Bus as BusIcon,
  MapPin,
  Share2,
  MoreVertical,
  Bluetooth as Alarm,
  Layout,
  RefreshCcw,
  Navigation,
  CircleCheck,
  Smartphone,
  ShieldCheck,
  WifiOff,
  CloudOff,
  RefreshCw,
  ChevronRight,
  ArrowUpRight,
  BusFront,
  QrCode,
  Download,
  Info,
  Mail,
  Edit2,
  Trash2,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './firebase';
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  getDocFromServer,
  addDoc as firestoreAddDoc,
  updateDoc as firestoreUpdateDoc
} from 'firebase/firestore';
import { MOCK_BUSES, RECENT_SEARCHES, Bus, Station } from './types';
import InteractiveMap from './components/InteractiveMap';
import ksrtcLogo from '../ksrtc logo.jpeg';

type ViewState = 'onboarding' | 'home' | 'results' | 'tracking' | 'booking' | 'my-tickets' | 'alerts' | 'profile' | 'smart-card' | 'ticket-detail' | 'history' | 'support' | 'edit-profile';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'delay' | 'arrival' | 'info';
  read: boolean;
}

interface Ticket {
  id: string;
  busNumber: string;
  from: string;
  to: string;
  date: string;
  time: string;
  price: number;
  seats: string[];
  status: 'Confirmed' | 'Completed' | 'Cancelled';
}

const STATIONS = [
  'Bidar', 'Hyderabad', 'Kalaburagi', 'Bengaluru', 'Basavakalyan', 
  'Bhalki', 'Humnabad', 'Aurad', 'Zaheerabad', 'Solapur', 
  'Latur', 'Vijayapura', 'Hubballi', 'Manoorkere', 'Chidri',
  'Naubad', 'Janwada', 'Kamalnagar', 'Santhpur', 'Pune', 'Mumbai', 'Udgir'
];

export default function App() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [view, setView] = useState<ViewState>('onboarding');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedBus, setSelectedBus] = useState<Bus | undefined>(undefined);
  const [selectedViewTicket, setSelectedViewTicket] = useState<Ticket | null>(null);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [customMarkers, setCustomMarkers] = useState<{ pos: [number, number]; note: string; id: string }[]>([]);
  const [showDirections, setShowDirections] = useState(false);
  const [bookedTickets, setBookedTickets] = useState<Ticket[]>([
    {
      id: 'TXN882731',
      busNumber: 'KA-38-F-987',
      from: 'Bidar',
      to: 'Bengaluru',
      date: '10 May 2026',
      time: '08:30 PM',
      price: 950,
      seats: ['12', '13'],
      status: 'Confirmed'
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expandedRouteBusId, setExpandedRouteBusId] = useState<string | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [bookingStep, setBookingStep] = useState<'seats' | 'details' | 'success'>('seats');
  const [cancellingTicketId, setCancellingTicketId] = useState<string | null>(null);
  const [lastBookedTicketId, setLastBookedTicketId] = useState<string | null>(null);

  // Advanced Filters
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [priceRange, setPriceRange] = useState<number>(1000);
  const [departureFilter, setDepartureFilter] = useState<string | null>(null);
  const [operatorFilter, setOperatorFilter] = useState<string | null>(null);

  const [liveStats, setLiveStats] = useState({ speed: 0, dist: 0 });

  useEffect(() => {
    let interval: any;
    if (view === 'tracking' && selectedBus) {
      setLiveStats({
        speed: selectedBus.currentSpeed || 0,
        dist: selectedBus.distanceLeft || 0
      });
      
      interval = setInterval(() => {
        setLiveStats(prev => ({
          speed: Math.max(0, (prev.speed > 0 ? prev.speed : (selectedBus?.currentSpeed || 45)) + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3)),
          dist: Math.max(0, prev.dist - 0.02)
        }));
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [view, selectedBus]);

  const [activeTab, setActiveTab] = useState('KSRTC');
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'delay' | 'arrival' | 'info'>('all');
  const [smartCardBalance, setSmartCardBalance] = useState(450.50);
  const [smartCardId, setSmartCardId] = useState('8832 9912 0045 1256');
  const [smartCardHistory, setSmartCardHistory] = useState([
    { id: '1', date: '08 May 2026', amount: -120.00, desc: 'Bidar to Humnabad', type: 'debit' },
    { id: '2', date: '05 May 2026', amount: 500.00, desc: 'Recharge - UPI', type: 'credit' },
    { id: '3', date: '02 May 2026', amount: -150.00, desc: 'Bidar to Bhalki', type: 'debit' },
  ]);

  // Online/Offline Listener
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      setUser(currUser);
      setLoading(false);
      if (currUser) {
        // Sync user profile
        try {
          const userRef = doc(db, 'users', currUser.uid);
          const userDoc = await getDocFromServer(userRef).catch(() => null);
          
          if (!userDoc?.exists()) {
            // First time login
            await setDoc(userRef, {
              email: currUser.email,
              displayName: currUser.displayName,
              photoURL: currUser.photoURL,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } else {
            // Update existing profile
            await firestoreUpdateDoc(userRef, {
              displayName: currUser.displayName,
              photoURL: currUser.photoURL,
              updatedAt: serverTimestamp()
            });
          }
        } catch (err) {
          console.error('Failed to sync user profile', err);
          // Don't call handleFirestoreError here to avoid blocking the app on startup if it's just a minor sync issue
        }
      } else {
        if (!isGuest) {
          setView('onboarding');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Notifications Listener
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(notes);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'));
    return () => unsubscribe();
  }, [user]);

  // Markers Listener
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'markers'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const markers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        pos: [doc.data().pos.lat, doc.data().pos.lng]
      })) as any[];
      setCustomMarkers(markers);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'markers'));
    return () => unsubscribe();
  }, [user]);

  // Simulation: Add notification when bus passes stop
  useEffect(() => {
    if (view === 'tracking' && selectedBus && user) {
      const interval = setInterval(async () => {
        try {
          if (user) {
            await firestoreAddDoc(collection(db, 'notifications'), {
              userId: user.uid,
              title: 'Live Update',
              message: `${selectedBus.number} just passed ${selectedBus.nextStop}. Currently at 45km/h.`,
              type: 'info',
              read: false,
              time: 'Just now',
              createdAt: serverTimestamp()
            });
          }
        } catch (err) {
          console.error('Failed to add simulation note', err);
        }
      }, 60000); // Every 1m for demo cleanliness
      return () => clearInterval(interval);
    }
  }, [view, selectedBus, user]);

  const filteredBuses = MOCK_BUSES.filter(bus => {
    const normalizedFrom = fromLocation.split(' [')[0].toLowerCase();
    const normalizedTo = toLocation.split(' [')[0].toLowerCase();

    const matchesRoute = bus.origin.toLowerCase().includes(normalizedFrom) && 
                        bus.destination.toLowerCase().includes(normalizedTo);
    
    if (!matchesRoute) return false;

    const matchesSearch = searchQuery === '' || 
                         bus.number.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         bus.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Type Filters
    let matchesType = true;
    if (activeTab === 'LOCAL') matchesType = bus.type.includes('Local');
    else if (activeTab === 'SLEEPER') matchesType = bus.type.includes('Sleeper');
    else if (activeTab === 'EXPRESS') matchesType = (bus.type.includes('Express') || bus.type.includes('Palle-Velugu'));
    else if (activeTab === 'KSRTC') matchesType = (bus.operator.includes('KSRTC') || bus.operator.includes('KKRTC'));

    // Advanced Filters
    const matchesPrice = bus.price <= priceRange;
    
    let matchesTime = true;
    if (departureFilter) {
      const hour = parseInt(bus.startTime.split(':')[0]);
      const isPM = bus.startTime.includes('PM');
      const normalizedHour = isPM && hour !== 12 ? hour + 12 : (!isPM && hour === 12 ? 0 : hour);
      
      if (departureFilter === 'Morning') matchesTime = normalizedHour >= 5 && normalizedHour < 12;
      if (departureFilter === 'Afternoon') matchesTime = normalizedHour >= 12 && normalizedHour < 17;
      if (departureFilter === 'Evening') matchesTime = normalizedHour >= 17 || normalizedHour < 5;
    }

    const matchesOperator = !operatorFilter || bus.operator.includes(operatorFilter);

    return matchesSearch && matchesType && matchesPrice && matchesTime && matchesOperator;
  });

  const handleAddMarker = (pos: [number, number], note: string) => {
    if (!user) return;
    firestoreAddDoc(collection(db, 'markers'), {
      userId: user.uid,
      pos: { lat: pos[0], lng: pos[1] },
      note,
      createdAt: serverTimestamp()
    }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'markers'));
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setIsGuest(false);
      setView('home');
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        console.log('Login cancelled or popup closed');
      } else {
        console.error('Login failed', err);
        alert('Login failed: ' + err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsGuest(false);
      setView('onboarding');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Yatra Karnataka - KSRTC Bidar',
          text: 'Check out the official KSRTC Bidar portal for real-time bus tracking and booking!',
          url: window.location.origin
        });
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        alert('App link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing', err);
    }
  };

  const closePwaToast = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const renderPwaToast = () => (
    <AnimatePresence>
      {(offlineReady || needRefresh) && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 z-[1000] bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 flex items-center gap-4"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${needRefresh ? 'bg-blue-100 text-ksrtc-blue' : 'bg-emerald-100 text-emerald-600'}`}>
            {needRefresh ? <RefreshCw size={24} className="animate-spin-slow" /> : <ShieldCheck size={24} />}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-900 text-sm">
              {needRefresh ? 'New version available!' : 'Ready for offline use!'}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {needRefresh ? 'Reload to apply the latest updates.' : 'You can now use this app without internet.'}
            </p>
          </div>
          <div className="flex gap-2">
            {needRefresh && (
              <button 
                onClick={() => updateServiceWorker(true)}
                className="bg-ksrtc-blue text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
              >
                Reload
              </button>
            )}
            <button 
              onClick={closePwaToast}
              className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
            >
              Close
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderOfflineBanner = () => (
    <AnimatePresence>
      {isOffline && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-500 text-white text-[10px] font-bold uppercase tracking-widest py-1.5 px-4 text-center flex items-center justify-center gap-2 sticky top-0 z-[1100]"
        >
          <WifiOff size={12} />
          Offline Mode • Some live features may be limited
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderOnboarding = () => (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f4ff] via-[#f8fbff] to-[#ffffff] flex flex-col items-center justify-between p-8 text-center" id="onboarding">
      <div className="mt-20 flex flex-col items-center">
        <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-[0_20px_50px_rgba(8,112,184,0.1)] mb-10 mx-auto border-4 border-white overflow-hidden p-4">
          <img 
            src={ksrtcLogo}
            alt="KSRTC Official Logo" 
            className="w-full h-full object-contain" 
          />
        </div>
        <h1 className="text-[32px] font-display font-black text-[#003d7a] mb-3 tracking-tight">Yatra Karnataka</h1>
        <p className="text-sm text-gray-500 max-w-[280px] mx-auto font-medium leading-relaxed">
          Official KSRTC Real-time Tracking & Booking
        </p>
      </div>

      <div className="w-full max-w-md aspect-[1.8/1] bg-white/40 backdrop-blur-sm rounded-[32px] border border-white/50 mb-12 shadow-[0_10px_30px_rgba(0,0,0,0.02)] overflow-hidden flex items-center justify-center relative">
         <img src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-10 grayscale absolute inset-0" alt="Bus background" />
         <div className="w-full h-full bg-gradient-to-b from-transparent to-white/60 absolute inset-0" />
      </div>

      <div className="w-full max-w-sm flex flex-col items-center gap-6 mb-8">
        <button 
          onClick={user ? () => setView('home') : handleLogin}
          disabled={isLoggingIn}
          className="w-full bg-[#004a8f] text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-[0_12px_24px_rgba(0,74,143,0.25)] active:scale-[0.98] transition-all text-lg disabled:opacity-50"
        >
          {isLoggingIn ? 'Connecting...' : (user ? 'Welcome Back!' : 'Get Started')}
          {!isLoggingIn && <ArrowRight size={20} />}
        </button>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-500 font-medium">
            Already have an account? <button onClick={handleLogin} className="text-[#004a8f] font-bold hover:underline">Login</button>
          </p>
          <button 
            onClick={() => {
              setIsGuest(true);
              setView('home');
            }}
            className="text-xs text-gray-400 font-bold hover:text-gray-600 uppercase tracking-widest"
          >
            Continue as Guest
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest pb-4">
        <ShieldCheck size={14} className="text-gray-300" />
        SECURE GOVT PORTAL
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="min-h-screen bg-white pb-24" id="home">
      {/* Header */}
      <div className="bg-ksrtc-blue px-4 py-3 flex items-center justify-between text-white border-b border-white/10 sticky top-0 z-[1000]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1 shadow-lg overflow-hidden border-2 border-white/30">
            <img 
              src={ksrtcLogo}
              alt="KSRTC" 
              className="w-full h-full object-contain" 
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-display font-bold tracking-tight leading-none">KSRTC</h1>
            <span className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mt-0.5">Bidar Division</span>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setView('alerts')} className="p-2 hover:bg-white/10 rounded-full relative">
            <Bell size={24} />
            {notifications.some(n => !n.read) && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-ksrtc-blue" />}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-4 p-4 border-b border-gray-100 no-scrollbar">
        {['EXPRESS', 'KSRTC', 'LOCAL', 'SLEEPER'].map((tab) => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-full font-bold text-sm border-2 whitespace-nowrap transition-all ${activeTab === tab ? 'bg-ksrtc-blue text-white border-ksrtc-blue' : 'text-gray-400 border-gray-100 bg-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search Card */}
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-100 border border-gray-100 p-4 relative z-50">
          <div className="space-y-4">
            <div className="relative">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <div className="w-2 h-2 rounded-full bg-gray-300 ring-4 ring-gray-100" />
                <input 
                  className="flex-1 text-lg font-medium text-gray-800 outline-none" 
                  placeholder="From (e.g. Bidar)"
                  value={fromLocation}
                  onChange={(e) => {
                    setFromLocation(e.target.value);
                    setShowFromSuggestions(true);
                  }}
                  onFocus={() => setShowFromSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowFromSuggestions(false), 200)}
                />
                <button className="text-gray-400"><History size={20} /></button>
              </div>
              
              <AnimatePresence>
                {showFromSuggestions && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl z-[60] max-h-60 overflow-y-auto no-scrollbar scroll-smooth"
                  >
                    {STATIONS.filter(s => s.toLowerCase().includes(fromLocation.toLowerCase())).map(s => (
                      <button 
                        key={s}
                        onClick={() => {
                          setFromLocation(s);
                          setShowFromSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 text-gray-700 font-medium border-b border-gray-50 last:border-0 flex items-center gap-3 active:bg-blue-100 transition-colors"
                      >
                        <MapPin size={16} className="text-gray-400" />
                        {s}
                      </button>
                    ))}
                    {STATIONS.filter(s => s.toLowerCase().includes(fromLocation.toLowerCase())).length === 0 && (
                      <div className="px-4 py-3 text-gray-400 text-xs italic">No matching stations found</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <div className="flex items-center gap-3 pt-1">
                <div className="w-2 h-2 rounded-full border-2 border-ksrtc-blue" />
                <input 
                  className="flex-1 text-lg font-medium text-gray-800 outline-none" 
                  placeholder="To (e.g. Hyderabad)"
                  value={toLocation}
                  onChange={(e) => {
                    setToLocation(e.target.value);
                    setShowToSuggestions(true);
                  }}
                  onFocus={() => setShowToSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowToSuggestions(false), 200)}
                />
                <button className="text-gray-400"><History size={20} /></button>
              </div>

              <AnimatePresence>
                {showToSuggestions && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-0 right-0 top-12 mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl z-[60] max-h-60 overflow-y-auto no-scrollbar scroll-smooth"
                  >
                    {STATIONS.filter(s => s.toLowerCase().includes(toLocation.toLowerCase())).map(s => (
                      <button 
                        key={s}
                        onClick={() => {
                          setToLocation(s);
                          setShowToSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 text-gray-700 font-medium border-b border-gray-50 last:border-0 flex items-center gap-3 active:bg-blue-100 transition-colors"
                      >
                        <MapPin size={16} className="text-gray-400" />
                        {s}
                      </button>
                    ))}
                    {STATIONS.filter(s => s.toLowerCase().includes(toLocation.toLowerCase())).length === 0 && (
                      <div className="px-4 py-3 text-gray-400 text-xs italic">No matching stations found</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <button 
            className="absolute right-4 top-14 p-3 bg-gray-50 rounded-full border border-gray-200 text-ksrtc-blue shadow-sm active:scale-95 transition-transform z-[55]"
            onClick={() => {
              const temp = fromLocation;
              setFromLocation(toLocation);
              setToLocation(temp);
            }}
          >
            <ArrowRightLeft size={20} />
          </button>
          
          <button 
            onClick={() => {
              if (fromLocation.trim() && toLocation.trim()) {
                setView('results');
              } else {
                alert('Please enter both From and To locations');
              }
            }}
            className="w-full bg-emerald-600 text-white mt-6 py-4 rounded-xl font-bold text-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 transition-transform disabled:opacity-50"
          >
            Find Buses
          </button>
        </div>
      </div>

      {/* Popular Routes */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-800 font-bold text-lg">Popular Routes from Bidar</h2>
          <button className="text-ksrtc-blue text-xs font-bold">View All</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { to: 'Hyderabad', time: '3h 30m', price: '₹240', color: 'bg-blue-50' },
            { to: 'Kalaburagi', time: '3h 00m', price: '₹155', color: 'bg-emerald-50' },
            { to: 'Bengaluru', time: '12h 00m', price: '₹950', color: 'bg-indigo-50' },
            { to: 'Basavakalyan', time: '2h 00m', price: '₹85', color: 'bg-rose-50' }
          ].map((route) => (
            <button 
              key={route.to}
              onClick={() => {
                setFromLocation('Bidar');
                setToLocation(route.to);
                setView('results');
              }}
              className={`${route.color} p-4 rounded-3xl border border-white shadow-sm hover:shadow-md transition-all active:scale-95 text-left group`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="bg-white/80 p-2 rounded-xl group-hover:bg-white transition-colors">
                  <MapPin size={18} className="text-gray-600" />
                </div>
                <ArrowRight size={14} className="text-gray-400" />
              </div>
              <h3 className="font-bold text-gray-800">{route.to}</h3>
              <div className="flex justify-between items-end mt-1">
                <span className="text-[10px] text-gray-500 font-medium">{route.time} travel</span>
                <span className="text-sm font-bold text-ksrtc-blue">{route.price}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Live Arrivals */}
      <div className="px-4 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-400 font-bold text-xs uppercase tracking-wider">Live Arrivals at Bidar</h2>
          <button className="text-ksrtc-blue text-xs font-bold bg-blue-50 px-3 py-1 rounded-full">Station Status</button>
        </div>
        <div className="space-y-3">
          {MOCK_BUSES.filter(b => b.destination === 'Bidar' && b.status === 'Running').map(bus => (
            <button 
              key={bus.id} 
              onClick={() => {
                setSelectedBus(bus);
                setView('tracking');
              }}
              className="w-full bg-white border border-gray-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between group active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-ksrtc-blue group-hover:bg-blue-50 transition-colors">
                  <BusFront size={24} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-800">{bus.origin}</h3>
                    <ArrowRight size={12} className="text-gray-400" />
                    <span className="text-gray-400 text-sm font-medium">Bidar</span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium">No: {bus.number} • {bus.type}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-emerald-600 font-bold text-sm bg-emerald-50 px-2 py-0.5 rounded-lg mb-1 inline-block">
                  {bus.remainingTime}
                </div>
                <p className="text-[10px] text-gray-400 font-bold">ETA: {bus.endTime}</p>
              </div>
            </button>
          ))}
          {MOCK_BUSES.filter(b => b.destination === 'Bidar' && b.status === 'Running').length === 0 && (
            <div className="p-8 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
              <RefreshCw className="mx-auto text-gray-300 mb-2" size={24} />
              <p className="text-xs text-gray-400 font-medium">No live arrivals currently tracked</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Access: My Tickets */}
      <div className="px-4 mt-8">
        <h2 className="text-gray-400 font-bold text-xs uppercase mb-4 tracking-wider">Quick Actions</h2>
        <div className="flex gap-4">
          <button 
            onClick={() => setView('my-tickets')}
            className="flex-1 bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center gap-3 active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 bg-blue-50 text-ksrtc-blue rounded-full flex items-center justify-center">
              <Ticket size={20} />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-gray-800">My Tickets</div>
              <div className="text-[10px] text-gray-400">{bookedTickets.length} active</div>
            </div>
          </button>
          <button 
            onClick={() => setView('smart-card')}
            className="flex-1 bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center gap-3 active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
              <Smartphone size={20} />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-gray-800">Smart Card</div>
              <div className="text-[10px] text-gray-400">Recharge now</div>
            </div>
          </button>
        </div>
      </div>

      {/* Depot Info */}
      <div className="p-4 mt-6">
        <div className="bg-ksrtc-blue rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <h3 className="text-xl font-bold mb-2">Bidar Depot Info</h3>
          <p className="text-blue-100 text-sm mb-4">Daily over 200+ departures from Bidar CBS to various parts of Karnataka, Maharashtra, and Telangana.</p>
          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-xl font-bold">4</div>
              <div className="text-[10px] text-blue-200 uppercase font-bold">Depots</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <div className="text-xl font-bold">120+</div>
              <div className="text-[10px] text-blue-200 uppercase font-bold">Routes</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <div className="text-xl font-bold">24/7</div>
              <div className="text-[10px] text-blue-200 uppercase font-bold">Service</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSmartCard = () => (
    <div className="min-h-screen bg-gray-50 pb-24" id="smart-card">
      <div className="bg-ksrtc-blue p-6 pb-24 text-white rounded-b-[40px] relative">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setView('home')} className="p-2 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-xl font-display font-bold">Smart Card</h2>
        </div>
        
        <div className="relative group">
          {/* Card Visual */}
          <div className="w-full bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl p-6 shadow-2xl relative overflow-hidden aspect-[1.6/1]">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-10 -mt-10" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full -ml-12 -mb-12" />
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-emerald-100 tracking-[0.2em] mb-1">KSRTC PASSENGER CARD</span>
                <span className="text-xs text-white/80 font-medium">{user?.displayName || 'Card Holder'}</span>
              </div>
              <div className="flex gap-2">
                <div className="w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center p-1 overflow-hidden border border-emerald-400/30">
                  <img 
                    src={ksrtcLogo}
                    alt="Logo" 
                    className="w-full h-full object-contain" 
                  />
                </div>
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm shadow-sm">
                  <Smartphone size={24} className="text-white" />
                </div>
              </div>
            </div>

            <div className="mb-6 relative z-10">
              <p className="text-[10px] text-emerald-200 uppercase font-bold tracking-widest mb-1">Card Number</p>
              <p className="text-xl font-mono text-white tracking-widest">{smartCardId}</p>
            </div>

            <div className="flex justify-between items-end relative z-10">
              <div>
                <p className="text-[10px] text-emerald-200 uppercase font-bold tracking-widest mb-1">Expires</p>
                <p className="text-sm font-medium">12/28</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-emerald-200 uppercase font-bold tracking-widest mb-1">Balance</p>
                <p className="text-2xl font-display font-bold">₹{smartCardBalance.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-16 relative z-20">
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-100 p-6 mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Quick Recharge</h3>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[100, 200, 500].map(amount => (
              <button 
                key={amount}
                onClick={() => {
                  setSmartCardBalance(prev => prev + amount);
                  setSmartCardHistory(prev => [
                    { id: Math.random().toString(), date: 'Today', amount, desc: 'Recharge - UPI', type: 'credit' },
                    ...prev
                  ]);
                  alert(`Successfully recharged ₹${amount}!`);
                }}
                className="py-3 bg-emerald-50 text-emerald-700 rounded-2xl font-bold border border-emerald-100 active:scale-95 transition-transform"
              >
                +₹{amount}
              </button>
            ))}
          </div>
          <button 
            className="w-full bg-ksrtc-blue text-white py-4 rounded-2xl font-display font-bold shadow-lg shadow-blue-100 flex items-center justify-center gap-2 active:scale-95 transition-transform"
            onClick={() => alert('Custom recharge amount flow')}
          >
            Custom Amount
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider px-2">Transaction History</h3>
            <button className="text-ksrtc-blue text-xs font-bold px-2">View All</button>
          </div>
          <div className="space-y-3">
            {smartCardHistory.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-2xl flex items-center justify-between border border-gray-50 shadow-sm border-l-4 border-l-transparent hover:border-l-emerald-400 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.type === 'credit' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                    {item.type === 'credit' ? <ArrowUpRight size={20} /> : <BusFront size={20} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">{item.desc}</h4>
                    <p className="text-[10px] text-gray-400 font-medium">{item.date}</p>
                  </div>
                </div>
                <div className={`text-sm font-bold ${item.type === 'credit' ? 'text-emerald-600' : 'text-gray-800'}`}>
                  {item.type === 'credit' ? '+' : '-'}₹{Math.abs(item.amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="min-h-screen bg-gray-50 pb-24" id="results">
      <div className="bg-ksrtc-blue px-4 py-3 text-white sticky top-0 z-[1000] shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('home')} className="p-1 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-display font-bold flex items-center gap-2 truncate">
              {fromLocation.split(' [')[0]} <ArrowRight size={14} className="text-blue-300" /> {toLocation.split(' [')[0]}
            </h1>
            <p className="text-[10px] text-white/70 font-bold uppercase tracking-wider">
               {filteredBuses.length} {filteredBuses.length === 1 ? 'Bus' : 'Buses'} • Today
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
             <button onClick={() => setView('alerts')} className="p-2 hover:bg-white/10 rounded-full relative">
               <Bell size={20} />
               {notifications.some(n => !n.read) && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-ksrtc-blue" />}
             </button>
             <button 
               onClick={() => setIsFilterOpen(!isFilterOpen)}
               className={`p-2 rounded-full transition-colors ${isFilterOpen ? 'bg-white text-ksrtc-blue' : 'hover:bg-white/10'}`}
             >
               <Filter size={20} />
             </button>
             <button onClick={handleShare} className="p-2 hover:bg-white/10 rounded-full">
               <Share2 size={20} />
             </button>
             <button onClick={() => alert('Option menu coming soon!')} className="p-2 hover:bg-white/10 rounded-full">
               <MoreVertical size={20} />
             </button>
          </div>
        </div>

        <AnimatePresence>
          {isFilterOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white border-b border-gray-100 overflow-hidden shadow-sm"
            >
              <div className="p-4 space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-gray-800">Max Price: ₹{priceRange}</h4>
                    {(priceRange < 1000 || departureFilter || operatorFilter) && (
                      <button 
                        onClick={() => {
                          setPriceRange(1000);
                          setDepartureFilter(null);
                          setOperatorFilter(null);
                        }}
                        className="text-xs text-rose-500 font-bold"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                  <input 
                    type="range" 
                    min="50" 
                    max="1000" 
                    step="50"
                    value={priceRange}
                    onChange={(e) => setPriceRange(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-ksrtc-blue"
                  />
                  <div className="flex justify-between mt-1 text-[10px] text-gray-400 font-bold">
                    <span>₹50</span>
                    <span>₹1000+</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-800 mb-3">Departure Time</h4>
                  <div className="flex gap-2">
                    {['Morning', 'Afternoon', 'Evening'].map(time => (
                      <button 
                        key={time}
                        onClick={() => setDepartureFilter(departureFilter === time ? null : time)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${departureFilter === time ? 'bg-ksrtc-blue text-white border-ksrtc-blue shadow-md' : 'bg-white text-gray-500 border-gray-100'}`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-800 mb-3">Operator</h4>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {['KSRTC', 'KKRTC', 'Private'].map(op => (
                      <button 
                        key={op}
                        onClick={() => setOperatorFilter(operatorFilter === op ? null : op)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-all ${operatorFilter === op ? 'bg-ksrtc-blue text-white border-ksrtc-blue shadow-md' : 'bg-white text-gray-500 border-gray-100'}`}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 pt-0">
        <div className="bg-white rounded-xl border border-gray-100 p-2 flex items-center gap-2 shadow-sm">
          <Search size={16} className="text-gray-400 ml-2" />
          <input 
            type="text" 
            placeholder="Refine by bus number or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium outline-none text-gray-700"
          />
        </div>
      </div>

      <div className="flex overflow-x-auto gap-3 p-4 pt-0 no-scrollbar">
        {['All Buses', 'Express', 'AC Sleeper', 'Govt.'].map((filter, i) => (
          <button key={filter} className={`px-5 py-2 rounded-full text-sm font-bold border ${i === 0 ? 'bg-ksrtc-blue text-white border-ksrtc-blue' : 'bg-white text-gray-500 border-gray-200'}`}>
            {filter}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {filteredBuses.map(bus => (
          <motion.div 
            key={bus.id} 
            layoutId={`bus-${bus.id}`}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-ksrtc-blue">{bus.type}</h3>
                    <span className="text-[10px] bg-blue-50 text-ksrtc-blue px-2 py-0.5 rounded font-bold">{bus.operator}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold">{bus.number}</span>
                    {bus.liveTracking && (
                      <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-bold">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Live Tracking Available
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-800">₹{bus.price}</div>
                  <div className="text-[10px] text-emerald-600 font-bold">{bus.seatsLeft} Seats Left</div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-6">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-800">{bus.startTime}</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase">{bus.origin}</div>
                </div>
                <div className="flex-1 flex flex-col items-center px-4">
                   <div className="text-[10px] text-gray-400 font-medium mb-1">{bus.duration}</div>
                   <div className="w-full flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-ksrtc-blue" />
                      <div className="h-px flex-1 bg-gray-200" />
                      <div className="w-1.5 h-1.5 rounded-full border border-ksrtc-blue" />
                   </div>
                   <div className="text-[10px] text-emerald-600 font-bold mt-1">On Time</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-800">{bus.endTime}</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase">{bus.destination}</div>
                </div>
              </div>

              {/* Stop Summary */}
              {bus.stations.length > 2 && (
                <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center gap-3 overflow-x-auto no-scrollbar">
                  <div className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Key Stops:</div>
                  {bus.stations.slice(1, -1).map((s, idx) => (
                    <div key={s.id} className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-gray-700">{s.name}</span>
                      <span className="text-[10px] text-gray-400">{s.scheduledTime}</span>
                      {idx < bus.stations.length - 3 && <span className="text-gray-300">|</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Expandable Full Route */}
              <button 
                onClick={() => setExpandedRouteBusId(expandedRouteBusId === bus.id ? null : bus.id)}
                className="text-ksrtc-blue text-xs font-bold flex items-center gap-1 mb-4"
              >
                {expandedRouteBusId === bus.id ? 'Hide full route' : 'View full route'}
                <ChevronLeft size={14} className={`transition-transform ${expandedRouteBusId === bus.id ? 'rotate-90' : '-rotate-90'}`} />
              </button>

              <AnimatePresence>
                {expandedRouteBusId === bus.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-4 border-l-2 border-gray-100 ml-2 pl-4"
                  >
                    {bus.stations.map((s, i) => (
                      <div key={s.id} className="relative pb-4 last:pb-0">
                        <div className={`absolute -left-[21px] top-1 w-2 h-2 rounded-full border-2 bg-white ${i === 0 ? 'border-ksrtc-blue' : i === bus.stations.length - 1 ? 'border-gray-400' : 'border-emerald-500'}`} />
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-gray-800">{s.name}</span>
                          <span className="text-xs text-gray-500">{s.scheduledTime}</span>
                        </div>
                        {s.bay && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">Bay {s.bay}</span>}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex border-t border-gray-50">
              <button 
                onClick={() => {
                  setSelectedBus(bus);
                  setView('tracking');
                }}
                className="flex-1 py-4 flex items-center justify-center gap-2 text-ksrtc-blue font-bold hover:bg-gray-50 active:bg-gray-100 transition-colors"
                disabled={!bus.liveTracking}
              >
                <Compass size={18} /> Track Live
              </button>
              <button 
                onClick={() => {
                  setSelectedBus(bus);
                  setView('booking');
                  setBookingStep('seats');
                  setSelectedSeats([]);
                }}
                className="flex-1 bg-ksrtc-blue py-4 flex items-center justify-center gap-2 text-white font-bold hover:bg-ksrtc-accent active:scale-95 transition-all"
              >
                <Ticket size={18} /> Book Ticket
              </button>
            </div>
          </motion.div>
        ))}

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex gap-4 items-center mt-8">
           <div className="flex-1">
             <h4 className="font-bold text-gray-800 text-lg">Popular Route Insight</h4>
             <p className="text-sm text-gray-600 mt-1">Average travel time is 5h 25m. Most commuters prefer morning schedules.</p>
           </div>
           <div className="w-24 h-24 bg-white rounded-xl shadow-lg border-4 border-white overflow-hidden p-2">
              <Smartphone size={24} className="text-blue-500 mb-2" />
              <div className="h-1 bg-gray-100 rounded-full w-full" />
              <div className="h-1 bg-gray-100 rounded-full w-2/3 mt-1" />
           </div>
        </div>

        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">Cannot find the train you are looking for?</p>
          <button className="text-ksrtc-blue font-bold underline mt-1">Report missing train</button>
        </div>
      </div>
    </div>
  );

  const renderTracking = () => (
    <div className="min-h-screen bg-white pb-24 overflow-x-hidden" id="tracking">
       <div className="bg-ksrtc-blue px-4 py-3 text-white flex items-center gap-3 sticky top-0 z-[1000] shadow-md">
          <button onClick={() => setView('results')} className="p-1 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
          <div className="flex-1 min-w-0">
             <h1 className="text-base font-display font-bold truncate leading-tight uppercase">{selectedBus?.number}</h1>
             <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">{selectedBus?.type}</p>
          </div>
          <div className="flex gap-1 shrink-0">
             <button onClick={() => setView('alerts')} className="p-2 hover:bg-white/10 rounded-full relative">
               <Bell size={20} />
               {notifications.some(n => !n.read) && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-ksrtc-blue" />}
             </button>
             <button onClick={handleShare} className="p-2 hover:bg-white/10 rounded-full"><Share2 size={20} /></button>
             <button onClick={() => alert('Option menu coming soon!')} className="p-2 hover:bg-white/10 rounded-full"><MoreVertical size={20} /></button>
          </div>
       </div>

       <div className="flex gap-3 p-4 overflow-x-auto no-scrollbar bg-ksrtc-blue/5">
          <button 
            onClick={async () => {
              if (user && selectedBus) {
                try {
                  await firestoreAddDoc(collection(db, 'notifications'), {
                    userId: user.uid,
                    title: 'Alarm Set',
                    message: `You will be notified 15 mins before ${selectedBus.number} arrives at ${selectedBus.nextStop}.`,
                    type: 'info',
                    read: false,
                    time: 'Just now',
                    createdAt: serverTimestamp()
                  });
                  alert('Alarm set for ' + selectedBus.nextStop);
                } catch (err) {
                  handleFirestoreError(err, OperationType.CREATE, 'notifications');
                }
              } else {
                alert('Please login to set alarms');
              }
            }}
            className="bg-white px-4 py-2 rounded-full text-ksrtc-blue font-bold text-sm border border-ksrtc-blue shadow-sm flex items-center gap-2 whitespace-nowrap active:scale-95 transition-transform"
          >
            <Alarm size={16} /> Set Alarm
          </button>
          <button onClick={() => {
            alert('Seat layout feature coming soon!');
          }} className="bg-ksrtc-blue px-4 py-2 rounded-full text-white font-bold text-sm shadow-sm flex items-center gap-2 whitespace-nowrap">
            <Layout size={16} /> Seat Layout
          </button>
          <button onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({ 
                  title: 'Yatra Karnataka', 
                  text: `Tracking bus ${selectedBus?.number} from ${selectedBus?.from} to ${selectedBus?.to}`, 
                  url: window.location.href 
                });
              } catch (err: any) {
                if (err.name !== 'AbortError') {
                  console.error('Share failed:', err);
                }
              }
            } else {
              alert('Sharing not supported on this browser');
            }
          }} className="bg-ksrtc-blue px-4 py-2 rounded-full text-white font-bold text-sm shadow-sm flex items-center gap-2 whitespace-nowrap">
            <Share2 size={16} /> Share
          </button>
       </div>

       <div className="p-4">
         <div className="relative h-56 rounded-3xl overflow-hidden border border-gray-100 shadow-xl mb-4">
            <InteractiveMap bus={selectedBus} interactive={false} />
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-2 rounded-lg shadow-lg">
               <MapIcon size={20} className="text-ksrtc-blue" />
            </div>
            <div className="absolute bottom-4 left-4 bg-gray-100/80 backdrop-blur px-3 py-1 rounded text-[10px] font-bold text-gray-600">
               Live Preview
            </div>
         </div>

         <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-2">
               <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
               <span className="text-sm font-bold text-red-500">Running 12 mins late</span>
            </div>
            <span className="text-xs text-gray-400 font-medium">Updated 2 mins ago</span>
         </div>

         <div className="relative pl-8 space-y-12">
            <div className="absolute left-[3.5px] top-6 bottom-6 w-1 bg-gray-100 rounded-full" />
            {selectedBus?.stations.map((station, i) => (
              <div key={station.id} className="relative">
                <div className={`absolute -left-8 top-1 w-6 h-6 rounded-full border-4 bg-white z-10 flex items-center justify-center ${i === 0 ? 'border-ksrtc-blue' : i === (selectedBus.stations.length - 1) ? 'border-gray-300' : 'border-emerald-500'}`}>
                  {i === 1 && <div className="absolute -right-12 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] rounded font-bold border border-blue-200">Bay {station.bay}</div>}
                  {i === 1 && <div className="absolute -right-32 top-11 p-2 bg-ksrtc-blue rounded-xl shadow-lg border-2 border-white z-20"> <BusIcon size={20} className="text-white" /> </div>}
                </div>
                <div className="flex justify-between items-start">
                   <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-800 text-lg leading-tight">{station.name}</h4>
                        {i > 0 && (
                          <button 
                            onClick={async () => {
                              if (user && selectedBus) {
                                try {
                                  await firestoreAddDoc(collection(db, 'notifications'), {
                                    userId: user.uid,
                                    title: 'Station Alert Set',
                                    message: `We'll notify you 15 mins before ${selectedBus.number} reaches ${station.name}.`,
                                    type: 'arrival',
                                    read: false,
                                    time: 'Just now',
                                    createdAt: serverTimestamp()
                                  });
                                  alert(`Alert set for ${station.name}`);
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.CREATE, 'notifications');
                                }
                              } else {
                                alert('Please login to set alerts');
                              }
                            }}
                            className="p-1 hover:bg-rose-50 rounded-full text-rose-500 transition-colors"
                            title="Set Alert"
                          >
                            <Bell size={14} />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-medium">{i === 0 ? 'Origin Station' : i === (selectedBus.stations.length -1) ? `Destination • ${station.distance}` : `${station.distance}`}</p>
                   </div>
                   <div className="text-right shrink-0">
                      <div className="text-sm text-gray-400 font-medium">Scheduled</div>
                      <div className="font-bold text-gray-800">{station.scheduledTime}</div>
                      {station.actualTime && <div className="text-sm font-bold text-red-500 mt-1">{station.actualTime} <span className="text-[10px] font-medium block">Delayed</span></div>}
                      {i === (selectedBus.stations.length -1) && <div className="text-[10px] text-gray-500 mt-1">Expected 11:42 AM</div>}
                   </div>
                </div>
              </div>
            ))}
         </div>

         <div className="bg-blue-50/50 rounded-3xl p-6 mt-12 border border-blue-50">
            <h3 className="text-ksrtc-blue font-bold text-xs uppercase mb-4 tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Live Journey Stats
            </h3>
            <div className="grid grid-cols-3 gap-4">
               <div className="text-center group">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-2 text-blue-500 group-hover:scale-110 transition-all duration-300">
                    <Compass size={20} />
                  </div>
                  <div className="text-xs text-gray-400 font-medium">Speed</div>
                  <div className="text-xl font-bold text-gray-800 tracking-tight">
                    {(view === 'tracking' && liveStats.speed > 0) ? liveStats.speed : (selectedBus?.currentSpeed || 0)} <span className="text-[10px] font-medium text-gray-400">KM/H</span>
                  </div>
               </div>
               <div className="text-center group">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-2 text-blue-500 group-hover:scale-110 transition-all duration-300">
                    <MapPin size={20} />
                  </div>
                  <div className="text-xs text-gray-400 font-medium">To Go</div>
                  <div className="text-xl font-bold text-gray-800 tracking-tight">
                    {(view === 'tracking' && liveStats.dist > 0) ? liveStats.dist.toFixed(1) : (selectedBus?.distanceLeft || 0)} <span className="text-[10px] font-medium text-gray-400">KM</span>
                  </div>
               </div>
               <div className="text-center group">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-2 text-blue-500 group-hover:scale-110 transition-all duration-300">
                    <Clock size={20} />
                  </div>
                  <div className="text-xs text-gray-400 font-medium">Remaining</div>
                  <div className="text-xl font-bold text-gray-800 tracking-tight">
                    {selectedBus?.remainingTime || '--'}
                  </div>
               </div>
            </div>
         </div>
       </div>

       <div className="p-4 border-t border-gray-100 flex items-center gap-4 bg-white mt-4">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
             <CircleCheck size={24} />
          </div>
          <div className="flex-1">
             <h4 className="text-sm font-bold text-gray-800">At Bidar-Humnabad Link</h4>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="p-4 rounded-full bg-ksrtc-blue text-white shadow-lg active:rotate-180 transition-transform duration-500"
          >
             <RefreshCcw size={24} />
          </button>
       </div>
    </div>
  );

  const renderBooking = () => {
    if (!selectedBus) return null;

    const renderBookingProgress = () => {
      const steps = [
        { id: 'seats', label: 'Seats', icon: <Layout size={14} /> },
        { id: 'details', label: 'Details', icon: <User size={14} /> },
        { id: 'success', label: 'Success', icon: <CircleCheck size={14} /> },
      ];

      const currentIdx = ['seats', 'details', 'success'].indexOf(bookingStep);

      return (
        <div className="flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md rounded-3xl shadow-xl border border-white/20">
          {steps.map((step, idx) => {
            const isActive = bookingStep === step.id;
            const isDone = currentIdx > idx;

            return (
              <div key={step.id} className="flex flex-col items-center gap-1.5 relative flex-1">
                {idx < steps.length - 1 && (
                  <div className="absolute top-4 left-1/2 w-full h-0.5 bg-gray-100 -z-10">
                    <motion.div 
                      initial={{ width: '0%' }}
                      animate={{ width: isDone ? '100%' : '0%' }}
                      className="h-full bg-ksrtc-blue transition-all duration-500"
                    />
                  </div>
                )}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isActive ? 'bg-ksrtc-blue text-white scale-110 shadow-lg shadow-blue-100' : 
                  isDone ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-400'
                }`}>
                  {isDone ? <CircleCheck size={16} /> : step.icon}
                </div>
                <span className={`text-[9px] font-bold tracking-widest uppercase transition-colors ${
                  isActive ? 'text-ksrtc-blue' : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      );
    };

    const renderSeatGrid = () => (
      <div className="p-6 bg-white rounded-t-[40px] shadow-2xl relative z-10 min-h-[60vh]">
        <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-display font-bold text-gray-800">Select Seats</h2>
            <p className="text-gray-400 text-sm">{selectedBus.type} • {selectedBus.number}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-ksrtc-blue">₹{selectedBus.price * selectedSeats.length}</div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">{selectedSeats.length} Seats Selected</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 max-w-xs mx-auto mb-10">
          {/* Driver Seat */}
          <div className="col-start-4 mb-8 flex justify-center">
             <div className="w-10 h-10 rounded border-2 border-gray-200 flex items-center justify-center text-gray-300">
               <User size={16} />
             </div>
          </div>

          {[...Array(32)].map((_, i) => {
            const seatId = (i + 1).toString();
            const isSelected = selectedSeats.includes(seatId);
            const isBooked = [3, 8, 12, 15, 22].includes(i + 1);
            
            // Layout: 2 seats | aisle | 1 seat
            const isAisle = (i + 1) % 4 === 3;

            return (
              <React.Fragment key={seatId}>
                {isAisle && <div className="w-4" />}
                <button
                  disabled={isBooked}
                  onClick={() => {
                    setSelectedSeats(prev => 
                      prev.includes(seatId) 
                        ? prev.filter(s => s !== seatId) 
                        : [...prev, seatId]
                    );
                  }}
                  className={`w-12 h-12 rounded-xl border-2 font-bold transition-all flex flex-col items-center justify-center relative
                    ${isBooked ? 'bg-gray-50 border-gray-100 text-gray-200' : 
                      isSelected ? 'bg-ksrtc-blue border-ksrtc-blue text-white shadow-lg shadow-blue-100 scale-110 z-10' : 
                      'bg-white border-gray-100 text-gray-400 hover:border-ksrtc-blue/30'}`}
                >
                  <span className="text-xs">{seatId}</span>
                  <div className={`w-6 h-1 mt-0.5 rounded-full ${isSelected ? 'bg-white/30' : 'bg-gray-100'}`} />
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex gap-6 justify-center mb-10 text-[10px] font-bold uppercase tracking-wider">
           <div className="flex items-center gap-2 text-gray-400">
             <div className="w-4 h-4 rounded border-2 border-gray-100" /> Available
           </div>
           <div className="flex items-center gap-2 text-ksrtc-blue">
             <div className="w-4 h-4 rounded bg-ksrtc-blue" /> Selected
           </div>
           <div className="flex items-center gap-2 text-gray-200">
             <div className="w-4 h-4 rounded bg-gray-50 border-2 border-gray-100" /> Booked
           </div>
        </div>

        <button 
          disabled={selectedSeats.length === 0}
          onClick={() => setBookingStep('details')}
          className="w-full bg-ksrtc-blue text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-100 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
        >
          Confirm {selectedSeats.length} Seats
        </button>
      </div>
    );

    const renderDetails = () => (
      <div className="p-6 bg-white rounded-t-[40px] shadow-2xl relative z-10 min-h-[60vh]">
        <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />
        <h2 className="text-2xl font-display font-bold text-gray-800 mb-6">Passenger Details</h2>
        
        <div className="space-y-6">
          {selectedSeats.map((seatId, idx) => (
            <div key={seatId} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
               <div className="flex justify-between items-center mb-3">
                 <span className="text-xs font-bold text-ksrtc-blue uppercase">Passenger {idx + 1} (Seat {seatId})</span>
               </div>
               <div className="space-y-3">
                 <input placeholder="Full Name" className="w-full bg-white border border-gray-200 p-3 rounded-xl outline-none focus:border-ksrtc-blue" />
                 <div className="flex gap-3">
                   <input placeholder="Age" className="w-20 bg-white border border-gray-200 p-3 rounded-xl outline-none focus:border-ksrtc-blue" />
                   <select className="flex-1 bg-white border border-gray-200 p-3 rounded-xl outline-none focus:border-ksrtc-blue">
                     <option>Male</option>
                     <option>Female</option>
                     <option>Other</option>
                   </select>
                 </div>
               </div>
            </div>
          ))}

          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex items-center gap-3">
            <ShieldCheck size={24} className="text-emerald-600" />
            <div>
              <div className="text-sm font-bold text-emerald-800">Secure Checkout</div>
              <p className="text-[10px] text-emerald-600">Your details are protected by KSRTC security.</p>
            </div>
          </div>

          <button 
            onClick={async () => {
              const bookingId = 'TXN' + Math.random().toString(36).substring(7).toUpperCase();
              
              // Add to local state
              const newTicket: Ticket = {
                id: bookingId,
                busNumber: selectedBus.number,
                from: selectedBus.origin,
                to: selectedBus.destination,
                date: '10 May 2026', // Current mock date
                time: selectedBus.startTime,
                price: selectedBus.price * selectedSeats.length,
                seats: selectedSeats,
                status: 'Confirmed'
              };
              setBookedTickets(prev => [newTicket, ...prev]);
              setLastBookedTicketId(bookingId);

              if (user) {
                try {
                  await firestoreAddDoc(collection(db, 'notifications'), {
                    userId: user.uid,
                    title: 'Ticket Confirmed!',
                    message: `Your booking for ${selectedBus.number} is confirmed. Booking ID: ${bookingId}`,
                    type: 'arrival',
                    read: false,
                    time: 'Just now',
                    createdAt: serverTimestamp()
                  });
                } catch (err) {
                  handleFirestoreError(err, OperationType.CREATE, 'notifications');
                }
              }
              setBookingStep('success');
            }}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-emerald-100 active:scale-95 transition-all"
          >
            Pay ₹{selectedBus.price * selectedSeats.length}
          </button>
        </div>
      </div>
    );

    const renderSuccess = () => {
      const ticket = bookedTickets.find(t => t.id === lastBookedTicketId);
      if (!ticket) return null;

      return (
        <div className="p-8 text-center bg-white rounded-t-[40px] shadow-2xl relative z-10 min-h-[70vh] flex flex-col items-center">
          <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />
          
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-50"
          >
            <CircleCheck size={48} />
          </motion.div>
          
          <h2 className="text-3xl font-display font-bold text-gray-800 mb-2">Payment Confirmed!</h2>
          <p className="text-gray-500 mb-8 max-w-xs text-sm">Your seat is reserved. Please carry your e-ticket during travel.</p>
          
          <div className="w-full bg-gray-50 rounded-[32px] p-6 border border-gray-100 mb-8 text-left relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12" />
            
            <div className="flex justify-between mb-4 border-b border-gray-200 border-dashed pb-4">
               <div>
                 <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Bus Number</div>
                 <div className="font-bold text-gray-800">{ticket.busNumber}</div>
               </div>
               <div className="text-right">
                 <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Seats</div>
                 <div className="font-bold text-ksrtc-blue">{ticket.seats.join(', ')}</div>
               </div>
            </div>
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">From</div>
                <div className="font-bold text-gray-800">{ticket.from}</div>
              </div>
              <ArrowRight size={16} className="text-gray-300" />
              <div className="text-right">
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">To</div>
                <div className="font-bold text-gray-800">{ticket.to}</div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-200 border-dashed">
              <div>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Transaction ID</div>
                <div className="font-mono text-xs font-bold text-gray-800">{ticket.id}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Paid</div>
                <div className="font-bold text-emerald-600 text-lg">₹{ticket.price}</div>
              </div>
            </div>
          </div>

          <div className="w-full space-y-4">
            <button 
              onClick={() => {
                setSelectedViewTicket(ticket);
                setView('ticket-detail');
                setBookingStep('seats');
              }}
              className="w-full bg-ksrtc-blue text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Ticket size={24} /> View E-Ticket
            </button>
            
            <button 
              onClick={() => {
                setView('home');
                setBookingStep('seats');
                setSelectedSeats([]);
                setSelectedBus(undefined);
                setLastBookedTicketId(null);
              }}
              className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold active:scale-95 transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    };

    return (
      <div className="min-h-screen bg-gray-50 pb-24" id="booking">
        <div className="h-64 relative bg-ksrtc-blue pt-4">
           <div className="px-4 flex items-center gap-2 text-white relative z-20">
             <button onClick={() => {
               if (bookingStep === 'details') setBookingStep('seats');
               else setView('results');
             }} className="p-2 hover:bg-white/10 rounded-full">
               <ChevronLeft size={24} />
             </button>
             <h1 className="flex-1 text-lg font-display font-bold">Booking Ticket</h1>
             <div className="flex gap-1">
               <button onClick={() => setView('alerts')} className="p-2 hover:bg-white/10 rounded-full relative">
                 <Bell size={20} />
                 {notifications.some(n => !n.read) && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-ksrtc-blue" />}
               </button>
               <button onClick={handleShare} className="p-2 hover:bg-white/10 rounded-full">
                 <Share2 size={20} />
               </button>
               <button onClick={() => alert('Option menu coming soon!')} className="p-2 hover:bg-white/10 rounded-full">
                 <MoreVertical size={20} />
               </button>
             </div>
           </div>
           
           <div className="absolute inset-0 z-0">
             <InteractiveMap bus={selectedBus} interactive={false} />
             <div className="absolute inset-0 bg-ksrtc-blue/40 pointer-events-none" />
           </div>
        </div>

        {/* Steps Indicator */}
        <div className="px-6 -mt-10 mb-6 relative z-30">
          {renderBookingProgress()}
        </div>

        {bookingStep === 'seats' && renderSeatGrid()}
        {bookingStep === 'details' && renderDetails()}
        {bookingStep === 'success' && renderSuccess()}
      </div>
    );
  };

  const handleCancelTicket = async (ticketId: string) => {
    if (cancellingTicketId !== ticketId) {
      setCancellingTicketId(ticketId);
      // Reset after 3 seconds if not confirmed
      setTimeout(() => setCancellingTicketId(prev => prev === ticketId ? null : prev), 3000);
      return;
    }

    setCancellingTicketId(null);

    try {
      // Update local state first for immediate UI feedback
      setBookedTickets(prev => prev.map(ticket => 
        ticket.id === ticketId ? { ...ticket, status: 'Cancelled' as const } : ticket
      ));

      // Optional: Add notification to Firestore if user is logged in
      if (user) {
        await firestoreAddDoc(collection(db, 'notifications'), {
          userId: user.uid,
          title: 'Ticket Cancelled',
          message: `Your booking ${ticketId} has been successfully cancelled. Refund will be processed.`,
          type: 'info',
          read: false,
          time: 'Just now',
          createdAt: serverTimestamp()
        }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'notifications'));
      }
    } catch (err) {
      console.error('Cancellation failed:', err);
    }
  };

  const renderMyTickets = () => (
    <div className="min-h-screen bg-gray-50 pb-24" id="my-tickets">
      <div className="bg-ksrtc-blue px-6 pt-12 pb-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="flex items-center gap-4 relative z-10">
          <button onClick={() => setView('home')} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-display font-bold">My Tickets</h1>
            <p className="text-blue-100 text-sm mt-1">Manage your active and past bookings</p>
          </div>
          <button onClick={() => setView('alerts')} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors relative">
            <Bell size={24} />
            {notifications.some(n => !n.read) && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white/20" />}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 -mt-6 relative z-20">
        {bookedTickets.length === 0 ? (
          <div className="text-center py-20">
            <Ticket size={48} className="text-gray-200 mx-auto mb-4" />
            <h3 className="text-gray-800 font-bold">No active tickets</h3>
            <p className="text-gray-400 text-sm">Your booked tickets will appear here</p>
            <button 
              onClick={() => setView('home')}
              className="mt-6 text-ksrtc-blue font-bold border-2 border-ksrtc-blue px-8 py-3 rounded-full"
            >
              Book Now
            </button>
          </div>
        ) : (
          bookedTickets.map(ticket => (
            <div key={ticket.id} className="bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-100 relative group">
              <div className={`${ticket.status === 'Confirmed' ? 'bg-emerald-500' : ticket.status === 'Cancelled' ? 'bg-red-500' : 'bg-gray-400'} h-2 w-full`} />
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{ticket.busNumber}</div>
                    <h3 className="text-xl font-bold text-gray-800">{ticket.from} → {ticket.to}</h3>
                  </div>
                  <div className={`${ticket.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-600' : ticket.status === 'Cancelled' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'} px-3 py-1 rounded-full text-[10px] font-bold uppercase`}>
                    {ticket.status}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Date & Time</div>
                    <div className="text-sm font-bold text-gray-800">{ticket.date}, {ticket.time}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Seats</div>
                    <div className="text-sm font-bold text-gray-800">{ticket.seats.join(', ')}</div>
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-200 pt-6 flex justify-between items-center gap-3">
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Booking ID</div>
                    <div className="text-sm font-bold text-gray-800">{ticket.id}</div>
                  </div>
                  <div className="flex gap-2">
                    {ticket.status === 'Confirmed' && (
                      <button 
                        onClick={() => {
                          const bus = MOCK_BUSES.find(b => b.number === ticket.busNumber);
                          if (bus) {
                            setSelectedBus(bus);
                            setView('tracking');
                          } else {
                            alert('Tracking not available');
                          }
                        }}
                        className="bg-emerald-50 text-emerald-600 px-3 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-100 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm border border-emerald-100"
                      >
                        <Compass size={14} /> Track
                      </button>
                    )}
                    {ticket.status === 'Confirmed' && (
                       <button 
                         onClick={() => handleCancelTicket(ticket.id)}
                         className={`${cancellingTicketId === ticket.id ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-500 border-red-100'} px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all w-24 flex items-center justify-center`}
                       >
                         {cancellingTicketId === ticket.id ? 'Confirm?' : 'Cancel'}
                       </button>
                    )}
                    <button 
                      onClick={() => {
                        setSelectedViewTicket(ticket);
                        setView('ticket-detail');
                      }}
                      className="bg-ksrtc-blue text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-blue-100 active:scale-95 transition-transform flex items-center gap-2"
                    >
                      View Ticket <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Ticket cutouts */}
              <div className="absolute left-0 top-[65%] -translate-x-1/2 w-8 h-8 rounded-full bg-gray-50 border-r border-gray-100" />
              <div className="absolute right-0 top-[65%] translate-x-1/2 w-8 h-8 rounded-full bg-gray-50 border-l border-gray-100" />
            </div>
          ))
        )}
      </div>

      <div className="p-4 pt-0">
        <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-ksrtc-blue shadow-sm">
             <ShieldCheck size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-blue-900">Valid ID Required</div>
            <p className="text-[10px] text-blue-600 font-medium">Please carry original ID proof during travel.</p>
          </div>
        </div>
      </div>
    </div>
  );
  const handleMarkAllRead = async () => {
    try {
      const promises = notifications.filter(n => !n.read).map(n => 
        firestoreUpdateDoc(doc(db, 'notifications', n.id), { read: true })
      );
      await Promise.all(promises);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  };

  const renderTicketDetail = () => {
    if (!selectedViewTicket) return null;
    const ticket = selectedViewTicket;

    return (
      <div className="min-h-screen bg-gray-50 pb-24" id="ticket-detail">
        <div className="bg-ksrtc-blue p-6 pb-20 text-white rounded-b-[40px] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="flex items-center gap-4 relative z-10">
            <button onClick={() => setView('my-tickets')} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors no-print">
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-xl font-display font-bold w-full text-center pr-10 print:pr-0">Ticket Details</h2>
          </div>
        </div>

        <div className="px-5 -mt-12 relative z-20">
          <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden relative">
            <div className={`${ticket.status === 'Confirmed' ? 'bg-emerald-500' : 'bg-red-500'} h-3 w-full`} />
            
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl border-2 border-gray-50 overflow-hidden p-1.5 ring-4 ring-gray-100/50">
                  <img 
                    src={ksrtcLogo}
                    alt="Official KSRTC Logo" 
                    className="w-full h-full object-contain" 
                  />
                </div>
                <div className="text-right">
                  <div className={`${ticket.status === 'Confirmed' ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'} px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider inline-block mb-1`}>
                    {ticket.status}
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold block">PRINTED TICKET</div>
                </div>
              </div>

              <div className="text-center mb-10">
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">{ticket.busNumber}</div>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-display font-bold text-gray-800">{ticket.from}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">{ticket.time}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-24 h-px bg-gray-200 relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2">
                        <BusFront size={14} className="text-ksrtc-blue" />
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-display font-bold text-gray-800">{ticket.to}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Arrival</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-3xl p-6 mb-8 grid grid-cols-2 gap-y-6">
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Passenger</div>
                  <div className="text-sm font-bold text-gray-800 truncate">{user?.displayName || 'Traveler'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Seats</div>
                  <div className="text-sm font-bold text-gray-800">{ticket.seats.join(', ')}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Date</div>
                  <div className="text-sm font-bold text-gray-800">{ticket.date}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Class</div>
                  <div className="text-sm font-bold text-gray-800">Super Luxury</div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-100 rounded-3xl mb-8">
                <div className="w-32 h-32 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mb-4">
                  <QrCode size={96} className="text-gray-800" />
                </div>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">PNR: {ticket.id}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 no-print">
                <button 
                  onClick={() => window.print()}
                  className="bg-gray-100 text-gray-700 py-4 rounded-2xl font-display font-bold active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <Download size={20} /> Print
                </button>
                <button 
                  onClick={async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: 'KSRTC E-Ticket',
                          text: `My ticket for ${ticket.busNumber} from ${ticket.from} to ${ticket.to} on ${ticket.date}. PNR: ${ticket.id}`,
                          url: window.location.href
                        });
                      } catch (err: any) {
                        if (err.name !== 'AbortError') {
                          console.error('Share failed:', err);
                        }
                      }
                    } else {
                      alert('Sharing is not supported on this browser. You can take a screenshot instead.');
                    }
                  }}
                  className="bg-ksrtc-blue text-white py-4 rounded-2xl font-display font-bold shadow-lg shadow-blue-100 active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <Share2 size={20} /> Share
                </button>
              </div>

              <button 
                onClick={() => {
                  const bus = MOCK_BUSES.find(b => b.number === ticket.busNumber);
                  if (bus) {
                    setSelectedBus(bus);
                    setView('tracking');
                  } else {
                    alert('Tracking information not available for this bus.');
                  }
                }}
                className="w-full mt-4 bg-emerald-50 text-emerald-700 py-4 rounded-2xl font-display font-bold active:scale-95 transition-transform flex items-center justify-center gap-2 border border-emerald-100 shadow-sm no-print"
              >
                <Compass size={20} /> Track Journey
              </button>
            </div>

            {/* Side Cutouts */}
            <div className="absolute top-[68%] -left-4 w-8 h-8 rounded-full bg-gray-50 border-r border-gray-100" />
            <div className="absolute top-[68%] -right-4 w-8 h-8 rounded-full bg-gray-50 border-l border-gray-100" />
          </div>

          <div className="mt-8 bg-blue-50/50 rounded-2xl p-4 border border-blue-100 flex items-start gap-3">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm shrink-0 mt-1">
              <Info size={16} />
            </div>
            <div>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Show this digital ticket to the conductor. Carrying a printed copy is not mandatory for KSRTC e-tickets. 
                <span className="font-bold"> Valid ID proof is required.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAlerts = () => {
    const filteredNotifications = notificationFilter === 'all' 
      ? notifications 
      : notifications.filter(n => n.type === notificationFilter);

    return (
      <div className="min-h-screen bg-white pb-24" id="alerts">
         <div className="bg-ksrtc-blue p-4 pt-12 text-white">
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setView('home')} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                <ChevronLeft size={24} />
              </button>
              <div className="flex-1">
                <h1 className="text-2xl font-display font-bold">Notifications</h1>
              </div>
              <button onClick={handleMarkAllRead} className="text-xs font-bold text-blue-200 bg-white/10 px-3 py-1.5 rounded-lg whitespace-nowrap">Mark all read</button>
            </div>
            
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {[
                { id: 'all', label: 'All', icon: Bell },
                { id: 'delay', label: 'Delays', icon: Clock },
                { id: 'arrival', label: 'Arrivals', icon: MapPin },
                { id: 'info', label: 'General', icon: ShieldCheck }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setNotificationFilter(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    notificationFilter === tab.id 
                      ? 'bg-white text-ksrtc-blue shadow-lg' 
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>
         </div>

         <div className="p-4 space-y-3">
            {filteredNotifications.map(n => (
              <div 
                key={n.id} 
                onClick={() => {
                  if (!n.read) firestoreUpdateDoc(doc(db, 'notifications', n.id), { read: true });
                }}
                className={`p-4 rounded-3xl border cursor-pointer transition-all ${n.read ? 'bg-white border-gray-100 opacity-60' : 'bg-white border-blue-100 shadow-sm ring-1 ring-blue-50'}`}
              >
                 <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl ${
                      n.type === 'delay' ? 'bg-rose-50 text-rose-600' : 
                      n.type === 'arrival' ? 'bg-emerald-50 text-emerald-600' : 
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {n.type === 'delay' ? <Clock size={20} /> : n.type === 'arrival' ? <MapPin size={20} /> : <Bell size={20} />}
                    </div>
                    <div className="flex-1">
                       <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-gray-900 leading-tight">{n.title}</h4>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{n.time}</span>
                       </div>
                       <p className="text-sm text-gray-600 leading-relaxed">{n.message}</p>
                       <div className="mt-3 flex items-center gap-2">
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${
                            n.type === 'delay' ? 'bg-rose-100 text-rose-600' : 
                            n.type === 'arrival' ? 'bg-emerald-100 text-emerald-600' : 
                            'bg-blue-100 text-blue-600'
                          }`}>
                            {n.type}
                          </span>
                       </div>
                    </div>
                 </div>
              </div>
            ))}
            
            {filteredNotifications.length === 0 && (
              <div className="text-center py-24">
                 <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bell size={32} className="text-gray-200" />
                 </div>
                 <p className="text-gray-400 font-bold">No {notificationFilter === 'all' ? '' : notificationFilter} notifications</p>
                 <button 
                  onClick={() => setNotificationFilter('all')}
                  className="mt-4 text-ksrtc-blue text-xs font-bold"
                 >
                   Clear filters
                 </button>
              </div>
            )}
         </div>
      </div>
    );
  };

  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');

  useEffect(() => {
    if (user) {
      setProfileName(user.displayName || '');
      setProfileEmail(user.email || '');
    }
  }, [user]);

  const renderHistory = () => (
    <div className="min-h-screen bg-gray-50 pb-24" id="history">
       <div className="bg-ksrtc-blue p-6 text-white flex items-center gap-4">
          <button onClick={() => setView('profile')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
             <ChevronLeft size={24} />
          </button>
          <h2 className="text-xl font-display font-bold">Travel History</h2>
       </div>
       <div className="p-4">
          {bookedTickets.length > 0 ? (
            <div className="space-y-4">
               {bookedTickets.map((ticket, i) => (
                  <div key={i} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                     <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full font-bold uppercase">Completed</span>
                        <span className="text-xs text-gray-400 font-mono">#{ticket.id}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <div>
                           <p className="text-xs text-gray-400 font-medium">Route</p>
                           <p className="font-bold text-gray-800">{ticket.from} → {ticket.to}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs text-gray-400 font-medium">Date</p>
                           <p className="font-bold text-gray-800">{ticket.date}</p>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
          ) : (
            <div className="text-center py-20">
               <div className="w-16 h-16 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <History size={32} />
               </div>
               <p className="text-gray-400 font-medium">No travel history found.</p>
               <button onClick={() => setView('home')} className="mt-4 text-ksrtc-blue font-bold text-sm">Book your first trip</button>
            </div>
          )}
       </div>
    </div>
  );

  const renderSupport = () => (
    <div className="min-h-screen bg-gray-50 pb-24" id="support">
       <div className="bg-ksrtc-blue p-6 text-white flex items-center gap-4">
          <button onClick={() => setView('profile')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
             <ChevronLeft size={24} />
          </button>
          <h2 className="text-xl font-display font-bold">Help & Support</h2>
       </div>
       <div className="p-4 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
             <h3 className="font-bold text-gray-800 mb-4">Contact Us</h3>
             <div className="space-y-4">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                      <Smartphone size={20} />
                   </div>
                   <div>
                      <p className="text-xs text-gray-400">Customer Helpline</p>
                      <p className="font-bold text-gray-800">1800 221 221</p>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                      <Mail size={20} />
                   </div>
                   <div>
                      <p className="text-xs text-gray-400">Email Support</p>
                      <p className="font-bold text-gray-800">support@ksrtc.in</p>
                   </div>
                </div>
             </div>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
             <h3 className="font-bold text-gray-800 mb-4 font-display">Common FAQs</h3>
             <div className="space-y-3">
                {['How to cancel a ticket?', 'Can I reschedule my trip?', 'Lost items?', 'Refund status'].map((q, i) => (
                   <button key={i} className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                      {q}
                      <ChevronRight size={16} className="text-gray-400" />
                   </button>
                ))}
             </div>
          </div>
       </div>
    </div>
  );

  const renderEditProfile = () => (
    <div className="min-h-screen bg-gray-50 pb-24" id="edit-profile">
       <div className="bg-ksrtc-blue p-6 text-white flex items-center gap-4">
          <button onClick={() => setView('profile')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
             <ChevronLeft size={24} />
          </button>
          <h2 className="text-xl font-display font-bold">Edit Profile</h2>
       </div>
       <div className="p-4">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
             <div className="text-center pb-4">
                <div className="w-20 h-20 bg-blue-50 rounded-full mx-auto flex items-center justify-center mb-2">
                   <User size={40} className="text-blue-500" />
                </div>
                <button className="text-ksrtc-blue text-xs font-bold uppercase tracking-wider">Change Photo</button>
             </div>
             
             <div className="space-y-4">
                <div>
                   <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Full Name</label>
                   <input 
                      type="text" 
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none"
                      placeholder="John Doe"
                   />
                </div>
                <div>
                   <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Email Address</label>
                   <input 
                      type="email" 
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none"
                      placeholder="john@example.com"
                   />
                </div>
             </div>
             
             <button 
                onClick={() => {
                  alert('Profile updated successfully!');
                  setView('profile');
                }}
                className="w-full bg-ksrtc-blue text-white py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-blue-100"
             >
                Save Changes
             </button>
          </div>
       </div>
    </div>
  );

  const renderProfile = () => (
    <div className="min-h-screen bg-gray-50 pb-24" id="profile">
       <div className="bg-ksrtc-blue p-8 text-white text-center rounded-b-[40px] shadow-lg">
          <div className="w-24 h-24 bg-white rounded-full mx-auto mb-4 border-4 border-white/20 p-1 overflow-hidden">
             {user?.photoURL ? (
                <img src={user.photoURL} alt="User profile" className="w-full h-full object-cover rounded-full" />
             ) : (
                <div className="w-full h-full bg-blue-100 rounded-full flex items-center justify-center">
                   <User size={48} className="text-ksrtc-blue" />
                </div>
             )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl font-display font-bold">{user?.displayName || (isGuest ? 'Guest User' : 'KSRTC User')}</h2>
            {!isGuest && (
              <button onClick={() => setView('edit-profile')} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <Edit2 size={16} />
              </button>
            )}
          </div>
          <p className="text-blue-200 text-sm mt-1">{user?.email || (isGuest ? 'Browse as Guest' : 'user@ksrtc.gov.in')}</p>
       </div>
       
       <div className="p-4 -mt-8">
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 p-2 border border-gray-100">
             {[
               { icon: Ticket, label: 'My Bookings', color: 'text-blue-500', action: () => setView('my-tickets') },
               { icon: History, label: 'Travel History', color: 'text-emerald-500', action: () => setView('history') },
               { icon: Bell, label: 'Alert Preferences', color: 'text-amber-500', action: () => setView('alerts') },
               { icon: Smartphone, label: 'Wallet', subtitle: `₹${smartCardBalance.toFixed(2)}`, color: 'text-rose-500', action: () => setView('smart-card') },
               { icon: ShieldCheck, label: 'Help & Support', color: 'text-purple-500', action: () => setView('support') },
               { icon: Settings, label: 'Settings', color: 'text-gray-400', action: () => alert('Advanced settings coming soon!') },
             ].map((item, i) => (
                <button 
                  key={i} 
                  onClick={item.action}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-colors text-left border-b border-gray-50 last:border-0"
                >
                   <div className={`p-2 rounded-xl bg-gray-50 ${item.color}`}>
                      <item.icon size={20} />
                   </div>
                   <div className="flex-1">
                      <div className="font-bold text-gray-800">{item.label}</div>
                      {item.subtitle && <div className="text-xs text-gray-400 font-medium">{item.subtitle}</div>}
                   </div>
                   <ChevronRight size={16} className="text-gray-300" />
                </button>
             ))}
          </div>
          
          {user || isGuest ? (
            <button 
              onClick={handleLogout} 
              className="w-full mt-8 py-4 text-rose-500 font-bold bg-white rounded-[24px] border border-rose-100 shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
               <Trash2 size={18} />
               {user ? 'Sign Out' : 'Exit Guest Mode'}
            </button>
          ) : (
            <button 
              onClick={() => setView('onboarding')} 
              className="w-full mt-8 py-4 text-ksrtc-blue font-bold bg-white rounded-[24px] border border-blue-100 shadow-sm active:scale-[0.98] transition-all"
            >
               Login to your account
            </button>
          )}
       </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto relative overflow-hidden bg-white shadow-2xl min-h-screen font-sans">
      {renderOfflineBanner()}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="h-full"
        >
          {view === 'onboarding' && renderOnboarding()}
          {view === 'home' && renderHome()}
          {view === 'results' && renderResults()}
          {view === 'tracking' && renderTracking()}
          {view === 'booking' && renderBooking()}
          {view === 'my-tickets' && renderMyTickets()}
          {view === 'alerts' && renderAlerts()}
          {view === 'history' && renderHistory()}
          {view === 'support' && renderSupport()}
          {view === 'edit-profile' && renderEditProfile()}
          {view === 'profile' && renderProfile()}
          {view === 'ticket-detail' && renderTicketDetail()}
          {view === 'smart-card' && renderSmartCard()}
        </motion.div>
      </AnimatePresence>
      {renderPwaToast()}

      {/* Global Bottom Navigation for views other than onboarding */}
      {view !== 'onboarding' && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center justify-around py-4 pb-6 z-[2000] no-print">
          <button onClick={() => setView('home')} className={`flex flex-col items-center gap-1 transition-colors ${view === 'home' ? 'text-ksrtc-blue' : 'text-gray-400 hover:text-gray-600'}`}>
            <HomeIcon size={24} />
            <span className="text-[10px] font-bold">Home</span>
          </button>
          <button onClick={() => setView('my-tickets')} className={`flex flex-col items-center gap-1 transition-colors ${view === 'my-tickets' ? 'text-ksrtc-blue' : 'text-gray-400 hover:text-gray-600'}`}>
            <Ticket size={24} />
            <span className="text-[10px] font-bold">Tickets</span>
          </button>
          <button onClick={() => setView('alerts')} className={`flex flex-col items-center gap-1 transition-colors relative ${view === 'alerts' ? 'text-ksrtc-blue' : 'text-gray-400 hover:text-gray-600'}`}>
            <Bell size={24} />
            {notifications.some(n => !n.read) && <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />}
            <span className="text-[10px] font-bold">Alerts</span>
          </button>
          <button onClick={() => setView('profile')} className={`flex flex-col items-center gap-1 transition-colors ${view === 'profile' ? 'text-ksrtc-blue' : 'text-gray-400 hover:text-gray-600'}`}>
            <User size={24} />
            <span className="text-[10px] font-bold">Profile</span>
          </button>
        </div>
      )}
    </div>
  );
}
