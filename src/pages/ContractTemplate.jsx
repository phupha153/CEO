import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Printer, Mail, FileText } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "sonner";

export default function ContractTemplate() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const contractId = searchParams.get('contractId');
  const printRef = useRef(null);

  const [formData, setFormData] = useState({
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
    pay_day: 5,
    water_rate: 18,
    elec_rate: 7,
    common_fee: 0,
    internet_fee: 200,
    late_fee_per_day: 50,
    allow_pets: false,
    no_smoking: true,
    termination_notice_days: 30,
    deposit_return_days: 7,
    late_payment_grace_days: 7,
    furniture_rent: 0,
    advance_rent: 0,
    remarks: '',
    status: 'draft'
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => base44.entities.Tenant.list(),
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
  });

  const { data: existingContract } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      if (!contractId) return null;
      const contracts = await base44.entities.Contract.list();
      return contracts.find(c => c.id === contractId);
    },
    enabled: !!contractId,
  });

  useEffect(() => {
    if (existingContract) {
      setFormData({
        ...existingContract,
        contract_date: existingContract.contract_date || format(new Date(), 'yyyy-MM-dd'),
      });
    }
  }, [existingContract]);

  useEffect(() => {
    // Load config values
    const buildingName = configs.find(c => c.key === 'building_name')?.value;
    const buildingAddress = configs.find(c => c.key === 'building_address')?.value;
    const managerName = configs.find(c => c.key === 'manager_name')?.value;
    const waterRate = configs.find(c => c.key === 'water_rate')?.value;
    const elecRate = configs.find(c => c.key === 'electricity_rate')?.value;
    const internetRate = configs.find(c => c.key === 'internet_rate')?.value;
    const lateFee = configs.find(c => c.key === 'late_payment_fee_per_day')?.value;
    const payDay = configs.find(c => c.key === 'bill_due_day')?.value;

    setFormData(prev => ({
      ...prev,
      building: buildingName || 'W RESIDENTS',
      full_address: buildingAddress || '',
      lessor_name: managerName || '',
      water_rate: parseFloat(waterRate) || 18,
      elec_rate: parseFloat(elecRate) || 7,
      internet_fee: parseFloat(internetRate) || 200,
      late_fee_per_day: parseFloat(lateFee) || 50,
      pay_day: parseInt(payDay) || 5,
    }));
  }, [configs]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (contractId) {
        return await base44.entities.Contract.update(contractId, data);
      } else {
        return await base44.entities.Contract.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts']);
      toast.success('บันทึกสัญญาสำเร็จ');
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  });

  const handleSave = () => {
    if (!formData.lessor_name || !formData.lessee_name || !formData.start_date) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    // Generate contract number if not exists
    if (!formData.contract_no) {
      const dateStr = format(new Date(), 'yyyyMM');
      const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
      formData.contract_no = `RNT-${dateStr}-${randomNum}`;
    }

    saveMutation.mutate(formData);
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
        deposit: room.price || 0,
      }));
    }
  };

  const convertToBuddhistYear = (dateStr) => {
    if (!dateStr) return '...........................';
    try {
      const date = new Date(dateStr);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '...........................';
      }
      return format(date, 'd MMMM ', { locale: th }) + (date.getFullYear() + 543);
    } catch (error) {
      console.error('Error converting date:', error);
      return '...........................';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* No Print Section - Controls */}
      <div className="no-print bg-white border-b border-slate-200 p-4 shadow-sm">
        <div className="w-full px-2 md:max-w-7xl md:mx-auto space-y-3">
          <h1 className="text-sm md:text-xl font-bold text-slate-800 whitespace-normal break-words">แบบสัญญาเช่าที่พักอาศัย (A4)</h1>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleSave} disabled={saveMutation.isPending} size="sm" className="bg-green-600 hover:bg-green-700 text-xs md:text-sm">
              <Save className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">บันทึกสัญญา</span>
              <span className="md:hidden">บันทึก</span>
            </Button>
            <Button onClick={handlePrint} variant="outline" size="sm" className="text-xs md:text-sm">
              <Printer className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              พิมพ์
            </Button>
            <Button variant="outline" disabled size="sm" className="text-xs md:text-sm">
              <Mail className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">ส่ง PDF ทางอีเมล</span>
              <span className="md:hidden">ส่ง PDF</span>
            </Button>
          </div>
        </div>
      </div>

      {/* No Print Section - Form Inputs */}
      <div className="no-print max-w-7xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">ข้อมูลสัญญา</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label>เลือกผู้เช่า</Label>
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
              <Label>เลือกห้อง</Label>
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

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <Label>วันที่ทำสัญญา</Label>
              <Input
                type="date"
                value={formData.contract_date}
                onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })}
              />
            </div>
            <div>
              <Label>วันที่เริ่มสัญญา</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>วันที่สิ้นสุดสัญญา</Label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <Label>ค่าเช่า/เดือน (บาท)</Label>
              <Input
                type="number"
                value={formData.rent_monthly}
                onChange={(e) => setFormData({ ...formData, rent_monthly: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>เงินประกัน (บาท)</Label>
              <Input
                type="number"
                value={formData.deposit}
                onChange={(e) => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>วันกำหนดชำระ</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={formData.pay_day}
                onChange={(e) => setFormData({ ...formData, pay_day: parseInt(e.target.value) || 5 })}
              />
            </div>
            <div>
              <Label>ค่าปรับล่าช้า/วัน (บาท)</Label>
              <Input
                type="number"
                value={formData.late_fee_per_day}
                onChange={(e) => setFormData({ ...formData, late_fee_per_per_day: parseFloat(e.target.value) || 0 })}
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
        </div>
      </div>

      {/* Printable Contract - A4 Format */}
      <div ref={printRef} className="contract-print">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .contract-print {
              width: 21cm;
              margin: 0 auto;
              background: white;
            }
            .page {
              page-break-after: always;
              padding: 2.5cm 2cm 2.5cm 3cm;
              min-height: 29.7cm;
              box-sizing: border-box;
            }
            .page:last-child {
              page-break-after: auto;
            }
            body { margin: 0; padding: 0; }
          }
          
          .contract-print {
            font-family: 'TH Sarabun New', 'Sarabun', sans-serif;
            background: white;
            max-width: 21cm;
            margin: 0 auto;
          }
          
          .page {
            padding: 2.5cm 2cm 2.5cm 3cm;
            background: white;
            min-height: 29.7cm;
            position: relative;
          }
          
          .header-title {
            text-align: center;
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 5pt;
            white-space: nowrap;
            overflow-wrap: normal;
          }
          
          .header-subtitle {
            text-align: center;
            font-size: 14pt;
            margin-bottom: 20pt;
          }
          
          .date-line {
            text-align: right;
            font-size: 15pt;
            margin-bottom: 20pt;
          }
          
          .content {
            font-size: 15pt;
            line-height: 1.4;
            text-align: justify;
          }
          
          .indent {
            text-indent: 2em;
          }
          
          .clause-title {
            font-size: 16pt;
            font-weight: bold;
            margin-top: 15pt;
            margin-bottom: 10pt;
          }
          
          .dotted-line {
            border-bottom: 1px dotted #333;
            display: inline-block;
            min-width: 100px;
          }
          
          .signature-section {
            margin-top: 40pt;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30pt;
          }
          
          .signature-box {
            text-align: center;
          }
          
          .signature-line {
            border-bottom: 1px solid #333;
            margin: 10pt 20pt;
            height: 60pt;
          }
          
          .page-number {
            position: absolute;
            bottom: 1cm;
            right: 2cm;
            font-size: 14pt;
          }
          
          .remarks-box {
            background: #f0f0f0;
            padding: 15pt;
            margin-top: 20pt;
            border: 1px solid #999;
          }
          
          @media (max-width: 768px) {
            .page {
              padding: 1cm 0.5cm;
            }
            
            .header-title {
              font-size: 12pt;
              white-space: normal;
              word-break: keep-all;
            }
            
            .header-subtitle {
              font-size: 10pt;
              margin-bottom: 10pt;
            }
            
            .date-line {
              font-size: 10pt;
              margin-bottom: 10pt;
            }
            
            .content {
              font-size: 10pt;
              line-height: 1.3;
            }
            
            .clause-title {
              font-size: 11pt;
              margin-top: 10pt;
              margin-bottom: 8pt;
            }
            
            .signature-section {
              margin-top: 20pt;
              gap: 15pt;
            }
            
            .signature-line {
              height: 40pt;
              margin: 5pt 10pt;
            }
            
            .page-number {
              font-size: 10pt;
              bottom: 0.5cm;
              right: 0.5cm;
            }
            
            .remarks-box {
              padding: 10pt;
              font-size: 10pt;
            }
          }
        `}</style>

        {/* หน้า 1 */}
        <div className="page">
          <div className="header-title">แบบสัญญาเช่าที่พักอาศัย</div>
          <div className="header-subtitle">เรื่อง ให้ผู้เช่ารักษากฎการเช่าอาศัยตามสัญญา</div>
          <div className="date-line">
            วันที่ .........{convertToBuddhistYear(formData.contract_date)}.........
          </div>

          <div className="content">
            <p className="indent">
              สัญญาเช่าฉบับนี้ทำขึ้นระหว่าง <span className="dotted-line">&nbsp;{formData.lessor_name}&nbsp;</span> อายุ ........... ปี 
              ผู้มีอำนาจในการทำสัญญา เลขบัตรประชาชน <span className="dotted-line">&nbsp;{formData.lessor_id}&nbsp;</span> 
              เบอร์โทรศัพท์ <span className="dotted-line">&nbsp;{formData.lessor_phone}&nbsp;</span> 
              อยู่บ้านเลขที่ <span className="dotted-line">&nbsp;{formData.lessor_address}&nbsp;</span>
              ซึ่งต่อไปในสัญญานี้จะเรียกว่า <strong>"ผู้ให้เช่า"</strong> ฝ่ายหนึ่ง
            </p>

            <p className="indent">
              กับ <span className="dotted-line">&nbsp;{formData.lessee_name}&nbsp;</span> อายุ ........... ปี 
              เลขบัตรประชาชน <span className="dotted-line">&nbsp;{formData.lessee_id}&nbsp;</span> 
              เบอร์โทรศัพท์ <span className="dotted-line">&nbsp;{formData.lessee_phone}&nbsp;</span> 
              อยู่บ้านเลขที่ <span className="dotted-line">&nbsp;{formData.lessee_address}&nbsp;</span>
              ซึ่งต่อไปในสัญญานี้จะเรียกว่า <strong>"ผู้เช่า"</strong> อีกฝ่ายหนึ่ง
            </p>

            <p className="indent">
              คู่สัญญาทั้งสองฝ่ายตกลงทำสัญญาเช่าที่พักอาศัยกันโดยมีสาระสำคัญดังต่อไปนี้
            </p>

            <div className="clause-title">ข้อ 1. ทรัพย์สินที่เช่า</div>
            <p className="indent">
              ผู้ให้เช่าตกลงให้เช่าและผู้เช่าตกลงเช่าห้องพักเลขที่ <span className="dotted-line">&nbsp;{formData.room_no}&nbsp;</span> 
              ชั้น <span className="dotted-line">&nbsp;{formData.floor}&nbsp;</span> 
              อาคาร/โครงการ <span className="dotted-line">&nbsp;{formData.building}&nbsp;</span>
            </p>
            <p className="indent">
              ตั้งอยู่ที่ <span className="dotted-line">&nbsp;{formData.full_address}&nbsp;</span>
            </p>

            <div className="clause-title">ข้อ 2. วัตถุประสงค์การเช่า</div>
            <p className="indent">
              ผู้เช่าตกลงเช่าห้องพักดังกล่าวเพื่อใช้เป็นที่อยู่อาศัยเท่านั้น ห้ามมิให้ใช้เพื่อการพาณิชย์หรือกิจการอื่นใดโดยเด็ดขาด 
              ผู้เช่าจะต้องไม่กระทำการใดๆ ที่เป็นการรบกวนหรือก่อความเดือดร้อนรำคาญแก่ผู้อื่น
            </p>

            <div className="clause-title">ข้อ 3. ระยะเวลาการเช่า</div>
            <p className="indent">
              ผู้เช่าตกลงเช่าห้องพักดังกล่าวเป็นระยะเวลาตั้งแต่วันที่ <span className="dotted-line">&nbsp;{convertToBuddhistYear(formData.start_date)}&nbsp;</span> 
              ถึงวันที่ <span className="dotted-line">&nbsp;{convertToBuddhistYear(formData.end_date)}&nbsp;</span>
            </p>

            <div className="clause-title">ข้อ 4. ค่าเช่าและการชำระเงิน</div>
            <p className="indent">
              ผู้เช่าตกลงชำระค่าเช่าห้องพักเป็นจำนวนเงินเดือนละ <span className="dotted-line">&nbsp;{formData.rent_monthly.toLocaleString()}&nbsp;</span> บาท 
              ({(() => {
                const bahtText = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
                const num = Math.floor(formData.rent_monthly / 1000); // Simplified for example, full baht text conversion is complex
                return num < 10 && num > 0 ? bahtText[num] + 'พัน' : (formData.rent_monthly === 0 ? 'ศูนย์' : ''); // Basic for demonstration
              })()}บาทถ้วน) 
              โดยชำระภายในวันที่ <span className="dotted-line">&nbsp;{formData.pay_day}&nbsp;</span> ของทุกเดือน
            </p>

            <div className="clause-title">ข้อ 5. เงินประกันการเช่า</div>
            <p className="indent">
              ผู้เช่าได้วางเงินประกันการเช่าไว้กับผู้ให้เช่าเป็นจำนวนเงิน <span className="dotted-line">&nbsp;{formData.deposit.toLocaleString()}&nbsp;</span> บาท 
              เงินประกันนี้ผู้ให้เช่าจะคืนให้แก่ผู้เช่าภายใน <span className="dotted-line">&nbsp;{formData.deposit_return_days}&nbsp;</span> วัน 
              นับจากวันที่สัญญาเช่าสิ้นสุดลงและผู้เช่าได้ส่งมอบห้องเช่าคืนในสภาพเรียบร้อยแล้ว
            </p>

          </div>
          <div className="page-number">หน้า 1/3</div>
        </div>

        {/* หน้า 2 */}
        <div className="page">
          <div className="content">
            <div className="clause-title">ข้อ 6. ค่าสาธารณูปโภค</div>
            <p className="indent">ผู้เช่าตกลงชำระค่าสาธารณูปโภคต่างๆ ดังนี้</p>
            <p style={{ marginLeft: '3em' }}>
              6.1 ค่ากระแสไฟฟ้า ในอัตราหน่วยละ <span className="dotted-line">&nbsp;{formData.elec_rate}&nbsp;</span> บาท 
              ตามการใช้จริงจากมิเตอร์
            </p>
            <p style={{ marginLeft: '3em' }}>
              6.2 ค่าน้ำประปา ในอัตราหน่วยละ <span className="dotted-line">&nbsp;{formData.water_rate}&nbsp;</span> บาท 
              ตามการใช้จริงจากมิเตอร์
            </p>
            <p style={{ marginLeft: '3em' }}>
              6.3 ค่าอินเทอร์เน็ต เดือนละ <span className="dotted-line">&nbsp;{formData.internet_fee}&nbsp;</span> บาท
            </p>
            <p style={{ marginLeft: '3em' }}>
              6.4 ค่าส่วนกลาง (ถ้ามี) เดือนละ <span className="dotted-line">&nbsp;{formData.common_fee}&nbsp;</span> บาท
            </p>

            <div className="clause-title">ข้อ 7. ค่าปรับกรณีชำระเงินล่าช้า</div>
            <p className="indent">
              หากผู้เช่าไม่ชำระค่าเช่าหรือค่าใช้จ่ายอื่นๆ ภายในกำหนด ผู้เช่าต้องชำระค่าปรับในอัตราวันละ 
              <span className="dotted-line">&nbsp;{formData.late_fee_per_day}&nbsp;</span> บาท 
              และหากผู้เช่าค้างชำระเกิน <span className="dotted-line">&nbsp;{formData.late_payment_grace_days}&nbsp;</span> วัน 
              ผู้ให้เช่ามีสิทธิบอกเลิกสัญญาได้ทันที
            </p>

            <div className="clause-title">ข้อ 8. การบอกเลิกสัญญา</div>
            <p className="indent">
              หากฝ่ายใดฝ่ายหนึ่งประสงค์จะบอกเลิกสัญญาก่อนครบกำหนด ต้องแจ้งให้อีกฝ่ายหนึ่งทราบล่วงหน้าเป็นหนังสือเป็นเวลาไม่น้อยกว่า 
              <span className="dotted-line">&nbsp;{formData.termination_notice_days}&nbsp;</span> วัน 
              และต้องไม่มีหนี้ค้างชำระใดๆ ทั้งสิ้น
            </p>

            <div className="clause-title">ข้อ 9. หน้าที่ความรับผิดชอบของผู้เช่า</div>
            <p style={{ marginLeft: '2em' }}>9.1 รักษาความสะอาดและทรัพย์สินภายในห้องเช่าให้อยู่ในสภาพดีตลอดเวลา</p>
            <p style={{ marginLeft: '2em' }}>9.2 {formData.allow_pets ? '✓ อนุญาตให้เลี้ยงสัตว์ได้ตามข้อตกลง' : '✗ ห้ามนำสัตว์เลี้ยงเข้ามาในห้องเช่าโดยเด็ดขาด'}</p>
            <p style={{ marginLeft: '2em' }}>9.3 {formData.no_smoking ? '✗ ห้ามสูบบุหรี่ภายในอาคารและห้องเช่า' : '✓ อนุญาตให้สูบบุหรี่ได้'}</p>
            <p style={{ marginLeft: '2em' }}>9.4 ห้ามก่อเสียงดังรบกวนผู้อื่นในเวลา 22.00 น. - 06.00 น.</p>
            <p style={{ marginLeft: '2em' }}>9.5 ห้ามดัดแปลง ต่อเติม รื้อถอน หรือเคลื่อนย้ายทรัพย์สินโดยไม่ได้รับอนุญาต</p>
            <p style={{ marginLeft: '2em' }}>9.6 ห้ามนำบุคคลภายนอกเข้าพักอาศัยหรือเช่าช่วงโดยไม่ได้รับอนุญาต</p>
            <p style={{ marginLeft: '2em' }}>9.7 ห้ามทำการค้าหรือประกอบกิจการใดๆ ภายในห้องเช่า</p>

            <div className="clause-title">ข้อ 10. หน้าที่ความรับผิดชอบของผู้ให้เช่า</div>
            <p style={{ marginLeft: '2em' }}>10.1 จัดให้มีสาธารณูปโภคครบถ้วนและใช้การได้ตลอดเวลา</p>
            <p style={{ marginLeft: '2em' }}>10.2 ซ่อมแซมทรัพย์สินที่ชำรุดจากการใช้งานตามปกติ</p>
            <p style={{ marginLeft: '2em' }}>10.3 แจ้งให้ผู้เช่าทราบล่วงหน้าก่อนเข้าห้องเช่า ยกเว้นกรณีฉุกเฉิน</p>

            <div className="clause-title">ข้อ 11. เหตุให้บอกเลิกสัญญาทันที</div>
            <p className="indent">ผู้ให้เช่ามีสิทธิบอกเลิกสัญญาได้ทันที หากผู้เช่ากระทำการดังต่อไปนี้</p>
            <p style={{ marginLeft: '2em' }}>11.1 ใช้ห้องเช่าผิดวัตถุประสงค์หรือกระทำการผิดกฎหมาย</p>
            <p style={{ marginLeft: '2em' }}>11.2 ก่อเสียงดังหรือรบกวนสร้างความเดือดร้อนแก่ผู้อื่น</p>
            <p style={{ marginLeft: '2em' }}>11.3 ดัดแปลง ต่อเติม หรือทำลายทรัพย์สินโดยไม่ได้รับอนุญาต</p>
            <p style={{ marginLeft: '2em' }}>11.4 ค้างชำระค่าเช่าเกิน <span className="dotted-line">&nbsp;{formData.late_payment_grace_days}&nbsp;</span> วัน</p>

            <div className="clause-title">ข้อ 12. ข้อพิพาทและกฎหมายที่ใช้บังคับ</div>
            <p className="indent">
              สัญญานี้ทำขึ้นตามกฎหมายไทย หากเกิดข้อพิพาทใดๆ ให้ใช้กฎหมายไทยเป็นหลักในการตัดสิน 
              และให้ศาลไทยเป็นศาลที่มีเขตอำนาจพิจารณาพิพากษาคดี
            </p>
          </div>
          <div className="page-number">หน้า 2/3</div>
        </div>

        {/* หน้า 3 */}
        <div className="page">
          <div className="content">
            <p className="indent">
              สัญญานี้ทำขึ้นเป็นสองฉบับมีข้อความถูกต้องตรงกัน คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญาโดยตลอดแล้ว 
              จึงได้ลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน และยึดถือไว้ฝ่ายละฉบับ
            </p>

            <div className="signature-section">
              <div className="signature-box">
                <p>ลงชื่อ ................................. ผู้เช่า</p>
                <div className="signature-line"></div>
                <p>({formData.lessee_name})</p>
              </div>

              <div className="signature-box">
                <p>ลงชื่อ ................................. ผู้ให้เช่า</p>
                <div className="signature-line"></div>
                <p>({formData.lessor_name})</p>
              </div>

              <div className="signature-box">
                <p>ลงชื่อ ................................. พยาน</p>
                <div className="signature-line"></div>
                <p>(...............................................)</p>
              </div>

              <div className="signature-box">
                <p>ลงชื่อ ................................. พยาน</p>
                <div className="signature-line"></div>
                <p>(...............................................)</p>
              </div>
            </div>

            <div className="remarks-box">
              <strong>หมายเหตุ:</strong>
              <p style={{ marginTop: '10pt', fontSize: '14pt' }}>
                เอกสารนี้เป็นเพียงแบบสัญญาเบื้องต้น เจ้าของหอพักควรปรับแก้ไขให้เหมาะสมกับข้อเท็จจริงและตรวจสอบให้สอดคล้องกับกฎหมายที่ใช้บังคับ 
                หรือขอคำปรึกษาจากผู้เชี่ยวชาญทางกฎหมายก่อนนำไปใช้งานจริง
              </p>
            </div>

            <div style={{ marginTop: '30pt', padding: '15pt', background: '#f9f9f9', border: '1px solid #ddd' }}>
              <strong>สรุปย่อสัญญา</strong>
              <p style={{ marginTop: '10pt', fontSize: '14pt' }}>
                • ค่าเช่า: {formData.rent_monthly.toLocaleString()} บาท/เดือน<br/>
                • เงินประกัน: {formData.deposit.toLocaleString()} บาท<br/>
                • วันกำหนดชำระ: วันที่ {formData.pay_day} ของทุกเดือน<br/>
                • ระยะเวลาสัญญา: {convertToBuddhistYear(formData.start_date)} ถึง {convertToBuddhistYear(formData.end_date)}<br/>
                • เลขที่สัญญา: {formData.contract_no || 'ยังไม่ได้กำหนด'}
              </p>
            </div>

            {formData.remarks && (
              <div style={{ marginTop: '20pt', padding: '15pt', background: '#fffacd', border: '1px dashed #f0ad4e' }}>
                <strong>หมายเหตุเพิ่มเติม:</strong>
                <p style={{ marginTop: '10pt', fontSize: '14pt' }}>{formData.remarks}</p>
              </div>
            )}
          </div>
          <div className="page-number">หน้า 3/3</div>
        </div>
      </div>
    </div>
  );
}