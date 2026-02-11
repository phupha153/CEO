import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Save, Printer, FileText, PenTool, X, Plus, Trash2, List, Users, Shield, Send, CheckCircle, Sparkles, MessageSquare, ShieldCheck, FileSignature, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "sonner";
import SignaturePad from '../components/shared/SignaturePad';
import { createPageUrl } from "@/utils";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ContractEditor() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const contractId = searchParams.get('contractId');
  
  const selectedBranchId = localStorage.getItem('selected_branch_id');

  const signaturePadRef = useRef(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [currentSignatureType, setCurrentSignatureType] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showClausesEditor, setShowClausesEditor] = useState(false);
  const [hasReadContract, setHasReadContract] = useState(false);

  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState(300);
  const otpTimerRef = useRef(null);

  const [tempContractId, setTempContractId] = useState(null);
  const [isSaving, setIsSaving] = useState(false); // New state for saving status
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiMode, setAiMode] = useState('generate'); // 'generate', 'review', 'suggest', 'edit'
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiEditQuery, setAiEditQuery] = useState('');
  const [aiPendingChanges, setAiPendingChanges] = useState(null);
  const [showAiConfirmDialog, setShowAiConfirmDialog] = useState(false);

  const activeContractId = contractId || tempContractId;

  const [formData, setFormData] = useState({
    branch_id: selectedBranchId || '',
    contract_no: '',
    contract_date: format(new Date(), 'yyyy-MM-dd'),
    lessor_name: '',
    lessor_id: '',
    lessor_phone: '',
    lessor_address: '',
    lessee_name: '',
    lessee_id: '',
    lessee_phone: '',
    lessee_address: '',
    tenant_id: '',
    room_id: '',
    building: 'W RESIDENTS',
    room_no: '',
    floor: '',
    full_address: '',
    start_date: '',
    end_date: '',
    rent_monthly: 0,
    deposit: 0,
    advance_rent_months: 1,
    deposit_months: 1,
    appliance_fee: 0,
    pay_day: 5,
    water_rate: 18,
    elec_rate: 7,
    common_fee: 0,
    internet_fee: 200,
    late_fee_per_per_day: 50,
    allow_pets: false,
    no_smoking: true,
    termination_notice_days: 30,
    deposit_return_days: 7,
    late_payment_grace_days: 7,
    furniture_rent: 0,
    advance_rent: 0,
    witness1_name: '',
    witness2_name: '',
    additional_rules: [],
    contract_clauses: [],
    status: 'draft',
    contract_content: '',
    tenant_signature: null,
    landlord_signature: null,
    witness1_signature: null,
    witness2_signature: null,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const tenants = await base44.entities.Tenant.filter({ branch_id: selectedBranchId, status: 'active' }, '-created_date', 1000);
      console.log('🔍 ContractEditor: Loaded tenants for branch', selectedBranchId, '- Total:', tenants.length);
      return tenants;
    },
    enabled: !!selectedBranchId,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const rooms = await base44.entities.Room.filter({ branch_id: selectedBranchId }, '-room_number', 1000);
      console.log('🔍 ContractEditor: Loaded rooms for branch', selectedBranchId, '- Total:', rooms.length);
      return rooms;
    },
    enabled: !!selectedBranchId,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const bookings = await base44.entities.Booking.filter({ branch_id: selectedBranchId }, '-created_date', 1000);
      console.log('🔍 ContractEditor: Loaded bookings for branch', selectedBranchId, '- Total:', bookings.length);
      return bookings;
    },
    enabled: !!selectedBranchId,
  });

  const getDefaultClauses = () => [
    { clause_number: 1, title: "ห้องพักที่เช่า", content: "ผู้เช่าตกลงเช่าและผู้ให้เช่าตกลงให้เช่าห้องพักเลขที่ <strong><span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{หมายเลขห้อง}</span></strong> ชั้น <strong><span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{ชั้น}</span></strong> ตั้งอยู่ที่ <span style=\"border-bottom: 1px dotted #333; min-width: 300px; display: inline-block;\">{ที่อยู่หอพัก}</span> เพื่อใช้เป็นที่อยู่อาศัยเท่านั้น ในอัตราค่าเช่าเดือนละ <strong><span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{ค่าเช่า}</span></strong> บาท โดยมีกำหนดระยะเวลาในการเช่า ตั้งแต่วันที่ <span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{วันที่เริ่มสัญญา}</span> ถึงวันที่ <span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{วันที่สิ้นสุดสัญญา}</span> โดยมีกำหนดชำระค่าบริการก่อนวันที่ <span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{วันกำหนดชำระ}</span> ของทุกเดือน" },
    { clause_number: 2, title: "เฟอร์นิเจอร์", content: "ผู้เช่าตกลงเช่าและผู้ให้เช่าตกลงให้เช่า อุปกรณ์ไฟฟ้าและเฟอร์นิเจอร์ ภายในห้องพัก ในอัตราค่าเช่าเดือนละ <span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{ค่าเช่าเฟอร์นิเจอร์}</span> บาท โดยมีกำหนดชำระค่าบริการก่อนวันที่ <span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{วันกำหนดชำระ}</span> ของทุกเดือน โดยมีสภาพของอุปกรณ์ไฟฟ้าและเฟอร์นิเจอร์ ปรากฎตามรายละเอียดหลักฐาน การตรวจรับสภาพอาคารแนบท้ายสัญญาฉบับนี้และถือว่าเป็นส่วนหนึ่งของสัญญาเช่า" },
    { clause_number: 3, title: "ค่าสาธารณูปโภค", content: "ผู้เช่าตกลงชำระค่าสาธารณูปโภคและค่าบริการต่างๆ ดังนี้ ๓.๑ ค่ากระแสไฟฟ้า และค่าน้ำประปา ในอัตราตามที่ผู้ให้บริการ (การไฟฟ้าและการประปา) เรียกเก็บในแต่ละเดือน โดยมีกำหนดชำระค่าบริการก่อนวันที่ <span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{วันกำหนดชำระ}</span> ของทุกเดือน ๓.๒ ค่าบริการสาธารณูปโภคส่วนกลาง (ไฟฟ้าส่องสว่างทางเดินส่วนกลาง, ทำความสะอาดและจัดเก็บขยะส่วนกลาง) ในอัตราเดือนละ <span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{ค่าส่วนกลาง}</span> บาท ๓.๓ ค่าบริการอินเตอร์เน็ตในอัตราเดือนละ <strong><span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{ค่าอินเทอร์เน็ต}</span></strong> บาท" },
    { clause_number: 4, title: "การจัดส่งใบแจ้ง", content: "ผู้ให้เช่าจะจัดส่งใบแจ้งค่าใช้จ่ายต่างๆ ที่ผู้เช่าต้องชำระให้แก่ผู้เช่าทราบล่วงหน้า ไม่น้อยกว่า ๗ วันก่อนถึงกำหนดวันชำระค่าใช้จ่ายต่างๆ" },
    { clause_number: 5, title: "การชำระเงินในวันทำสัญญา", content: "ผู้เช่าได้ชำระเงินและผู้ให้เช่าได้รับชำระเงินในวันที่ได้ลงนามในสัญญา ดังนี้ ๕.๑ ค่าเช่าเดือนปัจจุบัน (เดือน <span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{เดือนปัจจุบัน}</span>) จำนวน <span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{ค่าเช่า}</span> บาท ๕.๒ ค่าเช่าล่วงหน้า ({จำนวนเดือนค่าเช่าล่วงหน้า}) จำนวน <span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{ค่าเช่าล่วงหน้าทั้งหมด}</span> บาท ๕.๓ เงินประกัน ({จำนวนเดือนเงินประกัน}) จำนวน <span style=\"border-bottom: 1px dotted #333; display: inline-block;\">{เงินประกันทั้งหมด}</span> บาท" },
    { clause_number: 6, title: "สิทธิบอกเลิกของผู้เช่า", content: "ผู้เช่ามีสิทธิบอกเลิกสัญญาเช่าได้ โดยต้องบอกกล่าวเป็นหนังสือให้ผู้ให้เช่าทราบ ล่วงหน้าไม่น้อยกว่า <strong>{จำนวนวันแจ้งล่วงหน้า}</strong> วัน และผู้เช่าต้องไม่ผิดนัดหรือค้างชำระค่าเช่า" },
    { clause_number: 7, title: "การคืนเงินประกัน", content: "เมื่อสัญญาเช่าสิ้นสุดลง ผู้ให้เช่าจะทำการชำระเงินประกันคืนให้แก่ผู้เช่าทันที ในกรณีที่ต้องมีการตรวจสอบความเสียหาย ผู้ให้เช่าจะชำระเงินประกันคืนให้แก่ผู้เช่าภายใน <strong>{จำนวนวันคืนเงินประกัน}</strong> วัน" },
    { clause_number: 8, title: "สิทธิบอกเลิกของผู้ให้เช่า", content: "ผู้ให้เช่ามีสิทธิบอกเลิกสัญญาเช่ากับผู้เช่า หากผู้เช่าไม่ปฏิบัติตามเงื่อนไข ดังต่อไปนี้:<br/>๘.๑ {กฎเลี้ยงสัตว์}<br/>๘.๒ ก่อเสียงดังหรือรบกวนสร้างความเดือดร้อนรำคาญกับผู้เช่ารายอื่น<br/>๘.๓ นำสิ่งของผิดกฎหมาย สิ่งเสพติด เล่นการพนัน และดื่มสิ่งมึนเมาในพื้นที่เช่า<br/>๘.๔ ดัดแปลง ต่อเติม รื้อถอน เคลื่อนย้ายทรัพย์สินต่างๆ หรือสร้างความเสียหายแก่พื้นที่เช่า<br/>๘.๕ นำบุคคลภายนอกเข้ามาในพื้นที่เช่าหรือพักอาศัยก่อนได้รับอนุญาตจากผู้ให้เช่า<br/>๘.๖ ไม่ชำระค่าเช่า หรือค่าใช้จ่ายอื่นๆ ตามกำหนด<br/>๘.๗ {กฎสูบบุหรี่}" },
    { clause_number: 9, title: "การยึดเงินประกัน", content: "ผู้ให้เช่าไม่มีสิทธิยึดเงินค่าเช่าล่วงหน้า และเงินประกัน เว้นแต่ ผู้เช่าผิดนัดไม่ชำระค่าเช่า หรือทำความเสียหายต่อทรัพย์สินที่เช่า หากผู้เช่าค้างชำระเกิน <strong>{จำนวนวันค้างชำระ}</strong> วัน ผู้ให้เช่ามีสิทธิบอกเลิกสัญญาได้ทันที" },
    { clause_number: 10, title: "การตรวจสอบพื้นที่เช่า", content: "กรณีที่ผู้ให้เช่ามีความประสงค์เข้าตรวจสอบพื้นที่เช่า ผู้ให้เช่าต้องแจ้งให้ผู้เช่าทราบก่อนล่วงหน้าทุกครั้ง เว้นแต่ มีเหตุฉุกเฉินหรือจำเป็นที่ต้องเข้าไปทันที" },
    { clause_number: 11, title: "ห้ามปิดกั้นผู้เช่า", content: "ผู้ให้เช่าไม่มีสิทธิปิดกั้นไม่ให้ผู้เช่าเข้าใช้ประโยชน์หรือเข้าไปในพื้นที่เช่าเพื่อยึดทรัพย์สิน หรือขนย้ายทรัพย์สินของผู้เช่า" },
    { clause_number: 12, title: "ความรับผิดชอบความเสียหาย", content: "ผู้เช่าต้องรับผิดชอบต่อความเสียหายหรือความชำรุดบกพร่องที่เกิดขึ้นจากการใช้งาน หรือเกิดจากการเสื่อมสภาพจากการใช้งานตามปกติ" },
    { clause_number: 13, title: "เงื่อนไขการบอกเลิก", content: "ในกรณีที่ผู้ให้เช่าจะใช้สิทธิบอกเลิกสัญญาต้องเป็นเงื่อนไขอันเป็นสาระสำคัญที่กำหนดไว้ในสัญญาเช่า" },
    { clause_number: 14, title: "ข้อพิพาท", content: "กรณีมีข้อพิพาทระหว่างคู่สัญญา ให้นำข้อพิพาทไปเจรจาตกลงกันก่อน หากตกลงกันไม่ได้ให้ดำเนินการตามกฎหมายไทย" },
    { clause_number: 15, title: "ลงนามสัญญา", content: "สัญญาฉบับนี้ทำขึ้นเป็นสองฉบับ มีข้อความถูกต้องตรงกันทุกประการ คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญาดีแล้ว จึงลงลายมือชื่อไว้เป็นหลักฐานต่อหน้าพยาน" }
  ];

  const { data: existingContract } = useQuery({
    queryKey: ['contract', activeContractId],
    queryFn: async () => {
      if (!activeContractId) return null;
      const contracts = await base44.entities.Contract.list();
      return contracts.find(c => c.id === activeContractId);
    },
    enabled: !!activeContractId,
  });

  useEffect(() => {
    if (existingContract) {
      setFormData({
        ...existingContract,
        branch_id: existingContract.branch_id || selectedBranchId || '',
        contract_date: existingContract.contract_date || format(new Date(), 'yyyy-MM-dd'),
        additional_rules: existingContract.additional_rules || [],
        contract_clauses: existingContract.contract_clauses || getDefaultClauses(),
        advance_rent_months: existingContract.advance_rent_months || 1,
        deposit_months: existingContract.deposit_months || 1,
        appliance_fee: existingContract.appliance_fee || 0,
        late_fee_per_per_day: existingContract.late_fee_per_per_day || 50,
      });
    }
  }, [existingContract, selectedBranchId]);

  useEffect(() => {
    // Prevent overwriting if editing an existing contract (data comes from existingContract)
    if (activeContractId) return;

    const buildingName = configs.find(c => c.key === 'building_name')?.value;
    const buildingAddress = configs.find(c => c.key === 'building_address')?.value;
    const managerName = configs.find(c => c.key === 'manager_name')?.value;
    const lessorName = configs.find(c => c.key === 'lessor_name')?.value; 
    const lessorId = configs.find(c => c.key === 'lessor_id')?.value; 
    const lessorPhone = configs.find(c => c.key === 'lessor_phone')?.value; 
    const lessorAddress = configs.find(c => c.key === 'lessor_address')?.value; 
    const waterRate = configs.find(c => c.key === 'water_rate')?.value;
    const elecRate = configs.find(c => c.key === 'electricity_rate')?.value;
    const internetRate = configs.find(c => c.key === 'internet_rate')?.value;
    const commonFee = configs.find(c => c.key === 'common_fee')?.value;
    const lateFee = configs.find(c => c.key === 'late_payment_fee_per_day')?.value;
    const payDay = configs.find(c => c.key === 'bill_due_day')?.value;

    setFormData(prev => ({
      ...prev,
      // Only set default if current value is empty to prevent overwriting user input
      building: prev.building || buildingName || 'W RESIDENTS',
      full_address: prev.full_address || buildingAddress || '',
      lessor_name: prev.lessor_name || lessorName || managerName || '', 
      lessor_id: prev.lessor_id || lessorId || '', 
      lessor_phone: prev.lessor_phone || lessorPhone || '', 
      lessor_address: prev.lessor_address || lessorAddress || buildingAddress || '', 
      water_rate: prev.water_rate || parseFloat(waterRate) || 18,
      elec_rate: prev.elec_rate || parseFloat(elecRate) || 7,
      internet_fee: prev.internet_fee || parseFloat(internetRate) || 200,
      common_fee: prev.common_fee || parseFloat(commonFee) || 0,
      late_fee_per_per_day: prev.late_fee_per_per_day || parseFloat(lateFee) || 50,
      pay_day: prev.pay_day || parseInt(payDay) || 5,
    }));
  }, [configs, activeContractId]);

  useEffect(() => {
    if (!contractId && formData.contract_clauses.length === 0) {
      setFormData(prev => ({
        ...prev,
        contract_clauses: getDefaultClauses()
      }));
    }
  }, [contractId, formData.contract_clauses.length]);

  useEffect(() => {
    if (formData.tenant_id && formData.room_id && !formData.contract_content) {
      setTimeout(() => generateTemplate(), 300);
    }
  }, [formData.tenant_id, formData.room_id]);

  useEffect(() => {
    if (otpSent && otpExpiresIn > 0) {
      otpTimerRef.current = setInterval(() => {
        setOtpExpiresIn((prev) => prev - 1);
      }, 1000);
    } else if (otpExpiresIn === 0 && otpTimerRef.current) {
      clearInterval(otpTimerRef.current);
      toast.error('รหัส OTP หมดอายุแล้ว');
      setOtpSent(false);
    }

    return () => {
      if (otpTimerRef.current) {
        clearInterval(otpTimerRef.current);
      }
    };
  }, [otpSent, otpExpiresIn]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (activeContractId) {
        return await base44.entities.Contract.update(activeContractId, data);
      } else {
        return await base44.entities.Contract.create(data);
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['contracts']);
      if (data?.id) {
        queryClient.invalidateQueries(['contract', data.id]);
      }
      
      if (!variables?.skipToast) {
        toast.success(activeContractId ? 'บันทึกสัญญาสำเร็จ' : 'สร้างสัญญาสำเร็จ');
      }
      
      if (!contractId && data?.id && !variables?.skipNavigation) {
        navigate(createPageUrl('ContractEditor') + `?contractId=${data.id}`, { replace: true });
      }
      
      setIsSaving(false);
    },
    onError: (error) => {
      console.error('Save mutation error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
      setIsSaving(false);
    }
  });

  const saveContract = async (skipNavigation = false, skipToast = false) => {
    if (isSaving || saveMutation.isPending) {
      console.log('Already saving, skipping...');
      return null;
    }

    if (!formData.lessor_name || !formData.lessee_name || !formData.start_date) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return null;
    }

    if (!formData.room_id) {
      toast.error('กรุณาเลือกห้องพัก');
      return null;
    }

    if (!formData.tenant_id) {
      toast.error('กรุณาเลือกผู้เช่า');
      return null;
    }

    setIsSaving(true);

    try {
      let currentFormData = { ...formData };

      if (!currentFormData.contract_no) {
        const dateStr = format(new Date(), 'yyyyMM');
        const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
        currentFormData.contract_no = `RNT-${dateStr}-${randomNum}`;
      }

      // ⭐ เช็คว่ามี booking อยู่แล้วหรือไม่ (เช็คจาก contractId ด้วย)
      const existingBooking = bookings.find(
        b => b.room_id === formData.room_id && 
        b.tenant_id === formData.tenant_id && 
        b.status === 'active' &&
        (!activeContractId || b.id === formData.booking_id) // ถ้ามี contractId แล้ว ให้ใช้ booking_id เดิม
      );

      let bookingId = existingBooking?.id;

      // ⭐ สร้าง booking ใหม่เฉพาะเมื่อไม่มี booking และยังไม่มี contractId
      if (!existingBooking && !activeContractId) {
        const newBooking = await base44.entities.Booking.create({
          branch_id: selectedBranchId,
          room_id: formData.room_id,
          tenant_id: formData.tenant_id,
          check_in_date: formData.start_date,
          check_out_date: formData.end_date,
          booking_type: 'monthly',
          status: 'active',
          deposit_amount: formData.deposit,
          total_amount: formData.rent_monthly,
        });
        bookingId = newBooking.id;
        if (!skipToast) {
          toast.success('สร้างการจองสำเร็จ');
        }
      } else if (existingBooking) {
        bookingId = existingBooking.id;
      }

      await base44.entities.Room.update(formData.room_id, {
        status: 'occupied'
      });

      const dataToSave = {
        ...currentFormData,
        booking_id: bookingId,
        status: (currentFormData.tenant_signature && currentFormData.landlord_signature) ? 'signed' : 'draft',
        skipNavigation,
        skipToast
      };

      const savedContract = await saveMutation.mutateAsync(dataToSave);
      
      if (savedContract?.id) {
        setTempContractId(savedContract.id);
      }

      queryClient.invalidateQueries(['rooms']);
      queryClient.invalidateQueries(['bookings']);

      return savedContract;
    } catch (error) {
      console.error('Error saving contract:', error);
      toast.error('บันทึกสัญญาไม่สำเร็จ: ' + (error.message || 'กรุณาลองใหม่อีกครั้ง'));
      setIsSaving(false);
      return null;
    }
  };

  const handleSave = async () => {
    if (isSaving || saveMutation.isPending) {
      console.log('Already saving, skipping handleSave...');
      return;
    }
    await saveContract(false, false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleTenantChange = (tenantId) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      setFormData(prev => ({
        ...prev,
        tenant_id: tenantId,
        lessee_name: tenant.full_name || '',
        lessee_id: tenant.national_id || '',
        lessee_phone: tenant.phone || '',
        lessee_address: tenant.address || '',
      }));
    }
  };

  const handleRoomChange = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      setFormData(prev => ({
        ...prev,
        room_id: roomId,
        room_no: room.room_number || '',
        floor: room.floor?.toString() || '',
        rent_monthly: room.price || 0,
        deposit: room.price * formData.deposit_months || 0,
      }));
    }
  };

  const convertToBuddhistYear = (dateStr) => {
    if (!dateStr) return '...........................';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return '...........................';
      }
      return format(date, 'd MMMM ', { locale: th }) + (date.getFullYear() + 543);
    } catch (error) {
      return '...........................';
    }
  };

  const handleAIRequest = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      let prompt = "";
      let systemPrompt = "คุณเป็นผู้ช่วยทนายความและผู้เชี่ยวชาญด้านสัญญาเช่าอสังหาริมทรัพย์ในประเทศไทย";
      
      const tenant = tenants.find(t => t.id === formData.tenant_id);
      const room = rooms.find(r => r.id === formData.room_id);
      const basicInfo = `
        ผู้เช่า: ${formData.lessee_name || tenant?.full_name || 'ไม่ระบุ'}
        ห้อง: ${formData.room_no || room?.room_number || 'ไม่ระบุ'}
        ค่าเช่า: ${formData.rent_monthly} บาท
        สัญญา: ${formData.start_date} ถึง ${formData.end_date}
      `;

      if (aiMode === 'generate') {
        prompt = `สร้างร่างสัญญาเช่าหอพัก/อพาร์ทเม้นท์ที่รัดกุมและเป็นธรรม โดยมีข้อมูลดังนี้: ${basicInfo}
        ข้อกำหนดสำคัญที่ต้องมี:
        1. การชำระค่าเช่าและค่าสาธารณูปโภค
        2. เงินประกันและการคืนเงิน
        3. กฎระเบียบการอยู่อาศัย (เสียงดัง, ความสะอาด, สูบบุหรี่, สัตว์เลี้ยง)
        4. การบอกเลิกสัญญา
        
        ขอรูปแบบ HTML ที่สวยงามพร้อมจัดรูปแบบสำหรับพิมพ์`;
      } else if (aiMode === 'review') {
        prompt = `ตรวจสอบสัญญาเช่านี้และระบุจุดที่ควรแก้ไขหรือเพิ่มเพื่อความรัดกุมตามกฎหมายไทย:
        "${formData.contract_content || JSON.stringify(formData.contract_clauses)}"`;
      } else if (aiMode === 'suggest') {
        prompt = `แนะนำข้อสัญญาเพิ่มเติม 3-5 ข้อที่ควรมีสำหรับสัญญาเช่าหอพัก เพื่อป้องกันปัญหาที่พบบ่อย (เช่น เรื่องที่จอดรถ, การพาคนนอกเข้าพัก, การซ่อมแซม) สำหรับ: ${basicInfo}`;
      }

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        system_prompt: systemPrompt
      });

      setAiResult(res);
    } catch (error) {
      console.error("AI Error:", error);
      toast.error("เกิดข้อผิดพลาดในการใช้งาน AI");
    } finally {
      setAiLoading(false);
    }
  };

  // AI Edit - แก้ไขข้อมูลสัญญาด้วยคำสั่ง
  const handleAIEdit = async () => {
    if (!aiEditQuery.trim()) {
      toast.error('กรุณาใส่คำสั่งแก้ไข');
      return;
    }

    setAiLoading(true);
    try {
      // สร้างข้อมูลข้อสัญญาปัจจุบันสำหรับ AI
      const currentClausesSummary = formData.contract_clauses.map(c => 
        `ข้อ ${c.clause_number}: ${c.title || '(ไม่มีหัวข้อ)'}`
      ).join(', ');
      const lastClauseNumber = formData.contract_clauses.length > 0 
        ? Math.max(...formData.contract_clauses.map(c => c.clause_number || 0))
        : 15;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `คุณเป็นผู้ช่วยแก้ไขสัญญาเช่า วิเคราะห์คำสั่งและแก้ไขข้อมูลตามที่ผู้ใช้ต้องการ

ข้อมูลสัญญาปัจจุบัน:
- ชื่อผู้เช่า: ${formData.lessee_name}
- เบอร์โทรผู้เช่า: ${formData.lessee_phone}
- เลขบัตรประชาชน: ${formData.lessee_id}
- ที่อยู่ผู้เช่า: ${formData.lessee_address}
- ชื่อผู้ให้เช่า: ${formData.lessor_name}
- วันที่เริ่มสัญญา: ${formData.start_date}
- วันที่สิ้นสุดสัญญา: ${formData.end_date}
- ค่าเช่า/เดือน: ${formData.rent_monthly} บาท
- เงินประกัน: ${formData.deposit} บาท
- วันกำหนดชำระ: ${formData.pay_day}
- ค่าน้ำ/หน่วย: ${formData.water_rate} บาท
- ค่าไฟ/หน่วย: ${formData.elec_rate} บาท
- ค่าส่วนกลาง: ${formData.common_fee} บาท
- ค่าอินเทอร์เน็ต: ${formData.internet_fee} บาท
- แจ้งล่วงหน้า: ${formData.termination_notice_days} วัน
- คืนเงินประกันภายใน: ${formData.deposit_return_days} วัน
- อนุญาตเลี้ยงสัตว์: ${formData.allow_pets ? 'ใช่' : 'ไม่'}
- ห้ามสูบบุหรี่: ${formData.no_smoking ? 'ใช่' : 'ไม่'}
- กฎเพิ่มเติมปัจจุบัน (additional_rules): ${JSON.stringify(formData.additional_rules)}
- ข้อสัญญาปัจจุบัน (contract_clauses): ${currentClausesSummary}
- หมายเลขข้อสัญญาล่าสุด: ข้อ ${lastClauseNumber}

คำสั่งจากผู้ใช้: "${aiEditQuery}"

**กฎการตอบ (สำคัญมาก)**:

1. **การเพิ่มข้อสัญญาใหม่ (new_clauses)**: 
   - ถ้าผู้ใช้ระบุหมายเลขข้อ เช่น "เพิ่มข้อ 16", "ข้อ 17", "สร้างข้อที่ 18" → ใส่ใน new_clauses
   - new_clauses ต้องมี clause_number (ตัวเลข), title (หัวข้อ), content (เนื้อหา)
   - ตัวอย่าง: ผู้ใช้พิมพ์ "เพิ่มข้อ 16 ห้ามนำบุคคลภายนอกเข้าพัก" → new_clauses = [{"clause_number": 16, "title": "บุคคลภายนอก", "content": "ห้ามนำบุคคลภายนอกเข้าพักค้างคืนโดยเด็ดขาด"}]

2. **การเพิ่มกฎทั่วไป (new_rules)**:
   - ถ้าผู้ใช้ขอเพิ่มกฎทั่วไปโดยไม่ระบุหมายเลขข้อ เช่น "เพิ่มกฎห้ามสูบบุหรี่", "ห้ามส่งเสียงดัง" → ใส่ใน new_rules
   - new_rules เป็น array ของ string
   - ตัวอย่าง: ผู้ใช้พิมพ์ "เพิ่มกฎห้ามเลี้ยงสัตว์" → new_rules = ["ห้ามเลี้ยงสัตว์ทุกชนิดในห้องพัก"]

3. **การแก้ไขข้อมูลทั่วไป (updated_data)**:
   - ถ้าผู้ใช้ขอเปลี่ยนค่าเช่า, เงินประกัน, วันที่, ฯลฯ → ใส่ใน updated_data

4. **ต้องเพิ่มข้อมูลเสมอ**: ถ้าผู้ใช้ขอเพิ่มอะไร อย่าปล่อย array ว่าง [] ต้องใส่ข้อมูลที่ผู้ใช้ขอเสมอ

กรุณาส่งคืนข้อมูลที่แก้ไขแล้ว พร้อมอธิบายสิ่งที่เปลี่ยนแปลง`,
        response_json_schema: {
          type: "object",
          properties: {
            updated_data: {
              type: "object",
              properties: {
                lessee_name: { type: "string" },
                lessee_phone: { type: "string" },
                lessee_id: { type: "string" },
                lessee_address: { type: "string" },
                lessor_name: { type: "string" },
                start_date: { type: "string" },
                end_date: { type: "string" },
                rent_monthly: { type: "number" },
                deposit: { type: "number" },
                pay_day: { type: "number" },
                water_rate: { type: "number" },
                elec_rate: { type: "number" },
                common_fee: { type: "number" },
                internet_fee: { type: "number" },
                termination_notice_days: { type: "number" },
                deposit_return_days: { type: "number" },
                allow_pets: { type: "boolean" },
                no_smoking: { type: "boolean" }
              }
            },
            new_rules: {
              type: "array",
              items: { type: "string" },
              description: "กฎเพิ่มเติมทั่วไป (ไม่มีหมายเลขข้อ)"
            },
            new_clauses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  clause_number: { type: "integer", description: "หมายเลขข้อสัญญา เช่น 16, 17" },
                  title: { type: "string", description: "หัวข้อข้อสัญญา" },
                  content: { type: "string", description: "เนื้อหาข้อสัญญา" }
                },
                required: ["clause_number", "content"]
              },
              description: "ข้อสัญญาใหม่ที่มีหมายเลขข้อ เช่น ข้อ 16, ข้อ 17"
            },
            explanation: { type: "string" }
          },
          required: ["explanation"]
        }
      });

      // กรองเฉพาะข้อมูลที่เปลี่ยนแปลงจริง
      const filteredChanges = {
        explanation: response.explanation,
        new_rules: response.new_rules || [],
        new_clauses: response.new_clauses || []
      };

      // ถ้ามี updated_data ให้เช็คว่าค่าเปลี่ยนจริงหรือไม่
      if (response.updated_data && Object.keys(response.updated_data).length > 0) {
        const actualChanges = {};
        Object.entries(response.updated_data).forEach(([key, value]) => {
          const currentValue = formData[key];
          // เปรียบเทียบค่า (แปลงเป็น string เพื่อเทียบ)
          if (String(currentValue) !== String(value) && value !== undefined && value !== null) {
            actualChanges[key] = value;
          }
        });
        
        if (Object.keys(actualChanges).length > 0) {
          filteredChanges.updated_data = actualChanges;
        }
      }

      // ถ้าไม่มีการเปลี่ยนแปลงใดๆ
      if (filteredChanges.new_rules.length === 0 && filteredChanges.new_clauses.length === 0 && !filteredChanges.updated_data) {
        toast.info(response.explanation || 'ไม่มีการเปลี่ยนแปลง');
        setAiEditQuery('');
        return;
      }
      
      // เก็บผลลัพธ์ที่กรองแล้วไว้รอยืนยัน
      setAiPendingChanges(filteredChanges);
      setShowAiConfirmDialog(true);
      setAiEditQuery('');
    } catch (error) {
      console.error('AI Edit Error:', error);
      toast.error('เกิดข้อผิดพลาดในการวิเคราะห์คำสั่ง');
    } finally {
      setAiLoading(false);
    }
  };

  // ยืนยันการเปลี่ยนแปลงจาก AI
  const handleConfirmAiChanges = async () => {
    if (!aiPendingChanges) return;

    // สร้างข้อมูลใหม่
    let updatedFormData = { ...formData };

    // 1. Update general data
    if (aiPendingChanges.updated_data) {
      Object.assign(updatedFormData, aiPendingChanges.updated_data);
    }

    // 2. Add new additional rules
    if (aiPendingChanges.new_rules && aiPendingChanges.new_rules.length > 0) {
      updatedFormData.additional_rules = [...(formData.additional_rules || []), ...aiPendingChanges.new_rules];
    }

    // 3. Add or update new clauses
    if (aiPendingChanges.new_clauses && aiPendingChanges.new_clauses.length > 0) {
      const currentClauses = [...(formData.contract_clauses || [])];

      aiPendingChanges.new_clauses.forEach(newClause => {
        if (newClause.clause_number) {
          const existingIndex = currentClauses.findIndex(c => c.clause_number === newClause.clause_number);
          if (existingIndex !== -1) {
            // Update existing clause
            currentClauses[existingIndex] = { ...currentClauses[existingIndex], ...newClause };
          } else {
            // Add new clause if number doesn't exist
            currentClauses.push(newClause);
          }
        } else {
          // Append if no number
          currentClauses.push(newClause);
        }
      });

      // Re-sort and re-number all clauses to ensure they are sequential
      updatedFormData.contract_clauses = currentClauses
        .sort((a, b) => (a.clause_number || 999) - (b.clause_number || 999))
        .map((clause, index) => ({
          ...clause,
          clause_number: index + 1
        }));
    }

    // อัปเดต state
    setFormData(updatedFormData);
    
    setShowAiConfirmDialog(false);
    setAiPendingChanges(null);

    // รอให้ state อัปเดตแล้ว generate template ใหม่
    setTimeout(() => {
      // Generate template ใหม่โดยใช้ข้อมูลที่อัปเดตแล้ว
      const tenant = tenants.find(t => t.id === updatedFormData.tenant_id);
      const room = rooms.find(r => r.id === updatedFormData.room_id);

      if (tenant && room) {
        const additionalRulesHtml = updatedFormData.additional_rules.length > 0
          ? updatedFormData.additional_rules.map((rule) => `<p style="margin-left: 2em; margin-bottom: 4pt; font-size: 10pt;">${rule}</p>`).join('\n')
          : '';

        const clauses = updatedFormData.contract_clauses.length > 0 ? updatedFormData.contract_clauses : getDefaultClauses();

        const template = `
<div style="font-family: 'TH Sarabun New', 'Sarabun', sans-serif; font-size: 12pt; line-height: 1.6;">
  
  <div class="contract-page" style="position: relative; min-height: 29.7cm; padding: 1.5cm 1.5cm 2cm 1.5cm; page-break-after: always;">
    <div style="text-align: center; margin-bottom: 10pt;">
      <h3 style="margin: 0; font-size: 14pt; font-weight: bold;">แบบสัญญาเช่าที่พักอาศัย</h3>
      <p style="margin: 3pt 0 0 0; font-size: 11pt;">เรื่อง ให้ผู้เช่ารักษากฎการเช่าอาศัยตามสัญญา</p>
    </div>

    <div style="text-align: right; margin-bottom: 8pt;">
      <p style="margin: 0; font-size: 10pt;">วันที่ {วันที่ทำสัญญา} พ.ศ. ........</p>
    </div>

    <p style="text-indent: 2em; margin-bottom: 6pt; font-size: 10pt;">
      สัญญาเช่าอาคารฉบับนี้ ทำขึ้นระหว่าง
    </p>

    <p style="margin-left: 2em; margin-bottom: 6pt; font-size: 10pt;">
      (ก) นาย/นาง/นางสาว <span style="border-bottom: 1px dotted #333; min-width: 120px; display: inline-block;">{ชื่อผู้ให้เช่า}</span> (ผู้มีอำนาจในการทำสัญญา)
    </p>
    <p style="margin-left: 2em; margin-bottom: 4pt; font-size: 10pt;">
      อยู่ <span style="border-bottom: 1px dotted #333; min-width: 180px; display: inline-block;">{ที่อยู่ผู้ให้เช่า}</span>
    </p>
    <p style="margin-left: 2em; margin-bottom: 10pt; font-size: 10pt;">
      หมายเลขโทรศัพท์ <span style="border-bottom: 1px dotted #333; display: inline-block;">{เบอร์โทรผู้ให้เช่า}</span> ซึ่งต่อไปสัญญาฉบับนี้ จะเรียกว่า "ผู้ให้เช่า" ฝ่ายหนึ่งกับ
    </p>

    <p style="margin-left: 2em; margin-bottom: 6pt; font-size: 10pt;">
      (ข) นาย/นาง/นางสาว <span style="border-bottom: 1px dotted #333; min-width: 120px; display: inline-block;"><strong>{ชื่อผู้เช่า}</strong></span> อายุ ......... ปี
    </p>
    <p style="margin-left: 2em; margin-bottom: 4pt; font-size: 10pt;">
      เลขบัตรประชาชน <span style="border-bottom: 1px dotted #333; display: inline-block;">{เลขบัตรประชาชนผู้เช่า}</span> เบอร์โทรศัพท์ <span style="border-bottom: 1px dotted #333; display: inline-block;">{เบอร์โทรผู้เช่า}</span>
    </p>
    <p style="margin-left: 2em; margin-bottom: 10pt; font-size: 10pt;">
      ที่อยู่ <span style="border-bottom: 1px dotted #333; min-width: 180px; display: inline-block;">{ที่อยู่ผู้เช่า}</span> ซึ่งต่อไปสัญญาฉบับนี้ จะเรียกว่า "ผู้เช่า" อีกฝ่ายหนึ่ง
    </p>

    <p style="text-indent: 2em; margin-top: 10pt; margin-bottom: 6pt; font-size: 10pt;">
      ทั้งสองฝ่ายตกลงทำสัญญาเช่าที่พักอาศัยกันโดยมีสาระสำคัญดังต่อไปนี้
    </p>

    ${clauses.slice(0, 8).map(clause => `
    <p style="margin-bottom: 8pt; margin-top: 8pt; font-size: 10pt; line-height: 1.5;">
      <strong>ข้อ ${clause.clause_number}.</strong> ${clause.title ? ` ${clause.title}:` : ''} ${clause.content}
    </p>
    `).join('')}

    <div style="position: absolute; bottom: 1cm; right: 1.2cm; font-size: 11pt;">หน้า ๑/๓</div>
  </div>

  <div class="contract-page" style="position: relative; min-height: 29.7cm; padding: 1.5cm 1.5cm 2cm 1.5cm; page-break-after: always;">
    
    ${clauses.slice(8).map(clause => `
    <p style="margin-bottom: 8pt; margin-top: 8pt; font-size: 10pt; line-height: 1.5;">
      <strong>ข้อ ${clause.clause_number}.</strong> ${clause.title ? ` ${clause.title}:` : ''} ${clause.content}
    </p>
    `).join('')}

    ${additionalRulesHtml ? `
    <p style="margin-left: 2em; margin-bottom: 6pt; font-size: 10pt; margin-top: 12pt;">
      <strong>กฎเพิ่มเติม:</strong>
    </p>
    ${additionalRulesHtml}
    ` : ''}

    <div style="position: absolute; bottom: 1cm; right: 1.2cm; font-size: 11pt;">หน้า ๒/๓</div>
  </div>

  <div class="contract-page" style="position: relative; min-height: 29.7cm; padding: 1.5cm 1.5cm 2cm 1.5cm;">
    
    <p style="text-align: center; font-size: 11pt; font-weight: bold; margin-bottom: 30pt;">
      ลงลายมือชื่อเพื่อเป็นสัญญา
    </p>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30pt; margin-bottom: 40pt;">
      <div style="text-align: center;">
        <div id="tenant-signature-placeholder" style="height: 60pt; display: flex; align-items: center; justify-content: center; margin-bottom: 0pt;">
          
        </div>
        <div style="display: flex; justify-content: center; align-items: baseline; gap: 4pt; margin-bottom: 4pt;">
          <span style="font-size: 10pt;">ลงชื่อ</span>
          <span style="border-bottom: 1px dotted #333; flex: 1; max-width: 150px; min-height: 1em; display: inline-block;"></span>
          <span style="font-size: 10pt;">ผู้เช่า</span>
        </div>
        <p style="margin: 4pt 0 0 0; font-size: 10pt;">
          ({ชื่อผู้เช่า})
        </p>
      </div>

      <div style="text-align: center;">
        <div id="landlord-signature-placeholder" style="height: 60pt; display: flex; align-items: center; justify-content: center; margin-bottom: 0pt;">
          
        </div>
        <div style="display: flex; justify-content: center; align-items: baseline; gap: 4pt; margin-bottom: 4pt;">
          <span style="font-size: 10pt;">ลงชื่อ</span>
          <span style="border-bottom: 1px dotted #333; flex: 1; max-width: 150px; min-height: 1em; display: inline-block;"></span>
          <span style="font-size: 10pt;">ผู้ให้เช่า</span>
        </div>
        <p style="margin: 4pt 0 0 0; font-size: 10pt;">
          ({ชื่อผู้ให้เช่า})
        </p>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30pt; margin-bottom: 40pt;">
      <div style="text-align: center;">
        <div id="witness1-signature-placeholder" style="height: 60pt; display: flex; align-items: center; justify-content: center; margin-bottom: 0pt;">
          
        </div>
        <div style="display: flex; justify-content: center; align-items: baseline; gap: 4pt; margin-bottom: 4pt;">
          <span style="font-size: 10pt;">ลงชื่อ</span>
          <span style="border-bottom: 1px dotted #333; flex: 1; max-width: 150px; min-height: 1em; display: inline-block;"></span>
          <span style="font-size: 10pt;">พยาน</span>
        </div>
        <p style="margin: 4pt 0 0 0; font-size: 10pt;">
          ({ชื่อพยาน1})
        </p>
      </div>

      <div style="text-align: center;">
        <div id="witness2-signature-placeholder" style="height: 60pt; display: flex; align-items: center; justify-content: center; margin-bottom: 0pt;">
          
        </div>
        <div style="display: flex; justify-content: center; align-items: baseline; gap: 4pt; margin-bottom: 4pt;">
          <span style="font-size: 10pt;">ลงชื่อ</span>
          <span style="border-bottom: 1px dotted #333; flex: 1; max-width: 150px; min-height: 1em; display: inline-block;"></span>
          <span style="font-size: 10pt;">พยาน</span>
        </div>
        <p style="margin: 4pt 0 0 0; font-size: 10pt;">
          ({ชื่อพยาน2})
        </p>
      </div>
    </div>

    <div style="background: #e5e7eb; padding: 10pt; border: 1px solid #9ca3af; margin-top: 30pt; border-radius: 4pt;">
      <p style="margin: 0; font-size: 10pt; font-weight: bold;">หมายเหตุ:</p>
      <p style="margin: 6pt 0 0 0; font-size: 9pt; line-height: 1.4;">
        เอกสารนี้เป็นเพียงแบบสัญญาเบื้องต้น เจ้าของหอพักควรปรับแก้ไขให้เหมาะสมกับข้อเท็จจริงและตรวจสอบให้สอดคล้องกับกฎหมายที่ใช้บังคับ 
        หรือขอคำปรึกษาจากผู้เชี่ยวชาญทางกฎหมายก่อนนำไปใช้งานจริง
      </p>
    </div>

    <div style="position: absolute; bottom: 1cm; right: 1.2cm; font-size: 11pt;">หน้า ๓/๓</div>
  </div>

</div>
        `.trim();

        setFormData(prev => ({ ...prev, contract_content: template }));
        toast.success(aiPendingChanges?.explanation || 'เพิ่มข้อสัญญาและอัปเดตสัญญาสำเร็จ');
      } else {
        toast.success(aiPendingChanges?.explanation || 'บันทึกการเปลี่ยนแปลงแล้ว');
      }
    }, 100);
  };

  const handleCancelAiChanges = () => {
    setShowAiConfirmDialog(false);
    setAiPendingChanges(null);
    toast.info('ยกเลิกการเปลี่ยนแปลง');
  };

  const generateTemplate = () => {
    const tenant = tenants.find(t => t.id === formData.tenant_id);
    const room = rooms.find(r => r.id === formData.room_id);

    if (!tenant || !room) {
      toast.error('กรุณาเลือกผู้เช่าและห้องพักก่อนสร้าง Template');
      return;
    }
    
    const additionalRulesHtml = formData.additional_rules.length > 0
      ? formData.additional_rules.map((rule) => `<p style="margin-left: 2em; margin-bottom: 4pt; font-size: 10pt;">${rule}</p>`).join('\n')
      : '';

    const clauses = formData.contract_clauses.length > 0 ? formData.contract_clauses : getDefaultClauses();

    const template = `
<div style="font-family: 'TH Sarabun New', 'Sarabun', sans-serif; font-size: 12pt; line-height: 1.6;">
  
  <div class="contract-page" style="position: relative; min-height: 29.7cm; padding: 1.5cm 1.5cm 2cm 1.5cm; page-break-after: always;">
    <div style="text-align: center; margin-bottom: 10pt;">
      <h3 style="margin: 0; font-size: 14pt; font-weight: bold;">แบบสัญญาเช่าที่พักอาศัย</h3>
      <p style="margin: 3pt 0 0 0; font-size: 11pt;">เรื่อง ให้ผู้เช่ารักษากฎการเช่าอาศัยตามสัญญา</p>
    </div>

    <div style="text-align: right; margin-bottom: 8pt;">
      <p style="margin: 0; font-size: 10pt;">วันที่ {วันที่ทำสัญญา} พ.ศ. ........</p>
    </div>

    <p style="text-indent: 2em; margin-bottom: 6pt; font-size: 10pt;">
      สัญญาเช่าอาคารฉบับนี้ ทำขึ้นระหว่าง
    </p>

    <p style="margin-left: 2em; margin-bottom: 6pt; font-size: 10pt;">
      (ก) นาย/นาง/นางสาว <span style="border-bottom: 1px dotted #333; min-width: 120px; display: inline-block;">{ชื่อผู้ให้เช่า}</span> (ผู้มีอำนาจในการทำสัญญา)
    </p>
    <p style="margin-left: 2em; margin-bottom: 4pt; font-size: 10pt;">
      อยู่ <span style="border-bottom: 1px dotted #333; min-width: 180px; display: inline-block;">{ที่อยู่ผู้ให้เช่า}</span>
    </p>
    <p style="margin-left: 2em; margin-bottom: 10pt; font-size: 10pt;">
      หมายเลขโทรศัพท์ <span style="border-bottom: 1px dotted #333; display: inline-block;">{เบอร์โทรผู้ให้เช่า}</span> ซึ่งต่อไปสัญญาฉบับนี้ จะเรียกว่า "ผู้ให้เช่า" ฝ่ายหนึ่งกับ
    </p>

    <p style="margin-left: 2em; margin-bottom: 6pt; font-size: 10pt;">
      (ข) นาย/นาง/นางสาว <span style="border-bottom: 1px dotted #333; min-width: 120px; display: inline-block;"><strong>{ชื่อผู้เช่า}</strong></span> อายุ ......... ปี
    </p>
    <p style="margin-left: 2em; margin-bottom: 4pt; font-size: 10pt;">
      เลขบัตรประชาชน <span style="border-bottom: 1px dotted #333; display: inline-block;">{เลขบัตรประชาชนผู้เช่า}</span> เบอร์โทรศัพท์ <span style="border-bottom: 1px dotted #333; display: inline-block;">{เบอร์โทรผู้เช่า}</span>
    </p>
    <p style="margin-left: 2em; margin-bottom: 10pt; font-size: 10pt;">
      ที่อยู่ <span style="border-bottom: 1px dotted #333; min-width: 180px; display: inline-block;">{ที่อยู่ผู้เช่า}</span> ซึ่งต่อไปสัญญาฉบับนี้ จะเรียกว่า "ผู้เช่า" อีกฝ่ายหนึ่ง
    </p>

    <p style="text-indent: 2em; margin-top: 10pt; margin-bottom: 6pt; font-size: 10pt;">
      ทั้งสองฝ่ายตกลงทำสัญญาเช่าที่พักอาศัยกันโดยมีสาระสำคัญดังต่อไปนี้
    </p>

    ${clauses.slice(0, 8).map(clause => `
    <p style="margin-bottom: 8pt; margin-top: 8pt; font-size: 10pt; line-height: 1.5;">
      <strong>ข้อ ${clause.clause_number}.</strong> ${clause.title ? ` ${clause.title}:` : ''} ${clause.content}
    </p>
    `).join('')}

    <div style="position: absolute; bottom: 1cm; right: 1.2cm; font-size: 11pt;">หน้า ๑/๓</div>
  </div>

  <div class="contract-page" style="position: relative; min-height: 29.7cm; padding: 1.5cm 1.5cm 2cm 1.5cm; page-break-after: always;">
    
    ${clauses.slice(8).map(clause => `
    <p style="margin-bottom: 8pt; margin-top: 8pt; font-size: 10pt; line-height: 1.5;">
      <strong>ข้อ ${clause.clause_number}.</strong> ${clause.title ? ` ${clause.title}:` : ''} ${clause.content}
    </p>
    `).join('')}

    ${additionalRulesHtml ? `
    <p style="margin-left: 2em; margin-bottom: 6pt; font-size: 10pt; margin-top: 12pt;">
      <strong>กฎเพิ่มเติม:</strong>
    </p>
    ${additionalRulesHtml}
    ` : ''}

    <div style="position: absolute; bottom: 1cm; right: 1.2cm; font-size: 11pt;">หน้า ๒/๓</div>
  </div>

  <div class="contract-page" style="position: relative; min-height: 29.7cm; padding: 1.5cm 1.5cm 2cm 1.5cm;">
    
    <p style="text-align: center; font-size: 11pt; font-weight: bold; margin-bottom: 30pt;">
      ลงลายมือชื่อเพื่อเป็นสัญญา
    </p>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30pt; margin-bottom: 40pt;">
      <div style="text-align: center;">
        <div id="tenant-signature-placeholder" style="height: 60pt; display: flex; align-items: center; justify-content: center; margin-bottom: 0pt;">
          
        </div>
        <div style="display: flex; justify-content: center; align-items: baseline; gap: 4pt; margin-bottom: 4pt;">
          <span style="font-size: 10pt;">ลงชื่อ</span>
          <span style="border-bottom: 1px dotted #333; flex: 1; max-width: 150px; min-height: 1em; display: inline-block;"></span>
          <span style="font-size: 10pt;">ผู้เช่า</span>
        </div>
        <p style="margin: 4pt 0 0 0; font-size: 10pt;">
          ({ชื่อผู้เช่า})
        </p>
      </div>

      <div style="text-align: center;">
        <div id="landlord-signature-placeholder" style="height: 60pt; display: flex; align-items: center; justify-content: center; margin-bottom: 0pt;">
          
        </div>
        <div style="display: flex; justify-content: center; align-items: baseline; gap: 4pt; margin-bottom: 4pt;">
          <span style="font-size: 10pt;">ลงชื่อ</span>
          <span style="border-bottom: 1px dotted #333; flex: 1; max-width: 150px; min-height: 1em; display: inline-block;"></span>
          <span style="font-size: 10pt;">ผู้ให้เช่า</span>
        </div>
        <p style="margin: 4pt 0 0 0; font-size: 10pt;">
          ({ชื่อผู้ให้เช่า})
        </p>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30pt; margin-bottom: 40pt;">
      <div style="text-align: center;">
        <div id="witness1-signature-placeholder" style="height: 60pt; display: flex; align-items: center; justify-content: center; margin-bottom: 0pt;">
          
        </div>
        <div style="display: flex; justify-content: center; align-items: baseline; gap: 4pt; margin-bottom: 4pt;">
          <span style="font-size: 10pt;">ลงชื่อ</span>
          <span style="border-bottom: 1px dotted #333; flex: 1; max-width: 150px; min-height: 1em; display: inline-block;"></span>
          <span style="font-size: 10pt;">พยาน</span>
        </div>
        <p style="margin: 4pt 0 0 0; font-size: 10pt;">
          ({ชื่อพยาน1})
        </p>
      </div>

      <div style="text-align: center;">
        <div id="witness2-signature-placeholder" style="height: 60pt; display: flex; align-items: center; justify-content: center; margin-bottom: 0pt;">
          
        </div>
        <div style="display: flex; justify-content: center; align-items: baseline; gap: 4pt; margin-bottom: 4pt;">
          <span style="font-size: 10pt;">ลงชื่อ</span>
          <span style="border-bottom: 1px dotted #333; flex: 1; max-width: 150px; min-height: 1em; display: inline-block;"></span>
          <span style="font-size: 10pt;">พยาน</span>
        </div>
        <p style="margin: 4pt 0 0 0; font-size: 10pt;">
          ({ชื่อพยาน2})
        </p>
      </div>
    </div>

    <div style="background: #e5e7eb; padding: 10pt; border: 1px solid #9ca3af; margin-top: 30pt; border-radius: 4pt;">
      <p style="margin: 0; font-size: 10pt; font-weight: bold;">หมายเหตุ:</p>
      <p style="margin: 6pt 0 0 0; font-size: 9pt; line-height: 1.4;">
        เอกสารนี้เป็นเพียงแบบสัญญาเบื้องต้น เจ้าของหอพักควรปรับแก้ไขให้เหมาะสมกับข้อเท็จจริงและตรวจสอบให้สอดคล้องกับกฎหมายที่ใช้บังคับ 
        หรือขอคำปรึกษาจากผู้เชี่ยวชาญทางกฎหมายก่อนนำไปใช้งานจริง
      </p>
    </div>

    <div style="position: absolute; bottom: 1cm; right: 1.2cm; font-size: 11pt;">หน้า ๓/๓</div>
  </div>

</div>
    `.trim();

    setFormData(prev => ({ ...prev, contract_content: template }));
    toast.success('สร้าง Template สำเร็จ');
  };

  const replacePlaceholders = (content) => {
    if (!content) return '';
    
    const tenant = tenants.find(t => t.id === formData.tenant_id);
    const room = rooms.find(r => r.id === formData.room_id);

    const petRule = formData.allow_pets 
      ? 'อนุญาตให้เลี้ยงสัตว์ได้ตามข้อตกลง' 
      : 'ห้ามนำสัตว์เลี้ยงเข้ามาในพื้นที่เช่าโดยเด็ดขาด';

    const smokingRule = formData.no_smoking 
      ? 'ห้ามสูบบุหรี่ภายในอาคารและห้องเช่า' 
      : 'อนุญาตให้สูบบุหรี่ได้ในพื้นที่ที่กำหนด';

    const calculatedAdvanceRentTotal = (formData.rent_monthly || 0) * (formData.advance_rent_months || 0);
    const calculatedDepositTotal = (formData.rent_monthly || 0) * (formData.deposit_months || 0);

    const replacements = {
      '{ชื่อผู้เช่า}': tenant?.full_name || formData.lessee_name || '[ชื่อผู้เช่า]',
      '{เบอร์โทรผู้เช่า}': tenant?.phone || formData.lessee_phone || '[เบอร์โทร]',
      '{ที่อยู่ผู้เช่า}': tenant?.address || formData.lessee_address || '[ที่อยู่]',
      '{เลขบัตรประชาชนผู้เช่า}': tenant?.national_id || formData.lessee_id || '[เลขบัตร]',
      '{ชื่อผู้ให้เช่า}': formData.lessor_name || '[ชื่อผู้ให้เช่า]',
      '{เบอร์โทรผู้ให้เช่า}': formData.lessor_phone || '[เบอร์โทร]',
      '{ที่อยู่ผู้ให้เช่า}': formData.lessor_address || '[ที่อยู่]',
      '{ที่อยู่หอพัก}': formData.full_address || '[ที่อยู่]',
      '{หมายเลขห้อง}': room?.room_number || formData.room_no || '[หมายเลขห้อง]',
      '{ชั้น}': room?.floor?.toString() || formData.floor || '[ชั้น]',
      '{ค่าเช่า}': (room?.price || formData.rent_monthly || 0).toLocaleString(),
      '{เงินประกัน}': (formData.deposit || 0).toLocaleString(),
      '{วันที่เริ่มสัญญา}': formData.start_date ? convertToBuddhistYear(formData.start_date) : '[วันที่เริ่ม]',
      '{วันที่สิ้นสุดสัญญา}': formData.end_date ? convertToBuddhistYear(formData.end_date) : '[วันที่สิ้นสุด]',
      '{วันที่ทำสัญญา}': formData.contract_date ? convertToBuddhistYear(formData.contract_date) : '[วันที่ทำสัญญา]',
      '{วันกำหนดชำระ}': formData.pay_day?.toString() || '[วันชำระ]',
      '{ค่าน้ำ/หน่วย}': formData.water_rate?.toString() || '[ค่าน้ำ]',
      '{ค่าไฟ/หน่วย}': formData.elec_rate?.toString() || '[ค่าไฟ]',
      '{ค่าอินเทอร์เน็ต}': (formData.internet_fee || 0).toLocaleString(),
      '{ชื่อพยาน1}': formData.witness1_name || '[ชื่อพยาน]',
      '{ชื่อพยาน2}': formData.witness2_name || '[ชื่อพยาน]',
      '{จำนวนวันแจ้งล่วงหน้า}': formData.termination_notice_days?.toString() || '30',
      '{จำนวนวันคืนเงินประกัน}': formData.deposit_return_days?.toString() || '7',
      '{จำนวนวันค้างชำระ}': formData.late_payment_grace_days?.toString() || '7',
      '{กฎเลี้ยงสัตว์}': petRule,
      '{กฎสูบบุหรี่}': smokingRule,
      '{ค่าเช่าเฟอร์นิเจอร์}': (formData.furniture_rent || 0).toLocaleString(),
      '{ค่าส่วนกลาง}': (formData.common_fee || 0).toLocaleString(),
      '{เดือนปัจจุบัน}': format(new Date(), 'MMMM', { locale: th }),
      '{จำนวนเดือนค่าเช่าล่วงหน้า}': formData.advance_rent_months?.toString() || '1',
      '{ค่าเช่าล่วงหน้าทั้งหมด}': calculatedAdvanceRentTotal.toLocaleString(),
      '{จำนวนเดือนเงินประกัน}': formData.deposit_months?.toString() || '1',
      '{เงินประกันทั้งหมด}': calculatedDepositTotal.toLocaleString(),
      '{ค่าอุปกรณ์ไฟฟ้า}': (formData.appliance_fee || 0).toLocaleString(),
    };

    let result = content;
    Object.keys(replacements).forEach(key => {
      result = result.replace(new RegExp(key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replacements[key]);
    });

    if (formData.tenant_signature) {
      result = result.replace(
        /<div id="tenant-signature-placeholder"[^>]*>[\s\S]*?<\/div>/g,
        `<div style="height: 70pt; display: flex; align-items: center; justify-content: center; margin-bottom: 0pt;"><img src="${formData.tenant_signature}" style="max-height: 65pt; max-width: 250px; object-fit: contain;" alt="ลายเซ็นผู้เช่า" /></div>`
      );
    }
    if (formData.landlord_signature) {
      result = result.replace(
        /<div id="landlord-signature-placeholder"[^>]*>[\s\S]*?<\/div>/g,
        `<div style="height: 70pt; display: flex; align-items: center; justify-content: center; margin-bottom: 0pt;"><img src="${formData.landlord_signature}" style="max-height: 65pt; max-width: 250px; object-fit: contain;" alt="ลายเซ็นผู้ให้เช่า" /></div>`
      );
    }
    if (formData.witness1_signature) {
      result = result.replace(
        /<div id="witness1-signature-placeholder"[^>]*>[\s\S]*?<\/div>/g,
        `<div style="height: 70pt; display: flex; align-items: center; justify-content: center; margin-bottom: 0pt;"><img src="${formData.witness1_signature}" style="max-height: 65pt; max-width: 250px; object-fit: contain;" alt="ลายเซ็นพยาน 1" /></div>`
      );
    }
    if (formData.witness2_signature) {
      result = result.replace(
        /<div id="witness2-signature-placeholder"[^>]*>[\s\S]*?<\/div>/g,
        `<div style="height: 70pt; display: flex; align-items: center; justify-content: center; margin-bottom: 0pt;"><img src="${formData.witness2_signature}" style="max-height: 65pt; max-width: 250px; object-fit: contain;" alt="ลายเซ็นพยาน 2" /></div>`
      );
    }

    return result;
  };

  const handleOpenSignature = async (type) => {
    console.log('🖊️ Opening signature dialog for:', type);
    console.log('Current activeContractId:', activeContractId);
    console.log('Current tempContractId:', tempContractId);
    
    setCurrentSignatureType(type);
    setHasReadContract(false);
    
    if (type === 'tenant') {
      // ตรวจสอบข้อมูลให้ครบถ้วน
      if (!formData.lessor_name || !formData.lessee_name || !formData.start_date) {
        toast.error('❌ กรุณากรอกข้อมูลสัญญาให้ครบถ้วน (ผู้ให้เช่า, ผู้เช่า, วันที่เริ่มสัญญา) ก่อนลงนาม');
        return;
      }
      
      if (!formData.lessee_phone) {
        toast.error('❌ กรุณากรอกเบอร์โทรศัพท์ผู้เช่าก่อน');
        return;
      }

      let contractIdToUse = activeContractId;
      
      // ถ้ายังไม่มี contract ID ให้บันทึกก่อน
      if (!contractIdToUse) {
        console.log('📝 No contract ID found, saving contract first...');
        toast.info('💾 กำลังบันทึกสัญญาก่อนลงนาม...');
        
        const saved = await saveContract(true, true);
        console.log('💾 Save result:', saved);
        
        if (!saved || !saved.id) {
          toast.error('❌ ไม่สามารถบันทึกสัญญาได้ กรุณาลองใหม่');
          return;
        }
        
        contractIdToUse = saved.id;
        setTempContractId(contractIdToUse);
        
        console.log('✅ Contract saved, ID:', contractIdToUse);
        
        // Invalidate and refetch contract
        await queryClient.invalidateQueries(['contract', contractIdToUse]);
        
        // Update URL if needed
        if (!contractId && contractIdToUse) {
          window.history.pushState({}, '', createPageUrl('ContractEditor') + `?contractId=${contractIdToUse}`);
        }
        
        toast.success('✅ บันทึกสัญญาสำเร็จ');
        
        // รอให้ state update
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      console.log('📱 Opening OTP dialog with contractId:', contractIdToUse);
      
      // เปิด OTP Dialog
      setShowOtpDialog(true);
      setOtpSent(false);
      setOtp('');
      setOtpError('');
      setOtpExpiresIn(300);
      if (otpTimerRef.current) {
        clearInterval(otpTimerRef.current);
      }
    } else {
      // สำหรับลายเซ็นอื่นๆ (ผู้ให้เช่า, พยาน) เปิด dialog ลายเซ็นเลย
      console.log('✍️ Opening signature dialog directly for:', type);
      setShowSignatureDialog(true);
    }
  };

  const handleSaveSignature = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const signatureData = signaturePadRef.current.toDataURL();
      
      setFormData(prev => ({
        ...prev,
        [`${currentSignatureType}_signature`]: signatureData
      }));
      
      toast.success('บันทึกลายเซ็นสำเร็จ');
      setShowSignatureDialog(false);
      setHasReadContract(false);
    } else {
      toast.error('กรุณาเซ็นชื่อก่อน');
    }
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ],
  };

  const handleAddRule = () => {
    setFormData(prev => ({
      ...prev,
      additional_rules: [...prev.additional_rules, '']
    }));
  };

  const handleRemoveRule = (index) => {
    setFormData(prev => ({
      ...prev,
      additional_rules: prev.additional_rules.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateRule = (index, value) => {
    setFormData(prev => ({
      ...prev,
      additional_rules: prev.additional_rules.map((rule, i) => i === index ? value : rule)
    }));
  };

  const handleAddClause = () => {
    const newClauseNumber = formData.contract_clauses.length + 1;
    setFormData(prev => ({
      ...prev,
      contract_clauses: [
        ...prev.contract_clauses,
        {
          clause_number: newClauseNumber,
          title: '',
          content: ''
        }
      ]
    }));
  };

  const handleRemoveClause = (index) => {
    setFormData(prev => ({
      ...prev,
      contract_clauses: prev.contract_clauses
        .filter((_, i) => i !== index)
        .map((clause, i) => ({ ...clause, clause_number: i + 1 }))
    }));
  };

  const handleUpdateClause = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      contract_clauses: prev.contract_clauses.map((clause, i) => 
        i === index ? { ...clause, [field]: value } : clause
      )
    }));
  };

  const handleSendOtp = async () => {
    const contractIdToUse = activeContractId;
    
    if (!contractIdToUse) {
      toast.error('❌ ไม่พบข้อมูลสัญญา กรุณาบันทึกสัญญาก่อน');
      console.error('No contract ID found:', { contractId, tempContractId, activeContractId });
      return;
    }

    const phoneNumber = formData.lessee_phone;
    if (!phoneNumber) {
      toast.error('❌ ไม่พบเบอร์โทรศัพท์ผู้เช่า กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    console.log('📱 Sending OTP to:', phoneNumber, 'for contract:', contractIdToUse);

    setSendingOtp(true);
    setOtpError('');

    try {
      const response = await base44.functions.invoke('sendSmsOtp', {
        phoneNumber: phoneNumber,
        contractId: contractIdToUse
      });

      console.log('✅ OTP Response:', response.data);

      if (response.data.success) {
        setOtpSent(true);
        setOtpExpiresIn(response.data.expiresIn || 300);
        toast.success('✅ ส่งรหัส OTP ไปยังเบอร์ ' + phoneNumber + ' แล้ว');
      } else {
        setOtpError(response.data.error || 'ส่ง OTP ไม่สำเร็จ');
        toast.error('❌ ' + (response.data.error || 'ส่ง OTP ไม่สำเร็จ'));
      }
    } catch (error) {
      console.error("❌ Error sending OTP:", error);
      const errorMsg = error.response?.data?.error || error.message || 'เกิดข้อผิดพลาด';
      setOtpError(errorMsg);
      toast.error('❌ ส่ง OTP ไม่สำเร็จ: ' + errorMsg);
    }

    setSendingOtp(false);
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setOtpError('กรุณากรอกรหัส OTP 6 หลัก');
      return;
    }

    const contractIdToUse = activeContractId;
    
    if (!contractIdToUse) {
      toast.error('❌ ไม่พบข้อมูลสัญญา');
      return;
    }

    setVerifyingOtp(true);
    setOtpError('');

    try {
      const response = await base44.functions.invoke('verifySmsOtp', {
        phoneNumber: formData.lessee_phone,
        contractId: contractIdToUse,
        otp: otp
      });

      if (response.data.success) {
        toast.success('✅ ยืนยันตัวตนสำเร็จ');
        setShowOtpDialog(false);
        setOtp('');
        setOtpSent(false);
        setOtpExpiresIn(300);
        setShowSignatureDialog(true);
      } else {
        setOtpError(response.data.error || 'ยืนยัน OTP ไม่สำเร็จ');
        toast.error('❌ ' + (response.data.error || 'ยืนยัน OTP ไม่สำเร็จ'));
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      const errorMsg = error.response?.data?.error || error.message || 'เกิดข้อผิดพลาด';
      setOtpError(errorMsg);
      toast.error('❌ ยืนยัน OTP ไม่สำเร็จ: ' + errorMsg);
    }

    setVerifyingOtp(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="no-print bg-white border-b border-slate-200 p-4 shadow-sm">
        <div className="w-full px-2 md:max-w-7xl md:mx-auto space-y-3">
          <h1 className="text-sm md:text-xl font-bold text-slate-800 break-words">แบบสัญญาเช่าที่พักอาศัย (A4)</h1>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate(createPageUrl('Contracts'))} size="sm" className="text-xs md:text-sm">
              กลับ
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setShowClausesEditor(!showClausesEditor)}
              className="text-xs md:text-sm"
            >
              <List className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">{showClausesEditor ? 'ซ่อนรายการข้อสัญญา' : 'แสดงรายการข้อสัญญา'}</span>
              <span className="md:hidden">{showClausesEditor ? 'ซ่อน' : 'แสดง'}</span>
            </Button>
            <Button onClick={handleSave} disabled={isSaving || saveMutation.isPending} size="sm" className="bg-green-600 hover:bg-green-700 text-xs md:text-sm">
              <Save className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              {isSaving || saveMutation.isPending ? 'บันทึก...' : 'บันทึก'}
            </Button>
            <Button onClick={handlePrint} variant="outline" size="sm" className="text-xs md:text-sm">
              <Printer className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              พิมพ์
            </Button>
          </div>
        </div>
      </div>

      <div className="no-print max-w-7xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">ข้อมูลสัญญา</h2>
          
          {/* AI Quick Edit Section */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-200 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-purple-800">แก้ไขด้วย AI</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={aiEditQuery}
                onChange={(e) => setAiEditQuery(e.target.value)}
                placeholder="เช่น 'เปลี่ยนค่าเช่าเป็น 5000' หรือ 'ต่อสัญญาอีก 1 ปี'"
                className="flex-1 bg-white"
                onKeyDown={(e) => e.key === 'Enter' && !aiLoading && handleAIEdit()}
                disabled={aiLoading}
              />
              <Button 
                onClick={handleAIEdit} 
                disabled={aiLoading || !aiEditQuery.trim()}
                className="bg-gradient-to-r from-purple-600 to-blue-600"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-purple-600 mt-2">
              💡 ตัวอย่าง: "ค่าเช่า 4500", "เงินประกัน 10000", "ต่อสัญญาถึง 31 ธ.ค. 2568", "อนุญาตเลี้ยงสัตว์"
            </p>
          </div>
          
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-6">
            <h3 className="text-md font-semibold mb-3 text-purple-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              ข้อมูลผู้ให้เช่า (ผู้มีอำนาจลงนาม)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ชื่อ-นามสกุล *</Label>
                <Input
                  value={formData.lessor_name}
                  onChange={(e) => setFormData({ ...formData, lessor_name: e.target.value })}
                  placeholder="เช่น นายสมชาย ใจดี"
                  className="bg-white"
                />
              </div>
              <div>
                <Label>เลขบัตรประชาชน</Label>
                <Input
                  value={formData.lessor_id}
                  onChange={(e) => setFormData({ ...formData, lessor_id: e.target.value })}
                  placeholder="1234567890123"
                  maxLength={13}
                  className="bg-white"
                />
              </div>
              <div>
                <Label>เบอร์โทรศัพท์</Label>
                <Input
                  value={formData.lessor_phone}
                  onChange={(e) => setFormData({ ...formData, lessor_phone: e.target.value })}
                  placeholder="0812345678"
                  className="bg-white"
                />
              </div>
              <div>
                <Label>ที่อยู่</Label>
                <Input
                  value={formData.lessor_address}
                  onChange={(e) => setFormData({ ...formData, lessor_address: e.target.value })}
                  placeholder="ที่อยู่เต็มของผู้ให้เช่า"
                  className="bg-white"
                />
              </div>
            </div>
            <p className="text-xs text-purple-700 mt-2">
              💡 คุณสามารถตั้งค่าข้อมูลผู้ให้เช่าเริ่มต้นได้ที่หน้า "ตั้งค่า" → "ผู้มีอำนาจลงนาม"
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label>เลือกผู้เช่า *</Label>
              <Select value={formData.tenant_id} onValueChange={handleTenantChange}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกผู้เช่า" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map(tenant => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.full_name} - {tenant.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>เลือกห้อง *</Label>
              <Select value={formData.room_id} onValueChange={handleRoomChange}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกห้อง" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      ห้อง {room.room_number} - ชั้น {room.floor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label className="text-xs md:text-sm">วันที่ทำสัญญา</Label>
                <Input
                  type="date"
                  value={formData.contract_date}
                  onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs md:text-sm">วันที่เริ่มสัญญา *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs md:text-sm">วันที่สิ้นสุดสัญญา *</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <Label className="text-xs md:text-sm">
                <span className="hidden md:inline">ค่าเช่า/เดือน (บาท)</span>
                <span className="md:hidden">ค่าเช่า/เดือน</span>
              </Label>
              <Input
                type="number"
                value={formData.rent_monthly}
                onChange={(e) => setFormData({ ...formData, rent_monthly: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label className="text-xs md:text-sm">
                <span className="hidden md:inline">เงินประกัน (บาท)</span>
                <span className="md:hidden">ประกัน</span>
              </Label>
              <Input
                type="number"
                value={formData.deposit}
                onChange={(e) => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label className="text-xs md:text-sm">
                <span className="hidden md:inline">วันกำหนดชำระ</span>
                <span className="md:hidden">กำหนดชำระ</span>
              </Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={formData.pay_day}
                onChange={(e) => setFormData({ ...formData, pay_day: parseInt(e.target.value) || 5 })}
              />
            </div>
            <div>
              <Label className="text-xs md:text-sm">
                <span className="hidden md:inline">ค่าปรับล่าช้า/วัน (บาท)</span>
                <span className="md:hidden">ค่าปรับ/วัน</span>
              </Label>
              <Input
                type="number"
                value={formData.late_fee_per_per_day}
                onChange={(e) => setFormData({ ...formData, late_fee_per_per_day: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <Label className="text-xs md:text-sm">
                <span className="hidden md:inline">ค่าเช่าล่วงหน้า (เดือน)</span>
                <span className="md:hidden">ล่วงหน้า</span>
              </Label>
              <Input
                type="number"
                min="0"
                value={formData.advance_rent_months}
                onChange={(e) => setFormData({ ...formData, advance_rent_months: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-slate-500 mt-1">
                <span className="hidden md:inline">เช่น 1 = ล่วงหน้า 1 เดือน</span>
                <span className="md:hidden">เช่น 1 = 1 เดือน</span>
              </p>
            </div>
            <div>
              <Label className="text-xs md:text-sm">
                <span className="hidden md:inline">เงินประกัน (เดือน)</span>
                <span className="md:hidden">ประกัน</span>
              </Label>
              <Input
                type="number"
                min="0"
                value={formData.deposit_months}
                onChange={(e) => setFormData({ ...formData, deposit_months: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-slate-500 mt-1">
                <span className="hidden md:inline">เช่น 1 = ประกัน 1 เดือน</span>
                <span className="md:hidden">เช่น 1 = 1 เดือน</span>
              </p>
            </div>
            <div>
              <Label className="text-xs md:text-sm">
                <span className="hidden md:inline">ค่าอุปกรณ์ไฟฟ้า (บาท)</span>
                <span className="md:hidden">อุปกรณ์</span>
              </Label>
              <Input
                type="number"
                min="0"
                value={formData.appliance_fee}
                onChange={(e) => setFormData({ ...formData, appliance_fee: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-slate-500 mt-1">
                <span className="hidden md:inline">ค่าครุภัณฑ์/เฟอร์นิเจอร์</span>
                <span className="md:hidden">ครุภัณฑ์</span>
              </p>
            </div>
          </div>

          {showClausesEditor && (
            <Card className="mb-4 border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <List className="w-5 h-5 text-blue-600" />
                    แก้ไขข้อสัญญา ({formData.contract_clauses.length} ข้อ)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddClause}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      เพิ่มข้อใหม่
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        generateTemplate();
                        toast.success('บันทึกการแก้ไขข้อสัญญาสำเร็จ');
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      บันทึกการแก้ไข
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
                {formData.contract_clauses.map((clause, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-semibold text-blue-900">ข้อ {clause.clause_number}</Label>
                      {formData.contract_clauses.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveClause(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="หัวข้อข้อสัญญา (ถ้ามี)"
                      value={clause.title || ''}
                      onChange={(e) => handleUpdateClause(index, 'title', e.target.value)}
                      className="mb-2"
                    />
                    <ReactQuill
                      theme="snow"
                      value={clause.content}
                      onChange={(value) => handleUpdateClause(index, 'content', value)}
                      modules={{ toolbar: [['bold', 'italic', 'underline']] }}
                      style={{ backgroundColor: 'white' }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {showEditor && (
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-3">
                <Label className="text-base font-semibold">แก้ไขเนื้อหาสัญญา</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateTemplate}
                  disabled={!formData.tenant_id || !formData.room_id}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  สร้าง Template ใหม่
                </Button>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-blue-800">
                  💡 คุณสามารถแก้ไขเนื้อหาสัญญาได้ตามต้องการ ตัวแปรเช่น {'{ชื่อผู้เช่า}'}, {'{ค่าเช่า}'} จะถูกแทนที่ด้วยข้อมูลจริงเมื่อแสดงผลและพิมพ์
                </p>
              </div>
              <ReactQuill
                value={formData.contract_content}
                onChange={(value) => setFormData({ ...formData, contract_content: value })}
                modules={modules}
                theme="snow"
                style={{ height: '400px', marginBottom: '50px' }}
                placeholder="พิมพ์เนื้อหาสัญญา หรือคลิกปุ่ม 'สร้าง Template ใหม่' เพื่อเริ่มต้น..."
              />
            </div>
          )}

          <div className="border-t pt-4 mt-4">
          <h3 className="text-sm md:text-md font-semibold mb-3 text-slate-700">เงื่อนไขสัญญาเช่า</h3>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <Label className="text-xs md:text-sm leading-tight">
                <span className="hidden md:inline">จำนวนวันแจ้งล่วงหน้าก่อนบอกเลิก (วัน)</span>
                <span className="md:hidden">แจ้งล่วงหน้า (วัน)</span>
              </Label>
              <Input
                type="number"
                min="1"
                value={formData.termination_notice_days}
                onChange={(e) => setFormData({ ...formData, termination_notice_days: parseInt(e.target.value) || 30 })}
              />
            </div>
            <div>
              <Label className="text-xs md:text-sm leading-tight">
                <span className="hidden md:inline">จำนวนวันคืนเงินประกัน (วัน)</span>
                <span className="md:hidden">คืนประกัน (วัน)</span>
              </Label>
              <Input
                type="number"
                min="1"
                value={formData.deposit_return_days}
                onChange={(e) => setFormData({ ...formData, deposit_return_days: parseInt(e.target.value) || 7 })}
              />
            </div>
            <div>
              <Label className="text-xs md:text-sm leading-tight">
                <span className="hidden md:inline">จำนวนวันค้างชำระที่อนุญาต (วัน)</span>
                <span className="md:hidden">ค้างชำระ (วัน)</span>
              </Label>
              <Input
                type="number"
                min="1"
                value={formData.late_payment_grace_days}
                onChange={(e) => setFormData({ ...formData, late_payment_grace_days: parseInt(e.target.value) || 7 })}
              />
            </div>
          </div>

            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allow_pets"
                  checked={formData.allow_pets}
                  onCheckedChange={(checked) => setFormData({ ...formData, allow_pets: checked })}
                />
                <label htmlFor="allow_pets" className="text-sm cursor-pointer">
                  อนุญาตให้เลี้ยงสัตว์
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="no_smoking"
                  checked={formData.no_smoking}
                  onCheckedChange={(checked) => setFormData({ ...formData, no_smoking: checked })}
                />
                <label htmlFor="no_smoking" className="text-sm cursor-pointer">
                  ห้ามสูบบุหรี่ในอาคาร
                </label>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>กฎเพิ่มเติม</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddRule}
                  className="bg-green-50 hover:bg-green-100"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  เพิ่มกฎใหม่
                </Button>
              </div>
              <div className="space-y-2">
                {formData.additional_rules.map((rule, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={rule}
                      onChange={(e) => handleUpdateRule(index, e.target.value)}
                      placeholder={`กฎเพิ่มเติมข้อ ${index + 1} (เช่น ไม่อนุญาตให้บุคคลภายนอกเข้าพักค้างคืน)`}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => handleRemoveRule(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {formData.additional_rules.length === 0 && (
                  <p className="text-sm text-slate-500 italic">
                    ยังไม่มีกฎเพิ่มเติม คลิกปุ่ม "เพิ่มกฎใหม่" เพื่อเพิ่ม
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4 mt-4">
            <div>
              <Label>ชื่อพยานคนที่ 1</Label>
              <Input
                value={formData.witness1_name}
                onChange={(e) => setFormData({ ...formData, witness1_name: e.target.value })}
                placeholder="ชื่อ-นามสกุล พยาน 1"
              />
            </div>
            <div>
              <Label>ชื่อพยานคนที่ 2</Label>
              <Input
                value={formData.witness2_name}
                onChange={(e) => setFormData({ ...formData, witness2_name: e.target.value })}
                placeholder="ชื่อ-นามสกุล พยาน 2"
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <Label className="mb-3 block text-base font-semibold">ลายเซ็นอิเล็กทรอนิกส์</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenSignature('tenant')}
                className={formData.tenant_signature ? 'border-green-500 bg-green-50' : ''}
              >
                <PenTool className="w-4 h-4 mr-2" />
                {formData.tenant_signature ? '✓ ผู้เช่า' : '+ ผู้เช่า'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenSignature('landlord')}
                className={formData.landlord_signature ? 'border-green-500 bg-green-50' : ''}
              >
                <PenTool className="w-4 h-4 mr-2" />
                {formData.landlord_signature ? '✓ ผู้ให้เช่า' : '+ ผู้ให้เช่า'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenSignature('witness1')}
                className={formData.witness1_signature ? 'border-green-500 bg-green-50' : ''}
              >
                <PenTool className="w-4 h-4 mr-2" />
                {formData.witness1_signature ? '✓ พยาน 1' : '+ พยาน 1'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenSignature('witness2')}
                className={formData.witness2_signature ? 'border-green-500 bg-green-50' : ''}
              >
                <PenTool className="w-4 h-4 mr-2" />
                {formData.witness2_signature ? '✓ พยาน 2' : '+ พยาน 2'}
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {formData.tenant_signature && (
                <div className="border rounded-lg p-2 bg-green-50 flex flex-col items-center justify-center">
                  <p className="text-xs text-slate-600 mb-1">ลายเซ็นผู้เช่า:</p>
                  <img src={formData.tenant_signature} alt="ลายเซ็นผู้เช่า" className="w-full h-20 object-contain" />
                </div>
              )}
              {formData.landlord_signature && (
                <div className="border rounded-lg p-2 bg-green-50 flex flex-col items-center justify-center">
                  <p className="text-xs text-slate-600 mb-1">ลายเซ็นผู้ให้เช่า:</p>
                  <img src={formData.landlord_signature} alt="ลายเซ็นผู้ให้เช่า" className="w-full h-20 object-contain" />
                </div>
              )}
              {formData.witness1_signature && (
                <div className="border rounded-lg p-2 bg-green-50 flex flex-col items-center justify-center">
                  <p className="text-xs text-slate-600 mb-1">ลายเซ็นพยาน 1:</p>
                  <img src={formData.witness1_signature} alt="ลายเซ็นพยาน 1" className="w-full h-20 object-contain" />
                </div>
              )}
              {formData.witness2_signature && (
                <div className="border rounded-lg p-2 bg-green-50 flex flex-col items-center justify-center">
                  <p className="text-xs text-slate-600 mb-1">ลายเซ็นพยาน 2:</p>
                  <img src={formData.witness2_signature} alt="ลายเซ็นพยาน 2" className="w-full h-20 object-contain" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Confirm Dialog */}
      <Dialog open={showAiConfirmDialog} onOpenChange={setShowAiConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              ยืนยันการเปลี่ยนแปลง
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {aiPendingChanges && (
              <>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-purple-800 font-medium mb-2">
                    {aiPendingChanges.explanation}
                  </p>
                </div>

                {aiPendingChanges.new_rules && aiPendingChanges.new_rules.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-green-800 mb-2">กฎที่จะเพิ่ม:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {aiPendingChanges.new_rules.map((rule, idx) => (
                        <li key={idx} className="text-sm text-green-700">{rule}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiPendingChanges.updated_data && Object.keys(aiPendingChanges.updated_data).length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-800 mb-2">ข้อมูลที่จะแก้ไข:</p>
                    <ul className="space-y-1">
                      {Object.entries(aiPendingChanges.updated_data).map(([key, value]) => (
                        <li key={key} className="text-sm text-blue-700">
                          <span className="font-medium">{key}:</span> {String(value)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiPendingChanges.new_clauses && aiPendingChanges.new_clauses.length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-indigo-800 mb-2">ข้อสัญญาที่จะเพิ่ม:</p>
                    <ul className="space-y-2">
                      {aiPendingChanges.new_clauses.map((clause, idx) => (
                        <li key={idx} className="text-sm text-indigo-700 border-l-2 border-indigo-300 pl-3">
                          <span className="font-bold">ข้อ {clause.clause_number}.</span>
                          {clause.title && <span className="font-medium"> {clause.title}:</span>}
                          <p className="text-indigo-600 mt-1">{clause.content}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCancelAiChanges}>
                ยกเลิก
              </Button>
              <Button 
                onClick={handleConfirmAiChanges}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                ยืนยัน
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOtpDialog} onOpenChange={(open) => {
        setShowOtpDialog(open);
        if (!open) {
          setOtp('');
          setOtpError('');
          setOtpSent(false);
          setOtpExpiresIn(300);
          if (otpTimerRef.current) {
            clearInterval(otpTimerRef.current);
          }
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              ยืนยันตัวตนก่อนลงนาม
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 leading-relaxed">
                📱 เพื่อความปลอดภัย กรุณายืนยันตัวตนด้วยรหัส OTP ที่ส่งไปยังเบอร์โทรศัพท์
              </p>
              <p className="text-xs text-blue-600 mt-2">
                เบอร์: <strong>{formData.lessee_phone || 'ไม่ระบุ'}</strong>
              </p>
            </div>

            {!otpSent && (
              <Button
                onClick={handleSendOtp}
                disabled={sendingOtp || !formData.lessee_phone || !activeContractId}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {sendingOtp ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    กำลังส่ง OTP...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    ส่งรหัส OTP
                  </>
                )}
              </Button>
            )}

            {otpSent && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-green-800">
                      ✅ ส่งรหัส OTP แล้ว
                    </p>
                    <Badge className="bg-green-600 text-white">
                      {Math.floor(otpExpiresIn / 60)}:{String(otpExpiresIn % 60).padStart(2, '0')}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label>กรอกรหัส OTP 6 หลัก</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setOtp(value);
                      setOtpError('');
                    }}
                    placeholder="000000"
                    className="text-center text-2xl tracking-widest font-bold"
                    autoFocus
                  />
                </div>

                {otpError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">
                      ❌ {otpError}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleSendOtp}
                    disabled={sendingOtp || otpExpiresIn > 295 || !activeContractId}
                    variant="outline"
                    className="flex-1"
                  >
                    ส่งรหัสใหม่
                  </Button>
                  <Button
                    onClick={handleVerifyOtp}
                    disabled={verifyingOtp || otp.length !== 6 || !activeContractId}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    {verifyingOtp ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        กำลังตรวจสอบ...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        ยืนยัน
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                💡 <strong>หมายเหตุ:</strong> รหัส OTP จะหมดอายุใน 5 นาที กรุณากรอกภายในเวลาที่กำหนด
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <Sparkles className="w-5 h-5" />
              AI ผู้ช่วยสัญญาเช่า
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
              <Button 
                variant={aiMode === 'generate' ? 'default' : 'ghost'}
                onClick={() => { setAiMode('generate'); setAiResult(null); }}
                className="flex-1"
              >
                <FileSignature className="w-4 h-4 mr-2" /> สร้างร่างสัญญา
              </Button>
              <Button 
                variant={aiMode === 'review' ? 'default' : 'ghost'}
                onClick={() => { setAiMode('review'); setAiResult(null); }}
                className="flex-1"
              >
                <ShieldCheck className="w-4 h-4 mr-2" /> ตรวจสอบ
              </Button>
              <Button 
                variant={aiMode === 'suggest' ? 'default' : 'ghost'}
                onClick={() => { setAiMode('suggest'); setAiResult(null); }}
                className="flex-1"
              >
                <MessageSquare className="w-4 h-4 mr-2" /> แนะนำเงื่อนไข
              </Button>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border">
              {aiMode === 'generate' && (
                <p className="text-sm text-slate-600">สร้างร่างสัญญาเช่าฉบับใหม่จากข้อมูลผู้เช่าและห้องพักที่เลือกไว้ โดยเน้นความรัดกุมและครอบคลุมตามกฎหมาย</p>
              )}
              {aiMode === 'review' && (
                <p className="text-sm text-slate-600">ตรวจสอบเนื้อหาสัญญาปัจจุบันเพื่อหาช่องโหว่ หรือเงื่อนไขที่อาจเสียเปรียบ พร้อมคำแนะนำในการแก้ไข</p>
              )}
              {aiMode === 'suggest' && (
                <p className="text-sm text-slate-600">แนะนำข้อสัญญาหรือกฎระเบียบเพิ่มเติมที่เหมาะสมกับประเภทห้องพักและผู้เช่ารายนี้</p>
              )}
            </div>

            {!aiResult && (
              <Button 
                onClick={handleAIRequest} 
                disabled={aiLoading} 
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {aiLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังประมวลผล...</> : 'เริ่มทำงาน'}
              </Button>
            )}

            {aiResult && (
              <div className="space-y-4">
                <div className="bg-white border rounded-lg p-4 shadow-sm max-h-60 overflow-y-auto text-sm">
                  {aiMode === 'generate' ? (
                    <div dangerouslySetInnerHTML={{ __html: aiResult }} />
                  ) : (
                    <div className="whitespace-pre-wrap">{aiResult}</div>
                  )}
                </div>
                
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setAiResult(null)}>
                    ลองใหม่
                  </Button>
                  {aiMode === 'generate' && (
                    <Button 
                      onClick={() => {
                        setFormData(prev => ({ ...prev, contract_content: aiResult }));
                        setShowAIDialog(false);
                        toast.success("นำร่างสัญญาไปใช้เรียบร้อยแล้ว");
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      ใช้ร่างสัญญานี้
                    </Button>
                  )}
                  {aiMode === 'suggest' && (
                    <Button 
                      onClick={() => {
                        setFormData(prev => ({ 
                          ...prev, 
                          additional_rules: [...prev.additional_rules, ...aiResult.split('\n').filter(line => line.trim().length > 0)]
                        }));
                        setShowAIDialog(false);
                        toast.success("เพิ่มข้อแนะนำลงในกฎเพิ่มเติมแล้ว");
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      เพิ่มในกฎเพิ่มเติม
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSignatureDialog} onOpenChange={(open) => {
        setShowSignatureDialog(open);
        if (!open) setHasReadContract(false);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              ลงลายเซ็น {currentSignatureType === 'tenant' ? 'ผู้เช่า' : 
                         currentSignatureType === 'landlord' ? 'ผู้ให้เช่า' : 
                         currentSignatureType === 'witness1' ? 'พยาน ๑' : 'พยาน ๒'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-amber-900 text-base mb-2">
                    คำเตือนสำคัญ: กรุณาอ่านสัญญาก่อนลงนาม
                  </h4>
                  <p className="text-sm text-amber-800 mb-3 leading-relaxed">
                    โปรดอ่านและทำความเข้าใจข้อตกลงและเงื่อนไขทั้งหมดในสัญญาเช่านี้อย่างละเอียด 
                    ก่อนลงลายมือชื่อ การลงลายมือชื่อถือเป็นการยืนยันว่าท่านได้อ่าน เข้าใจ 
                    และตกลงยินยอมปฏิบัติตามข้อกำหนดทั้งหมดในสัญญาฉบับนี้
                  </p>
                  
                  <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-amber-300">
                    <Checkbox
                      id="confirm-read"
                      checked={hasReadContract}
                      onCheckedChange={setHasReadContract}
                      className="mt-0.5"
                    />
                    <label 
                      htmlFor="confirm-read" 
                      className="text-sm font-medium text-slate-800 cursor-pointer leading-relaxed"
                    >
                      ข้าพเจ้าได้อ่านและทำความเข้าใจข้อตกลงและเงื่อนไขทั้งหมดในสัญญาเช่าฉบับนี้แล้ว 
                      และยินยอมที่จะปฏิบัติตามข้อกำหนดดังกล่าว
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                💡 วาดลายเซ็นของคุณในกรอบด้านล่าง ลายเซ็นจะถูกวางในตำแหน่งที่ถูกต้องบนสัญญาโดยอัตโนมัติ
              </p>
            </div>
            
            <div className="w-full h-64 border-2 border-slate-300 rounded-lg bg-white">
              <SignaturePad ref={signaturePadRef} className="w-full h-full" />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => signaturePadRef.current?.clear()}
              >
                <X className="w-4 h-4 mr-2" />
                ล้าง
              </Button>
              <Button
                type="button"
                onClick={handleSaveSignature}
                disabled={!hasReadContract}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!hasReadContract ? 'กรุณายืนยันว่าได้อ่านสัญญาแล้ว' : ''}
              >
                <Save className="w-4 h-4 mr-2" />
                บันทึกลายเซ็น
              </Button>
            </div>
            
            {!hasReadContract && (
              <p className="text-xs text-amber-600 text-center">
                ⚠️ กรุณาติ๊กยืนยันว่าได้อ่านและเข้าใจสัญญาแล้ว เพื่อดำเนินการลงลายเซ็น
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="contract-print">
        <style>{`
          @page {
            size: A4 portrait;
            margin: 0;
          }
          
          @media print {
            * { 
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            body { 
              margin: 0 !important; 
              padding: 0 !important;
              width: 100% !important;
              overflow-y: visible !important;
            }
            
            ::-webkit-scrollbar { display: none !important; }
            
            .no-print { display: none !important; }
            .ql-toolbar, .ql-container .ql-tooltip { display: none !important; }
            aside, nav, [role="navigation"], [data-sidebar], .sidebar, header { display: none !important; }
            
            html, #root, main { 
              margin: 0 !important; 
              padding: 0 !important; 
              background: white !important;
              overflow: visible !important;
              height: auto !important;
              width: 100% !important;
            }
            
            .contract-print {
              display: block !important;
              width: 21cm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              overflow: visible !important;
            }
            
            .contract-page {
              page-break-after: always !important;
              page-break-inside: avoid !important;
              display: block !important;
              width: 21cm !important;
              margin: 0 !important;
              padding: 1.5cm !important;
              background: white !important;
              overflow: visible !important;
              height: auto !important;
            }
            
            .contract-page:last-child {
              page-break-after: auto !important;
            }
          }
          
          .contract-print {
            font-family: 'TH Sarabun New', 'Sarabun', sans-serif;
            background: white;
            width: 21cm;
            margin: 20px auto;
          }
          
          .contract-page {
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            min-height: auto;
          }

          .contract-print p,
          .contract-print div {
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: keep-all;
          }
        `}</style>

        <div 
          dangerouslySetInnerHTML={{ __html: replacePlaceholders(formData.contract_content) }}
        />
      </div>
    </div>
  );
}