import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import PageHeader from "../components/shared/PageHeader";
import { Megaphone, Plus, Trash2, Edit, Loader2, Eye, EyeOff, Calendar, Link2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "sonner";

export default function BannerManagement() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingBannerId, setDeletingBannerId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    image_url: '',
    link_url: '',
    is_active: true,
    start_date: '',
    end_date: '',
    priority: 0
  });

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['banners'],
    queryFn: () => base44.entities.Banner.list('-priority', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Banner.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['banners']);
      setShowDialog(false);
      resetForm();
      toast.success('เพิ่มประกาศสำเร็จ');
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Banner.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['banners']);
      setShowDialog(false);
      resetForm();
      toast.success('แก้ไขประกาศสำเร็จ');
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Banner.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['banners']);
      setDeletingBannerId(null);
      toast.success('ลบประกาศสำเร็จ');
    },
    onError: () => toast.error('ลบไม่สำเร็จ'),
  });

  const resetForm = () => {
    setFormData({
      title: '',
      image_url: '',
      link_url: '',
      is_active: true,
      start_date: '',
      end_date: '',
      priority: 0
    });
    setEditingBanner(null);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, image_url: file_url }));
      toast.success('อัปโหลดรูปภาพสำเร็จ');
    } catch {
      toast.error('อัปโหลดรูปภาพไม่สำเร็จ');
    }
    setUploadingImage(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.image_url) {
      toast.error('กรุณาอัปโหลดรูปภาพประกาศ');
      return;
    }

    if (editingBanner) {
      updateMutation.mutate({ id: editingBanner.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      image_url: banner.image_url,
      link_url: banner.link_url || '',
      is_active: banner.is_active,
      start_date: banner.start_date,
      end_date: banner.end_date,
      priority: banner.priority || 0
    });
    setShowDialog(true);
  };

  const handleToggleActive = async (banner) => {
    try {
      await base44.entities.Banner.update(banner.id, {
        is_active: !banner.is_active
      });
      queryClient.invalidateQueries(['banners']);
      toast.success(banner.is_active ? 'ปิดการแสดงผลแล้ว' : 'เปิดการแสดงผลแล้ว');
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const isDateActive = (banner) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(banner.start_date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(banner.end_date);
    endDate.setHours(23, 59, 59, 999);
    return today >= startDate && today <= endDate;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader 
        title="จัดการประกาศ Pop-up" 
        subtitle="จัดการประกาศและอัปเดตระบบที่แสดงในหน้าเลือกสาขา"
        icon={Megaphone}
      />

      <div className="mb-6">
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มประกาศใหม่
        </Button>
      </div>

      {banners.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-300">
          <CardContent className="p-12 text-center">
            <Megaphone className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">ยังไม่มีประกาศ</p>
            <p className="text-sm text-slate-500 mt-2">เริ่มต้นด้วยการเพิ่มประกาศแรก</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {banners.map((banner) => {
            const dateActive = isDateActive(banner);
            const willShow = banner.is_active && dateActive;

            return (
              <Card key={banner.id} className={`overflow-hidden ${willShow ? 'border-2 border-green-500' : 'border-slate-200'}`}>
                <div className="relative">
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    {willShow && (
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg">
                        กำลังแสดง
                      </span>
                    )}
                    {banner.is_active && !dateActive && (
                      <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg">
                        รออยู่
                      </span>
                    )}
                    {!banner.is_active && (
                      <span className="bg-slate-500 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg">
                        ปิดใช้งาน
                      </span>
                    )}
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-bold text-slate-800 mb-2 truncate">{banner.title}</h3>
                  
                  <div className="space-y-1 text-sm text-slate-600 mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-xs">
                        {format(parseISO(banner.start_date), 'd MMM yyyy', { locale: th })} - {format(parseISO(banner.end_date), 'd MMM yyyy', { locale: th })}
                      </span>
                    </div>
                    {banner.link_url && (
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-slate-400" />
                        <span className="text-xs truncate">{banner.link_url}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">ลำดับ:</span>
                      <span className="text-xs">{banner.priority || 0}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleToggleActive(banner)}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      {banner.is_active ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-1" />
                          ปิด
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-1" />
                          เปิด
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleEdit(banner)}
                      size="sm"
                      variant="outline"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => setDeletingBannerId(banner.id)}
                      size="sm"
                      variant="destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBanner ? 'แก้ไขประกาศ' : 'เพิ่มประกาศใหม่'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>ชื่อประกาศ (สำหรับอ้างอิงภายใน) *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="อัปเดตระบบ ม.ค. 2569"
              />
            </div>

            <div>
              <Label>รูปภาพประกาศ *</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="cursor-pointer"
              />
              {uploadingImage && (
                <div className="mt-2 text-sm text-blue-600 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังอัปโหลด...
                </div>
              )}
              {formData.image_url && (
                <div className="mt-3">
                  <img 
                    src={formData.image_url} 
                    alt="Preview" 
                    className="w-full max-h-96 object-contain rounded-lg border-2 border-slate-200" 
                  />
                </div>
              )}
            </div>

            <div>
              <Label>ลิงก์เมื่อคลิก (ถ้ามี)</Label>
              <Input
                value={formData.link_url}
                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                placeholder="https://example.com"
              />
              <p className="text-xs text-slate-500 mt-1">ถ้าระบุ เมื่อคลิกที่รูปจะเปิดลิงก์นี้</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>วันที่เริ่มแสดง *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>วันที่สิ้นสุด *</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label>ลำดับความสำคัญ</Label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <p className="text-xs text-slate-500 mt-1">เลขมากจะแสดงก่อน (ถ้ามีหลายประกาศพร้อมกัน)</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600"
              />
              <Label htmlFor="is_active" className="cursor-pointer">เปิดใช้งานทันที</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
              >
                ยกเลิก
              </Button>
              <Button 
                type="submit"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                disabled={uploadingImage}
              >
                {editingBanner ? 'บันทึก' : 'เพิ่มประกาศ'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingBannerId} onOpenChange={() => setDeletingBannerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบประกาศ</AlertDialogTitle>
            <AlertDialogDescription>
              การลบประกาศนี้จะไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deletingBannerId)}
              className="bg-red-600 hover:bg-red-700"
            >
              ลบประกาศ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}