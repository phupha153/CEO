import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Globe, Zap, Loader2, Save, Check, X } from "lucide-react";
import { BranchToggle } from "./BranchToggle";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function MessagingTab({
  userRole,
  applyToAllBranches_line,
  setApplyToAllBranches_line,
  applyToAllBranches_facebook,
  setApplyToAllBranches_facebook,
  selectedBranch,
  canSetGlobalConfig,
  defaultCommunicationBranch,
  setDefaultCommunicationBranch,
  branches,
  branchOwnerStatus,
  currentUser,
  queryClient,
  lineSettings,
  setLineSettings,
  showWebhookUrl,
  setShowWebhookUrl,
  handleLineSettingsSubmit,
  isSavingLineSettings,
  facebookSettings,
  setFacebookSettings,
  buildingLogo,
  buildingInfo,
  handleFacebookSettingsSubmit,
  isSavingFacebookSettings,
  updateConfigMutation,
  configs,
  myOwnedBranches,
}) {
  const [copiedBranchIdForWebhook, setCopiedBranchIdForWebhook] = useState(null);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
          เชื่อมต่อช่องทางสื่อสาร
        </CardTitle>
        <p className="text-sm text-slate-600 mt-2">
          ตั้งค่าการเชื่อมต่อ LINE และ Facebook เพื่อส่งข้อความอัตโนมัติถึงผู้เช่า
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="line" className="w-full">
          <TabsList className={`grid w-full ${userRole === 'developer' ? 'grid-cols-2' : 'grid-cols-1'} mb-6`}>
            <TabsTrigger value="line" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              LINE
            </TabsTrigger>
            {userRole === 'developer' && (
              <TabsTrigger value="facebook" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Facebook
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="line" className="space-y-6">
            <BranchToggle
              applyToAllBranches={applyToAllBranches_line}
              setApplyToAllBranches={setApplyToAllBranches_line}
              selectedBranch={selectedBranch}
              canSetGlobalConfig={canSetGlobalConfig}
            />

            {(userRole === 'developer' || userRole === 'owner') && (
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-5 border border-indigo-100 shadow-sm relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-100 rounded-full opacity-50 blur-xl" />
                <div className="flex items-start gap-4 relative z-10">
                  <div className="bg-indigo-100 p-3 rounded-full flex-shrink-0 mt-1 shadow-sm border border-indigo-200">
                    <MessageSquare className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-indigo-900 mb-2">สาขาหลักสำหรับรับลูกค้าใหม่ (Default Branch)</h4>
                    <div className="bg-white/60 rounded-lg p-3 border border-indigo-100 mb-4">
                      <p className="text-sm text-indigo-800 leading-relaxed">
                        เมื่อมี <b>"ผู้เช่าคนใหม่"</b> ทัก LINE เข้ามาครั้งแรก (ระบบยังไม่รู้ว่าเขาพักอยู่สาขาไหน)<br />
                        ข้อความจะถูกส่งไปที่ <b>"สาขาที่คุณเลือกไว้ด้านล่างนี้"</b> เป็นที่แรก เพื่อให้แอดมินช่วยตอบคำถามและรับลงทะเบียน
                      </p>
                    </div>
                    <div className="max-w-md">
                      <Select
                        value={defaultCommunicationBranch}
                        onValueChange={async (v) => {
                          setDefaultCommunicationBranch(v);
                          try {
                            const oe = branchOwnerStatus?.owner_email || currentUser?.email;
                            const k = oe ? 'default_communication_branch_' + oe : 'default_communication_branch';
                            const c = await base44.entities.Config.filter({ key: k }, '', 100);
                            const cArr = Array.isArray(c) ? c : (c ? [c] : []);
                            const d = cArr.find(x => !x.branch_id);
                            if (d) {
                              if (v && v !== 'none') await base44.entities.Config.update(d.id, { value: v });
                              else await base44.entities.Config.delete(d.id);
                            } else if (v && v !== 'none') {
                              await base44.entities.Config.create({ key: k, value: v, category: 'notification' });
                            }
                            await queryClient.refetchQueries({ queryKey: ['configs'] });
                            toast.success('บันทึกสำเร็จ');
                          } catch (e) {
                            toast.error('ไม่สำเร็จ');
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white border-indigo-300 shadow-sm h-12 text-base font-medium text-indigo-900">
                          <SelectValue placeholder="-- กรุณาเลือกสาขาหลัก --" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- ไม่ระบุ (ให้ดึงเฉพาะสาขาตัวเอง) --</SelectItem>
                          {branches.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-4 bg-[#00B900] rounded-xl">
              <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/2d3db1611_image.png" alt="LINE Logo" className="w-12 h-12 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-white font-bold text-lg">LINE Official Account</h3>
                <p className="text-white/90 text-sm">เชื่อมต่อ LINE เพื่อส่งข้อความอัตโนมัติ</p>
              </div>
            </div>

            <form onSubmit={handleLineSettingsSubmit} className="space-y-6">
              {myOwnedBranches.length > 1 && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">คัดลอกการตั้งค่าจากสาขาอื่น (กรณีใช้ LINE เดียวกันหลายสาขา)</Label>
                  <Select onValueChange={(branchId) => {
                    const tokenCfg = configs.find(c => c.key === 'line_channel_access_token' && c.branch_id === branchId);
                    const secretCfg = configs.find(c => c.key === 'line_channel_secret' && c.branch_id === branchId);
                    setLineSettings({
                      line_channel_access_token: tokenCfg?.value || '',
                      line_channel_secret: secretCfg?.value || ''
                    });
                    setCopiedBranchIdForWebhook(branchId);
                    toast.success('คัดลอกข้อมูลสำเร็จ กรุณากดบันทึก');
                  }}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="-- เลือกสาขาที่ต้องการคัดลอกข้อมูล --" />
                    </SelectTrigger>
                    <SelectContent>
                      {myOwnedBranches.filter(b => b.id !== selectedBranch?.id).map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-2">เมื่อคัดลอกแล้ว ระบบจะตั้งค่า Token และ Secret ให้เหมือนกัน และปรับ Webhook URL ให้ตรงกับสาขาที่คัดลอกมา</p>
                </div>
              )}

              <div className="space-y-4">
                <div><Label>LINE Channel Access Token *</Label><Input type="password" value={lineSettings.line_channel_access_token} onChange={(e) => setLineSettings({ ...lineSettings, line_channel_access_token: e.target.value })} placeholder="ใส่ Channel Access Token ที่ได้จาก LINE Developers" /></div>
                <div><Label>LINE Channel Secret</Label><Input type="password" value={lineSettings.line_channel_secret} onChange={(e) => setLineSettings({ ...lineSettings, line_channel_secret: e.target.value })} placeholder="ใส่ Channel Secret (สำหรับการยืนยันตัวตน)" /></div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><Zap className="w-5 h-5" /> Webhook URL สำหรับ {copiedBranchIdForWebhook ? 'สาขาที่คัดลอกมา' : 'สาขานี้'}</h4>
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-3 border border-slate-200 flex items-center gap-2">
                    <code className="flex-1 text-sm text-slate-700 font-mono break-all">{showWebhookUrl ? `https://app-483eff6e.base44.app/api/apps/6904ea5ce861be65483eff6e/functions/lineWebhookHandler?branch_id=${copiedBranchIdForWebhook || selectedBranch?.id || ''}` : '••••••••••••••••••••••••••••••••••••••••••••••'}</code>
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowWebhookUrl(!showWebhookUrl)} className="flex-shrink-0">{showWebhookUrl ? 'ซ่อน' : 'ดู'}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`https://app-483eff6e.base44.app/api/apps/6904ea5ce861be65483eff6e/functions/lineWebhookHandler?branch_id=${copiedBranchIdForWebhook || selectedBranch?.id || ''}`); toast.success('คัดลอก Webhook URL แล้ว'); }} className="flex-shrink-0">คัดลอก</Button>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200"><h4 className="font-semibold text-green-900 mb-2">วิธีตั้งค่า LINE Official Account:</h4><ol className="text-sm text-green-700 space-y-2 list-decimal ml-5"><li>ไปที่ <a href="https://developers.line.biz/console/" target="_blank" className="underline font-semibold">LINE Developers Console</a></li><li>สร้าง Provider และ Messaging API Channel</li><li>ไปที่ Messaging API → คัดลอก <strong>Channel Access Token</strong></li><li>ไปที่ Basic Settings → คัดลอก <strong>Channel Secret</strong></li><li>นำมาใส่ในฟอร์มด้านบนและกดบันทึก</li><li>ตั้ง Webhook URL (ใช้ URL ด้านบน) ใน LINE Console</li></ol></div>

              <Button
                type="submit"
                className="w-full bg-[#00B900] hover:bg-[#00A000] text-white"
                disabled={isSavingLineSettings}
              >
                {isSavingLineSettings ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    บันทึกการตั้งค่า LINE
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          {userRole === 'developer' && (
            <TabsContent value="facebook" className="space-y-6">
              <BranchToggle
                applyToAllBranches={applyToAllBranches_facebook}
                setApplyToAllBranches={setApplyToAllBranches_facebook}
                selectedBranch={selectedBranch}
                canSetGlobalConfig={canSetGlobalConfig}
              />

              {facebookSettings.facebook_page_access_token && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border-2 border-green-300 shadow-lg">
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-20 h-20 rounded-2xl bg-white border-3 border-green-400 shadow-xl flex items-center justify-center overflow-hidden">
                        {buildingLogo && buildingLogo.includes('graph.facebook.com') ? (
                          <img src={buildingLogo} alt="Page Logo" className="w-full h-full object-cover" />
                        ) : (
                          <Globe className="w-10 h-10 text-green-600" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Check className="w-6 h-6 text-green-600" />
                        <h3 className="text-2xl font-bold text-green-900">เชื่อมต่อสำเร็จ!</h3>
                      </div>
                      <div className="space-y-2 mb-4">
                        <p className="text-base text-green-800">
                          <strong>เพจ:</strong> {configs.find(c => c.key === 'facebook_page_name' && c.branch_id === selectedBranch?.id)?.value || buildingInfo.building_name || 'Facebook Page'}
                        </p>
                        <p className="text-sm text-green-700">
                          📍 สาขา: {selectedBranch?.name}
                        </p>
                      </div>
                      <div className="bg-white/60 rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-green-900 font-semibold mb-2">คุณสามารถใช้งาน:</p>
                        <ul className="text-xs text-green-800 space-y-1.5">
                          <li>• รับข้อความจากลูกค้าผ่าน Facebook Messenger</li>
                          <li>• ส่งข้อความแจ้งเตือนการชำระเงินอัตโนมัติ</li>
                          <li>• ตอบกลับคอมเมนต์ในโพสต์ด้วย AI</li>
                          <li>• ลงทะเบียนผู้เช่าผ่าน Facebook Chat</li>
                        </ul>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        if (confirm('คุณต้องการยกเลิกการเชื่อมต่อ Facebook หรือไม่?')) {
                          await Promise.all([
                            updateConfigMutation.mutateAsync({
                              key: 'facebook_page_access_token',
                              value: '',
                              description: 'Facebook Page Access Token',
                              category: 'notification',
                              applyToAllBranches: false
                            }),
                            updateConfigMutation.mutateAsync({
                              key: 'facebook_page_id',
                              value: '',
                              description: 'Facebook Page ID',
                              category: 'notification',
                              applyToAllBranches: false
                            }),
                            updateConfigMutation.mutateAsync({
                              key: 'facebook_page_name',
                              value: '',
                              description: 'Facebook Page Name',
                              category: 'notification',
                              applyToAllBranches: false
                            })
                          ]);
                          setFacebookSettings({ facebook_page_access_token: '', facebook_verify_token: '' });
                          toast.success('ยกเลิกการเชื่อมต่อสำเร็จ');
                        }
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                    >
                      <X className="w-5 h-5 mr-2" />
                      ยกเลิกการเชื่อมต่อ
                    </Button>
                  </div>
                </div>
              )}

              {!facebookSettings.facebook_page_access_token && (
                <div className="space-y-6">
                  <Button
                    type="button"
                    onClick={() => {
                      if (window.FB) {
                        console.log('🔵 Facebook SDK ready, starting login...');
                        window.FB.login(function (response) {
                          console.log('🔵 FB Login Response:', response);
                          if (response.authResponse) {
                            console.log('✅ Facebook authorized!');
                            window.checkLoginState();
                          } else {
                            console.log('❌ User cancelled login or did not fully authorize.');
                            toast.error('การเข้าสู่ระบบถูกยกเลิก');
                          }
                        }, { scope: 'pages_show_list,pages_messaging,pages_read_engagement,pages_manage_metadata' });
                      } else {
                        console.error('❌ window.FB not available');
                        toast.error('Facebook SDK ยังไม่พร้อม กรุณารีเฟรชหน้าและลองอีกครั้ง');
                      }
                    }}
                    className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white text-xl font-bold py-8 shadow-xl hover:shadow-2xl transition-all"
                  >
                    <svg className="w-7 h-7 mr-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    เชื่อมต่อด้วย Facebook Login
                  </Button>

                  <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                    <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      ประโยชน์ที่คุณจะได้รับ:
                    </h4>
                    <ul className="text-sm text-blue-800 space-y-2">
                      <li className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span><strong>รับข้อความอัตโนมัติ:</strong> ลูกค้าส่งข้อความถึงเพจได้ทันที</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span><strong>แจ้งเตือนการชำระเงิน:</strong> ส่งใบแจ้งหนี้ผ่าน Messenger อัตโนมัติ</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span><strong>ตอบคอมเมนต์ด้วย AI:</strong> AI ตอบคอมเมนต์ในโพสต์อัตโนมัติ</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span><strong>ลงทะเบียนผู้เช่า:</strong> ผู้เช่าลงทะเบียนผ่าน Facebook Chat ได้</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span><strong>รับแจ้งซ่อม:</strong> รับแจ้งปัญหาผ่าน Messenger พร้อมบันทึกอัตโนมัติ</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {facebookSettings.facebook_page_access_token && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-300"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-4 text-sm text-slate-500">หรือกรอก Token ด้วยตัวเอง</span>
                    </div>
                  </div>

                  <form onSubmit={handleFacebookSettingsSubmit} className="space-y-6">
                    {myOwnedBranches.length > 1 && (
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                        <Label className="text-sm font-semibold text-slate-700 mb-2 block">คัดลอกการตั้งค่าจากสาขาอื่น (กรณีใช้เพจเดียวกันหลายสาขา)</Label>
                        <Select onValueChange={(branchId) => {
                          const tokenCfg = configs.find(c => c.key === 'facebook_page_access_token' && c.branch_id === branchId);
                          const verifyCfg = configs.find(c => c.key === 'facebook_verify_token' && c.branch_id === branchId);
                          setFacebookSettings({
                            facebook_page_access_token: tokenCfg?.value || '',
                            facebook_verify_token: verifyCfg?.value || ''
                          });
                          toast.success('คัดลอกข้อมูลสำเร็จ กรุณากดบันทึก');
                        }}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="-- เลือกสาขาที่ต้องการคัดลอกข้อมูล --" />
                          </SelectTrigger>
                          <SelectContent>
                            {myOwnedBranches.filter(b => b.id !== selectedBranch?.id).map(b => (
                              <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-4">
                      <div>
                        <Label>Facebook Page Access Token *</Label>
                        <Input
                          type="password"
                          value={facebookSettings.facebook_page_access_token}
                          onChange={(e) => setFacebookSettings({ ...facebookSettings, facebook_page_access_token: e.target.value })}
                          placeholder="ใส่ Page Access Token"
                        />
                      </div>
                      <div>
                        <Label>Verify Token *</Label>
                        <Input
                          value={facebookSettings.facebook_verify_token}
                          onChange={(e) => setFacebookSettings({ ...facebookSettings, facebook_verify_token: e.target.value })}
                          placeholder="กำหนด Verify Token เอง (เช่น mysecrettoken)"
                        />
                      </div>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                        <Zap className="w-5 h-5" />
                        Webhook URL สำหรับ Facebook
                      </h4>
                      <div className="space-y-3">
                        <p className="text-sm text-purple-800 font-semibold">
                          คัดลอก URL นี้ไปใส่ในหน้า Facebook Developers Console:
                        </p>
                        <div className="bg-white rounded-lg p-3 border-2 border-purple-300 flex items-center gap-2">
                          <code className="flex-1 text-sm text-purple-900 font-mono break-all">
                            https://app-483eff6e.base44.app/api/apps/6904ea5ce861be65483eff6e/functions/facebookWebhookHandler
                          </code>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText('https://app-483eff6e.base44.app/api/apps/6904ea5ce861be65483eff6e/functions/facebookWebhookHandler');
                              toast.success('คัดลอก Webhook URL แล้ว');
                            }}
                            className="flex-shrink-0"
                          >
                            คัดลอก
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-2">วิธีตั้งค่า Facebook Messenger:</h4>
                      <ol className="text-sm text-blue-700 space-y-2 list-decimal ml-5">
                        <li>ไปที่ <a href="https://developers.facebook.com/" target="_blank" className="underline font-semibold">Facebook Developers</a></li>
                        <li>สร้าง App และเพิ่มผลิตภัณฑ์ Messenger</li>
                        <li>เลือก Page เพื่อสร้าง <strong>Page Access Token</strong></li>
                        <li>ตั้งค่า Webhook โดยใช้ URL ด้านบน และ Verify Token ที่คุณกำหนดเอง</li>
                        <li>เลือก Subscription Fields: <strong>messages</strong></li>
                      </ol>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
                      disabled={isSavingFacebookSettings}
                    >
                      {isSavingFacebookSettings ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          กำลังบันทึก...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          บันทึกการตั้งค่า Facebook
                        </>
                      )}
                    </Button>
                  </form>
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}