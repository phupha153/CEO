import React, { useState, useEffect } from "react";
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

// ⭐⭐⭐ PUBLIC PAGE - ไม่ต้องการ authentication
// ⭐ ใช้ native URLSearchParams แทน useSearchParams เพื่อหลีกเลี่ยง router auth check
export default function PublicInvoice() {
  // ⭐ ใช้ window.location.search แทน useSearchParams
  const urlParams = new URLSearchParams(window.location.search);
  const paymentId = urlParams.get("id");
  const branchId = urlParams.get("branch");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchInvoiceData = async () => {
      if (!paymentId) {
        setError("ไม่พบรหัสใบแจ้งหนี้");
        setLoading(false);
        return;
      }

      try {
        // ⭐ เรียก API แบบ public โดยไม่ต้อง login - ใช้ fetch ตรงๆ
        const apiUrl = `https://base44.app/api/apps/6904ea5ce861be65483eff6e/functions/getPublicInvoice`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ paymentId, branchId })
        });

        const result = await response.json();

        if (result?.success) {
          setData(result.data);
        } else {
          setError(result?.error || "ไม่สามารถโหลดข้อมูลได้");
        }
      } catch (err) {
        console.error("Error fetching invoice:", err);
        setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setLoading(false);
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

// ⭐ Export flag to indicate this is a public page (for platform-level check)
PublicInvoice.isPublicPage = true;