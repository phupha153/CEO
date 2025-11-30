import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { X, Send, Loader2, Sparkles, CheckCircle } from "lucide-react";

export default function ReportIssueDialog({ isOpen, onClose, currentUser }) {
  const [step, setStep] = useState(1); // 1 = form, 2 = AI analysis
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'bug',
    priority: 'medium',
    image_urls: []
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);

  const submitMutation = useMutation({
    mutationFn: async (data) => {
      // ส่งไปยัง CRM แทนการสร้างใน app ปัจจุบัน
      const response = await base44.functions.invoke('sendTicketToCRM', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('ส่งรายงานปัญหาไปยังทีมซัพพอร์ตเรียบร้อยแล้ว');
      handleClose();
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + (error.response?.data?.error || error.message));
    }
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({
        ...prev,
        image_urls: [...prev.image_urls, file_url]
      }));
      toast.success('อัปโหลดรูปภาพสำเร็จ');
    } catch (error) {
      toast.error('อัปโหลดรูปภาพไม่สำเร็จ');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (index) => {
    setFormData(prev => ({
      ...prev,
      image_urls: prev.image_urls.filter((_, i) => i !== index)
    }));
  };

  const handleAnalyzeWithAI = async (e) => {
    e.preventDefault();
    setAiAnalyzing(true);

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `คุณเป็นผู้ช่วยด้านการแก้ปัญหาระบบจัดการหอพัก วิเคราะห์ปัญหาและให้คำแนะนำแก่ผู้ใช้

ปัญหาที่รายงาน:
หัวข้อ: ${formData.title}
รายละเอียด: ${formData.description}
ประเภท: ${formData.category === 'bug' ? 'ระบบทำงานผิดพลาด' : formData.category === 'feature_request' ? 'ขอฟีเจอร์เพิ่ม' : formData.category === 'question' ? 'คำถาม' : 'อื่นๆ'}

วิเคราะห์และให้คำตอบ:
1. ถ้าเป็นคำถามหรือปัญหาที่ไม่ซับซ้อน ให้คำแนะนำวิธีแก้ไขที่ผู้ใช้สามารถทำเองได้
2. ถ้าเป็นปัญหาที่ซับซ้อนหรือต้องการทีมช่วย แนะนำให้ส่งต่อทีมซัพพอร์ต
3. ใช้ภาษาง่ายๆ ไม่ใช้ศัพท์เทคนิค
4. ตอบแบบเป็นมิตรและช่วยเหลือ

ห้ามใช้คำว่า "error", "bug", "code", "system", "technical" หรือศัพท์เทคนิคอื่นๆ`,
        response_json_schema: {
          type: "object",
          properties: {
            can_solve: { 
              type: "boolean",
              description: "true ถ้าผู้ใช้สามารถแก้ไขเองได้, false ถ้าต้องส่งต่อทีม"
            },
            suggestion: { 
              type: "string",
              description: "คำแนะนำการแก้ไข หรือเหตุผลที่ควรส่งต่อทีม"
            }
          },
          required: ["can_solve", "suggestion"]
        }
      });

      setAiSuggestion(response);
      setStep(2);
    } catch (error) {
      toast.error('ไม่สามารถวิเคราะห์ได้ กรุณาลองใหม่');
      console.error(error);
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleSendToSupport = () => {
    submitMutation.mutate(formData);
  };

  const handleMarkAsResolved = () => {
    toast.success('ดีใจที่ช่วยคุณได้!');
    handleClose();
  };

  const handleClose = () => {
    setStep(1);
    setAiSuggestion(null);
    setFormData({
      title: '',
      description: '',
      category: 'bug',
      priority: 'medium',
      image_urls: []
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'รายงานปัญหาใหม่' : 'คำแนะนำจาก AI'}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <form onSubmit={handleAnalyzeWithAI} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>หัวข้อ *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="สรุปปัญหาสั้นๆ"
                  required
                  disabled={aiAnalyzing}
                />
              </div>

              <div>
                <Label>หมวดหมู่</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  disabled={aiAnalyzing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">🐛 ระบบทำงานผิดพลาด</SelectItem>
                    <SelectItem value="feature_request">✨ ขอฟีเจอร์เพิ่ม</SelectItem>
                    <SelectItem value="question">❓ สงสัย/ถามคำถาม</SelectItem>
                    <SelectItem value="other">📝 อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>ระดับความสำคัญ</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  disabled={aiAnalyzing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">🟢 ไม่เร่ง</SelectItem>
                    <SelectItem value="medium">🟡 ปกติ</SelectItem>
                    <SelectItem value="high">🟠 สำคัญ</SelectItem>
                    <SelectItem value="urgent">🔴 เร่งด่วนมาก</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>รายละเอียด *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="อธิบายปัญหาอย่างละเอียด (ทำอะไร, เกิดอะไรขึ้น, คาดหวังอะไร)"
                rows={4}
                required
                disabled={aiAnalyzing}
              />
            </div>

            <div>
              <Label>รูปภาพประกอบ (ถ้ามี)</Label>
              <div className="mt-2 space-y-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage || aiAnalyzing}
                />
                
                {formData.image_urls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {formData.image_urls.map((url, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={url} 
                          alt={`รูป ${index + 1}`} 
                          className="w-full h-24 object-cover rounded-lg border" 
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={aiAnalyzing}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={aiAnalyzing}
              >
                ยกเลิก
              </Button>
              
              <Button
                type="submit"
                disabled={aiAnalyzing}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
              >
                {aiAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    AI กำลังวิเคราะห์...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    วิเคราะห์ด้วย AI
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {step === 2 && aiSuggestion && (
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-md flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 mb-2 text-lg">คำแนะนำจาก AI ผู้ช่วย</h4>
                    <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                      {aiSuggestion.suggestion}
                    </p>
                  </div>
                </div>

                <div className="bg-white/60 rounded-lg p-4 border border-slate-200 mt-4">
                  <p className="text-sm text-slate-700 mb-2">
                    <strong>ปัญหาของคุณ:</strong> {formData.title}
                  </p>
                  <p className="text-xs text-slate-600">
                    {formData.description}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleMarkAsResolved}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 h-12"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                แก้ปัญหาได้แล้ว ขอบคุณ
              </Button>

              <Button
                onClick={handleSendToSupport}
                disabled={submitMutation.isPending}
                variant="outline"
                className="w-full border-orange-500 text-orange-600 hover:bg-orange-50 h-12"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    กำลังส่ง...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    ส่งต่อให้ทีมซัพพอร์ต
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                className="text-slate-600 hover:text-slate-800"
              >
                ← กลับไปแก้ไขรายละเอียด
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}