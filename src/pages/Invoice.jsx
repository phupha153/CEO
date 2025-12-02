import React, { useRef, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";

export default function Invoice() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const invoiceRef = useRef();
  const navigate = useNavigate();

  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!paymentId) {
      setError('ไม่พบเลขที่ใบแจ้งหนี้');
      setLoading(false);
      return;
    }

    const fetchInvoice = async () => {
      try {
        console.log('🔍 [Invoice] Fetching invoice for paymentId:', paymentId);
        const response = await base44.functions.invoke('getPublicInvoice', {
          paymentId: paymentId
        });

        console.log('🔍 [Invoice] Response:', response.data);
        
        if (response.data.success) {
          console.log('🔍 [Invoice] Invoice Data:', response.data.invoice);
          console.log('🔍 [Invoice] Recipient:', response.data.invoice?.recipient);
          console.log('🔍 [Invoice] Company Registration Number:', response.data.invoice?.recipient?.company_registration_number);
          setInvoiceData(response.data.invoice);
        } else {
          setError(response.data.error || 'ไม่พบข้อมูลใบแจ้งหนี้');
        }
      } catch (err) {
        console.error('Error fetching invoice:', err);
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [paymentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-sm w-full">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-base font-semibold text-slate-700">กำลังโหลด...</p>
        </Card>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-md w-full">
          <p className="text-base font-semibold text-slate-700 mb-2">{error || 'ไม่พบข้อมูล'}</p>
          <p className="text-sm text-slate-500">กรุณาติดต่อเจ้าของหอพัก</p>
        </Card>
      </div>
    );
  }

  const invoiceNumber = `INV-${invoiceData.id.slice(0, 8).toUpperCase()}`;
  const issueDate = format(new Date(), 'd MMMM yyyy', { locale: th });
  const dueDate = invoiceData.due_date ? format(parseISO(invoiceData.due_date), 'd MMMM yyyy', { locale: th }) : '-';
  
  // คำนวณวันเกินกำหนด
  const isOverdue = invoiceData.status === 'pending' && invoiceData.due_date && differenceInDays(new Date(), parseISO(invoiceData.due_date)) > 0;
  const daysOverdue = isOverdue ? differenceInDays(new Date(), parseISO(invoiceData.due_date)) : 0;

  const handleDownload = () => {
    if (window.print) {
      window.print();
    }
  };

  const lineItems = [];
  if (invoiceData.rent_amount > 0) {
    lineItems.push({
      name: 'ค่าเช่า',
      quantity: 1,
      price: invoiceData.rent_amount,
      total: invoiceData.rent_amount
    });
  }
  if (invoiceData.electricity_amount > 0) {
    // ตรวจสอบว่าเป็นค่าขั้นต่ำหรือไม่ (ถ้า หน่วย × เรท ไม่เท่ากับยอดเงิน หรือ หน่วย = 0 = ใช้ค่าขั้นต่ำ)
    const calculatedElecAmount = invoiceData.electricity_units * invoiceData.electricity_rate;
    const isElecMinimum = invoiceData.electricity_units === 0 || Math.abs(calculatedElecAmount - invoiceData.electricity_amount) > 0.01;

    // แสดงมิเตอร์ก่อน-หลัง ถ้ามี
    const elecMeterText = (invoiceData.electricity_previous || invoiceData.electricity_current) 
      ? ` (${invoiceData.electricity_previous}-${invoiceData.electricity_current})` 
      : '';

    lineItems.push({
      name: isElecMinimum 
        ? `ค่าไฟฟ้า${elecMeterText} ใช้ ${invoiceData.electricity_units} หน่วย - คิดขั้นต่ำ`
        : `ค่าไฟฟ้า${elecMeterText} ${invoiceData.electricity_units} หน่วย × ${invoiceData.electricity_rate} บาท`,
      quantity: 1,
      price: invoiceData.electricity_amount,
      total: invoiceData.electricity_amount
    });
  }
  if (invoiceData.water_amount > 0) {
    // ตรวจสอบว่าเป็นค่าขั้นต่ำหรือไม่ (ถ้า หน่วย × เรท ไม่เท่ากับยอดเงิน หรือ หน่วย = 0 = ใช้ค่าขั้นต่ำ)
    const calculatedWaterAmount = invoiceData.water_units * invoiceData.water_rate;
    const isWaterMinimum = invoiceData.water_units === 0 || Math.abs(calculatedWaterAmount - invoiceData.water_amount) > 0.01;

    // แสดงมิเตอร์ก่อน-หลัง ถ้ามี
    const waterMeterText = (invoiceData.water_previous || invoiceData.water_current) 
      ? ` (${invoiceData.water_previous}-${invoiceData.water_current})` 
      : '';

    lineItems.push({
      name: isWaterMinimum 
        ? `ค่าน้ำประปา${waterMeterText} ใช้ ${invoiceData.water_units} หน่วย - คิดขั้นต่ำ`
        : `ค่าน้ำประปา${waterMeterText} ${invoiceData.water_units} หน่วย × ${invoiceData.water_rate} บาท`,
      quantity: 1,
      price: invoiceData.water_amount,
      total: invoiceData.water_amount
    });
  }
  if (invoiceData.internet_amount > 0) {
    lineItems.push({
      name: 'ค่าอินเทอร์เน็ต',
      quantity: 1,
      price: invoiceData.internet_amount,
      total: invoiceData.internet_amount
    });
  }
  if (invoiceData.common_fee_amount > 0) {
    lineItems.push({
      name: 'ค่าส่วนกลาง',
      quantity: 1,
      price: invoiceData.common_fee_amount,
      total: invoiceData.common_fee_amount
    });
  }
  if (invoiceData.parking_fee_amount > 0) {
    lineItems.push({
      name: 'ค่าที่จอดรถ',
      quantity: 1,
      price: invoiceData.parking_fee_amount,
      total: invoiceData.parking_fee_amount
    });
  }
  if (invoiceData.other_amount > 0) {
    lineItems.push({
      name: 'ค่าใช้จ่ายอื่นๆ',
      quantity: 1,
      price: invoiceData.other_amount,
      total: invoiceData.other_amount
    });
  }

  // ✅ ใช้ค่าจาก invoiceData แทน hardcode
  const buildingLogo = invoiceData?.recipient?.building_logo || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
  const buildingName = invoiceData?.recipient?.building_name || 'W RESIDENTS';

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Sticky Header with Action Button */}
      <div className="print:hidden bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-3 py-2 flex justify-between items-center">
          <Button
            onClick={() => navigate(-1)}
            size="sm"
            variant="ghost"
            className="gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            ย้อนกลับ
          </Button>
          <Button
            onClick={handleDownload}
            size="sm"
            variant="outline"
            className="gap-1 text-xs"
          >
            <Download className="w-3 h-3" />
            บันทึก PDF
          </Button>
        </div>
      </div>

      {/* Invoice Content - Optimized for Mobile */}
      <div className="max-w-2xl mx-auto p-3 pb-6">
        <Card className="bg-white shadow-lg" ref={invoiceRef}>
          <div className="p-4">
            {/* Header */}
            <div className="mb-4 pb-3 border-b border-slate-200">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <img
                    src={buildingLogo}
                    alt={`${buildingName} Logo`}
                    className="w-10 h-10 object-contain"
                    onError={(e) => {
                      e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
                    }}
                  />
                  <div>
                    <h1 className="text-lg font-bold text-slate-800">{buildingName}</h1>
                    <p className="text-xs text-slate-600">ระบบจัดการที่พักอาศัย</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-base font-bold text-blue-600">ใบแจ้งหนี้</h2>
                  <p className="text-xs text-blue-600 font-semibold">INVOICE</p>
                </div>
              </div>
              
              <div className="text-xs text-slate-600 space-y-0.5">
                {invoiceData.recipient?.company_name ? (
                  <>
                    <p className="font-semibold text-slate-800">{invoiceData.recipient.company_name}</p>
                    {invoiceData.recipient.tax_id && <p>เลขประจำตัวผู้เสียภาษี: {invoiceData.recipient.tax_id}</p>}
                    {invoiceData.recipient.company_registration_number && <p>เลขทะเบียนนิติบุคคล: {invoiceData.recipient.company_registration_number}</p>}
                    <p>{invoiceData.recipient?.building_address}</p>
                    {invoiceData.recipient?.company_phone && <p>โทร: {invoiceData.recipient.company_phone}</p>}
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-slate-800">{invoiceData.recipient?.account_name || invoiceData.recipient?.lessor_name}</p>
                    <p>{invoiceData.recipient?.building_address}</p>
                    {invoiceData.recipient?.building_phone && <p>โทร: {invoiceData.recipient.building_phone}</p>}
                  </>
                )}
              </div>

              <div className="mt-3 text-xs space-y-0.5">
                <p><span className="font-semibold">เลขที่:</span> {invoiceNumber}</p>
                <p><span className="font-semibold">วันที่ออก:</span> {issueDate}</p>
                <p>
                  <span className="font-semibold text-red-600">ครบกำหนด:</span>{' '}
                  <span className="text-red-600 font-bold">{dueDate}</span>
                </p>
              </div>
            </div>

            {/* Overdue Warning */}
            {isOverdue && (
              <div className="mb-4">
                <div className="bg-red-100 border-2 border-red-500 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-800">เกินกำหนดชำระแล้ว {daysOverdue} วัน</p>
                    <p className="text-xs text-red-700">กรุณาชำระเงินโดยเร็วที่สุด</p>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Info */}
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-slate-500 mb-1.5">ผู้เช่า / Customer</h3>
              <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                <p className="font-bold text-sm text-slate-800">{invoiceData.tenant.full_name}</p>
                <p className="text-xs text-slate-600">ห้อง {invoiceData.room.room_number}</p>
                <p className="text-xs text-slate-600">{invoiceData.tenant.phone}</p>
                {invoiceData.tenant.address && invoiceData.tenant.address !== '-' && (
                  <p className="text-xs text-slate-600">{invoiceData.tenant.address}</p>
                )}
                {invoiceData.tenant.national_id && (
                  <p className="text-xs text-slate-600">
                    เลขประจำตัวผู้เสียภาษี: {invoiceData.tenant.national_id}
                  </p>
                )}
              </div>
            </div>

            {/* Invoice Items */}
            <div className="mb-4">
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="text-left py-2 pr-2 font-semibold text-slate-700">ลำดับ</th>
                      <th className="text-left py-2 pr-2 font-semibold text-slate-700">รายการ</th>
                      <th className="text-center py-2 px-1 font-semibold text-slate-700">จำนวน</th>
                      <th className="text-right py-2 pl-2 font-semibold text-slate-700">ราคา/หน่วย</th>
                      <th className="text-right py-2 pl-2 font-semibold text-slate-700">จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, index) => (
                      <tr key={index} className="border-b border-slate-200">
                        <td className="py-2 pr-2 text-slate-600">{index + 1}</td>
                        <td className="py-2 pr-2 text-slate-800">{item.name}</td>
                        <td className="py-2 px-1 text-center text-slate-600">{item.quantity}</td>
                        <td className="py-2 pl-2 text-right text-slate-600">
                          {(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 pl-2 text-right font-semibold text-slate-800">
                          {(item.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-end mb-4">
              <div className="w-full max-w-xs">
                <div className="flex justify-between py-2 border-t-2 border-slate-300">
                  <span className="font-bold text-sm text-slate-800">รวมทั้งสิ้น</span>
                  <span className={`font-bold text-lg ${isOverdue ? 'text-red-600' : 'text-blue-600'}`}>
                    {(invoiceData.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Info - Compact */}
            <div className="bg-blue-50 rounded-lg p-2 mb-3 border border-blue-200">
              <p className="text-[10px] text-slate-600 mb-1">💳 ช่องทางการชำระเงิน</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
                <span><span className="text-slate-500">ธนาคาร:</span> <span className="font-semibold">{invoiceData.bank.name}</span></span>
                <span><span className="text-slate-500">เลขบัญชี:</span> <span className="font-semibold">{invoiceData.bank.account_number}</span></span>
                <span><span className="text-slate-500">ชื่อ:</span> <span className="font-semibold">{invoiceData.bank.account_name}</span></span>
              </div>
            </div>

            {/* Notes */}
            <div className="text-xs text-slate-500 space-y-0.5 bg-slate-50 p-3 rounded mb-3">
              <p className="font-semibold text-slate-700 mb-1">หมายเหตุ:</p>
              <p>1. กรุณาชำระเงินภายในวันที่กำหนด</p>
              <p>2. กรุณาแนบหลักฐานการโอนเงินทุกครั้ง</p>
              <p>3. หากมีข้อสงสัยกรุณาติดต่อเจ้าของหอพัก</p>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-200 text-center">
              <p className="text-xs text-slate-600">ขอบคุณที่ใช้บริการ {buildingName}</p>
              <p className="text-xs text-slate-500 mt-0.5">เอกสารนี้สร้างโดยระบบอัตโนมัติ</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
          .max-w-2xl {
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}