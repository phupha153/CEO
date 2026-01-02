import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { 
  Building2, 
  Calendar, 
  CreditCard, 
  Droplets, 
  Zap, 
  Wifi,
  Car,
  Home,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileText,
  Phone,
  QrCode
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function PublicInvoice() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("id") || searchParams.get("paymentId"); // รองรับทั้ง 2 format
  const branchId = searchParams.get("branch");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [invoiceImageUrl, setInvoiceImageUrl] = useState(null);
  const [generatingImage, setGeneratingImage] = useState(false);

  useEffect(() => {
    const fetchInvoiceData = async () => {
      if (!paymentId) {
        setError("ไม่พบรหัสใบแจ้งหนี้");
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 PublicInvoice: Calling getPublicInvoice with:', { paymentId, branchId });
        
        // ใช้ fetch ตรงแทน invoke เพื่อไม่ต้อง auth
        const functionUrl = `${window.location.origin}/api/functions/getPublicInvoice`;
        const fetchResponse = await fetch(functionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId, branchId })
        });

        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text();
          console.error('❌ Function call failed:', fetchResponse.status, errorText);
          throw new Error(`HTTP ${fetchResponse.status}: ${errorText}`);
        }

        const response = await fetchResponse.json();
        console.log('✅ Response:', response);

        if (response?.success) {
          setData(response.data);
          
          // ⭐ ดึงรูปบิล - ถ้ามีอยู่แล้วใช้เลย
          const existingImageUrl = response.data?.payment?.invoice_image_url;
          
          if (existingImageUrl) {
            console.log('✅ ใช้รูปบิลที่มีอยู่:', existingImageUrl);
            setInvoiceImageUrl(existingImageUrl);
          } else {
            // ถ้าไม่มีรูป → สร้างใหม่
            console.log('🔨 สร้างรูปบิลใหม่...');
            await generateInvoiceImage(response.invoice);
          }
        } else {
          setError(response?.error || "ไม่สามารถโหลดข้อมูลได้");
        }
      } catch (err) {
        console.error("❌ Error fetching invoice:", err);
        setError(`เกิดข้อผิดพลาด: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    const generateInvoiceImage = async (invoice) => {
      setGeneratingImage(true);
      try {
        const functionUrl = `${window.location.origin}/api/functions/generateInvoiceImage`;
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            payment: invoice,
            skipHashCheck: true // Public ไม่ต้องเช็ค hash
          })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        
        if (result.invoice_image_url) {
          console.log('✅ สร้างรูปบิลสำเร็จ:', result.invoice_image_url);
          setInvoiceImageUrl(result.invoice_image_url);
        } else {
          console.warn('⚠️ ไม่มี invoice_image_url ในผลลัพธ์');
        }
      } catch (err) {
        console.error('❌ สร้างรูปบิลไม่สำเร็จ:', err);
        // ไม่ error - แสดง UI ธรรมดาแทน
      } finally {
        setGeneratingImage(false);
      }
    };

    fetchInvoiceData();
  }, [paymentId, branchId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">กำลังโหลดใบแจ้งหนี้...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">เกิดข้อผิดพลาด</h2>
            <p className="text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { payment, tenant, room, branch, configs } = data;

  const isPaid = payment.status === "paid";
  const isOverdue = payment.status === "overdue";

  // ⭐ ถ้ามีรูปบิล → แสดงรูปเลย (เหมือนหน้า Payments)
  if (invoiceImageUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">ใบแจ้งหนี้</h1>
              <p className="text-sm opacity-90">{configs?.building_name || branch?.branch_name}</p>
            </div>
            <Badge className={`text-lg px-4 py-2 ${isPaid ? 'bg-white text-green-600' : isOverdue ? 'bg-white text-red-600' : 'bg-white text-blue-600'}`}>
              {isPaid ? 'ชำระแล้ว' : isOverdue ? 'เกินกำหนด' : 'รอชำระ'}
            </Badge>
          </div>

          <div className="p-6">
            <img 
              src={invoiceImageUrl} 
              alt="Invoice" 
              className="w-full rounded-lg shadow-lg mb-4"
            />

            <div className="flex gap-3">
              <a
                href={invoiceImageUrl}
                download={`invoice-${payment.id}.png`}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-lg font-semibold text-center transition-all"
              >
                📥 ดาวน์โหลดบิล
              </a>
              <button
                onClick={() => window.print()}
                className="flex-1 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white py-3 rounded-lg font-semibold transition-all"
              >
                🖨️ พิมพ์บิล
              </button>
            </div>

            {/* ช่องทางชำระเงิน */}
            {!isPaid && (
              <div className="mt-6 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  ช่องทางชำระเงิน
                </h3>
                {configs?.promptpay_qr_url ? (
                  <div className="text-center">
                    <img 
                      src={configs.promptpay_qr_url} 
                      alt="PromptPay QR" 
                      className="w-48 h-48 mx-auto mb-3 rounded-lg border-2 border-green-300"
                    />
                    <p className="text-sm text-green-700">สแกน QR Code เพื่อชำระเงิน</p>
                    {configs?.promptpay && (
                      <p className="text-xs text-green-600 mt-1">พร้อมเพย์: {configs.promptpay}</p>
                    )}
                  </div>
                ) : configs?.bank_account_number ? (
                  <div className="text-center py-3">
                    <p className="text-lg font-semibold text-slate-800">{configs.bank_name || "ธนาคาร"}</p>
                    <p className="text-2xl font-bold text-green-600 my-2">{configs.bank_account_number}</p>
                    {configs.bank_account_name && (
                      <p className="text-sm text-slate-600">ชื่อบัญชี: {configs.bank_account_name}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-3 text-sm">กรุณาติดต่อเจ้าของหอพักเพื่อสอบถามช่องทางชำระเงิน</p>
                )}
              </div>
            )}

            {/* ติดต่อ */}
            {(branch?.phone || configs?.contact_phone) && (
              <div className="mt-4 text-center p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm">ติดต่อ: {configs?.contact_phone || branch?.phone}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ⭐ ระหว่างสร้างรูป → แสดง Loading
  if (generatingImage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">กำลังสร้างใบแจ้งหนี้...</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "d MMMM yyyy", { locale: th });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <Card className="mb-6 overflow-hidden">
          <div className={`p-6 text-white ${isPaid ? 'bg-gradient-to-r from-green-500 to-emerald-600' : isOverdue ? 'bg-gradient-to-r from-red-500 to-orange-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {configs?.building_logo ? (
                  <img 
                    src={configs.building_logo} 
                    alt="Logo" 
                    className="w-16 h-16 rounded-xl bg-white/20 p-1 object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
                    <Building2 className="w-8 h-8" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold">{configs?.building_name || branch?.branch_name || "หอพัก"}</h1>
                  <p className="text-white/80 text-sm">{branch?.address || ""}</p>
                </div>
              </div>
              <Badge className={`text-lg px-4 py-2 ${isPaid ? 'bg-white text-green-600' : isOverdue ? 'bg-white text-red-600' : 'bg-white text-blue-600'}`}>
                {isPaid ? (
                  <><CheckCircle className="w-5 h-5 mr-2" /> ชำระแล้ว</>
                ) : isOverdue ? (
                  <><AlertTriangle className="w-5 h-5 mr-2" /> เกินกำหนด</>
                ) : (
                  <><FileText className="w-5 h-5 mr-2" /> รอชำระ</>
                )}
              </Badge>
            </div>
          </div>

          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800">ใบแจ้งหนี้</h2>
              <span className="text-sm text-slate-500">#{payment.id?.substring(0, 8)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">ผู้เช่า</p>
                <p className="font-semibold text-slate-800">{tenant?.full_name || "-"}</p>
              </div>
              <div>
                <p className="text-slate-500">ห้อง</p>
                <p className="font-semibold text-slate-800">{room?.room_number || "-"}</p>
              </div>
              <div>
                <p className="text-slate-500">วันครบกำหนด</p>
                <p className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-800'}`}>
                  {formatDate(payment.due_date)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">รอบบิล</p>
                <p className="font-semibold text-slate-800">{formatDate(payment.created_date)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* รายละเอียดค่าใช้จ่าย */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              รายละเอียดค่าใช้จ่าย
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payment.rent_amount > 0 && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Home className="w-5 h-5 text-slate-400" />
                  <span>ค่าเช่าห้อง</span>
                </div>
                <span className="font-semibold">{formatCurrency(payment.rent_amount)} บาท</span>
              </div>
            )}

            {payment.water_amount > 0 && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Droplets className="w-5 h-5 text-blue-400" />
                  <div>
                    <span>ค่าน้ำ</span>
                    {payment.water_units > 0 && (
                      <span className="text-sm text-slate-500 ml-2">
                        ({payment.water_units} หน่วย × {formatCurrency(payment.water_rate)} บาท)
                      </span>
                    )}
                  </div>
                </div>
                <span className="font-semibold">{formatCurrency(payment.water_amount)} บาท</span>
              </div>
            )}

            {payment.electricity_amount > 0 && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <div>
                    <span>ค่าไฟ</span>
                    {payment.electricity_units > 0 && (
                      <span className="text-sm text-slate-500 ml-2">
                        ({payment.electricity_units} หน่วย × {formatCurrency(payment.electricity_rate)} บาท)
                      </span>
                    )}
                  </div>
                </div>
                <span className="font-semibold">{formatCurrency(payment.electricity_amount)} บาท</span>
              </div>
            )}

            {payment.internet_amount > 0 && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Wifi className="w-5 h-5 text-green-500" />
                  <span>ค่าอินเทอร์เน็ต</span>
                </div>
                <span className="font-semibold">{formatCurrency(payment.internet_amount)} บาท</span>
              </div>
            )}

            {payment.common_fee_amount > 0 && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-purple-500" />
                  <span>ค่าส่วนกลาง</span>
                </div>
                <span className="font-semibold">{formatCurrency(payment.common_fee_amount)} บาท</span>
              </div>
            )}

            {payment.parking_fee_amount > 0 && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Car className="w-5 h-5 text-slate-500" />
                  <span>ค่าจอดรถ</span>
                </div>
                <span className="font-semibold">{formatCurrency(payment.parking_fee_amount)} บาท</span>
              </div>
            )}

            {payment.other_amount > 0 && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <span>ค่าใช้จ่ายอื่นๆ</span>
                </div>
                <span className="font-semibold">{formatCurrency(payment.other_amount)} บาท</span>
              </div>
            )}

            <Separator className="my-4" />

            <div className="flex items-center justify-between py-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl px-4 -mx-2">
              <span className="text-lg font-bold text-slate-800">ยอดรวมทั้งสิ้น</span>
              <span className="text-2xl font-bold text-blue-600">{formatCurrency(payment.total_amount)} บาท</span>
            </div>
          </CardContent>
        </Card>

        {/* ช่องทางชำระเงิน */}
        {!isPaid && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <QrCode className="w-5 h-5 text-green-600" />
                ช่องทางชำระเงิน
              </CardTitle>
            </CardHeader>
            <CardContent>
              {configs?.promptpay_qr_url ? (
                <div className="text-center">
                  <img 
                    src={configs.promptpay_qr_url} 
                    alt="PromptPay QR Code" 
                    className="w-48 h-48 mx-auto mb-4 rounded-xl border-2 border-slate-200"
                  />
                  <p className="text-slate-600 mb-2">สแกน QR Code เพื่อชำระเงิน</p>
                  {configs?.promptpay && (
                    <p className="text-sm text-slate-500">พร้อมเพย์: {configs.promptpay}</p>
                  )}
                </div>
              ) : configs?.promptpay ? (
                <div className="text-center py-4">
                  <p className="text-lg font-semibold text-slate-800 mb-2">พร้อมเพย์</p>
                  <p className="text-2xl font-bold text-green-600">{configs.promptpay}</p>
                </div>
              ) : configs?.bank_account_number ? (
                <div className="text-center py-4">
                  <p className="text-lg font-semibold text-slate-800 mb-2">{configs.bank_name || "ธนาคาร"}</p>
                  <p className="text-2xl font-bold text-blue-600">{configs.bank_account_number}</p>
                  {configs.bank_account_name && (
                    <p className="text-sm text-slate-500 mt-1">ชื่อบัญชี: {configs.bank_account_name}</p>
                  )}
                </div>
              ) : (
                <p className="text-center text-slate-500 py-4">กรุณาติดต่อเจ้าของหอพักเพื่อสอบถามช่องทางชำระเงิน</p>
              )}

              <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>📸 หลังโอนเงินแล้ว:</strong> ส่งรูปสลิปมาที่ LINE เพื่อยืนยันการชำระเงิน
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ติดต่อ */}
        {(branch?.phone || configs?.contact_phone) && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-center gap-3 text-slate-600">
                <Phone className="w-5 h-5" />
                <span>ติดต่อ: {configs?.contact_phone || branch?.phone}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          ใบแจ้งหนี้อิเล็กทรอนิกส์ • {configs?.building_name || branch?.branch_name}
        </p>
      </div>
    </div>
  );
}