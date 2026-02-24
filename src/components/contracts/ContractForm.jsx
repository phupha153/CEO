import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, List, PenTool, Save, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ReactQuill from 'react-quill';

export default function ContractForm({
  formData,
  setFormData,
  tenants,
  rooms,
  isSaving,
  saveMutation,
  handleSave,
  handleTenantChange,
  handleRoomChange,
  handleAddRule,
  handleRemoveRule,
  handleUpdateRule,
  handleAddClause,
  handleRemoveClause,
  handleUpdateClause,
  handleOpenSignature,
  generateTemplate,
  showClausesEditor,
  setShowClausesEditor,
  showEditor,
  setShowEditor,
  handleAIEdit,
  setAiEditQuery,
  aiEditQuery,
  aiLoading,
  convertToBuddhistYear,
}) {
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ],
  };

  return (
    <div className="space-y-6">
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
          <h3 className="text-md font-semibold mb-3 text-purple-900">ข้อมูลผู้ให้เช่า (ผู้มีอำนาจลงนาม)</h3>
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
            <Label className="text-xs md:text-sm">ค่าเช่า/เดือน</Label>
            <Input
              type="number"
              value={formData.rent_monthly}
              onChange={(e) => setFormData({ ...formData, rent_monthly: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label className="text-xs md:text-sm">ประกัน</Label>
            <Input
              type="number"
              value={formData.deposit}
              onChange={(e) => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label className="text-xs md:text-sm">กำหนดชำระ</Label>
            <Input
              type="number"
              min="1"
              max="31"
              value={formData.pay_day}
              onChange={(e) => setFormData({ ...formData, pay_day: parseInt(e.target.value) || 5 })}
            />
          </div>
          <div>
            <Label className="text-xs md:text-sm">ค่าปรับ/วัน</Label>
            <Input
              type="number"
              value={formData.late_fee_per_per_day}
              onChange={(e) => setFormData({ ...formData, late_fee_per_per_day: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <Label className="text-xs md:text-sm">ล่วงหน้า</Label>
            <Input
              type="number"
              min="0"
              value={formData.advance_rent_months}
              onChange={(e) => setFormData({ ...formData, advance_rent_months: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div>
            <Label className="text-xs md:text-sm">ประกัน</Label>
            <Input
              type="number"
              min="0"
              value={formData.deposit_months}
              onChange={(e) => setFormData({ ...formData, deposit_months: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div>
            <Label className="text-xs md:text-sm">อุปกรณ์</Label>
            <Input
              type="number"
              min="0"
              value={formData.appliance_fee}
              onChange={(e) => setFormData({ ...formData, appliance_fee: parseFloat(e.target.value) || 0 })}
            />
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
                สร้าง Template ใหม่
              </Button>
            </div>
            <ReactQuill
              value={formData.contract_content}
              onChange={(value) => setFormData({ ...formData, contract_content: value })}
              modules={modules}
              theme="snow"
              style={{ height: '400px', marginBottom: '50px' }}
              placeholder="พิมพ์เนื้อหาสัญญา..."
            />
          </div>
        )}

        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm md:text-md font-semibold mb-3">เงื่อนไขสัญญา</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <Label className="text-xs md:text-sm">แจ้งล่วงหน้า (วัน)</Label>
              <Input
                type="number"
                min="1"
                value={formData.termination_notice_days}
                onChange={(e) => setFormData({ ...formData, termination_notice_days: parseInt(e.target.value) || 30 })}
              />
            </div>
            <div>
              <Label className="text-xs md:text-sm">คืนประกัน (วัน)</Label>
              <Input
                type="number"
                min="1"
                value={formData.deposit_return_days}
                onChange={(e) => setFormData({ ...formData, deposit_return_days: parseInt(e.target.value) || 7 })}
              />
            </div>
            <div>
              <Label className="text-xs md:text-sm">ค้างชำระ (วัน)</Label>
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
                ห้ามสูบบุหรี่
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
                    placeholder={`กฎเพิ่มเติมข้อ ${index + 1}`}
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
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 mt-4">
          <div>
            <Label>ชื่อพยานคนที่ 1</Label>
            <Input
              value={formData.witness1_name}
              onChange={(e) => setFormData({ ...formData, witness1_name: e.target.value })}
              placeholder="ชื่อ-นามสกุล"
            />
          </div>
          <div>
            <Label>ชื่อพยานคนที่ 2</Label>
            <Input
              value={formData.witness2_name}
              onChange={(e) => setFormData({ ...formData, witness2_name: e.target.value })}
              placeholder="ชื่อ-นามสกุล"
            />
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <Label className="mb-3 block text-base font-semibold">ลายเซ็น</Label>
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
        </div>
      </div>
    </div>
  );
}