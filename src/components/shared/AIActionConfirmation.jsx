import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, AlertTriangle, ArrowRight, Loader2, Upload, Edit2, Save, Trash2, Zap, Droplet } from "lucide-react";
import { motion } from "framer-motion";

export default function AIActionConfirmation({ 
  action, 
  onConfirm, 
  onCancel, 
  isLoading = false,
  allowSlipUpload = false,
  roomInfo = null // ข้อมูลห้องที่จะแก้ไข
}) {
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentAction, setCurrentAction] = useState(action);

  useEffect(() => {
    setCurrentAction(action);
  }, [action]);

  const handleSlipChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSlipFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSlipPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (key, value) => {
    setCurrentAction(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [key]: value
      }
    }));
  };

  if (!currentAction) return null;

  const getFieldLabel = (field) => {
    const labels = {
      check_in_date: 'วันเข้าพัก',
      check_out_date: 'วันออก',
      deposit_amount: 'เงินมัดจำ',
      deposit_payment_method: 'วิธีชำระเงินมัดจำ',
      total_amount: 'ยอดรวม',
      rent_amount: 'ค่าเช่า',
      booking_type: 'ประเภทการจอง',
      status: 'สถานะ',
      notes: 'หมายเหตุ',
      full_name: 'ชื่อ-นามสกุล',
      phone: 'เบอร์โทร',
      guest_name: 'ชื่อผู้เข้าพัก',
      guest_phone: 'เบอร์โทร',
      guest_email: 'อีเมล',
      room_number: 'หมายเลขห้อง',
      floor: 'ชั้น',
      price: 'ราคา',
      water_rate: 'ค่าน้ำ/หน่วย',
      electricity_rate: 'ค่าไฟ/หน่วย',
      common_fee: 'ค่าส่วนกลาง',
    };
    return labels[field] || field.replace(/_/g, ' ');
  };

  // Fields to hide based on room type
  const shouldHideField = (field, roomInfo) => {
    // For monthly rooms, hide check_out_date and guest_phone
    if (roomInfo?.room_type === 'monthly') {
      if (field === 'check_out_date' || field === 'guest_phone') {
        return true;
      }
    }
    return false;
  };

  const formatValue = (field, value) => {
    if (field === 'deposit_payment_method') {
      const methods = { cash: 'เงินสด', transfer: 'โอนเงิน', qr_code: 'QR Code' };
      return methods[value] || value;
    }
    if (field === 'booking_type') {
      return value === 'monthly' ? 'รายเดือน' : 'รายวัน';
    }
    if (field === 'status') {
      const statuses = { active: 'ใช้งาน', pending: 'รอดำเนินการ', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก' };
      return statuses[value] || value;
    }
    if (field.includes('amount') || field.includes('fee') || field.includes('rate') || field === 'price') {
      return `${Number(value).toLocaleString()} บาท`;
    }
    return value?.toString() || '-';
  };

  const getActionTypeLabel = (type) => {
    switch(type) {
      case 'update': return 'แก้ไขข้อมูล';
      case 'bulk_update': return 'แก้ไขหลายห้อง';
      case 'create': return 'เพิ่มข้อมูล';
      case 'delete': return 'ลบข้อมูล';
      default: return 'ดำเนินการ';
    }
  };

  const getActionColor = (type) => {
    switch(type) {
      case 'update': return 'from-blue-500 to-indigo-500';
      case 'bulk_update': return 'from-purple-500 to-pink-500';
      case 'create': return 'from-green-500 to-emerald-500';
      case 'delete': return 'from-red-500 to-pink-500';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const handleDelete = () => {
    if (confirm('คุณแน่ใจหรือไม่ที่จะยกเลิกรายการนี้?')) {
      onCancel();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mt-4"
    >
      <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getActionColor(currentAction.action_type)} flex items-center justify-center flex-shrink-0`}>
              {currentAction.action_type === 'update' && <AlertTriangle className="w-5 h-5 text-white" />}
              {currentAction.action_type === 'create' && <Check className="w-5 h-5 text-white" />}
              {currentAction.action_type === 'delete' && <X className="w-5 h-5 text-white" />}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-800 text-lg mb-1">
                ยืนยัน{getActionTypeLabel(currentAction.action_type)}
              </h4>
              <p className="text-sm text-slate-600">{currentAction.description || 'กรุณาตรวจสอบข้อมูลก่อนยืนยัน'}</p>
            </div>
            <div className="flex gap-2">
              {!isEditing && currentAction.action_type !== 'delete' && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} disabled={isLoading}>
                  <Edit2 className="w-4 h-4 mr-1" />
                  แก้ไข
                </Button>
              )}
              <Badge className={`bg-gradient-to-r ${getActionColor(currentAction.action_type)} text-white`}>
                {getActionTypeLabel(currentAction.action_type)}
              </Badge>
            </div>
          </div>

          {/* Bulk Update - แก้ไขหลายห้อง */}
          {currentAction.action_type === 'bulk_update' && currentAction.rooms_list && !isEditing && (
            <div className="space-y-3 mb-4">
              <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl p-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                    <span className="text-2xl font-bold">{currentAction.rooms_list.length}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">แก้ไข {currentAction.rooms_list.length} ห้อง</h3>
                    <p className="text-sm text-white/80">
                    เปลี่ยน{currentAction.field_label} → {currentAction.new_value}
                    {currentAction.except_rooms?.length > 0 && ` (ยกเว้น ${currentAction.except_rooms.join(', ')})`}
                    </p>
                    {currentAction.changes && (currentAction.changes.is_flat_rate_electricity || currentAction.changes.is_flat_rate_water) && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {currentAction.changes.is_flat_rate_electricity && (
                        <Badge className="bg-orange-400/30 text-white border-white/40">
                          <Zap className="w-3 h-3 mr-1" />
                          ค่าไฟเหมา {currentAction.changes.flat_rate_electricity_amount} บาท/เดือน
                        </Badge>
                      )}
                      {currentAction.changes.is_flat_rate_water && (
                        <Badge className="bg-blue-400/30 text-white border-white/40">
                          <Droplet className="w-3 h-3 mr-1" />
                          ค่าน้ำเหมา {currentAction.changes.flat_rate_water_amount} บาท/เดือน
                        </Badge>
                      )}
                    </div>
                    )}
                  </div>
                </div>
              </div>
              
              <h5 className="font-semibold text-slate-700 text-sm">📋 รายการห้องที่จะแก้ไข:</h5>
              <div className="bg-white rounded-xl p-4 border-2 border-slate-200 max-h-64 overflow-y-auto">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {currentAction.rooms_list.map((room) => (
                    <div key={room.room_id} className="p-2 bg-slate-50 rounded-lg text-center">
                      <p className="font-bold text-slate-800">ห้อง {room.room_number}</p>
                      <p className="text-xs text-slate-500">ชั้น {room.floor}</p>
                      <p className="text-xs">
                        <span className="text-red-600 line-through">{room.old_value}</span>
                        {' → '}
                        <span className="text-green-600 font-bold">{currentAction.new_value}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Single Update - แก้ไขห้องเดียว */}
          {currentAction.action_type === 'update' && currentAction.changes && !isEditing && (
            <div className="space-y-3 mb-4">
              {/* แสดงข้อมูลห้องที่จะแก้ไข */}
              {roomInfo && (
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl p-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl font-bold">{roomInfo.room_number}</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">ห้อง {roomInfo.room_number}</h3>
                      <p className="text-sm text-white/80">ชั้น {roomInfo.floor} • {roomInfo.room_type === 'monthly' ? 'รายเดือน' : 'รายวัน'}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <h5 className="font-semibold text-slate-700 text-sm">📝 รายการที่จะเปลี่ยนแปลง:</h5>
              <div className="bg-white rounded-xl p-4 border-2 border-slate-200 space-y-3">
                {Object.entries(currentAction.changes).map(([field, change]) => (
                  <div key={field} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-700 font-semibold">{change.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 text-center">
                        <p className="text-xs text-slate-500 mb-1">ค่าเดิม</p>
                        <span className="inline-block px-4 py-2 bg-red-100 text-red-700 rounded-lg font-semibold text-lg line-through">
                          {change.old || '-'} {field.includes('rate') || field.includes('fee') || field === 'price' ? 'บาท' : ''}
                        </span>
                      </div>
                      <ArrowRight className="w-6 h-6 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 text-center">
                        <p className="text-xs text-slate-500 mb-1">ค่าใหม่</p>
                        <span className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-lg font-bold text-lg">
                          {change.new || '-'} {field.includes('rate') || field.includes('fee') || field === 'price' ? 'บาท' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentAction.action_type === 'create' && currentAction.data && (
            <div className="space-y-3 mb-4">
              {/* แสดงข้อมูลห้องที่จะจอง */}
              {roomInfo && (
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl font-bold">{roomInfo.room_number}</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">ห้อง {roomInfo.room_number}</h3>
                      <p className="text-sm text-white/80">ชั้น {roomInfo.floor} • {roomInfo.room_type === 'monthly' ? 'รายเดือน' : 'รายวัน'}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <h5 className="font-semibold text-slate-700 text-sm">ข้อมูลที่จะเพิ่ม:</h5>
              <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3">
                {isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(currentAction.data).map(([field, value]) => {
                      if (field.includes('_id') || field === 'status') return null; // Skip ID fields
                      const fieldLabel = getFieldLabel(field);
                      return (
                        <div key={field}>
                          <Label className="text-xs text-slate-500 mb-1">{fieldLabel}</Label>
                          <Input 
                            value={value || ''} 
                            onChange={(e) => handleInputChange(field, e.target.value)}
                            className="bg-white"
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  Object.entries(currentAction.data).map(([field, value]) => (
                    value && !field.includes('_id') && !shouldHideField(field, roomInfo) && (
                      <div key={field} className="flex items-start gap-3 text-sm border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                        <span className="text-slate-600 font-medium min-w-[140px]">{getFieldLabel(field)}:</span>
                        <span className="text-slate-800 font-semibold">{formatValue(field, value)}</span>
                      </div>
                    )
                  ))
                )}
              </div>
              {isEditing && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setIsEditing(false)} className="bg-blue-600 hover:bg-blue-700">
                    <Save className="w-4 h-4 mr-1" />
                    บันทึกการแก้ไข
                  </Button>
                </div>
              )}
            </div>
          )}

          {!isEditing && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                <p className="text-sm text-blue-800 font-semibold">
                  ⚠️ ข้อมูลยังไม่ถูกเปลี่ยนแปลง กรุณากดปุ่ม "ยืนยัน" เพื่อดำเนินการ
                </p>
              </div>
            </div>
          )}

          {currentAction.warning && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <p className="text-sm text-amber-800">{currentAction.warning}</p>
              </div>
            </div>
          )}

          {allowSlipUpload && currentAction.data?.deposit_amount > 0 && !isEditing && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">📎 อัปโหลดสลิปค่ามัดจำ (ถ้ามี)</p>
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-slate-600" />
                <span className="text-sm text-slate-600">
                  {slipFile ? slipFile.name : 'คลิกเพื่ออัปโหลดสลิป'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSlipChange}
                  disabled={isLoading}
                  className="hidden"
                />
              </label>
              {slipPreview && (
                <div className="relative inline-block">
                  <img
                    src={slipPreview}
                    alt="สลิป"
                    className="w-full max-w-xs h-48 object-cover rounded-lg border-2 border-slate-200"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="absolute top-2 right-2 bg-white/90"
                    onClick={() => {
                      setSlipFile(null);
                      setSlipPreview(null);
                    }}
                    disabled={isLoading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={isLoading || isEditing}
              className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              ลบ/ยกเลิก
            </Button>
            <Button
              onClick={() => onConfirm(slipFile, currentAction)}
              disabled={isLoading || isEditing}
              className={`bg-gradient-to-r ${getActionColor(currentAction.action_type)}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  ยืนยัน{getActionTypeLabel(currentAction.action_type)}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}