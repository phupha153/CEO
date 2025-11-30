import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Database, Download, Trash2, Archive, Calendar, Building2, AlertTriangle, CheckCircle, Loader2, HardDrive } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../components/shared/PageHeader";
import { motion } from "framer-motion";

export default function DataArchive() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [deleteAfterArchive, setDeleteAfterArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState(null);
  
  const [selectedEntities, setSelectedEntities] = useState({
    Payment: true,
    Expense: true,
    Booking: true,
    MeterReading: true,
    MaintenanceRequest: true,
    Contract: true
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    enabled: !!currentUser,
  });

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');

  const handleArchive = async () => {
    if (!startDate || !endDate) {
      toast.error('กรุณาเลือกช่วงวันที่');
      return;
    }

    const includeEntities = Object.entries(selectedEntities)
      .filter(([_, selected]) => selected)
      .map(([entity, _]) => entity);

    if (includeEntities.length === 0) {
      toast.error('กรุณาเลือกอย่างน้อย 1 ประเภทข้อมูล');
      return;
    }

    if (deleteAfterArchive) {
      const confirmed = window.confirm(
        '⚠️ คำเตือน: คุณกำลังจะลบข้อมูลหลังจาก Archive\n\n' +
        'ข้อมูลที่ลบไปแล้วจะไม่สามารถกู้คืนได้ (ยกเว้นจากไฟล์ Archive)\n\n' +
        'คุณแน่ใจหรือไม่?'
      );
      
      if (!confirmed) return;
    }

    setArchiving(true);
    setArchiveResult(null);

    try {
      const response = await base44.functions.invoke('archiveDataToCloud', {
        branch_id: selectedBranch || null,
        start_date: startDate,
        end_date: endDate,
        include_entities: includeEntities,
        delete_after_archive: deleteAfterArchive
      });

      if (response.data.success) {
        setArchiveResult(response.data);
        toast.success('Archive สำเร็จ!');
      } else {
        throw new Error(response.data.error || 'Archive failed');
      }
    } catch (error) {
      console.error('Archive error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถ Archive ได้'));
    } finally {
      setArchiving(false);
    }
  };

  if (userRole !== 'developer') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-8">
        <Card className="max-w-2xl mx-auto bg-white/80 backdrop-blur-xl">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-slate-600">หน้านี้สำหรับผู้พัฒนาระบบเท่านั้น</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const entityOptions = [
    { key: 'Payment', label: 'การชำระเงิน (Payments)', icon: '💰' },
    { key: 'Expense', label: 'ค่าใช้จ่าย (Expenses)', icon: '🧾' },
    { key: 'Booking', label: 'การจองห้อง (Bookings)', icon: '📅' },
    { key: 'MeterReading', label: 'บันทึกมิเตอร์', icon: '⚡' },
    { key: 'MaintenanceRequest', label: 'แจ้งซ่อม', icon: '🔧' },
    { key: 'Contract', label: 'สัญญาเช่า', icon: '📄' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <PageHeader 
        title="Data Archive System" 
        subtitle="ระบบสำรองและจัดเก็บข้อมูลระยะยาว"
        icon={Database}
        showBackButton={true}
      />

      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* คำเตือน */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Alert className="bg-orange-50 border-orange-200">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <AlertDescription className="text-orange-800 text-sm">
                <strong>Developer Only:</strong> ฟีเจอร์นี้ใช้สำหรับจัดการข้อมูลระยะยาว เพื่อป้องกันข้อมูลเยอะเกินไปในระบบ
                <br />ข้อมูลที่ Archive แล้วจะถูกเก็บเป็นไฟล์ JSON และสามารถดาวน์โหลดกลับมาได้
              </AlertDescription>
            </Alert>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* การตั้งค่า Archive */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-white/80 backdrop-blur-xl shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Archive className="w-5 h-5 text-blue-600" />
                    ตั้งค่า Archive
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* เลือกสาขา */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      <Building2 className="w-4 h-4 inline mr-1" />
                      เลือกสาขา (ถ้าไม่เลือก = ทุกสาขา)
                    </label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-300 bg-white"
                    >
                      <option value="">ทุกสาขา</option>
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.branch_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* ช่วงวันที่ */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        วันที่เริ่มต้น
                      </label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        วันที่สิ้นสุด
                      </label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                  </div>

                  {/* เลือกประเภทข้อมูล */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      <Database className="w-4 h-4 inline mr-1" />
                      ประเภทข้อมูลที่ต้องการ Archive
                    </label>
                    <div className="space-y-2">
                      {entityOptions.map(({ key, label, icon }) => (
                        <label key={key} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer">
                          <Checkbox
                            checked={selectedEntities[key]}
                            onCheckedChange={(checked) => 
                              setSelectedEntities(prev => ({ ...prev, [key]: checked }))
                            }
                          />
                          <span className="text-lg">{icon}</span>
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* ลบหลัง Archive */}
                  <div className="p-4 bg-red-50 rounded-xl border-2 border-red-200">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={deleteAfterArchive}
                        onCheckedChange={setDeleteAfterArchive}
                        className="mt-1"
                      />
                      <div>
                        <div className="flex items-center gap-2 font-semibold text-red-700">
                          <Trash2 className="w-4 h-4" />
                          ลบข้อมูลหลัง Archive
                        </div>
                        <p className="text-xs text-red-600 mt-1">
                          ⚠️ ข้อมูลที่ลบจะหายไปจากระบบ แต่ยังมีใน Archive File
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* ปุ่ม Archive */}
                  <Button
                    onClick={handleArchive}
                    disabled={archiving}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-6"
                  >
                    {archiving ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        กำลัง Archive...
                      </>
                    ) : (
                      <>
                        <Archive className="w-5 h-5 mr-2" />
                        เริ่ม Archive ข้อมูล
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* ผลลัพธ์ */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Card className="bg-white/80 backdrop-blur-xl shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    ผลลัพธ์
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!archiveResult ? (
                    <div className="text-center py-12">
                      <HardDrive className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">ยังไม่มีผลลัพธ์</p>
                      <p className="text-xs text-slate-400 mt-2">กรุณาตั้งค่าและกดปุ่ม Archive</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* สรุปข้อมูล */}
                      <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                        <div className="flex items-center gap-2 text-green-700 font-semibold mb-2">
                          <CheckCircle className="w-5 h-5" />
                          Archive สำเร็จ!
                        </div>
                        <p className="text-sm text-green-600">
                          ทั้งหมด {archiveResult.summary?.total_records || 0} รายการ
                        </p>
                      </div>

                      {/* รายละเอียดแต่ละ Entity */}
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-700">รายละเอียด:</p>
                        {archiveResult.summary?.by_entity && Object.entries(archiveResult.summary.by_entity).map(([entity, count]) => (
                          <div key={entity} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-sm">
                            <span className="text-slate-700">{entity}</span>
                            <span className="font-bold text-slate-800">{count} รายการ</span>
                          </div>
                        ))}
                      </div>

                      {/* ผลลัพธ์การลบ */}
                      {archiveResult.deletion_results && (
                        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                          <p className="text-sm font-semibold text-red-700 mb-2">ข้อมูลที่ถูกลบ:</p>
                          <div className="space-y-1">
                            {archiveResult.deletion_results.map((result, idx) => (
                              <div key={idx} className="text-xs text-red-600">
                                {result.entity}: ลบ {result.deleted}/{result.total} รายการ
                                {result.error && <span className="text-red-500"> (Error: {result.error})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ดาวน์โหลดไฟล์ */}
                      <Button
                        onClick={() => window.open(archiveResult.archive_url, '_blank')}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        ดาวน์โหลดไฟล์ Archive
                      </Button>

                      {/* Metadata */}
                      <div className="text-xs text-slate-500 space-y-1 p-3 bg-slate-50 rounded-lg">
                        <p><strong>ช่วงวันที่:</strong> {archiveResult.metadata?.date_range?.start_date} ถึง {archiveResult.metadata?.date_range?.end_date}</p>
                        <p><strong>สาขา:</strong> {archiveResult.metadata?.branch_id === 'all_branches' ? 'ทุกสาขา' : archiveResult.metadata?.branch_id}</p>
                        <p><strong>Archive เมื่อ:</strong> {new Date(archiveResult.metadata?.archived_at).toLocaleString('th-TH')}</p>
                        <p><strong>โดย:</strong> {archiveResult.metadata?.archived_by}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* คำแนะนำการใช้งาน */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-base">💡 คำแนะนำการใช้งาน</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p>• <strong>Archive ข้อมูลเก่า:</strong> แนะนำให้ Archive ข้อมูลที่เก่ากว่า 2-3 ปี เพื่อลดภาระของระบบ</p>
                <p>• <strong>สำรอง Before ลบ:</strong> ควรดาวน์โหลดไฟล์ Archive ก่อนทุกครั้งที่เลือก "ลบหลัง Archive"</p>
                <p>• <strong>แยกตามสาขา:</strong> สามารถ Archive แยกตามสาขาได้ เพื่อจัดการข้อมูลแต่ละสาขาได้ง่ายขึ้น</p>
                <p>• <strong>ไฟล์ JSON:</strong> ไฟล์ Archive เป็น JSON Format สามารถนำกลับมาใช้ได้โดย Import เข้า Database</p>
                <p>• <strong>Cloud Storage:</strong> ไฟล์จะถูกเก็บอัตโนมัติใน Base44 File Storage</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}