import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Upload, CheckCircle2, Clock, AlertCircle, Building, CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { VerifiedBadge } from '@/components/ui/verified-badge';

export function VerifyDocumentsPage() {
  const { kycStatus, kycRecord, submitKycDocuments, user } = useAuth();
  const { showToast } = useData();

  // Form State
  const [govtIdType, setGovtIdType] = useState('Aadhaar Card');
  const [govtIdNumber, setGovtIdNumber] = useState(
    kycRecord && kycRecord.govtIdNumber !== '5482 9912 3014' ? kycRecord.govtIdNumber : ''
  );
  const [businessRegNumber, setBusinessRegNumber] = useState(kycRecord?.businessRegNumber || '');

  // File Attachments (strictly null by default for new vendors until attached!)
  const [govtIdFile, setGovtIdFile] = useState<string | null>(
    kycRecord && kycRecord.govtIdFile && kycRecord.govtIdFile !== 'identity_document.png' ? kycRecord.govtIdFile : null
  );
  const [govtIdFileName, setGovtIdFileName] = useState<string>(
    kycRecord && kycRecord.govtIdFile && kycRecord.govtIdFile !== 'identity_document.png' ? 'Identity_Document.png' : ''
  );
  const [businessRegFile, setBusinessRegFile] = useState<string | null>(kycRecord?.businessRegFile || null);
  const [businessRegFileName, setBusinessRegFileName] = useState<string>(kycRecord?.businessRegFile ? 'Business_Certificate.png' : '');
  const [bankProofFile, setBankProofFile] = useState<string | null>(
    kycRecord && kycRecord.bankProofFile && kycRecord.bankProofFile !== 'cancelled_cheque.png' ? kycRecord.bankProofFile : null
  );
  const [bankProofFileName, setBankProofFileName] = useState<string>(
    kycRecord && kycRecord.bankProofFile && kycRecord.bankProofFile !== 'cancelled_cheque.png' ? 'Cancelled_Cheque.png' : ''
  );

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!govtIdNumber.trim()) {
      showToast('Please enter your Government ID number (e.g. Aadhaar or PAN ID)', 'error');
      return;
    }
    if (!govtIdFile) {
      showToast('Please upload your Government Photo ID document before submitting', 'error');
      return;
    }
    if (!bankProofFile) {
      showToast('Please upload your Banking Proof (Cancelled Cheque / Statement) before submitting', 'error');
      return;
    }

    const finalIdNumber = govtIdNumber.trim();
    const vendorName = user?.fullName || 'Vendor Partner';
    const bName = user?.businessName || `${vendorName} Events`;

    submitKycDocuments({
      govtIdType,
      govtIdNumber: finalIdNumber,
      govtIdFile: govtIdFile,
      businessRegNumber: businessRegNumber || undefined,
      businessRegFile: businessRegFile || undefined,
      bankProofFile: bankProofFile,
    });

    // PUSH NOTIFICATION & PENDING ENTRY FOR ADMIN DASHBOARD
    const adminNotifications = JSON.parse(localStorage.getItem('festivo_admin_notifications') || '[]');
    const newAdminNotif = {
      id: `AN-${Math.floor(100000 + Math.random() * 900000)}`,
      type: 'kyc_submitted',
      vendorId: `VND-${user.id || 'NEW'}`,
      vendorName: bName,
      message: `KYC documents submitted by "${bName}" (${vendorName}) for verification (${govtIdType}: ${finalIdNumber}).`,
      timestamp: new Date().toISOString(),
      read: false
    };
    localStorage.setItem('festivo_admin_notifications', JSON.stringify([newAdminNotif, ...adminNotifications]));

    const pendingList = JSON.parse(localStorage.getItem('festivo_pending_vendors') || '[]');
    const userEmailLower = (user?.email || '').toLowerCase().trim();
    const existingIndex = pendingList.findIndex((p: any) => 
      (p.details?.email && p.details.email.toLowerCase().trim() === userEmailLower) || 
      p.name === bName || 
      (p.id && p.id === user.id)
    );

    const kycVendorRecord = {
      id: user.id || `VND-${Date.now()}`,
      name: bName,
      category: user.category || 'Event Provider',
      location: user.location || 'Hyderabad, India',
      price_amount: 45000,
      price_label: 'Starting Package',
      price_unit: 'event',
      rating: 5.0,
      reviews: 1,
      image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800',
      logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=200',
      verified: false,
      badge: 'Pending Review',
      badge_color: 'bg-gold-500',
      slug: user.username || 'vendor-partner',
      details: {
        email: user.email || 'gowtham@tent.house',
        phone: user.phone || '+91 93475 67375',
        owner: vendorName,
        address: user.location || 'Hyderabad, India',
        registrationDate: new Date().toISOString().split('T')[0],
        status: 'Pending Verification',
        kyc: {
          idNumber: finalIdNumber,
          aadhaarFront: govtIdFile,
          cancelledCheque: bankProofFile
        }
      }
    };
    if (existingIndex >= 0) {
      pendingList[existingIndex] = kycVendorRecord;
    } else {
      pendingList.unshift(kycVendorRecord);
    }
    localStorage.setItem('festivo_pending_vendors', JSON.stringify(pendingList));
    window.dispatchEvent(new Event('storage'));

    showToast('KYC Documents Submitted! Status updated to Pending Review. Admin notified.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verify KYC Documents"
        subtitle="Upload government identity documents for verification & Blue Verification Badge issuance"
        icon={ShieldCheck}
      />

      {/* Verification Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glossy-panel relative overflow-hidden rounded-3xl border border-white/40 p-6 shadow-premium-lg backdrop-blur-xl"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-glow-sage',
                kycStatus === 'verified'
                  ? 'bg-gradient-to-br from-sage-500 to-sage-700'
                  : kycStatus === 'pending'
                  ? 'bg-gradient-to-br from-gold-400 to-gold-600'
                  : 'bg-gradient-to-br from-dark-500 to-dark-700',
              )}
            >
              {kycStatus === 'verified' && <VerifiedBadge size="lg" />}
              {kycStatus === 'pending' && <Clock className="h-7 w-7 animate-pulse" />}
              {kycStatus === 'unverified' && <AlertCircle className="h-7 w-7" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-dark-900 flex items-center gap-1.5">
                  {kycStatus === 'verified' && (
                    <>
                      KYC Verified & Official Blue Badge Granted <VerifiedBadge size="md" />
                    </>
                  )}
                  {kycStatus === 'pending' && 'Documents Submitted — Awaiting Review'}
                  {kycStatus === 'unverified' && 'Verification Required (Aadhaar/PAN Required)'}
                </h3>
                <span
                  className={cn(
                    'rounded-full px-3 py-0.5 text-xs font-extrabold capitalize border',
                    kycStatus === 'verified' && 'bg-sage-100 text-sage-800 border-sage-300',
                    kycStatus === 'pending' && 'bg-gold-100 text-gold-800 border-gold-300',
                    kycStatus === 'unverified' && 'bg-red-100 text-red-700 border-red-200',
                  )}
                >
                  {kycStatus}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {kycStatus === 'verified' && 'Your vendor studio is officially verified. The Blue Badge is live on your profile.'}
                {kycStatus === 'pending' && 'Your documents are currently in the approval queue. They will be inspected for verification.'}
                {kycStatus === 'unverified' && 'Government Photo ID & Banking Proof are required to submit for Admin review.'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Form Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Step 1: Mandatory Govt ID */}
        <div className="glossy-panel rounded-3xl border border-sage-300 p-6 shadow-premium flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-600 text-white font-bold shadow-sm">
                1
              </div>
              <div>
                <h4 className="font-bold text-dark-900 flex items-center gap-1">
                  Government Photo ID <span className="text-red-500">*</span>
                </h4>
                <p className="text-xs text-muted-foreground font-semibold">Mandatory for Verification</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-dark-700 mb-1">Select Document Type</label>
                <select
                  value={govtIdType}
                  onChange={e => setGovtIdType(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium focus:border-primary focus:outline-none"
                >
                  <option value="Aadhaar Card">Aadhaar Card (India)</option>
                  <option value="PAN Card">PAN Card (Tax ID)</option>
                  <option value="Passport">Passport</option>
                  <option value="Driver License">Driver's License</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-700 mb-1">ID Number</label>
                <input
                  required
                  placeholder="Enter Official ID Number (e.g. 5482 9912 3014)"
                  value={govtIdNumber}
                  onChange={e => setGovtIdNumber(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div className="pt-1">
                <label className="block text-xs font-semibold text-dark-700 mb-1">Upload Scanned Photo ID</label>
                <input
                  type="file"
                  id="govt-id-input"
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setGovtIdFileName(file.name);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setGovtIdFile(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div
                  onClick={() => document.getElementById('govt-id-input')?.click()}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-sage-300 bg-sage-50/40 p-4 text-center cursor-pointer hover:border-sage-500 hover:bg-sage-50 transition-colors"
                >
                  <Upload className="h-6 w-6 text-sage-600 mb-1" />
                  <span className="text-xs font-bold text-dark-900 truncate max-w-full px-2">
                    {govtIdFile ? (govtIdFileName || 'Identity_Document.png') : 'Click to Upload Front/Back Photo'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {govtIdFile ? (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-sage-100 p-2.5 text-xs font-bold text-sage-900 border border-sage-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-sage-700" /> Photo ID Attached
              </div>
              <button
                type="button"
                onClick={() => { setGovtIdFile(null); setGovtIdFileName(''); }}
                className="text-[11px] font-semibold text-red-600 hover:underline cursor-pointer"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-xs font-bold text-amber-800 border border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" /> Photo ID Not Uploaded Yet
            </div>
          )}
        </div>

        {/* Step 2: OPTIONAL Business Registration */}
        <div className="glossy-panel rounded-3xl border border-border p-6 shadow-premium flex flex-col justify-between opacity-95">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500 text-white font-bold shadow-sm">
                2
              </div>
              <div>
                <h4 className="font-bold text-dark-900 flex items-center gap-1.5">
                  Business Certificate <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-extrabold text-gold-800">OPTIONAL</span>
                </h4>
                <p className="text-xs text-muted-foreground">GST, MSME, or Trade License</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-dark-700 mb-1">GST Number (Optional)</label>
                <input
                  placeholder="e.g. 27ABCDE1234F1Z5 (Optional)"
                  value={businessRegNumber}
                  onChange={e => setBusinessRegNumber(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div className="pt-1">
                <label className="block text-xs font-semibold text-dark-700 mb-1">Upload Certificate (Optional)</label>
                <input
                  type="file"
                  id="business-reg-input"
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setBusinessRegFileName(file.name);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setBusinessRegFile(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div
                  onClick={() => document.getElementById('business-reg-input')?.click()}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-cream-50/50 p-4 text-center cursor-pointer hover:border-gold-400 hover:bg-gold-50/30 transition-colors"
                >
                  <Building className="h-6 w-6 text-gold-600 mb-1" />
                  <span className="text-xs font-bold text-dark-900 truncate max-w-full px-2">
                    {businessRegFile ? (businessRegFileName || 'Business_Certificate.png') : 'Click to Upload (Optional)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {businessRegFile ? (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-gold-100 p-2.5 text-xs font-bold text-gold-900 border border-gold-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-gold-700" /> Optional File Attached
              </div>
              <button
                type="button"
                onClick={() => { setBusinessRegFile(null); setBusinessRegFileName(''); }}
                className="text-[11px] font-semibold text-red-600 hover:underline cursor-pointer"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted p-2.5 text-xs font-semibold text-muted-foreground border border-border">
              <AlertCircle className="h-4 w-4" /> Optional (GST/MSME Certificate)
            </div>
          )}
        </div>

        {/* Step 3: Banking Proof */}
        <div className="glossy-panel rounded-3xl border border-border p-6 shadow-premium flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-600 text-white font-bold shadow-sm">
                3
              </div>
              <div>
                <h4 className="font-bold text-dark-900 flex items-center gap-1">
                  Banking Proof <span className="text-red-500">*</span>
                </h4>
                <p className="text-xs text-muted-foreground">Cancelled Cheque or Passbook</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Verifies account owner for instant payouts upon approval.
              </p>

              <div className="pt-1">
                <label className="block text-xs font-semibold text-dark-700 mb-1">Upload Bank Statement / Cheque</label>
                <input
                  type="file"
                  id="bank-proof-input"
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setBankProofFileName(file.name);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setBankProofFile(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div
                  onClick={() => document.getElementById('bank-proof-input')?.click()}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-sage-300 bg-sage-50/40 p-4 text-center cursor-pointer hover:border-sage-500 hover:bg-sage-50 transition-colors"
                >
                  <CreditCard className="h-6 w-6 text-sage-600 mb-1" />
                  <span className="text-xs font-bold text-dark-900 truncate max-w-full px-2">
                    {bankProofFile ? (bankProofFileName || 'Cancelled_Cheque.png') : 'Click to Upload Cheque'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {bankProofFile ? (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-sage-100 p-2.5 text-xs font-bold text-sage-900 border border-sage-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-sage-700" /> Bank Proof Attached
              </div>
              <button
                type="button"
                onClick={() => { setBankProofFile(null); setBankProofFileName(''); }}
                className="text-[11px] font-semibold text-red-600 hover:underline cursor-pointer"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-xs font-bold text-amber-800 border border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" /> Bank Proof Not Uploaded Yet
            </div>
          )}
        </div>
      </div>

      {/* Submission Action */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 pb-20 border-t border-border mt-8">
        <div className="text-left">
          <p className="font-bold text-dark-900 text-sm">Ready for Instant Verification?</p>
          <p className="text-xs text-muted-foreground">Click submit to send your attached documents to Festivo Platform Admin for review.</p>
        </div>
        <button
          type="button"
          onClick={() => handleSubmit()}
          className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-2xl bg-sage-600 px-8 py-4 text-base font-extrabold text-white shadow-glow-sage transition-all hover:bg-sage-700 hover:shadow-card-hover active:scale-95 cursor-pointer z-30"
        >
          <ShieldCheck className="h-5 w-5" /> Submit Documents for Review
        </button>
      </div>
    </div>
  );
}
