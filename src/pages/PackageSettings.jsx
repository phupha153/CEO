import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox"; // Added for FeatureSelector
import { toast } from "sonner";
import { Save, Package, DollarSign, Calendar, CreditCard, Building2, ArrowLeft, Crown, Check, AlertCircle, Plus, Edit, Trash2, RefreshCw, Loader2, Sparkles, Link2, X, Home, Filter, Globe, XCircle, Settings, Shield, CheckCircle, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO, addMonths } from "date-fns";
import { th } from "date-fns/locale";

// FeatureSelector component definition
const FeatureSelector = ({
  packageId,
  packageName,
  crmFeatures,
  currentFeatures,
  notes,
  onSave,
  onCancel,
  isSaving,
}) => {
  const [selectedFeatures, setSelectedFeatures] = useState(currentFeatures || []);
  const [internalNotes, setInternalNotes] = useState(notes || '');

  useEffect(() => {
    setSelectedFeatures(currentFeatures || []);
    setInternalNotes(notes || '');
  }, [packageId, currentFeatures, notes]); // Depend on packageId, currentFeatures, notes to re-initialize when package changes

  const handleFeatureToggle = (feature) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
    );
  };

  const handleSaveClick = () => {
    onSave(selectedFeatures, internalNotes);
  };

  return (
    <div className="space-y-6">
      <DialogDescription>
        เลือก Features ที่แพ็กเกจ "{packageName}" สามารถเข้าถึงได้จากรายการ Features ที่กำหนดใน CRM คุณยังสามารถเพิ่มบันทึกเพิ่มเติมได้
      </DialogDescription>
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">Features ที่กำหนดใน CRM ({crmFeatures.length})</h4>
        {crmFeatures.length === 0 ? (
          <p className="text-sm text-blue-700">แพ็กเกจนี้ไม่มี Features กำหนดใน CRM</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2">
            {crmFeatures.map((feature, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  id={`feature-${packageId}-${index}`}
                  checked={selectedFeatures.includes(feature)}
                  onCheckedChange={() => handleFeatureToggle(feature)}
                />
                <Label htmlFor={`feature-${packageId}-${index}`} className="text-sm cursor-pointer">
                  {feature}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="feature-notes">หมายเหตุ (ภายใน)</Label>
        <Textarea
          id="feature-notes"
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="บันทึกเพิ่มเติมเกี่ยวกับ features ของแพ็กเกจนี้..."
          rows={3}
        />
        <p className="text-xs text-slate-500 mt-1">บันทึกนี้จะแสดงเฉพาะในหน้าตั้งค่านี้เท่านั้น</p>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          ยกเลิก
        </Button>
        <Button onClick={handleSaveClick} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              บันทึก
            </>
          )}
        </Button>
      </div>
    </div>
  );
};


export default function PackageSettings() {
  const [activeTab, setActiveTab] = useState('company');
  const [showAddPackageDialog, setShowAddPackageDialog] = useState(false);
  const [showSetBranchPackageDialog, setShowSetBranchPackageDialog] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [crmError, setCrmError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [globalPackageId, setGlobalPackageId] = useState('');
  const [applyingGlobalPackage, setApplyingGlobalPackage] = useState(false);
  const [cancellingAllPackages, setCancellingAllPackages] = useState(false);
  const [editingFeaturePackage, setEditingFeaturePackage] = useState(null);
  const [showFeatureDialog, setShowFeatureDialog] = useState(false);
  const [showTestExpiryDialog, setShowTestExpiryDialog] = useState(false);
  const [testingExpiry, setTestingExpiry] = useState(false);
  const [testExpiryBranch, setTestExpiryBranch] = useState(null);
  
  // CRM Access Test
  const [testEmail, setTestEmail] = useState("");
  const [testingCRM, setTestingCRM] = useState(false);
  const [crmTestResult, setCrmTestResult] = useState(null);
  
  const [crmSettings, setCrmSettings] = useState({
    crm_app_id: '',
    crm_api_key: '',
    crm_webhook_url: '',
    crm_webhook_secret: ''
  });

  const [systemSettings, setSystemSettings] = useState({
    trial_days: '14',
    app_mode: 'single_tenant'
  });

  const [newPackageData, setNewPackageData] = useState({
    app_name: '',
    subscription_start_date: new Date().toISOString().split('T')[0],
    subscription_duration_months: '3',
    price_per_month: '',
    auto_renew: false,
    payment_status: 'pending',
    notes: ''
  });

  const [companyData, setCompanyData] = useState({
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_tax_id: '',
  });

  const [packageData, setPackageData] = useState({
    package_name: '',
    package_price: '',
    package_duration_months: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_name: '',
    promptpay: ''
  });

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const userAccessibleBranches = currentUser?.accessible_branches || [];

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');

  const { data: allBranches = [] } = useQuery({
    queryKey: ['branches', 'secure'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Branch',
        filters: {},
        limit: 500
      });
      return response.data.data;
    },
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers', 'secure'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'User',
        filters: {},
        limit: 500
      });
      return response.data.data;
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // กรองสาขาที่ผู้ใช้มีสิทธิ์เข้าถึง
  const branches = React.useMemo(() => {
    if (userRole === 'developer') return allBranches;
    return allBranches.filter(branch => userAccessibleBranches.includes(branch.id));
  }, [allBranches, userRole, userAccessibleBranches]);

  const { data: allSubscriptions = [] } = useQuery({
    queryKey: ['appSubscriptions'],
    queryFn: () => base44.entities.AppSubscription.list('-created_date', 50),
  });

  // แสดงทั้งหมด - ไม่กรองซ้ำ
  const subscriptions = React.useMemo(() => {
    // เรียงตาม created_date ใหม่สุดไปเก่าสุด
    return [...allSubscriptions].sort((a, b) => {
      try {
        const dateA = parseISO(a.created_date);
        const dateB = parseISO(b.created_date);
        return dateB.getTime() - dateA.getTime();
      } catch {
        return 0;
      }
    });
  }, [allSubscriptions]);

  // ดึงแพ็กเกจจาก CRM
  const { data: crmPackages, isLoading: loadingCrmPackages, refetch: refetchCrmPackages, error: crmQueryError } = useQuery({
    queryKey: ['crmPackages'],
    queryFn: async () => {
      setCrmError(null);
      try {
        const response = await base44.functions.invoke('getPackagesFromCRM', {});
        
        if (response.data && response.data.error) {
          setCrmError(response.data.error);
          return { packages: [], active_subscriptions: [] }; 
        }
        
        return response.data;
      } catch (error) {
        const errorMsg = error.response?.data?.error || error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ CRM';
        setCrmError(errorMsg);
        return { packages: [], active_subscriptions: [] }; 
      }
    },
    retry: false,
    staleTime: 2 * 60 * 1000,
  });

  // ดึง BranchPackage
  const { data: branchPackages = [] } = useQuery({
    queryKey: ['branchPackages'],
    queryFn: () => base44.entities.BranchPackage.list('-created_date', 200),
  });

  // เพิ่ม query สำหรับ PackageFeatureConfig
  const { data: featureConfigs = [] } = useQuery({
    queryKey: ['packageFeatureConfigs'],
    queryFn: () => base44.entities.PackageFeatureConfig.list(),
  });

  const isDeveloper = userRole === 'developer';

  useEffect(() => {
    if (configs.length > 0) {
      const getConfigValue = (key, defaultValue = '') => {
        const config = configs.find(c => c.key === key && !c.branch_id);
        return config?.value || defaultValue;
      };

      setCompanyData({
        company_name: getConfigValue('company_name', ''),
        company_address: getConfigValue('company_address', ''),
        company_phone: getConfigValue('company_phone', ''),
        company_email: getConfigValue('company_email', ''),
        company_tax_id: getConfigValue('company_tax_id', ''),
      });

      setPackageData({
        package_name: getConfigValue('package_name', 'Elite Package'),
        package_price: getConfigValue('package_price', '2490'),
        package_duration_months: getConfigValue('package_duration_months', '3'),
        bank_name: getConfigValue('bank_name', ''),
        bank_account_number: getConfigValue('bank_account_number', ''),
        bank_account_name: getConfigValue('bank_account_name', ''),
        promptpay: getConfigValue('promptpay', '')
      });

      setCrmSettings({
        crm_app_id: getConfigValue('crm_app_id', ''),
        crm_api_key: getConfigValue('crm_api_key', ''),
        crm_webhook_url: getConfigValue('crm_webhook_url', 'https://ta-01ka6m9nmbv7qt4nfa6hkghhyy-5173.wo-eqi13toh5dnga3zgg8fg4pukt.w.modal.host/api/addCustomerWebhook'),
        crm_webhook_secret: getConfigValue('crm_webhook_secret', 'crm_8swg3i4zy9rpk8ysf6q')
      });

      setSystemSettings({
        trial_days: getConfigValue('trial_days', '14'),
        app_mode: getConfigValue('app_mode', 'single_tenant')
      });

      setGlobalPackageId(getConfigValue('global_package_id', ''));
    }
  }, [configs]);

  const updateConfigMutation = useMutation({
    mutationFn: async (updates) => {
      const promises = updates.map(({ key, value }) => {
        const existing = configs.find(c => c.key === key && !c.branch_id);
        if (existing) {
          return base44.entities.Config.update(existing.id, { value });
        } else {
          return base44.entities.Config.create({
            key,
            value,
            branch_id: null,
            value_type: 'string',
            category: 'general'
          });
        }
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configs'] });
      toast.success('บันทึกการตั้งค่าสำเร็จ');
    },
    onError: () => {
      toast.error('บันทึกการตั้งค่าไม่สำเร็จ');
    }
  });

  const createPackageMutation = useMutation({
    mutationFn: async (data) => {
      const startDate = parseISO(data.subscription_start_date);
      const endDate = addMonths(startDate, parseInt(data.subscription_duration_months));
      const pricePerMonth = parseFloat(data.price_per_month);
      const totalPrice = pricePerMonth * parseInt(data.subscription_duration_months);

      return base44.entities.AppSubscription.create({
        app_name: data.app_name,
        subscription_start_date: data.subscription_start_date,
        subscription_end_date: endDate.toISOString().split('T')[0],
        subscription_duration_months: parseInt(data.subscription_duration_months),
        price_per_month: pricePerMonth,
        total_price: totalPrice,
        status: 'active',
        auto_renew: data.auto_renew,
        payment_status: data.payment_status,
        notes: data.notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSubscriptions'] });
      toast.success('เพิ่มแพ็กเกจสำเร็จ');
      setShowAddPackageDialog(false);
      setNewPackageData({
        app_name: '',
        subscription_start_date: new Date().toISOString().split('T')[0],
        subscription_duration_months: '3',
        price_per_month: '',
        auto_renew: false,
        payment_status: 'pending',
        notes: ''
      });
    },
    onError: (error) => {
      toast.error('เพิ่มแพ็กเกจไม่สำเร็จ: ' + error.message);
    }
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      return base44.entities.AppSubscription.update(id, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSubscriptions'] });
      toast.success('อัปเดตสถานะสำเร็จ');
    }
  });

  const deleteSubscriptionMutation = useMutation({
    mutationFn: async (id) => {
      return base44.entities.AppSubscription.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSubscriptions'] });
      toast.success('ลบแพ็กเกจสำเร็จ');
    }
  });

  const deleteAllTrialsMutation = useMutation({
    mutationFn: async () => {
      const trialSubs = allSubscriptions.filter(s => s.status === 'trial');
      const promises = trialSubs.map(sub => base44.entities.AppSubscription.delete(sub.id));
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSubscriptions'] });
      toast.success('ลบ Trial ทั้งหมดสำเร็จ');
    },
    onError: (error) => {
      toast.error('ลบไม่สำเร็จ: ' + error.message);
    }
  });

  const deleteAllSubscriptionsMutation = useMutation({
    mutationFn: async () => {
      const promises = allSubscriptions.map(sub => base44.entities.AppSubscription.delete(sub.id));
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSubscriptions'] });
      toast.success('ลบทั้งหมดสำเร็จ');
    },
    onError: (error) => {
      toast.error('ลบไม่สำเร็จ: ' + error.message);
    }
  });

  const testExpiryMutation = useMutation({
    mutationFn: async (branchId) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expiredDate = yesterday.toISOString().split('T')[0];

      const appModeConfig = configs.find(c => c.key === 'app_mode' && !c.branch_id);
      const currentAppMode = appModeConfig?.value || 'single_tenant';

      if (currentAppMode === 'multi_tenant' && branchId) {
        // หมดอายุเฉพาะ BranchPackage ของสาขาที่เลือก
        const branchPackage = branchPackages.find(bp => bp.branch_id === branchId && bp.status === 'active');
        if (branchPackage) {
          return base44.entities.BranchPackage.update(branchPackage.id, {
            subscription_end_date: expiredDate,
            status: 'active' // ยังคงเป็น active แต่วันหมดอายุเป็นเมื่อวาน
          });
        }
        throw new Error('ไม่พบแพ็กเกจที่ active สำหรับสาขานี้');
      } else {
        // หมดอายุ AppSubscription ที่ active หรือ trial
        const activeOrTrialSubs = allSubscriptions.filter(s => s.status === 'active' || s.status === 'trial');
        const promises = activeOrTrialSubs.map(sub =>
          base44.entities.AppSubscription.update(sub.id, {
            subscription_end_date: expiredDate,
            trial_end_date: sub.status === 'trial' ? expiredDate : sub.trial_end_date
          })
        );
        return Promise.all(promises);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSubscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['branchPackages'] });
      toast.success('ตั้งค่าแพ็กเกจให้หมดอายุสำเร็จ - กรุณารีเฟรชหน้าเพื่อดูผล');
      setShowTestExpiryDialog(false);
      setTestExpiryBranch(null);
      setTestingExpiry(false);
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
      setTestingExpiry(false);
    }
  });

  const setBranchPackageMutation = useMutation({
    mutationFn: async ({ branchId, packageId, packageName, pricePerMonth, features }) => {
      const startDate = new Date();
      const endDate = addMonths(startDate, 3);

      const existing = branchPackages.find(bp => bp.branch_id === branchId);
      
      if (existing) {
        return base44.entities.BranchPackage.update(existing.id, {
          package_id: packageId,
          package_name: packageName,
          subscription_start_date: startDate.toISOString().split('T')[0],
          subscription_end_date: endDate.toISOString().split('T')[0],
          status: 'active',
          price_per_month: pricePerMonth,
          features: features || []
        });
      } else {
        return base44.entities.BranchPackage.create({
          branch_id: branchId,
          package_id: packageId,
          package_name: packageName,
          subscription_start_date: startDate.toISOString().split('T')[0],
          subscription_end_date: endDate.toISOString().split('T')[0],
          status: 'active',
          price_per_month: pricePerMonth,
          features: features || []
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branchPackages'] });
      toast.success('ตั้งค่าแพ็กเกจสาขาสำเร็จ');
      setShowSetBranchPackageDialog(false);
      setSelectedBranch(null);
      setSelectedPackage(null);
    },
    onError: (error) => {
      toast.error('ตั้งค่าแพ็กเกจไม่สำเร็จ: ' + error.message);
    }
  });

  const cancelBranchPackageMutation = useMutation({
    mutationFn: async (branchPackageId) => {
      return base44.entities.BranchPackage.update(branchPackageId, {
        status: 'cancelled'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branchPackages'] });
      toast.success('ยกเลิกแพ็กเกจสำเร็จ');
    },
    onError: (error) => {
      toast.error('ยกเลิกแพ็กเกจไม่สำเร็จ: ' + error.message);
    }
  });

  // เพิ่ม mutation สำหรับจัดการ features
  const saveFeatureConfigMutation = useMutation({
    mutationFn: async ({ packageId, packageName, enabledFeatures, notes }) => {
      const existing = featureConfigs.find(fc => fc.package_id === packageId);
      
      if (existing) {
        return base44.entities.PackageFeatureConfig.update(existing.id, {
          enabled_features: enabledFeatures,
          notes: notes || ''
        });
      } else {
        return base44.entities.PackageFeatureConfig.create({
          package_id: packageId,
          package_name: packageName,
          enabled_features: enabledFeatures,
          notes: notes || ''
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packageFeatureConfigs'] });
      toast.success('บันทึกการตั้งค่า Features สำเร็จ');
      setShowFeatureDialog(false);
      setEditingFeaturePackage(null);
    },
    onError: (error) => {
      toast.error('บันทึกไม่สำเร็จ: ' + error.message);
    }
  });

  const handleSaveCompany = () => {
    const updates = Object.entries(companyData).map(([key, value]) => ({
      key,
      value: String(value)
    }));
    updateConfigMutation.mutate(updates);
  };

  const handleSaveSystemSettings = () => {
    const updates = Object.entries(systemSettings).map(([key, value]) => ({
      key,
      value: String(value)
    }));
    updateConfigMutation.mutate(updates);
  };

  const handleSavePackage = () => {
    const updates = Object.entries(packageData).map(([key, value]) => ({
      key,
      value: String(value)
    }));
    updateConfigMutation.mutate(updates);
  };

  const handleSaveCrmSettings = () => {
    const updates = Object.entries(crmSettings).map(([key, value]) => ({
      key,
      value: String(value)
    }));
    updateConfigMutation.mutate(updates);
  };

  const handleAddPackage = () => {
    createPackageMutation.mutate(newPackageData);
  };

  const handleSetBranchPackage = () => {
    if (!selectedBranch || !selectedPackage) {
      toast.error('กรุณาเลือกสาขาและแพ็กเกจ');
      return;
    }

    const price = selectedPackage.price_monthly || 0;

    setBranchPackageMutation.mutate({
      branchId: selectedBranch,
      packageId: selectedPackage.id,
      packageName: selectedPackage.package_name || selectedPackage.name,
      pricePerMonth: price,
      features: selectedPackage.features || []
    });
  };

  const handleCancelBranchPackage = (branchPackage) => {
    if (!confirm(`คุณต้องการยกเลิกแพ็กเกจ "${branchPackage.package_name}" ของสาขานี้?`)) {
      return;
    }
    cancelBranchPackageMutation.mutate(branchPackage.id);
  };

  const handleCancelNonEliteBranchPackages = async () => {
    // ยกเลิกแพ็กเกจที่ไม่ใช่ Elite (ราคาน้อยกว่า Elite หรือเป็น Trial)
    const nonElitePackages = branchPackages.filter(bp => 
      bp.status === 'active' && 
      (bp.package_id === 'trial' || !bp.package_name?.toLowerCase().includes('elite'))
    );
    
    if (nonElitePackages.length === 0) {
      toast.error('ไม่มีแพ็กเกจที่ไม่ใช่ Elite');
      return;
    }

    if (!confirm(`คุณต้องการยกเลิกแพ็กเกจที่ไม่ใช่ Elite ทั้งหมด (${nonElitePackages.length} แพ็กเกจ) หรือไม่?\n\nแพ็กเกจที่จะถูกยกเลิก:\n${nonElitePackages.map(p => `- ${p.package_name}`).join('\n')}`)) {
      return;
    }

    setCancellingAllPackages(true);

    try {
      const promises = nonElitePackages.map(pkg => 
        base44.entities.BranchPackage.update(pkg.id, { status: 'cancelled' })
      );

      await Promise.all(promises);

      queryClient.invalidateQueries({ queryKey: ['branchPackages'] });
      toast.success(`ยกเลิกแพ็กเกจที่ไม่ใช่ Elite สำเร็จ (${nonElitePackages.length} แพ็กเกจ)`);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setCancellingAllPackages(false);
    }
  };

  const handleCancelAllBranchPackages = async () => {
    const activePackages = branchPackages.filter(bp => bp.status === 'active');
    
    if (activePackages.length === 0) {
      toast.error('ไม่มีแพ็กเกจที่ใช้งานอยู่');
      return;
    }

    if (!confirm(`คุณต้องการยกเลิกแพ็กเกจทั้งหมด (${activePackages.length} แพ็กเกจ) ของทุกสาขาหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`)) {
      return;
    }

    setCancellingAllPackages(true);

    try {
      const promises = activePackages.map(pkg => 
        base44.entities.BranchPackage.update(pkg.id, { status: 'cancelled' })
      );

      await Promise.all(promises);

      queryClient.invalidateQueries({ queryKey: ['branchPackages'] });
      toast.success(`ยกเลิกแพ็กเกจทั้งหมดสำเร็จ (${activePackages.length} แพ็กเกจ)`);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการยกเลิกแพ็กเกจ: ' + error.message);
    } finally {
      setCancellingAllPackages(false);
    }
  };

  const handleApplyGlobalPackage = async () => {
    if (!globalPackageId) {
      toast.error('กรุณาเลือกแพ็กเกจ');
      return;
    }

    const selectedPkg = packages.find(p => p.id === globalPackageId);
    if (!selectedPkg) {
      toast.error('ไม่พบแพ็กเกจที่เลือก');
      return;
    }

    if (!confirm(`คุณต้องการกำหนดแพ็กเกจ "${selectedPkg.package_name}" ให้กับทุกสาขา (${branches.length} สาขา)? การดำเนินการนี้จะแทนที่แพ็กเกจปัจจุบันของทุกสาขา`)) {
      return;
    }

    setApplyingGlobalPackage(true);

    try {
      const price = selectedPkg.price_monthly || 0;
      const startDate = new Date();
      const endDate = addMonths(startDate, 3);

      const promises = branches.map(branch => {
        const existing = branchPackages.find(bp => bp.branch_id === branch.id);
        
        if (existing) {
          return base44.entities.BranchPackage.update(existing.id, {
            package_id: selectedPkg.id,
            package_name: selectedPkg.package_name,
            subscription_start_date: startDate.toISOString().split('T')[0],
            subscription_end_date: endDate.toISOString().split('T')[0],
            status: 'active',
            price_per_month: price,
            features: selectedPkg.features || []
          });
        } else {
          return base44.entities.BranchPackage.create({
            branch_id: branch.id,
            package_id: selectedPkg.id,
            package_name: selectedPkg.package_name,
            subscription_start_date: startDate.toISOString().split('T')[0],
            subscription_end_date: endDate.toISOString().split('T')[0],
            status: 'active',
            price_per_month: price,
            features: selectedPkg.features || []
          });
        }
      });

      await Promise.all(promises);

      // บันทึก global_package_id ใน Config
      await updateConfigMutation.mutateAsync([{
        key: 'global_package_id',
        value: globalPackageId
      }]);

      queryClient.invalidateQueries({ queryKey: ['branchPackages'] });
      toast.success(`กำหนดแพ็กเกจให้ทุกสาขาสำเร็จ (${branches.length} สาขา)`);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setApplyingGlobalPackage(false);
    }
  };

  const getBranchPackage = (branchId) => {
    return branchPackages.find(bp => bp.branch_id === branchId && bp.status === 'active');
  };

  const getBranchOwner = (branchId) => {
    const branch = allBranches.find(b => b.id === branchId);
    if (!branch) return null;
    
    // หาผู้ใช้ที่สร้างสาขา (จาก created_by)
    const owner = allUsers.find(u => u.email === branch.created_by);
    return owner?.full_name || branch.created_by || 'ไม่ระบุ';
  };

  const priceBeforeVAT = parseFloat(packageData.package_price) || 0;
  const vat = priceBeforeVAT * 0.07;
  const totalWithVAT = priceBeforeVAT + vat;

  const packages = crmPackages?.packages || [];
  const activeSubscriptions = crmPackages?.active_subscriptions || [];

  // Filter packages by category
  const filteredPackages = packages.filter(pkg => {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'accommodation') return pkg.app_system === 'dormitory';
    if (categoryFilter === 'other') return pkg.app_system !== 'dormitory';
    return true;
  });

  // Count packages by category
  const accommodationCount = packages.filter(p => p.app_system === 'dormitory').length;
  const otherCount = packages.filter(p => p.app_system !== 'dormitory').length;

  // Count active packages for all branches
  const activePackagesCount = branchPackages.filter(bp => bp.status === 'active').length;

  const handleTestCRMAccess = async () => {
    setTestingCRM(true);
    setCrmTestResult(null);

    try {
      // ⭐ ส่ง email parameter ไปด้วย (ถ้าไม่มีจะใช้อีเมลตัวเอง)
      const response = await base44.functions.invoke('checkCRMAccess', { 
        email: testEmail || undefined 
      });
      setCrmTestResult(response.data);
      
      if (response.data.hasAccess) {
        toast.success('✅ มีสิทธิ์เข้าใช้งาน');
      } else {
        toast.error('❌ ไม่มีสิทธิ์เข้าใช้งาน');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
      setCrmTestResult({ error: error.message });
    } finally {
      setTestingCRM(false);
    }
  };

  const handleTestWebhook = async () => {
    setTestingCRM(true);
    setCrmTestResult(null);

    try {
      const testPayload = {
        event_type: "subscription_payment",
        customer_email: testEmail || currentUser?.email || "test@example.com",
        customer_name: "ทดสอบระบบ",
        package_id: "test_package",
        package_name: "Test Package",
        subscription_start_date: new Date().toISOString().split('T')[0],
        subscription_end_date: new Date(Date.now() + 90*24*60*60*1000).toISOString().split('T')[0],
        duration_months: 3,
        price_per_month: 500,
        total_amount: 1500,
        verified_amount: 1500,
        payment_date: new Date().toISOString().split('T')[0],
        slip_url: "https://example.com/test-slip.jpg",
        sender_name: "ทดสอบระบบ",
        sender_account: "xxx-x-12345-x",
        receiver_account: "123-4-56789-0",
        receiver_name: "บริษัททดสอบ",
        app_mode: systemSettings.app_mode,
        branch_ids: branches.map(b => b.id),
        branch_id: null,
        test_mode: true,
        timestamp: new Date().toISOString()
      };

      const response = await base44.functions.invoke('sendSubscriptionToCRM', testPayload);
      
      if (response.data?.success) {
        toast.success('✅ ส่งข้อมูลไป CRM สำเร็จ!');
        setCrmTestResult({
          hasAccess: true,
          message: '✅ CRM รับข้อมูลสำเร็จ',
          debug: {
            webhookResponse: response.data,
            sentPayload: testPayload
          }
        });
      } else {
        toast.error('❌ CRM ตอบกลับ Error: ' + (response.data?.error || 'Unknown error'));
        setCrmTestResult({
          hasAccess: false,
          error: response.data?.error || 'Unknown error',
          debug: {
            webhookResponse: response.data,
            sentPayload: testPayload
          }
        });
      }
    } catch (error) {
      toast.error('❌ ส่งข้อมูลไป CRM ไม่สำเร็จ: ' + error.message);
      setCrmTestResult({ 
        hasAccess: false,
        error: error.message 
      });
    } finally {
      setTestingCRM(false);
    }
  };


  if (!isDeveloper) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <Package className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-slate-600 mb-4">
              หน้านี้สำหรับผู้พัฒนาระบบเท่านั้น
            </p>
            <Button onClick={() => navigate(createPageUrl('Dashboard'))}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับหน้าหลัก
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50">
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-200 py-4 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button
              onClick={() => navigate(createPageUrl('Dashboard'))}
              variant="ghost"
              size="icon"
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                <Crown className="w-6 h-6 text-indigo-600" />
                ตั้งค่าระบบ (Developer)
              </h1>
              <p className="text-slate-500 mt-1">จัดการบัญชีบริษัท แพ็กเกจ และ CRM</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b overflow-x-auto bg-white/80 backdrop-blur-xl p-2 rounded-t-2xl">
            <Button 
              variant={activeTab === 'system' ? 'default' : 'ghost'} 
              onClick={() => setActiveTab('system')}
              className={activeTab === 'system' ? 'bg-indigo-600' : ''}
            >
              <Settings className="w-4 h-4 mr-2" />
              ตั้งค่าระบบ
            </Button>
            <Button 
              variant={activeTab === 'company' ? 'default' : 'ghost'} 
              onClick={() => setActiveTab('company')}
              className={activeTab === 'company' ? 'bg-blue-600' : ''}
            >
              <Building2 className="w-4 h-4 mr-2" />
              ข้อมูลรับชำระแพ็กเกจ
            </Button>
            <Button 
              variant={activeTab === 'package' ? 'default' : 'ghost'} 
              onClick={() => setActiveTab('package')}
              className={activeTab === 'package' ? 'bg-blue-600' : ''}
            >
              <Package className="w-4 h-4 mr-2" />
              ตั้งค่าแพ็กเกจ
            </Button>
            <Button 
              variant={activeTab === 'crm_connection' ? 'default' : 'ghost'} 
              onClick={() => setActiveTab('crm_connection')}
              className={activeTab === 'crm_connection' ? 'bg-blue-600' : ''}
            >
              <Link2 className="w-4 h-4 mr-2" />
              เชื่อมต่อ CRM
            </Button>
            <Button 
              variant={activeTab === 'branches' ? 'default' : 'ghost'} 
              onClick={() => setActiveTab('branches')}
              className={activeTab === 'branches' ? 'bg-blue-600' : ''}
            >
              <Crown className="w-4 h-4 mr-2" />
              แพ็กเกจสาขา
            </Button>
            <Button 
              variant={activeTab === 'crm' ? 'default' : 'ghost'} 
              onClick={() => setActiveTab('crm')}
              className={activeTab === 'crm' ? 'bg-blue-600' : ''}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              แพ็กเกจจาก CRM
            </Button>
            <Button 
              variant={activeTab === 'features' ? 'default' : 'ghost'} 
              onClick={() => setActiveTab('features')}
              className={activeTab === 'features' ? 'bg-blue-600' : ''}
            >
              <Crown className="w-4 h-4 mr-2" />
              จัดการ Features
            </Button>
            <Button 
              variant={activeTab === 'crm_test' ? 'default' : 'ghost'} 
              onClick={() => setActiveTab('crm_test')}
              className={activeTab === 'crm_test' ? 'bg-green-600' : ''}
            >
              <Shield className="w-4 h-4 mr-2" />
              ทดสอบ CRM
            </Button>
          </div>

          {/* System Settings Tab */}
          {activeTab === 'system' && (
            <Card className="bg-white/80 backdrop-blur-xl shadow-xl border-white/60">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-600" />
                    ตั้งค่าระบบทั่วไป
                  </CardTitle>
                  <Button
                    onClick={handleSaveSystemSettings}
                    disabled={updateConfigMutation.isPending}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    บันทึก
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>ระยะเวลาทดลองใช้ (วัน)</Label>
                    <Input
                      type="number"
                      value={systemSettings.trial_days}
                      onChange={(e) => setSystemSettings({ ...systemSettings, trial_days: e.target.value })}
                      placeholder="14"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      จำนวนวันที่ผู้ใช้ใหม่สามารถทดลองใช้งานได้ฟรี
                    </p>
                  </div>

                  <div>
                    <Label>โหมดแอพพลิเคชั่น</Label>
                    <Select 
                      value={systemSettings.app_mode} 
                      onValueChange={(value) => setSystemSettings({ ...systemSettings, app_mode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single_tenant">ลูกค้า 1 คน (แพ็กเกจใช้ได้ทุกสาขา)</SelectItem>
                        <SelectItem value="multi_tenant">หลายคน (แพ็กเกจเฉพาะสาขา)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1">
                      {systemSettings.app_mode === 'single_tenant' 
                        ? '✅ เจ้าของ 1 คนใช้ทุกสาขา - เมื่อซื้อแพ็กเกจจะใช้ได้ทั้งระบบ' 
                        : '👥 หลายเจ้าของ - เมื่อซื้อแพ็กเกจจะใช้ได้เฉพาะสาขาที่เลือก'}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                  <h4 className="font-semibold text-slate-800 mb-2">ค่าที่กำหนดอยู่:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">ทดลองใช้:</span>
                      <p className="font-bold text-indigo-600 text-lg">{systemSettings.trial_days} วัน</p>
                    </div>
                    <div>
                      <span className="text-slate-600">โหมด:</span>
                      <p className="font-bold text-purple-600 text-sm">
                        {systemSettings.app_mode === 'single_tenant' ? '👤 ลูกค้า 1 คน' : '👥 หลายคน'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-amber-800">
                      <p className="font-semibold mb-2">⚠️ สำคัญ:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li><strong>Single Tenant:</strong> เหมาะกับเจ้าของหอพักที่มีหลายสาขา - ซื้อครั้งเดียวใช้ได้ทั้งระบบ</li>
                        <li><strong>Multi Tenant:</strong> เหมาะกับการให้บริการหลายหอพัก - แต่ละหอซื้อแพ็กเกจแยกกัน</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Company Tab */}
          {activeTab === 'company' && (
            <Card className="bg-white/80 backdrop-blur-xl shadow-xl border-white/60">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    ข้อมูลบริษัทสำหรับรับชำระเงินแพ็กเกจ
                  </CardTitle>
                  <Button
                    onClick={handleSaveCompany}
                    disabled={updateConfigMutation.isPending}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    บันทึก
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>ชื่อบริษัท</Label>
                    <Input
                      value={companyData.company_name}
                      onChange={(e) => setCompanyData({ ...companyData, company_name: e.target.value })}
                      placeholder="บริษัท เอบีซี จำกัด"
                    />
                  </div>

                  <div>
                    <Label>เลขประจำตัวผู้เสียภาษี</Label>
                    <Input
                      value={companyData.company_tax_id}
                      onChange={(e) => setCompanyData({ ...companyData, company_tax_id: e.target.value })}
                      placeholder="0123456789012"
                    />
                  </div>

                  <div>
                    <Label>เบอร์โทรศัพท์</Label>
                    <Input
                      value={companyData.company_phone}
                      onChange={(e) => setCompanyData({ ...companyData, company_phone: e.target.value })}
                      placeholder="02-123-4567"
                    />
                  </div>

                  <div>
                    <Label>อีเมล</Label>
                    <Input
                      type="email"
                      value={companyData.company_email}
                      onChange={(e) => setCompanyData({ ...companyData, company_email: e.target.value })}
                      placeholder="info@company.com"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label>ที่อยู่บริษัท</Label>
                    <Textarea
                      value={companyData.company_address}
                      onChange={(e) => setCompanyData({ ...companyData, company_address: e.target.value })}
                      placeholder="123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs text-blue-800">
                    💡 <strong>หมายเหตุ:</strong> ข้อมูลนี้จะใช้ตอนที่ลูกค้า (เจ้าของหอพัก) ซื้อแพ็กเกจจากคุณ - ไม่เกี่ยวกับข้อมูลหอพักของลูกค้า
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CRM Connection Tab */}
          {activeTab === 'crm_connection' && (
            <Card className="bg-white/80 backdrop-blur-xl shadow-xl border-white/60">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-indigo-600" />
                    การเชื่อมต่อกับ CRM
                  </CardTitle>
                  <Button
                    onClick={handleSaveCrmSettings}
                    disabled={updateConfigMutation.isPending}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    บันทึก
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Link2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 mb-1">เชื่อมต่อกับ CRM</h4>
                      <p className="text-sm text-slate-600">
                        กรอกข้อมูล API ของ CRM เพื่อดึงแพ็กเกจและส่งข้อมูลการชำระเงินอัตโนมัติ
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>CRM App ID *</Label>
                    <Input
                      value={crmSettings.crm_app_id}
                      onChange={(e) => setCrmSettings({ ...crmSettings, crm_app_id: e.target.value })}
                      placeholder="6919c20da0265436aaa1f2d8"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      ดูจาก URL ของ CRM: https://app.base44.com/api/apps/<strong>[APP_ID]</strong>/entities/Package
                    </p>
                  </div>

                  <div>
                    <Label>CRM API Key *</Label>
                    <Input
                      type="password"
                      value={crmSettings.crm_api_key}
                      onChange={(e) => setCrmSettings({ ...crmSettings, crm_api_key: e.target.value })}
                      placeholder="bd933b03966e4126947c1b823e75a19c"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      API Key สำหรับเข้าถึง CRM (ดูจาก JavaScript Example ในรูป - Service Role Key)
                    </p>
                  </div>

                  <div>
                    <Label>CRM Webhook URL</Label>
                    <Input
                      value={crmSettings.crm_webhook_url}
                      onChange={(e) => setCrmSettings({ ...crmSettings, crm_webhook_url: e.target.value })}
                      placeholder="https://your-crm.com/api/webhook"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      URL สำหรับส่งข้อมูลการชำระเงินไปยัง CRM
                    </p>
                  </div>

                  <div>
                    <Label>CRM Webhook Secret</Label>
                    <Input
                      type="password"
                      value={crmSettings.crm_webhook_secret}
                      onChange={(e) => setCrmSettings({ ...crmSettings, crm_webhook_secret: e.target.value })}
                      placeholder="crm_secret_key"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Secret key สำหรับยืนยันตัวตนเมื่อส่งข้อมูลไป CRM (x-api-key header)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2 text-sm">✅ ส่งไป CRM</h4>
                    <ul className="text-xs text-green-800 space-y-1">
                      <li>• ข้อมูลการชำระเงิน</li>
                      <li>• การต่ออายุสัญญา</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2 text-sm">⬅️ รับจาก CRM</h4>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• รายการแพ็กเกจ</li>
                      <li>• สัญญาที่ active</li>
                      <li>• การต่อ/หมดอายุจาก webhook</li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs text-amber-800">
                    💡 <strong>วิธีหา API Key:</strong> ไปที่ CRM → เลือก Entity "Package" → คลิก "Code Example" → ดูในส่วน JavaScript → ใช้ <strong>Service Role Key</strong> (ไม่ใช่ API Key ธรรมดา)
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-semibold text-slate-700 mb-2 text-sm">ค่าที่บันทึกอยู่:</h4>
                  <div className="space-y-1 text-xs font-mono text-slate-600">
                    <div>App ID: {crmSettings.crm_app_id || '(ยังไม่ได้ตั้งค่า)'}</div>
                    <div>API Key: {crmSettings.crm_api_key ? '••••••••' : '(ยังไม่ได้ตั้งค่า)'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Package Tab */}
          {activeTab === 'package' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white/80 backdrop-blur-xl shadow-xl border-white/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    ข้อมูลแพ็กเกจ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>ชื่อแพ็กเกจ</Label>
                    <Input
                      value={packageData.package_name}
                      onChange={(e) => setPackageData({ ...packageData, package_name: e.target.value })}
                      placeholder="Elite Package"
                    />
                  </div>

                  <div>
                    <Label>ราคา (บาท - ก่อน VAT)</Label>
                    <Input
                      type="number"
                      value={packageData.package_price}
                      onChange={(e) => setPackageData({ ...packageData, package_price: e.target.value })}
                      placeholder="2490"
                    />
                  </div>

                  <div>
                    <Label>ระยะเวลา (เดือน)</Label>
                    <Input
                      type="number"
                      value={packageData.package_duration_months}
                      onChange={(e) => setPackageData({ ...packageData, package_duration_months: e.target.value })}
                      placeholder="3"
                    />
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <h4 className="font-semibold text-slate-800 mb-3 text-sm">สรุปราคา</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">ราคาก่อน VAT:</span>
                        <span className="font-semibold">{priceBeforeVAT.toLocaleString(undefined, { maximumFractionDigits: 2 })} บาท</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">VAT 7%:</span>
                        <span className="font-semibold">{vat.toLocaleString(undefined, { maximumFractionDigits: 2 })} บาท</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-blue-300">
                        <span className="font-bold text-slate-800">รวมทั้งหมด:</span>
                        <span className="text-xl font-bold text-blue-600">
                          {totalWithVAT.toLocaleString(undefined, { maximumFractionDigits: 2 })} บาท
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleSavePackage}
                    disabled={updateConfigMutation.isPending}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    บันทึกการตั้งค่า
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-xl shadow-xl border-white/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-purple-600" />
                    ข้อมูลธนาคาร
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>ชื่อธนาคาร</Label>
                    <Input
                      value={packageData.bank_name}
                      onChange={(e) => setPackageData({ ...packageData, bank_name: e.target.value })}
                      placeholder="ธนาคารกสิกรไทย"
                    />
                  </div>

                  <div>
                    <Label>เลขที่บัญชี</Label>
                    <Input
                      value={packageData.bank_account_number}
                      onChange={(e) => setPackageData({ ...packageData, bank_account_number: e.target.value })}
                      placeholder="xxx-x-xxxxx-x"
                    />
                  </div>

                  <div>
                    <Label>ชื่อบัญชี</Label>
                    <Input
                      value={packageData.bank_account_name}
                      onChange={(e) => setPackageData({ ...packageData, bank_account_name: e.target.value })}
                      placeholder="บริษัท..."
                    />
                  </div>

                  <div>
                    <Label>พร้อมเพย์</Label>
                    <Input
                      value={packageData.promptpay}
                      onChange={(e) => setPackageData({ ...packageData, promptpay: e.target.value })}
                      placeholder="0812345678"
                    />
                  </div>

                  <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-xs text-amber-800">
                      💡 <strong>หมายเหตุ:</strong> ข้อมูลธนาคารนี้จะแสดงในหน้าซื้อแพ็กเกจสำหรับลูกค้า (เจ้าของหอพัก) โอนเงินให้คุณ
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Branches Tab */}
          {activeTab === 'branches' && (
            <div className="space-y-6">
              {/* Global Package Selection */}
              <Card className="bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 border-2 border-purple-200 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-6 h-6 text-purple-600" />
                    กำหนดแพ็กเกจให้ทุกสาขา (Global)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-white/80 rounded-xl border-2 border-purple-300">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800 mb-1">เลือกแพ็กเกจจาก CRM</h4>
                        <p className="text-sm text-slate-600">
                          เมื่อเลือกแพ็กเกจด้านล่าง จะมีผลกับทุกสาขาในระบบ ({branches.length} สาขา)
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">เลือกแพ็กเกจ *</Label>
                        <Select value={globalPackageId} onValueChange={setGlobalPackageId}>
                          <SelectTrigger className="h-12 bg-white border-2 border-purple-300 focus:border-purple-500">
                            <SelectValue placeholder="เลือกแพ็กเกจจาก CRM" />
                          </SelectTrigger>
                          <SelectContent>
                            {packages.map((pkg) => (
                              <SelectItem key={pkg.id} value={pkg.id}>
                                <div className="flex items-center gap-2">
                                  {pkg.app_system === 'dormitory' && <Home className="w-4 h-4 text-blue-600" />}
                                  <span>{pkg.package_name || pkg.name}</span>
                                  <span className="text-slate-500">- {(pkg.price_monthly || 0).toLocaleString()} ฿/เดือน</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {globalPackageId && (
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <p className="text-xs text-purple-800 font-semibold mb-1">
                            ✨ แพ็กเกจที่เลือก: {packages.find(p => p.id === globalPackageId)?.package_name}
                          </p>
                          <p className="text-xs text-purple-700">
                            จะกำหนดให้ทั้งหมด {branches.length} สาขา
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Button
                          onClick={handleApplyGlobalPackage}
                          disabled={!globalPackageId || applyingGlobalPackage || loadingCrmPackages}
                          className="h-12 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 text-white font-semibold shadow-lg"
                        >
                          {applyingGlobalPackage ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              กำลังกำหนด...
                            </>
                          ) : (
                            <>
                              <Globe className="w-5 h-5 mr-2" />
                              กำหนดให้ทุกสาขา
                            </>
                          )}
                        </Button>

                        <Button
                          onClick={handleCancelNonEliteBranchPackages}
                          disabled={branchPackages.filter(bp => bp.status === 'active' && (bp.package_id === 'trial' || !bp.package_name?.toLowerCase().includes('elite'))).length === 0 || cancellingAllPackages}
                          variant="outline"
                          className="h-12 border-2 border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700 font-semibold"
                        >
                          {cancellingAllPackages ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              กำลังยกเลิก...
                            </>
                          ) : (
                            <>
                              <XCircle className="w-5 h-5 mr-2" />
                              ยกเลิกที่ไม่ใช่ Elite
                            </>
                          )}
                        </Button>

                        <Button
                          onClick={handleCancelAllBranchPackages}
                          disabled={activePackagesCount === 0 || cancellingAllPackages}
                          variant="outline"
                          className="h-12 border-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold"
                        >
                          {cancellingAllPackages ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              กำลังยกเลิก...
                            </>
                          ) : (
                            <>
                              <XCircle className="w-5 h-5 mr-2" />
                              ยกเลิกทุกสาขา ({activePackagesCount})
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-800">
                        <strong>⚠️ คำเตือน:</strong> การกำหนดแพ็กเกจแบบ Global จะแทนที่แพ็กเกจเดิมของทุกสาขาทันที และเริ่มนับระยะเวลา 3 เดือนตั้งแต่วันนี้
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Individual Subscription Card */}
              <Card className="bg-white/80 backdrop-blur-xl shadow-xl border-white/60">
                <CardHeader className="relative">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-purple-600" />
                      สถานะแพ็กเกจทั้งหมด
                    </CardTitle>
                    <div className="flex gap-2 flex-wrap" style={{ position: 'relative', zIndex: 100 }}>
                      {allSubscriptions.some(s => s.status === 'trial') && (
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm(`ต้องการลบ Trial ทั้งหมด (${allSubscriptions.filter(s => s.status === 'trial').length} รายการ)?`)) {
                              deleteAllTrialsMutation.mutate();
                            }
                          }}
                          disabled={deleteAllTrialsMutation.isPending}
                          variant="outline"
                          size="sm"
                          style={{ position: 'relative', zIndex: 101, pointerEvents: 'auto' }}
                          className="border-2 border-orange-400 text-orange-600 hover:bg-orange-100 hover:text-orange-700 cursor-pointer bg-white shadow-md"
                        >
                          {deleteAllTrialsMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          ลบ Trial ทั้งหมด
                        </Button>
                      )}
                      {allSubscriptions.length > 0 && (
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm(`⚠️ คำเตือน!\n\nต้องการลบแพ็กเกจทั้งหมด (${allSubscriptions.length} รายการ)?\nการกระทำนี้ไม่สามารถย้อนกลับได้!`)) {
                              deleteAllSubscriptionsMutation.mutate();
                            }
                          }}
                          disabled={deleteAllSubscriptionsMutation.isPending}
                          variant="outline"
                          size="sm"
                          style={{ position: 'relative', zIndex: 101, pointerEvents: 'auto' }}
                          className="border-2 border-red-400 text-red-600 hover:bg-red-100 hover:text-red-700 cursor-pointer bg-white shadow-md"
                        >
                          {deleteAllSubscriptionsMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          ลบทั้งหมด
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          queryClient.invalidateQueries({ queryKey: ['appSubscriptions'] });
                          toast.success('รีเฟรชข้อมูลแล้ว');
                        }}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        รีเฟรช
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {subscriptions.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-4">ยังไม่มีแพ็กเกจในระบบ</p>
                      <p className="text-sm text-slate-500 mb-4">
                        Trial subscription จะถูกสร้างอัตโนมัติเมื่อผู้ใช้เข้าระบบครั้งแรก
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                        <p className="text-sm text-blue-800">
                          <strong>💡 หมายเหตุ:</strong> แสดงทั้งหมด {subscriptions.length} รายการ (เรียงตามวันที่สร้างล่าสุด)
                        </p>
                      </div>
                      {subscriptions.map((sub) => (
                        <Card key={sub.id} className={`border-2 relative ${
                          sub.status === 'active' ? 'border-green-300 bg-green-50' : 
                          sub.status === 'trial' ? 'border-amber-300 bg-amber-50' :
                          'border-slate-200 bg-slate-50'
                        }`}>
                          <CardContent className="p-5 relative" style={{ zIndex: 1 }}>
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-bold text-slate-800 text-lg">
                                    {sub.package_name || sub.app_name}
                                  </h3>
                                  {sub.status === 'trial' && (
                                    <Badge className="bg-amber-500 text-white">Trial</Badge>
                                  )}
                                  {sub.status === 'active' && (
                                    <Badge className="bg-green-600 text-white">Active</Badge>
                                  )}
                                  {sub.status === 'cancelled' && (
                                    <Badge className="bg-slate-600 text-white">ยกเลิก</Badge>
                                  )}
                                  {sub.status === 'expired' && (
                                    <Badge className="bg-red-600 text-white">หมดอายุ</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600">
                                  {format(parseISO(sub.subscription_start_date), 'd MMM yyyy', { locale: th })} - {format(parseISO(sub.subscription_end_date), 'd MMM yyyy', { locale: th })}
                                </p>
                              </div>
                              <div style={{ position: 'relative', zIndex: 102, pointerEvents: 'auto' }}>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (confirm('ต้องการลบแพ็กเกจนี้?')) {
                                      deleteSubscriptionMutation.mutate(sub.id);
                                    }
                                  }}
                                  disabled={deleteSubscriptionMutation.isPending}
                                  style={{ pointerEvents: 'auto' }}
                                  className="border-2 border-red-400 text-red-600 hover:bg-red-100 hover:text-red-700 cursor-pointer bg-white shadow-md"
                                >
                                  {deleteSubscriptionMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-slate-600 text-xs mb-1">ระยะเวลา</p>
                                <p className="font-semibold text-slate-800">{sub.subscription_duration_months} เดือน</p>
                              </div>
                              <div>
                                <p className="text-slate-600 text-xs mb-1">ราคา/เดือน</p>
                                <p className="font-semibold text-slate-800">{sub.price_per_month?.toLocaleString() || '0'} บาท</p>
                              </div>
                              <div>
                                <p className="text-slate-600 text-xs mb-1">ราคารวม</p>
                                <p className="font-semibold text-green-600">{sub.total_price?.toLocaleString() || '0'} บาท</p>
                              </div>
                              <div>
                                <p className="text-slate-600 text-xs mb-1">การชำระ</p>
                                <Badge variant="outline" className={`${
                                  sub.payment_status === 'paid' ? 'border-green-600 text-green-700' : 
                                  sub.payment_status === 'pending' ? 'border-yellow-600 text-yellow-700' : 
                                  'border-red-600 text-red-700'
                                }`}>
                                  {sub.payment_status === 'paid' ? 'ชำระแล้ว' : sub.payment_status === 'pending' ? 'รอชำระ' : 'เกินกำหนด'}
                                </Badge>
                              </div>
                            </div>

                            {sub.notes && (
                              <div className="mt-4 p-3 bg-white/80 rounded-lg border border-slate-200">
                                <p className="text-xs text-slate-700 whitespace-pre-wrap">
                                  <strong>หมายเหตุ:</strong> {sub.notes}
                                </p>
                              </div>
                            )}

                            {sub.status !== 'active' && (
                              <div className="mt-4 flex gap-2" style={{ position: 'relative', zIndex: 102, pointerEvents: 'auto' }}>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    updateSubscriptionMutation.mutate({ id: sub.id, status: 'active' });
                                  }}
                                  disabled={updateSubscriptionMutation.isPending}
                                  style={{ pointerEvents: 'auto' }}
                                  className="bg-green-600 hover:bg-green-700 cursor-pointer shadow-md"
                                >
                                  {updateSubscriptionMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    'เปิดใช้งาน'
                                  )}
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Branch Overview */}
              <Card className="bg-white/80 backdrop-blur-xl shadow-xl border-white/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    สาขาทั้งหมด ({branches.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {branches.map((branch) => {
                      const branchPkg = getBranchPackage(branch.id);
                      const ownerName = getBranchOwner(branch.id);
                      return (
                        <Card key={branch.id} className="bg-white border-slate-200">
                          <CardContent className="p-5">
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-800 truncate">{branch.branch_name}</h4>
                                <p className="text-xs text-slate-600">{branch.branch_code}</p>
                                <p className="text-xs text-purple-600 mt-1 font-semibold">👤 {ownerName}</p>
                              </div>
                            </div>
                            
                            {branchPkg ? (
                              <div className="space-y-2 mb-3">
                                <div className="p-2 bg-green-50 rounded-lg border border-green-200">
                                  <p className="text-xs text-green-700 font-semibold">{branchPkg.package_name}</p>
                                  <p className="text-xs text-green-600">หมดอายุ: {format(parseISO(branchPkg.subscription_end_date), 'd MMM yyyy', { locale: th })}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="mb-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                                <p className="text-xs text-amber-700">ยังไม่ได้กำหนดแพ็กเกจ</p>
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-3 border-t border-slate-200 gap-2">
                              <Badge className={branch.status === 'active' ? 'bg-green-600' : 'bg-slate-600'}>
                                {branch.status === 'active' ? 'ใช้งาน' : 'ปิด'}
                              </Badge>
                              <div className="flex gap-2 flex-wrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedBranch(branch.id);
                                    setShowSetBranchPackageDialog(true);
                                  }}
                                >
                                  <Edit className="w-3 h-3 mr-1" />
                                  ตั้งค่า
                                </Button>
                                {branchPkg && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setTestExpiryBranch(branch);
                                        setShowTestExpiryDialog(true);
                                      }}
                                      disabled={testingExpiry}
                                      className="text-purple-600 hover:bg-purple-50 border-purple-200"
                                    >
                                      <AlertCircle className="w-3 h-3 mr-1" />
                                      ทดสอบหมดอายุ
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleCancelBranchPackage(branchPkg)}
                                      className="text-red-600 hover:bg-red-50 border-red-200"
                                    >
                                      <XCircle className="w-3 h-3 mr-1" />
                                      ยกเลิก
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* CRM Packages Tab */}
          {activeTab === 'crm' && (
            <Card className="bg-white/80 backdrop-blur-xl shadow-xl border-white/60">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    แพ็กเกจจากระบบ CRM
                  </CardTitle>
                  <Button
                    onClick={() => {
                      setCrmError(null);
                      refetchCrmPackages();
                    }}
                    disabled={loadingCrmPackages}
                    variant="outline"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingCrmPackages ? 'animate-spin' : ''}`} />
                    รีเฟรช
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Error Display */}
                {(crmError || crmQueryError) && (
                  <div className="mb-6 p-4 bg-red-50 rounded-xl border-2 border-red-200">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-red-900 mb-1">เกิดข้อผิดพลาด</h4>
                        <p className="text-sm text-red-800 mb-3">
                          {crmError || crmQueryError?.message}
                        </p>
                        <div className="space-y-2">
                          <p className="text-xs text-red-700 font-semibold">แนะนำการแก้ไข:</p>
                          <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                            <li>ตรวจสอบ <strong>CRM App ID</strong> ให้ถูกต้อง</li>
                            <li>ตรวจสอบ <strong>CRM API Key</strong> (ต้องใช้ Service Role Key)</li>
                            <li>ตรวจสอบว่า CRM มี Entity ชื่อ "Package" หรือไม่</li>
                          </ul>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setActiveTab('crm_connection')}
                          className="mt-3 bg-red-600 hover:bg-red-700 text-white"
                        >
                          <Link2 className="w-3 h-3 mr-1" />
                          ไปตั้งค่า CRM
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {loadingCrmPackages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="ml-3 text-slate-600">กำลังดึงข้อมูลจาก CRM...</p>
                  </div>
                ) : packages.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 mb-2">ไม่พบแพ็กเกจจาก CRM</p>
                    <p className="text-xs text-slate-500 mb-4">กรุณาตั้งค่าการเชื่อมต่อ CRM ก่อน</p>
                    <Button onClick={() => setActiveTab('crm_connection')}>
                      <Link2 className="w-4 h-4 mr-2" />
                      ตั้งค่าการเชื่อมต่อ
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 mb-6">
                      <p className="text-sm text-blue-800">
                        <strong>💡 หมายเหตุ:</strong> แพ็กเกจเหล่านี้ดึงมาจากระบบ CRM
                      </p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 p-2 bg-slate-50 rounded-xl mb-4">
                      <Button
                        variant={categoryFilter === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setCategoryFilter('all')}
                        className={categoryFilter === 'all' ? 'bg-purple-600 text-white hover:bg-purple-700' : 'text-slate-700 hover:bg-slate-100'}
                      >
                        <Filter className="w-3 h-3 mr-1" />
                        ทั้งหมด ({packages.length})
                      </Button>
                      <Button
                        variant={categoryFilter === 'accommodation' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setCategoryFilter('accommodation')}
                        className={categoryFilter === 'accommodation' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-700 hover:bg-slate-100'}
                      >
                        <Home className="w-3 h-3 mr-1" />
                        หอพัก ({accommodationCount})
                      </Button>
                      <Button
                        variant={categoryFilter === 'other' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setCategoryFilter('other')}
                        className={categoryFilter === 'other' ? 'bg-purple-600 text-white hover:bg-purple-700' : 'text-slate-700 hover:bg-slate-100'}
                      >
                        <Package className="w-3 h-3 mr-1" />
                        อื่นๆ ({otherCount})
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredPackages.map((pkg) => {
                        const price = pkg.price_monthly || 0;
                        const isAccommodation = pkg.app_system === 'dormitory';
                        
                        return (
                          <Card key={pkg.id} className={`border-2 ${isAccommodation ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'}`}>
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-bold text-slate-800 text-lg">{pkg.package_name || pkg.name}</h3>
                                    {isAccommodation && (
                                      <Home className="w-4 h-4 text-blue-600" />
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-600 mt-1">{pkg.description || 'ไม่มีคำอธิบาย'}</p>
                                </div>
                                <Badge className={isAccommodation ? 'bg-blue-600 text-white ml-2' : 'bg-purple-600 text-white ml-2'}>
                                  {isAccommodation ? 'หอพัก' : 'CRM'}
                                </Badge>
                              </div>

                              {pkg.features && pkg.features.length > 0 && (
                                <div className="space-y-1 mb-4">
                                  <p className="text-xs font-semibold text-slate-700 mb-2">ฟีเจอร์:</p>
                                  {pkg.features.slice(0, 3).map((feature, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                      <Check className="w-3 h-3 text-green-600 flex-shrink-0" />
                                      <p className="text-xs text-slate-600">{feature}</p>
                                    </div>
                                  ))}
                                  {pkg.features.length > 3 && (
                                    <p className="text-xs text-slate-500 mt-1">+{pkg.features.length - 3} เพิ่มเติม</p>
                                  )}
                                </div>
                              )}

                              <div className={`pt-3 border-t ${isAccommodation ? 'border-blue-200' : 'border-purple-200'}`}>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs text-slate-600">ราคา/เดือน</p>
                                    <p className={`text-lg font-bold ${isAccommodation ? 'text-blue-700' : 'text-purple-700'}`}>
                                      {price > 0 ? `${price.toLocaleString()} ฿` : 'N/A'}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedPackage(pkg);
                                      setShowSetBranchPackageDialog(true);
                                    }}
                                    className={isAccommodation ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gradient-to-r from-purple-600 to-pink-600'}
                                  >
                                    เลือก
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {activeSubscriptions.length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">แพ็กเกจที่ใช้งานอยู่</h3>
                        <div className="space-y-3">
                          {activeSubscriptions.map((sub) => (
                            <Card key={sub.id} className="bg-green-50 border-green-200">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-slate-800">{sub.package_name}</p>
                                    <p className="text-xs text-slate-600">
                                      วันหมดอายุ: {sub.end_date ? format(parseISO(sub.end_date), 'd MMM yyyy', { locale: th }) : 'N/A'}
                                    </p>
                                  </div>
                                  <Badge className="bg-green-600 text-white">Active</Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* CRM Access Test Tab */}
          {activeTab === 'crm_test' && (
            <div className="space-y-6">
              <Card className="bg-white/80 backdrop-blur-xl shadow-xl border-white/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    ทดสอบระบบเช็คสิทธิ์ CRM
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2">📋 วิธีใช้งาน</h4>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                      <li>เปิดระบบ CRM และเพิ่มอีเมลที่มีสิทธิ์เข้าไปใน Entity "User"</li>
                      <li>กลับมาหน้านี้แล้วกด "ทดสอบระบบ" เพื่อเช็คอีเมลปัจจุบัน</li>
                      <li>ระบบจะเรียก Function: <code className="bg-blue-100 px-2 py-0.5 rounded">checkCRMAccess</code></li>
                    </ol>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">
                        อีเมลที่ต้องการทดสอบ
                      </Label>
                      <Input
                        type="email"
                        placeholder={`เว้นว่าง = เช็คอีเมลของคุณ (${currentUser?.email || 'อีเมลของคุณ'})`}
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleTestCRMAccess()}
                        className="font-mono"
                      />
                      <div className="text-xs space-y-1">
                        {testEmail ? (
                          <p className="text-blue-600 font-medium bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                            🔍 จะเช็คอีเมล: <span className="font-mono font-bold">{testEmail}</span>
                          </p>
                        ) : (
                          <p className="text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                            💡 เว้นว่างไว้ = เช็คอีเมลที่ Login อยู่ (<span className="font-mono font-semibold">{currentUser?.email}</span>)
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={handleTestCRMAccess}
                        disabled={testingCRM}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 py-6"
                      >
                        {testingCRM ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            กำลังเช็ค...
                          </>
                        ) : (
                          <>
                            <Shield className="w-5 h-5 mr-2" />
                            เช็คสิทธิ์ CRM
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={handleTestWebhook}
                        disabled={testingCRM}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-6"
                      >
                        {testingCRM ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            กำลังส่ง...
                          </>
                        ) : (
                          <>
                            <Zap className="w-5 h-5 mr-2" />
                            ส่งข้อมูลทดสอบ
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* ผลลัพธ์ */}
                  {crmTestResult && (
                    <div className="space-y-4">
                      <Card className={`border-2 ${crmTestResult.hasAccess ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start gap-3">
                            {crmTestResult.hasAccess ? (
                              <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <h3 className={`font-bold text-lg mb-2 ${crmTestResult.hasAccess ? 'text-green-900' : 'text-red-900'}`}>
                                {crmTestResult.hasAccess ? '✅ สำเร็จ' : '❌ ไม่สำเร็จ'}
                              </h3>
                              {crmTestResult.email && (
                                <p className={`text-sm ${crmTestResult.hasAccess ? 'text-green-800' : 'text-red-800'} mb-1`}>
                                  <strong>อีเมล:</strong> {crmTestResult.email}
                                </p>
                              )}
                              {crmTestResult.message && (
                                <p className={`text-xs ${crmTestResult.hasAccess ? 'text-green-700' : 'text-red-700'} mt-2`}>
                                  {crmTestResult.message}
                                </p>
                              )}
                              {crmTestResult.source && (
                                <p className="text-xs text-slate-600 mt-1">
                                  <strong>ที่มา:</strong> {crmTestResult.source === 'employee_table' ? 'Employee Table' : 'Customer API'}
                                </p>
                              )}
                              {crmTestResult.error && (
                                <div className="mt-3 p-3 bg-white/80 rounded-lg border border-red-300">
                                  <p className="text-xs text-red-700">
                                    <strong>Error:</strong> {crmTestResult.error}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Debug Information */}
                      {crmTestResult.debug && (
                        <Card className="bg-slate-50 border-2 border-slate-300">
                          <CardContent className="p-4">
                            <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                              <Settings className="w-4 h-4" />
                              ข้อมูล Debug
                            </h4>
                            
                            {/* แสดง Webhook Response */}
                            {crmTestResult.debug.webhookResponse && (
                              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-xs font-semibold text-blue-900 mb-2">📡 CRM Response:</p>
                                <pre className="text-xs bg-white p-2 rounded overflow-x-auto font-mono text-blue-800">
                                  {JSON.stringify(crmTestResult.debug.webhookResponse, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* แสดง Sent Payload */}
                            {crmTestResult.debug.sentPayload && (
                              <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                <p className="text-xs font-semibold text-purple-900 mb-2">📤 ข้อมูลที่ส่งไป:</p>
                                <pre className="text-xs bg-white p-2 rounded overflow-x-auto font-mono text-purple-800 max-h-60">
                                  {JSON.stringify(crmTestResult.debug.sentPayload, null, 2)}
                                </pre>
                              </div>
                            )}

                            <div className="space-y-2 text-xs">
                              <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded border">
                                <span className="text-slate-600">อีเมลที่ Login:</span>
                                <code className="text-slate-800 font-mono">{crmTestResult.debug.loggedInEmail}</code>
                              </div>
                              <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded border">
                                <span className="text-slate-600">อีเมลที่เช็ค:</span>
                                <code className="text-slate-800 font-mono">{crmTestResult.debug.checkingEmail}</code>
                              </div>
                              <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded border">
                                <span className="text-slate-600">Role ในระบบ:</span>
                                <code className="text-slate-800 font-mono">{crmTestResult.debug.userRole}</code>
                              </div>
                              {(crmTestResult.debug.totalUsers !== undefined || 
                                crmTestResult.debug.totalEmployees !== undefined || 
                                crmTestResult.debug.totalCustomers !== undefined) && (
                                <div className="space-y-2">
                                  {crmTestResult.debug.totalUsers > 0 && (
                                    <div className="grid grid-cols-2 gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                                      <span className="text-blue-700 font-semibold">👥 Users:</span>
                                      <code className="text-blue-900 font-mono">{crmTestResult.debug.totalUsers} คน</code>
                                    </div>
                                  )}
                                  {crmTestResult.debug.totalEmployees > 0 && (
                                    <div className="grid grid-cols-2 gap-2 p-2 bg-green-50 rounded border border-green-200">
                                      <span className="text-green-700 font-semibold">👔 Employees:</span>
                                      <code className="text-green-900 font-mono">{crmTestResult.debug.totalEmployees} คน</code>
                                    </div>
                                  )}
                                  {crmTestResult.debug.totalCustomers > 0 && (
                                    <div className="grid grid-cols-2 gap-2 p-2 bg-purple-50 rounded border border-purple-200">
                                      <span className="text-purple-700 font-semibold">🏢 Customers:</span>
                                      <code className="text-purple-900 font-mono">{crmTestResult.debug.totalCustomers} คน</code>
                                    </div>
                                  )}
                                </div>
                              )}
                              {crmTestResult.debug.allEmails && crmTestResult.debug.allEmails.length > 0 && (
                                <div className="p-2 bg-white rounded border">
                                  <span className="text-slate-600 block mb-1">รายการอีเมลทั้งหมดใน CRM:</span>
                                  <div className="max-h-32 overflow-y-auto space-y-1">
                                    {crmTestResult.debug.allEmails.map((email, idx) => (
                                      <code key={idx} className={`block font-mono text-xs px-2 py-1 rounded ${
                                        email.toLowerCase() === crmTestResult.debug.searchingFor 
                                          ? 'bg-green-100 text-green-800 font-bold border border-green-300' 
                                          : 'bg-slate-50 text-slate-800'
                                      }`}>
                                        {email}
                                      </code>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {crmTestResult.debug.crmRawData && (
                                <details className="p-2 bg-white rounded border">
                                  <summary className="text-slate-600 cursor-pointer font-semibold mb-2">
                                    📦 ข้อมูลทั้งหมดจาก CRM (คลิกเพื่อดู)
                                  </summary>
                                  <pre className="text-xs bg-slate-900 text-green-400 p-3 rounded overflow-x-auto font-mono">
                                    {JSON.stringify(crmTestResult.debug.crmRawData, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* คำแนะนำ */}
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <h4 className="font-semibold text-purple-900 mb-2">🔐 การทำงานของระบบ</h4>
                    <div className="text-sm text-purple-800 space-y-2">
                      <p>1. ผู้ใช้ต้อง <strong>Login ผ่าน Base44</strong> ก่อน</p>
                      <p>2. ระบบเรียก <code className="bg-purple-100 px-2 py-0.5 rounded">checkCRMAccess</code> Function</p>
                      <p>3. Function จะส่งอีเมลไปเช็คกับ CRM ผ่าน API:</p>
                      <code className="block bg-purple-100 px-3 py-2 rounded mt-2 text-xs overflow-x-auto">
                        https://connect-sphere-crm-8aa1f2d8.base44.app/api/apps/6919c20da02654368aa1f2d8/functions/getCustomerByEmail
                      </code>
                      <p className="pt-2">4. ถ้าเจออีเมลใน CRM → อนุญาตให้เข้าใช้งาน ✅</p>
                      <p>5. ถ้าไม่เจอ → แสดงหน้า "ไม่มีสิทธิ์" ❌</p>
                    </div>
                  </div>

                  {/* ลิงก์ไป CRM */}
                  <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200">
                    <h4 className="font-semibold text-indigo-900 mb-3">🔗 จัดการสิทธิ์ใน CRM</h4>
                    <Button
                      variant="outline"
                      className="w-full border-2 border-indigo-300 hover:bg-indigo-50"
                      onClick={() => window.open('https://connect-sphere-crm-8aa1f2d8.base44.app/api/apps/6919c20da02654368aa1f2d8', '_blank')}
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      เปิด CRM (จัดการผู้ใช้)
                    </Button>
                    <p className="text-xs text-indigo-700 mt-2 text-center">
                      ไปที่ Entity "User" แล้วเพิ่มอีเมลที่ต้องการให้มีสิทธิ์
                    </p>
                  </div>

                  {/* การตั้งค่าปัจจุบัน */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="font-semibold text-slate-700 mb-3 text-sm">⚙️ การตั้งค่าปัจจุบัน</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-slate-600">CRM API URL:</span>
                        <code className="bg-slate-100 px-2 py-1 rounded text-xs max-w-xs truncate">
                          https://connect-sphere-crm-8aa1f2d8.base44.app
                        </code>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-slate-600">Function:</span>
                        <code className="bg-slate-100 px-2 py-1 rounded text-xs">getCustomerByEmail</code>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-slate-600">Secret:</span>
                        <code className="bg-slate-100 px-2 py-1 rounded text-xs">CRM_SERVICE_ROLE_KEY</code>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Features Management Tab */}
          {activeTab === 'features' && (
            <Card className="bg-white/80 backdrop-blur-xl shadow-xl border-white/60">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-indigo-600" />
                      จัดการ Features ของแต่ละแพ็กเกจ
                    </CardTitle>
                    <p className="text-sm text-slate-600 mt-1">
                      กำหนดว่าแต่ละแพ็กเกจสามารถเข้าถึง features อะไรได้บ้าง
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setCrmError(null);
                      refetchCrmPackages();
                    }}
                    disabled={loadingCrmPackages}
                    variant="outline"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingCrmPackages ? 'animate-spin' : ''}`} />
                    รีเฟรช
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingCrmPackages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="ml-3 text-slate-600">กำลังโหลดแพ็กเกจ...</p>
                  </div>
                ) : packages.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 mb-2">ไม่พบแพ็กเกจจาก CRM</p>
                    <Button onClick={() => setActiveTab('crm_connection')}>
                      <Link2 className="w-4 h-4 mr-2" />
                      ตั้งค่าการเชื่อมต่อ
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 mb-6">
                      <p className="text-sm text-blue-800">
                        <strong>💡 คำแนะนำ:</strong> คลิก "ตั้งค่า Features" เพื่อกำหนดว่าแพ็กเกจนั้นๆ สามารถเข้าถึงเมนูหรือฟังก์ชันอะไรได้บ้าง
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {packages.filter(p => p.app_system === 'dormitory').map((pkg) => {
                        const featureConfig = featureConfigs.find(fc => fc.package_id === pkg.id);
                        const configuredFeatures = featureConfig?.enabled_features || [];
                        const crmFeatures = pkg.features || [];
                        
                        return (
                          <Card key={pkg.id} className="bg-white border-2 border-slate-200 hover:border-blue-300 transition-all">
                            <CardContent className="p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-xl font-bold text-slate-800">{pkg.package_name}</h3>
                                    <Badge className="bg-blue-600 text-white">
                                      {(pkg.price_monthly || 0).toLocaleString()} ฿/เดือน
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-slate-600">{pkg.description || 'ไม่มีคำอธิบาย'}</p>
                                </div>
                                <Button
                                  onClick={() => {
                                    setEditingFeaturePackage({
                                      id: pkg.id,
                                      name: pkg.package_name,
                                      crmFeatures: crmFeatures,
                                      configuredFeatures: configuredFeatures,
                                      notes: featureConfig?.notes || ''
                                    });
                                    setShowFeatureDialog(true);
                                  }}
                                  className="bg-gradient-to-r from-indigo-600 to-purple-600"
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  ตั้งค่า Features
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Features จาก CRM */}
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="w-4 h-4 text-blue-600" />
                                    <h4 className="font-semibold text-blue-900 text-sm">Features ที่กำหนดใน CRM</h4>
                                  </div>
                                  {crmFeatures.length > 0 ? (
                                    <div className="space-y-1 max-h-40 overflow-y-auto">
                                      {crmFeatures.map((feature, idx) => (
                                        <div key={idx} className="flex items-start gap-2">
                                          <Check className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-blue-800">{feature}</p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-blue-700">ไม่มี features ที่กำหนด</p>
                                  )}
                                </div>

                                {/* Features ที่ตั้งค่าไว้ */}
                                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Check className="w-4 h-4 text-green-600" />
                                    <h4 className="font-semibold text-green-900 text-sm">Features ที่เปิดใช้งาน</h4>
                                  </div>
                                  {configuredFeatures.length > 0 ? (
                                    <div className="space-y-1 max-h-40 overflow-y-auto">
                                      {configuredFeatures.map((feature, idx) => (
                                        <div key={idx} className="flex items-start gap-2">
                                          <Check className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-green-800">{feature}</p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-green-700">ยังไม่ได้ตั้งค่า (ใช้ features จาก CRM)</p>
                                  )}
                                </div>
                              </div>

                              {featureConfig?.notes && (
                                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                  <p className="text-xs text-slate-700">
                                    <strong>หมายเหตุ:</strong> {featureConfig.notes}
                                  </p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Package Dialog */}
      <Dialog open={showAddPackageDialog} onOpenChange={setShowAddPackageDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>เพิ่มแพ็กเกจใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>ชื่อแอป *</Label>
                <Input
                  value={newPackageData.app_name}
                  onChange={(e) => setNewPackageData({ ...newPackageData, app_name: e.target.value })}
                  placeholder="ชื่อแอปหรือสาขา"
                />
              </div>

              <div>
                <Label>วันที่เริ่ม *</Label>
                <Input
                  type="date"
                  value={newPackageData.subscription_start_date}
                  onChange={(e) => setNewPackageData({ ...newPackageData, subscription_start_date: e.target.value })}
                />
              </div>

              <div>
                <Label>ระยะเวลา (เดือน) *</Label>
                <Input
                  type="number"
                  value={newPackageData.subscription_duration_months}
                  onChange={(e) => setNewPackageData({ ...newPackageData, subscription_duration_months: e.target.value })}
                  placeholder="3"
                />
              </div>

              <div>
                <Label>ราคาต่อเดือน (บาท) *</Label>
                <Input
                  type="number"
                  value={newPackageData.price_per_month}
                  onChange={(e) => setNewPackageData({ ...newPackageData, price_per_month: e.target.value })}
                  placeholder="830"
                />
              </div>

              <div>
                <Label>สถานะการชำระ</Label>
                <Select 
                  value={newPackageData.payment_status} 
                  onValueChange={(value) => setNewPackageData({ ...newPackageData, payment_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">รอชำระ</SelectItem>
                    <SelectItem value="paid">ชำระแล้ว</SelectItem>
                    <SelectItem value="overdue">เกินกำหนด</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label>หมายเหตุ</Label>
                <Textarea
                  value={newPackageData.notes}
                  onChange={(e) => setNewPackageData({ ...newPackageData, notes: e.target.value })}
                  placeholder="ระบุข้อมูลเพิ่มเติม..."
                  rows={2}
                />
              </div>
            </div>

            {newPackageData.price_per_month && newPackageData.subscription_duration_months && (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700">ราคารวมทั้งหมด:</span>
                  <span className="font-bold text-blue-600 text-lg">
                    {(parseFloat(newPackageData.price_per_month) * parseInt(newPackageData.subscription_duration_months)).toLocaleString()} บาท
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowAddPackageDialog(false)}>
                ยกเลิก
              </Button>
              <Button
                onClick={handleAddPackage}
                disabled={!newPackageData.app_name || !newPackageData.price_per_month || createPackageMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                เพิ่มแพ็กเกจ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Branch Package Dialog */}
      <Dialog open={showSetBranchPackageDialog} onOpenChange={setShowSetBranchPackageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>กำหนดแพ็กเกจให้สาขา</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>เลือกสาขา *</Label>
              <Select value={selectedBranch || ''} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสาขา" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.branch_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>เลือกแพ็กเกจ *</Label>
              {selectedPackage ? (
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{selectedPackage.package_name || selectedPackage.name}</p>
                        <p className="text-sm text-slate-600">{(selectedPackage.price_monthly || 0).toLocaleString()} ฿/เดือน</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPackage(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Select 
                  value={selectedPackage?.id || ''} 
                  onValueChange={(value) => {
                    const pkg = packages?.find(p => p.id === value);
                    setSelectedPackage(pkg);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกแพ็กเกจจาก CRM" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages?.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.package_name || pkg.name} - {(pkg.price_monthly || 0).toLocaleString()} ฿/เดือน
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-xs text-blue-800">
                💡 <strong>หมายเหตุ:</strong> การกำหนดแพ็กเกจจะมีผลทันที และจะเริ่มนับระยะเวลา 3 เดือนตั้งแต่วันนี้
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => {
                setShowSetBranchPackageDialog(false);
                setSelectedBranch(null);
                setSelectedPackage(null);
              }}>
                ยกเลิก
              </Button>
              <Button
                onClick={handleSetBranchPackage}
                disabled={!selectedBranch || !selectedPackage || setBranchPackageMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Check className="w-4 h-4 mr-2" />
                ยืนยัน
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feature Configuration Dialog */}
      <Dialog open={showFeatureDialog} onOpenChange={setShowFeatureDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-indigo-600" />
              ตั้งค่า Features - {editingFeaturePackage?.name}
            </DialogTitle>
          </DialogHeader>
          
          {editingFeaturePackage && (
            <FeatureSelector
              packageId={editingFeaturePackage.id}
              packageName={editingFeaturePackage.name}
              crmFeatures={editingFeaturePackage.crmFeatures}
              currentFeatures={editingFeaturePackage.configuredFeatures}
              notes={editingFeaturePackage.notes}
              onSave={(enabledFeatures, notes) => {
                saveFeatureConfigMutation.mutate({
                  packageId: editingFeaturePackage.id,
                  packageName: editingFeaturePackage.name,
                  enabledFeatures,
                  notes
                });
              }}
              onCancel={() => {
                setShowFeatureDialog(false);
                setEditingFeaturePackage(null);
              }}
              isSaving={saveFeatureConfigMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Test Expiry Confirmation Dialog */}
      <Dialog open={showTestExpiryDialog} onOpenChange={(open) => {
        setShowTestExpiryDialog(open);
        if (!open) {
          setTestExpiryBranch(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-purple-600" />
              ทดลองหมดอายุการใช้งาน
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {testExpiryBranch && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>สาขา:</strong> {testExpiryBranch.branch_name}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  ({testExpiryBranch.branch_code})
                </p>
              </div>
            )}

            <div className="p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
              <p className="text-sm text-purple-900 mb-3">
                <strong>⚠️ คำเตือน:</strong> การทดสอบนี้จะทำให้:
              </p>
              <ul className="text-sm text-purple-800 space-y-2 list-disc list-inside">
                <li>แพ็กเกจของ{testExpiryBranch ? 'สาขานี้' : 'ทุกสาขา'}จะถูกตั้งค่าให้หมดอายุเมื่อวานนี้</li>
                <li>ระบบจะแสดงหน้าแจ้งเตือนหมดอายุทันที</li>
                <li>ใช้สำหรับทดสอบการทำงานของระบบเท่านั้น</li>
              </ul>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-xs text-amber-800">
                💡 <strong>หมายเหตุ:</strong> คุณสามารถเปลี่ยนวันหมดอายุกลับมาได้โดยการตั้งค่าแพ็กเกจใหม่
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowTestExpiryDialog(false);
                  setTestExpiryBranch(null);
                }}
                disabled={testingExpiry}
              >
                ยกเลิก
              </Button>
              <Button
                onClick={() => {
                  setTestingExpiry(true);
                  testExpiryMutation.mutate(testExpiryBranch?.id);
                }}
                disabled={testingExpiry}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {testingExpiry ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังดำเนินการ...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    ยืนยันทดลองหมดอายุ
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}