import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function QuickDeletePayments() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const branchId = "692eae1308315df66d99c351"; // Wresdent 123

  const handleDelete = async () => {
    if (!confirm(`⚠️ ยืนยันการลบ Payment ทั้งหมดของสาขา Wresdent 123?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await base44.functions.invoke('deletePaymentsByBranchDirect', {
        branch_id: branchId
      });

      const data = response.data;
      
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเรียกฟังก์ชัน');
      console.error('Delete error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 p-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="shadow-2xl border-2 border-red-200">
            <CardHeader className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-t-lg">
              <CardTitle className="text-2xl flex items-center gap-3">
                <AlertTriangle className="w-8 h-8" />
                ลบข้อมูล Payment - Wresdent 123
              </CardTitle>
              <CardDescription className="text-red-50">
                ลบการชำระเงินทั้งหมดของสาขาทดสอบ
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">⚠️ คำเตือน</p>
                    <p>การดำเนินการนี้จะลบ Payment ประมาณ <strong>102 รายการ</strong></p>
                    <p className="text-xs mt-2 text-yellow-700">
                      Branch ID: {branchId}
                    </p>
                  </div>
                </div>
              </div>

              {/* Delete Button */}
              <Button
                onClick={handleDelete}
                disabled={loading}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white py-6 text-lg font-semibold rounded-xl shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    กำลังลบ...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 mr-2" />
                    ลบ Payment ทั้งหมด
                  </>
                )}
              </Button>

              {/* Result Display */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-50 border-2 border-green-200 rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-800 mb-2">✅ สำเร็จ!</p>
                      <div className="text-sm text-green-700 space-y-1">
                        <p>ลบสำเร็จ: <strong>{result.deleted}</strong> รายการ</p>
                        <p>จากทั้งหมด: <strong>{result.total}</strong> รายการ</p>
                        <p className="text-xs mt-2 text-green-600">{result.message}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Error Display */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-50 border-2 border-red-200 rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800 mb-2">❌ เกิดข้อผิดพลาด</p>
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ หมายเหตุ:</strong> การลบจะใช้เวลาสักครู่ ระบบจะลบทีละ 50 รายการ
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}