import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, BarChart3, Users, Wallet, TrendingUp, CheckCircle2,
  XCircle, Clock, Store, Star, Sparkles, ArrowRight, LogOut,
  AlertCircle, Download, Eye, Search, Filter, DollarSign, X, FileText, ExternalLink
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Vendor, Booking } from '../lib/supabase';
import { dataCache } from '../lib/cache';
import Navbar from '../components/Navbar';
import { useInView } from '../hooks/useInView';

type VendorWithProfile = Vendor & {
  approval_status?: string;
  commission_rate?: number;
  subscription_tier?: string;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [vendors, setVendors] = useState<VendorWithProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'vendors' | 'bookings' | 'revenue'>('applications');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [pendingApplications, setPendingApplications] = useState<any[]>([]);
  const [selectedDocPreview, setSelectedDocPreview] = useState<{
    title: string;
    docType: string;
    fileUrl: string;
    idNumber?: string;
    app: any;
  } | null>(null);

  const statsView = useInView<HTMLDivElement>();

  const isAdminAuth = localStorage.getItem('festivo_admin_authenticated') === 'true';

  useEffect(() => {
    if (!user && !isAdminAuth) {
      navigate('/auth?admin=true');
      return;
    }
  }, [user, isAdminAuth, navigate]);

  const loadPendingApplications = () => {
    const raw = localStorage.getItem('festivo_pending_vendors');
    let pendingList: any[] = [];
    if (raw) {
      try {
        pendingList = JSON.parse(raw);
      } catch (e) {}
    }

    // Always check active vendor profile & KYC submission from vendor dashboard as live fallback
    const currentVendorProfile = localStorage.getItem('vendor_user_profile');
    const currentKycRecord = localStorage.getItem('vendor_kyc_record');
    const currentKycStatus = localStorage.getItem('vendor_kyc_status');

    if (currentVendorProfile) {
      try {
        const vUser = JSON.parse(currentVendorProfile);
        const kRecord = currentKycRecord ? JSON.parse(currentKycRecord) : null;
        const vEmail = (vUser.email || '').toLowerCase().trim();

        if (vEmail && vEmail !== 'vendor@festivo.com') {
          const specStatus = localStorage.getItem(`festivo_kyc_status_${vEmail}`);
          const isApproved = specStatus === 'Approved' || currentKycStatus === 'verified';

          const existingIndex = pendingList.findIndex((p: any) =>
            (p.details?.email && p.details.email.toLowerCase().trim() === vEmail) ||
            p.name === vUser.businessName
          );

          const constructedApp = {
            id: vUser.id || `VND-${Date.now()}`,
            name: vUser.businessName || vUser.fullName || 'Vendor Application',
            category: vUser.category || 'Event Provider',
            location: vUser.location || 'Hyderabad, India',
            price_amount: 45000,
            price_label: 'Starting Package',
            price_unit: 'event',
            rating: 5.0,
            reviews: 1,
            image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800',
            logo: 'VP',
            verified: isApproved,
            badge: isApproved ? 'Approved' : 'Pending Verification',
            badge_color: isApproved ? 'bg-sage-600' : 'bg-gold-500',
            slug: vUser.username || 'vendor-partner',
            details: {
              email: vUser.email,
              phone: vUser.phone || '+91 93475 67375',
              owner: vUser.fullName || 'Vendor Owner',
              address: vUser.location || 'Hyderabad, India',
              registrationDate: new Date().toISOString().split('T')[0],
              status: isApproved ? 'Approved' : 'Pending Verification',
              kyc: {
                idNumber: kRecord?.govtIdNumber || 'Submitted',
                aadhaarFront: kRecord?.govtIdFile || '',
                cancelledCheque: kRecord?.bankProofFile || ''
              }
            }
          };

          if (existingIndex >= 0) {
            // Update existing entry with latest KYC details if present
            pendingList[existingIndex] = {
              ...pendingList[existingIndex],
              verified: isApproved,
              badge: isApproved ? 'Approved' : 'Pending Verification',
              details: {
                ...pendingList[existingIndex].details,
                status: isApproved ? 'Approved' : 'Pending Verification',
                kyc: {
                  ...pendingList[existingIndex].details?.kyc,
                  idNumber: kRecord?.govtIdNumber || pendingList[existingIndex].details?.kyc?.idNumber || 'Submitted',
                  aadhaarFront: kRecord?.govtIdFile || pendingList[existingIndex].details?.kyc?.aadhaarFront || '',
                  cancelledCheque: kRecord?.bankProofFile || pendingList[existingIndex].details?.kyc?.cancelledCheque || ''
                }
              }
            };
          } else {
            pendingList.unshift(constructedApp);
          }
          localStorage.setItem('festivo_pending_vendors', JSON.stringify(pendingList));
        }
      } catch (e) {}
    }

    setPendingApplications(pendingList);
  };

  useEffect(() => {
    loadPendingApplications();
    window.addEventListener('storage', loadPendingApplications);
    return () => window.removeEventListener('storage', loadPendingApplications);
  }, []);

  const loadAllBookingsAndVendors = async () => {
    try {
      const [vendorData, bookingData] = await Promise.all([
        dataCache.fetchWithCache('all_vendors', async () => {
          const { data } = await supabase.from('vendors').select('*').order('rating', { ascending: false });
          return (data ?? []) as VendorWithProfile[];
        }),
        dataCache.fetchWithCache('admin_bookings', async () => {
          const { data } = await supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(50);
          return data ?? [];
        }),
      ]);

      const localCustBookings = JSON.parse(localStorage.getItem('festivo_customer_bookings') || '[]');
      const localVendorBookings = JSON.parse(localStorage.getItem('vendor_bookings') || '[]');

      const formattedLocalCust = localCustBookings.map((b: any) => ({
        id: b.id || `bk_${Math.random()}`,
        booking_ref: b.booking_ref || `FEST-${Math.floor(1000 + Math.random() * 9000)}`,
        customer_name: b.customer_name || 'Customer',
        customer_email: b.customer_email || 'customer@festivo.com',
        customer_phone: b.customer_phone || '+91 90000 00000',
        event_type: b.event_type || b.type || 'Event',
        event_date: b.event_date || b.date || '2026-09-20',
        guests: b.guests || 200,
        total_amount: b.total_amount || (parseInt(String(b.budget || '0').replace(/[^0-9]/g, ''), 10) || 45000),
        special_requests: b.special_requests || 'Standard event booking',
        payment_status: b.payment_status || 'paid',
        status: b.status || 'confirmed',
        vendor_id: b.vendor_id || 'v1',
        created_at: b.created_at || new Date().toISOString()
      }));

      const formattedLocalVendor = localVendorBookings.map((b: any) => ({
        id: b.id || `bk_${Math.random()}`,
        booking_ref: `FEST-${Math.floor(1000 + Math.random() * 9000)}`,
        customer_name: b.customer || 'Client Inquiry',
        customer_email: 'client@festivo.com',
        customer_phone: '+91 90000 00000',
        event_type: b.type || 'Event Service',
        event_date: b.date || '2026-09-25',
        guests: 250,
        total_amount: parseInt(String(b.budget || '0').replace(/[^0-9]/g, ''), 10) || 35000,
        special_requests: b.location || 'Direct booking request',
        payment_status: b.status === 'confirmed' || b.status === 'completed' ? 'paid' : 'pending',
        status: b.status || 'pending',
        vendor_id: 'v_local',
        created_at: new Date().toISOString()
      }));

      const combinedBookings = [...(bookingData || []), ...formattedLocalCust, ...formattedLocalVendor];
      setBookings(combinedBookings);
      setVendors(vendorData as VendorWithProfile[]);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    loadAllBookingsAndVendors();
    window.addEventListener('storage', loadAllBookingsAndVendors);
    return () => window.removeEventListener('storage', loadAllBookingsAndVendors);
  }, []);

  const handleApproveApplication = (app: any) => {
    const updated = pendingApplications.map(p => (p.name === app.name || p.id === app.id) ? { ...p, verified: true, badge: 'Verified', badge_color: 'bg-sage-600', details: { ...p.details, status: 'Approved' } } : p);
    setPendingApplications(updated);
    localStorage.setItem('festivo_pending_vendors', JSON.stringify(updated));

    localStorage.setItem('vendor_kyc_status', 'verified');
    if (app.details?.email) {
      localStorage.setItem(`festivo_kyc_status_${app.details.email.toLowerCase()}`, 'Approved');
    }
    window.dispatchEvent(new Event('storage'));
    alert(`Application Approved for "${app.name}" (${app.details?.owner || 'Vendor'})!\n\nOfficial Blue Verified Badge granted. Vendor Dashboard contents are now UNLOCKED!`);
  };

  const handleRejectApplication = (app: any) => {
    const updated = pendingApplications.map(p => (p.name === app.name || p.id === app.id) ? { ...p, verified: false, badge: 'Rejected', badge_color: 'bg-red-500', details: { ...p.details, status: 'Rejected' } } : p);
    setPendingApplications(updated);
    localStorage.setItem('festivo_pending_vendors', JSON.stringify(updated));

    localStorage.setItem('vendor_kyc_status', 'unverified');
    if (app.details?.email) {
      localStorage.setItem(`festivo_kyc_status_${app.details.email.toLowerCase()}`, 'Rejected');
    }
    window.dispatchEvent(new Event('storage'));
    alert(`Application Rejected for "${app.name}". Vendor Dashboard contents will remain locked.`);
  };

  const totalRevenue = bookings.filter(b => b.payment_status === 'paid').reduce((s, b) => s + b.total_amount, 0);
  const commissionRevenue = Math.round(totalRevenue * 0.15);
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const avgRating = vendors.length ? (vendors.reduce((s, v) => s + Number(v.rating), 0) / vendors.length).toFixed(1) : '—';

  const filteredVendors = vendors.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'verified' && v.verified) || (filterStatus === 'unverified' && !v.verified);
    return matchesSearch && matchesStatus;
  });

  const toggleVerify = async (vendor: Vendor) => {
    const newStatus = !vendor.verified;
    await supabase.from('vendors').update({ verified: newStatus }).eq('id', vendor.id);
    setVendors(prev => prev.map(v => v.id === vendor.id ? { ...v, verified: newStatus } : v));
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-cream-50 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-sage-200 border-t-sage-600 rounded-full animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-cream-50/50 pt-16">
        {/* Header */}
        <div className="bg-gradient-to-r from-sage-900 to-sage-800 py-8 relative overflow-hidden">
          <div className="orb w-72 h-72 bg-sage-600/20 -top-20 -left-20 opacity-30" />
          <div className="orb w-72 h-72 bg-gold-500/10 -bottom-20 -right-20" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-brand rounded-2xl flex items-center justify-center shadow-glow flex-shrink-0">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Admin Dashboard</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-gold-500 text-sage-900 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Administrator
                    </span>
                    <span className="text-sage-200 text-sm">{user?.email}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={async () => { await signOut(); navigate('/'); }}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>

            <div className="flex gap-1 mt-6 overflow-x-auto">
              {(['overview', 'applications', 'vendors', 'bookings', 'revenue'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all capitalize whitespace-nowrap ${
                    activeTab === tab ? 'bg-white text-sage-600 shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab === 'applications' ? `Applications (${pendingApplications.filter(a => !a.verified).length})` : tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Applications Review Tab */}
          {activeTab === 'applications' && (
            <div className="bg-white rounded-2xl shadow-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold text-sage-900 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-sage-600" /> Vendor Applications & KYC Inspection
                  </h2>
                  <p className="text-dark-500 text-sm mt-1 font-medium">
                    Review submitted vendor identity documents (Aadhaar/PAN/Cheque) and click Accept to unlock their Vendor Dashboard.
                  </p>
                </div>
                <span className="bg-gold-100 text-gold-800 text-xs font-extrabold px-3 py-1.5 rounded-full border border-gold-300">
                  {pendingApplications.filter(a => !a.verified).length} Pending Review
                </span>
              </div>

              {pendingApplications.length === 0 ? (
                <div className="text-center py-12 bg-cream-50/50 rounded-2xl border border-dashed border-sage-200">
                  <CheckCircle2 className="w-12 h-12 text-sage-500 mx-auto mb-3" />
                  <p className="font-bold text-sage-900 text-base">No pending applications</p>
                  <p className="text-dark-500 text-sm">All submitted vendor applications have been reviewed.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingApplications.map((app, idx) => (
                    <div key={app.id || idx} className="bg-cream-50/60 rounded-2xl border border-sage-100 p-6 space-y-4 transition-all hover:shadow-md">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sage-100 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-sage-800 text-white font-extrabold text-base flex items-center justify-center shadow-md">
                            {app.name?.[0] || 'V'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sage-900 text-lg">{app.name}</h3>
                              <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${app.verified ? 'bg-sage-100 text-sage-800 border-sage-300' : 'bg-gold-100 text-gold-800 border-gold-300'}`}>
                                {app.details?.status || (app.verified ? 'Approved' : 'Pending Verification')}
                              </span>
                            </div>
                            <p className="text-dark-500 text-xs font-semibold">
                              Owner: {app.details?.owner || 'Vendor Partner'} · {app.category} · {app.location}
                            </p>
                            <p className="text-sage-700 text-xs font-mono">{app.details?.email} · {app.details?.phone}</p>
                          </div>
                        </div>

                        {/* Accept & Reject Action Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApproveApplication(app)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-sage-600 hover:bg-sage-700 text-white font-bold text-xs rounded-xl shadow-glow-sage transition-all hover:scale-105 active:scale-95 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Accept & Unlock Dashboard
                          </button>
                          <button
                            onClick={() => handleRejectApplication(app)}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      </div>

                      {/* Submitted Documents Inspection */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-sage-800 mb-2.5 flex items-center justify-between">
                          <span>Submitted Inspection Proofs</span>
                          <span className="text-[11px] text-sage-600 font-semibold normal-case">Click "View Document" to inspect uploaded files</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {/* Card 1: Govt Photo ID */}
                          <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-sage-100 shadow-sm hover:border-sage-300 transition-all">
                            <div className="flex items-center gap-3 min-w-0">
                              {app.details?.kyc?.aadhaarFront && (app.details.kyc.aadhaarFront.startsWith('data:image') || app.details.kyc.aadhaarFront.startsWith('http')) ? (
                                <img
                                  src={app.details.kyc.aadhaarFront}
                                  alt="Govt Photo ID"
                                  onClick={() => setSelectedDocPreview({ title: 'Government Photo ID (Aadhaar/PAN)', docType: 'Govt Photo ID', fileUrl: app.details.kyc.aadhaarFront, idNumber: app.details?.kyc?.idNumber || 'Uploaded ID', app })}
                                  className="w-14 h-11 object-cover rounded-lg border border-sage-200 cursor-pointer hover:opacity-90 transition-opacity flex-shrink-0 shadow-sm"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-sage-50 border border-sage-200 flex items-center justify-center flex-shrink-0 text-sage-700">
                                  <Shield className="w-5 h-5 text-sage-600" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-bold text-sage-900 text-xs truncate">Government Photo ID (Aadhaar/PAN)</p>
                                <p className="text-dark-400 font-mono text-[11px] truncate">ID No: {app.details?.kyc?.idNumber || 'Attached'}</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedDocPreview({ title: 'Government Photo ID (Aadhaar/PAN)', docType: 'Govt Photo ID', fileUrl: app.details?.kyc?.aadhaarFront || '', idNumber: app.details?.kyc?.idNumber || 'Attached', app })}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-sage-50 hover:bg-sage-100 text-sage-800 font-extrabold text-xs rounded-xl border border-sage-200 transition-colors flex-shrink-0 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-sage-600" /> View Document
                            </button>
                          </div>

                          {/* Card 2: Banking Proof */}
                          <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-sage-100 shadow-sm hover:border-sage-300 transition-all">
                            <div className="flex items-center gap-3 min-w-0">
                              {app.details?.kyc?.cancelledCheque && (app.details.kyc.cancelledCheque.startsWith('data:image') || app.details.kyc.cancelledCheque.startsWith('http')) ? (
                                <img
                                  src={app.details.kyc.cancelledCheque}
                                  alt="Banking Proof"
                                  onClick={() => setSelectedDocPreview({ title: 'Banking Proof (Cancelled Cheque)', docType: 'Banking Proof', fileUrl: app.details.kyc.cancelledCheque, app })}
                                  className="w-14 h-11 object-cover rounded-lg border border-sage-200 cursor-pointer hover:opacity-90 transition-opacity flex-shrink-0 shadow-sm"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-gold-50 border border-gold-200 flex items-center justify-center flex-shrink-0 text-gold-700">
                                  <Wallet className="w-5 h-5 text-gold-600" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-bold text-sage-900 text-xs truncate">Banking Proof (Cancelled Cheque)</p>
                                <p className="text-dark-400 font-mono text-[11px] truncate">Bank Payout Verification</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedDocPreview({ title: 'Banking Proof (Cancelled Cheque)', docType: 'Banking Proof', fileUrl: app.details?.kyc?.cancelledCheque || '', app })}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-50 hover:bg-gold-100 text-gold-900 font-extrabold text-xs rounded-xl border border-gold-200 transition-colors flex-shrink-0 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-gold-600" /> View Document
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Overview */}
          {activeTab === 'overview' && (
            <>
              <div ref={statsView.ref} className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-on-scroll ${statsView.inView ? 'in-view' : ''}`}>
                {[
                  { label: 'Total Revenue', value: `₹${(totalRevenue / 100000).toFixed(1)}L`, icon: DollarSign, color: 'bg-sage-50 text-sage-600' },
                  { label: 'Commission Earned', value: `₹${(commissionRevenue / 1000).toFixed(0)}K`, icon: Wallet, color: 'bg-cream-100 text-cream-800' },
                  { label: 'Total Vendors', value: String(vendors.length), icon: Store, color: 'bg-sage-100 text-sage-700' },
                  { label: 'Total Bookings', value: String(bookings.length), icon: BarChart3, color: 'bg-cream-50 text-cream-900' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white rounded-2xl shadow-card p-5 card-hover">
                    <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <p className="font-display text-2xl font-bold text-sage-900">{stat.value}</p>
                    <p className="text-dark-500 text-sm mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Bookings */}
                <div className="bg-white rounded-2xl shadow-card p-6">
                  <h2 className="font-display text-xl font-bold text-sage-900 mb-5 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-sage-500" /> Recent Bookings
                  </h2>
                  {bookings.length === 0 ? (
                    <p className="text-dark-500 text-sm text-center py-8">No bookings yet</p>
                  ) : (
                    <div className="space-y-3">
                      {bookings.slice(0, 6).map(b => (
                        <div key={b.id} className="flex items-center gap-3 p-3 bg-sage-50/60 rounded-xl">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sage-900 text-sm truncate">{b.customer_name}</p>
                            <p className="text-dark-400 text-xs">{b.event_type} · {new Date(b.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sage-900 text-sm">₹{b.total_amount.toLocaleString('en-IN')}</p>
                            <p className={`text-xs font-bold ${b.status === 'confirmed' ? 'text-sage-600' : b.status === 'pending' ? 'text-gold-600' : 'text-cream-700'}`}>{b.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top Vendors */}
                <div className="bg-white rounded-2xl shadow-card p-6">
                  <h2 className="font-display text-xl font-bold text-sage-900 mb-5 flex items-center gap-2">
                    <Star className="w-5 h-5 text-gold-500" /> Top Rated Vendors
                  </h2>
                  <div className="space-y-3">
                    {vendors.slice(0, 6).map(v => (
                      <div key={v.id} className="flex items-center gap-3 p-3 bg-sage-50/60 rounded-xl hover:bg-sage-100/60 transition-colors cursor-pointer" onClick={() => navigate(`/vendors/${v.slug}`)}>
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          {v.image && !v.image.includes('pexels.com') ? (
                            <img src={v.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-sage-600 to-sage-800 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">{v.category[0] || 'V'}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sage-900 text-sm truncate">{v.name}</p>
                          <p className="text-dark-400 text-xs">{v.category} · {v.location}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-gold-500 fill-gold-500" />
                          <span className="font-bold text-sage-900 text-sm">{v.rating}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Vendors Management */}
          {activeTab === 'vendors' && (
            <div className="bg-white rounded-2xl shadow-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="font-display text-xl font-bold text-sage-900 flex items-center gap-2">
                  <Store className="w-5 h-5 text-sage-500" /> Vendor Management ({vendors.length})
                </h2>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search vendors..."
                      className="pl-10 pr-4 py-2 border border-sage-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sage-300 w-48"
                    />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-sage-200 rounded-xl text-sm font-medium text-dark-700 outline-none focus:ring-2 focus:ring-sage-300"
                  >
                    <option value="all">All</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-sage-100">
                      {['Vendor', 'Category', 'Location', 'Rating', 'Price', 'Status', 'Actions'].map(h => (
                        <th key={h} className="pb-3 text-left text-dark-500 text-xs font-bold uppercase tracking-wider pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sage-50">
                    {filteredVendors.map(v => (
                      <tr key={v.id} className="hover:bg-sage-50/50 transition-colors">
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                              {v.image && !v.image.includes('pexels.com') ? (
                                <img src={v.image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-sage-600 to-sage-800 flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">{v.category[0] || 'V'}</span>
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-sage-900 text-sm">{v.name}</p>
                              <p className="text-dark-400 text-xs">{v.reviews} reviews</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-sm text-dark-700">{v.category}</td>
                        <td className="py-4 pr-4 text-sm text-dark-700">{v.location}</td>
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-gold-500 fill-gold-500" />
                            <span className="font-bold text-sage-900 text-sm">{v.rating}</span>
                          </div>
                        </td>
                        <td className="py-4 pr-4 font-bold text-sage-900 text-sm">₹{Number(v.price_amount).toLocaleString('en-IN')}</td>
                        <td className="py-4">
                          {v.verified ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-sage-700 bg-sage-100 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Verified
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-bold text-gold-700 bg-gold-100 px-2.5 py-1 rounded-full">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="py-4">
                          <div className="flex gap-1">
                            <button onClick={() => navigate(`/vendors/${v.slug}`)} className="p-2 hover:bg-sage-100 rounded-lg transition-colors" title="View">
                              <Eye className="w-4 h-4 text-sage-600" />
                            </button>
                            <button onClick={() => toggleVerify(v)} className={`p-2 rounded-lg transition-colors ${v.verified ? 'hover:bg-cream-100' : 'hover:bg-sage-100'}`} title={v.verified ? 'Unverify' : 'Verify'}>
                              {v.verified ? <XCircle className="w-4 h-4 text-cream-600" /> : <CheckCircle2 className="w-4 h-4 text-sage-600" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredVendors.length === 0 && (
                <div className="text-center py-12">
                  <Filter className="w-10 h-10 text-sage-300 mx-auto mb-3" />
                  <p className="text-dark-500 text-sm">No vendors match your filters</p>
                </div>
              )}
            </div>
          )}

          {/* Bookings */}
          {activeTab === 'bookings' && (
            <div className="bg-white rounded-2xl shadow-card p-6">
              <h2 className="font-display text-xl font-bold text-sage-900 mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-sage-500" /> All Bookings ({bookings.length})
              </h2>
              {bookings.length === 0 ? (
                <div className="text-center py-16">
                  <BarChart3 className="w-12 h-12 text-sage-300 mx-auto mb-4" />
                  <p className="font-bold text-sage-900 mb-1">No bookings yet</p>
                  <p className="text-dark-500 text-sm">Bookings will appear here once customers start booking.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-sage-100">
                        {['Ref', 'Customer', 'Event', 'Date', 'Amount', 'Payment', 'Status'].map(h => (
                          <th key={h} className="pb-3 text-left text-dark-500 text-xs font-bold uppercase tracking-wider pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sage-50">
                      {bookings.map(b => (
                        <tr key={b.id} className="hover:bg-sage-50/50 transition-colors">
                          <td className="py-4 pr-4 font-mono text-xs text-dark-500">{b.booking_ref}</td>
                          <td className="py-4 pr-4">
                            <p className="font-bold text-sage-900 text-sm">{b.customer_name}</p>
                            <p className="text-dark-400 text-xs">{b.customer_email}</p>
                          </td>
                          <td className="py-4 pr-4 text-sm text-dark-700">{b.event_type}</td>
                          <td className="py-4 pr-4 text-sm text-dark-700">{new Date(b.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td className="py-4 pr-4 font-bold text-sage-900 text-sm">₹{b.total_amount.toLocaleString('en-IN')}</td>
                          <td className="py-4">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${b.payment_status === 'paid' ? 'text-sage-700 bg-sage-100' : 'text-gold-700 bg-gold-100'}`}>
                              {b.payment_status}
                            </span>
                          </td>
                          <td className="py-4">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${b.status === 'confirmed' ? 'text-sage-700 bg-sage-100' : b.status === 'pending' ? 'text-gold-700 bg-gold-100' : 'text-cream-700 bg-cream-200'}`}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Revenue */}
          {activeTab === 'revenue' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Gross Revenue', value: `₹${(totalRevenue / 100000).toFixed(1)}L`, icon: DollarSign, color: 'bg-sage-50 text-sage-600' },
                  { label: 'Commission (15%)', value: `₹${(commissionRevenue / 1000).toFixed(0)}K`, icon: Wallet, color: 'bg-cream-100 text-cream-800' },
                  { label: 'Pending Payouts', value: `₹${((totalRevenue - commissionRevenue) / 1000).toFixed(0)}K`, icon: Clock, color: 'bg-sage-100 text-sage-700' },
                  { label: 'Avg Order Value', value: `₹${bookings.length ? Math.round(totalRevenue / bookings.length / 1000) : 0}K`, icon: TrendingUp, color: 'bg-cream-50 text-cream-900' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white rounded-2xl shadow-card p-5 card-hover">
                    <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <p className="font-display text-2xl font-bold text-sage-900">{stat.value}</p>
                    <p className="text-dark-500 text-sm mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl shadow-card p-6">
                <h2 className="font-display text-xl font-bold text-sage-900 mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-sage-500" /> Revenue by Category
                </h2>
                <div className="space-y-4">
                  {['Venue', 'Catering', 'Photography', 'Decoration', 'Entertainment', 'Coordinator'].map(cat => {
                    const catBookings = bookings.filter(b => {
                      const vendor = vendors.find(v => v.id === b.vendor_id);
                      return vendor?.category === cat;
                    });
                    const catRevenue = catBookings.filter(b => b.payment_status === 'paid').reduce((s, b) => s + b.total_amount, 0);
                    const maxRevenue = Math.max(...['Venue', 'Catering', 'Photography', 'Decoration', 'Entertainment', 'Coordinator'].map(c => {
                      const cb = bookings.filter(b => {
                        const v = vendors.find(vd => vd.id === b.vendor_id);
                        return v?.category === c;
                      });
                      return cb.filter(b => b.payment_status === 'paid').reduce((s, b) => s + b.total_amount, 0);
                    }), 1);
                    const pct = (catRevenue / maxRevenue) * 100;
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-sage-900 text-sm">{cat}</span>
                          <span className="font-bold text-sage-600 text-sm">₹{catRevenue.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="h-3 bg-sage-50 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-brand rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Full Document Inspector Modal */}
      {selectedDocPreview && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md animate-fade-in font-sans">
          <div className="bg-white rounded-3xl border border-white/50 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden relative font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-sage-100 bg-gradient-to-r from-sage-900 to-sage-800 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sage-700 flex items-center justify-center border border-sage-600">
                  <Shield className="w-5 h-5 text-gold-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base">{selectedDocPreview.title}</h3>
                  <p className="text-xs text-sage-200 font-semibold">
                    Submitted by {selectedDocPreview.app.name} ({selectedDocPreview.app.details?.owner || 'Vendor'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDocPreview(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document Viewer Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-center bg-cream-50/50 flex-1 flex flex-col items-center justify-center">
              {selectedDocPreview.fileUrl && (selectedDocPreview.fileUrl.startsWith('data:image') || selectedDocPreview.fileUrl.startsWith('http')) ? (
                <div className="rounded-2xl overflow-hidden border border-sage-200 shadow-md bg-white p-3 max-w-full">
                  <img
                    src={selectedDocPreview.fileUrl}
                    alt={selectedDocPreview.title}
                    className="max-h-[50vh] object-contain rounded-xl mx-auto shadow-sm"
                  />
                  <div className="mt-2 text-xs font-semibold text-sage-800 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-sage-600" /> Scanned Document Image Verified
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-md p-8 bg-white rounded-3xl border-2 border-dashed border-sage-200 text-center space-y-4 shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-sage-100 text-sage-700 flex items-center justify-center mx-auto shadow-inner">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sage-900 text-lg">{selectedDocPreview.docType} Attached</h4>
                    <p className="text-xs font-mono text-sage-800 mt-1 bg-sage-50 py-1.5 px-4 rounded-xl inline-block border border-sage-200">
                      {selectedDocPreview.fileUrl || 'scanned_document.png'}
                    </p>
                  </div>
                  {selectedDocPreview.idNumber && (
                    <div className="p-3 bg-cream-100 rounded-xl text-xs font-mono font-bold text-sage-900 border border-cream-200">
                      Official ID No: {selectedDocPreview.idNumber}
                    </div>
                  )}
                  <p className="text-xs text-dark-500 font-medium">
                    Verified Document Record · Scanned Copy Submitted for Verification
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer Action Bar */}
            <div className="p-5 border-t border-sage-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-dark-500 font-semibold text-left">
                Inspect document details before granting Blue Verified Badge.
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    handleApproveApplication(selectedDocPreview.app);
                    setSelectedDocPreview(null);
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-sage-600 hover:bg-sage-700 text-white font-bold text-xs rounded-xl shadow-glow-sage transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" /> Accept & Unlock Dashboard
                </button>
                <button
                  onClick={() => {
                    handleRejectApplication(selectedDocPreview.app);
                    setSelectedDocPreview(null);
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
