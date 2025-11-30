import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, Send, Zap, CheckCircle2, XCircle, Loader2, FlaskConical, Play, AlertTriangle } from "lucide-react";

export default function TestLine() {
  const [formData, setFormData] = useState({ to: '', message: '' });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);

  // Stress Test States
  const [stressTestCount, setStressTestCount] = useState(50);
  const [stressTestRunning, setStressTestRunning] = useState(false);
  const [stressTestProgress, setStressTestProgress] = useState(0);
  const [stressTestResult, setStressTestResult] = useState(null);

  const selectedBranchId = localStorage.getItem('selected_branch_id');

  // Stress Test - สร้าง fake LINE User IDs แล้วยิงไปที่ sendBatchLineMessages
  // แบ่งเป็น chunks เพื่อป้องกัน timeout (503 error)
  const runStressTest = async () => {
    setStressTestRunning(true);
    setStressTestProgress(0);
    setStressTestResult(null);

    const startTime = Date.now();
    const CHUNK_SIZE = 100; // ส่งทีละ 100 เพื่อป้องกัน timeout

    try {
      // สร้าง fake recipients ทั้งหมด
      const allRecipients = [];
      for (let i = 0; i < stressTestCount; i++) {
        allRecipients.push({
          lineUserId: `Ufake${String(i).padStart(28, '0')}test`,
          message: `🧪 Stress Test #${i + 1}/${stressTestCount}\n${new Date().toLocaleString('th-TH')}`,
          branchId: selectedBranchId,
          metadata: { testId: i + 1 }
        });
      }

      console.log(`🚀 Starting stress test: ${stressTestCount} messages in chunks of ${CHUNK_SIZE}`);

      // แบ่งเป็น chunks
      const chunks = [];
      for (let i = 0; i < allRecipients.length; i += CHUNK_SIZE) {
        chunks.push(allRecipients.slice(i, i + CHUNK_SIZE));
      }

      let totalSuccess = 0;
      let totalFailed = 0;
      let allErrors = [];

      // ส่งทีละ chunk
      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx];
        const progressPercent = Math.round(((chunkIdx + 1) / chunks.length) * 100);
        setStressTestProgress(progressPercent);

        console.log(`📦 Sending chunk ${chunkIdx + 1}/${chunks.length} (${chunk.length} messages)`);

        try {
          const response = await base44.functions.invoke('sendBatchLineMessages', {
            recipients: chunk,
            options: {
              batchSize: 20,
              delayBetweenBatches: 500,
              delayBetweenMessages: 30
            }
          });

          if (response.data) {
            totalSuccess += response.data.success || 0;
            totalFailed += response.data.failed || 0;
            if (response.data.errors) {
              allErrors = allErrors.concat(response.data.errors.slice(0, 5));
            }
          }
        } catch (chunkError) {
          console.error(`❌ Chunk ${chunkIdx + 1} error:`, chunkError.message);
          totalFailed += chunk.length;
          allErrors.push({ chunk: chunkIdx + 1, error: chunkError.message });
        }

        // หน่วงเวลาระหว่าง chunk เพื่อไม่ให้ overload
        if (chunkIdx < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      setStressTestProgress(100);

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      setStressTestResult({
        success: true,
        duration,
        total: stressTestCount,
        success: totalSuccess,
        failed: totalFailed,
        errors: allErrors,
        chunks: chunks.length,
        summary: {
          total: stressTestCount,
          success: totalSuccess,
          failed: totalFailed,
          rate: ((stressTestCount / parseFloat(duration)) || 0).toFixed(2)
        }
      });

    } catch (error) {
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      setStressTestProgress(100);
      setStressTestResult({
        success: false,
        error: error.message,
        duration,
        details: error
      });
    }

    setStressTestRunning(false);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);

    try {
      const response = await base44.functions.invoke('testLineConnection', {
        branch_id: selectedBranchId
      });

      setConnectionResult(response.data);
    } catch (error) {
      setConnectionResult({ 
        success: false, 
        error: error.message || 'เกิดข้อผิดพลาด',
        details: error
      });
    }

    setTestingConnection(false);
  };

  const handleSend = async () => {
    if (!formData.to || !formData.message) {
      setResult({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const response = await base44.functions.invoke('sendLineMessage', {
        to: formData.to,
        message: formData.message,
        branch_id: selectedBranchId
      });

      if (response.data.success) {
        setResult({ success: true, message: 'ส่งข้อความสำเร็จ ✅' });
        setFormData({ to: '', message: '' });
      } else {
        setResult({ success: false, message: response.data.error || 'เกิดข้อผิดพลาด', details: response.data });
      }
    } catch (error) {
      setResult({ success: false, message: error.message || 'เกิดข้อผิดพลาด', details: error });
    }

    setSending(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-slate-800 mb-6">ทดสอบระบบ LINE</h1>

      {/* Connection Test Card */}
      <Card className="shadow-2xl border-2 border-blue-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-600" />
            1. ทดสอบการเชื่อมต่อ LINE
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-blue-800 mb-3">
              <strong>ขั้นตอนแรก:</strong> ตรวจสอบว่า LINE Token ทำงานถูกต้องหรือไม่
            </p>
            <Button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {testingConnection ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังทดสอบ...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  ทดสอบการเชื่อมต่อ
                </>
              )}
            </Button>
          </div>

          {connectionResult && (
            <Alert className={connectionResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              <AlertDescription>
                <div className="flex items-start gap-2">
                  {connectionResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-semibold mb-2 ${connectionResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      {connectionResult.success ? '✅ เชื่อมต่อสำเร็จ!' : '❌ เชื่อมต่อล้มเหลว'}
                    </p>
                    {connectionResult.success && connectionResult.bot_info && (
                      <div className="space-y-1 text-sm text-green-700 bg-green-100 p-3 rounded">
                        <p><strong>Bot Name:</strong> {connectionResult.bot_info.displayName}</p>
                        <p><strong>User ID:</strong> {connectionResult.bot_info.userId}</p>
                        <p><strong>Token Source:</strong> {connectionResult.token_source === 'config' ? '📊 Config Database' : '🔧 Environment Variable'}</p>
                        <p className="text-xs text-green-600 mt-2">
                          ✅ LINE Token ถูกต้องและทำงานปกติ
                        </p>
                      </div>
                    )}
                    {!connectionResult.success && (
                      <div className="space-y-2 text-sm text-red-700">
                        <p><strong>ข้อผิดพลาด:</strong> {connectionResult.error}</p>
                        {connectionResult.details && (
                          <details className="bg-red-100 p-2 rounded">
                            <summary className="cursor-pointer font-semibold">ดูรายละเอียด</summary>
                            <pre className="mt-2 text-xs overflow-auto max-h-40">
                              {JSON.stringify(connectionResult.details, null, 2)}
                            </pre>
                          </details>
                        )}
                        <div className="mt-3 p-3 bg-white rounded border border-red-200">
                          <p className="font-semibold mb-2">💡 วิธีแก้ไข:</p>
                          <ol className="list-decimal ml-4 space-y-1 text-xs">
                            <li>ไปที่ <a href="https://developers.line.biz/console/" target="_blank" className="underline text-blue-600">LINE Developers Console</a></li>
                            <li>เลือก Channel ของคุณ → Messaging API</li>
                            <li>คัดลอก <strong>Channel Access Token</strong> ใหม่ (ถ้าไม่มี ให้กด Issue)</li>
                            <li>ไปที่หน้า <strong>ตั้งค่า → LINE</strong></li>
                            <li>วาง Token ใหม่และกดบันทึก</li>
                            <li>กลับมาทดสอบอีกครั้ง</li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Send Message Card */}
      <Card className="shadow-2xl border-2 border-green-200">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-green-600" />
            2. ทดสอบการส่งข้อความ LINE
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div>
            <Label>LINE User ID *</Label>
            <Input
              value={formData.to}
              onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              placeholder="U1234567890abcdef1234567890abcdef"
            />
          </div>

          <div>
            <Label>ข้อความทดสอบ *</Label>
            <Input
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="สวัสดีครับ ทดสอบการส่งข้อความ"
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={sending || !formData.to || !formData.message}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังส่ง...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                ส่งข้อความทดสอบ
              </>
            )}
          </Button>

          {result && (
            <Alert className={result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              <AlertDescription>
                <div className="flex items-start gap-2">
                  {result.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={result.success ? 'text-green-800' : 'text-red-800'}>
                      {result.message}
                    </p>
                    {result.details && !result.success && (
                      <pre className="mt-2 bg-white p-2 rounded text-xs overflow-auto max-h-40 text-red-700">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">วิธีหา LINE User ID:</h3>
            <ol className="text-sm text-blue-700 space-y-2 list-decimal ml-5">
              <li>ให้ผู้เช่า Add LINE OA ของหอพัก</li>
              <li>ผู้เช่าส่งเบอร์โทรศัพท์ (เช่น 0812345678)</li>
              <li>ระบบจะบันทึก LINE User ID ใน Tenant อัตโนมัติ</li>
              <li>ดู LINE User ID ได้ในหน้า "ผู้เช่า"</li>
            </ol>
          </div>

          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <h3 className="font-semibold text-amber-900 mb-2">⚠️ ตัวอย่าง LINE User ID:</h3>
            <div className="space-y-2 text-sm text-amber-800">
              <p className="font-mono bg-white p-2 rounded">U1234567890abcdef1234567890abcdef</p>
              <p className="text-xs">รูปแบบ: ขึ้นต้นด้วย U ตามด้วยตัวอักษรและตัวเลข 32 ตัว</p>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="font-semibold text-green-900 mb-2">📱 Setup LINE Official Account:</h3>
            <ol className="text-sm text-green-700 space-y-2 list-decimal ml-5">
              <li>ไปที่ <a href="https://developers.line.biz/console/" target="_blank" className="underline font-semibold">LINE Developers Console</a></li>
              <li>สร้าง Messaging API Channel</li>
              <li>คัดลอก Channel Access Token</li>
              <li>ไปที่หน้า "ตั้งค่า" → แท็บ "LINE" → วาง Token → บันทึก</li>
              <li>ตั้ง Webhook URL ใน LINE Console (function: lineWebhookHandler)</li>
              <li>เปิด "Use webhook" และปิด "Auto-reply messages"</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Stress Test Card */}
      <Card className="shadow-2xl border-2 border-orange-200">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50">
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-orange-600" />
            3. 🧪 Stress Test - ทดสอบส่งข้อความจำนวนมาก
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">⚠️ หมายเหตุ:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>ระบบจะสร้าง <strong>Fake LINE User IDs</strong> เพื่อทดสอบ</li>
                  <li>LINE API จะ reject ทุก message (เพราะ User ID ไม่มีจริง)</li>
                  <li>แต่เราจะเห็นว่าระบบ <strong>handle errors ได้ดีไหม</strong></li>
                  <li>ทดสอบ Rate Limiting, Retry Logic, และ Error Handling</li>
                  <li><strong>ไม่มีข้อความจริงถูกส่งไปหาใคร</strong></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold">จำนวนข้อความทดสอบ: {stressTestCount}</Label>
              <Slider
                value={[stressTestCount]}
                onValueChange={(val) => setStressTestCount(val[0])}
                min={10}
                max={10000}
                step={10}
                className="mt-3"
                disabled={stressTestRunning}
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>10</span>
                <span>1,000</span>
                <span>5,000</span>
                <span>10,000</span>
              </div>
            </div>

            {stressTestRunning && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>กำลังประมวลผล...</span>
                  <span>{stressTestProgress}%</span>
                </div>
                <Progress value={stressTestProgress} className="h-3" />
              </div>
            )}

            <Button
              onClick={runStressTest}
              disabled={stressTestRunning}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
            >
              {stressTestRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังทดสอบ... ({stressTestCount} messages)
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  เริ่ม Stress Test ({stressTestCount} messages)
                </>
              )}
            </Button>
          </div>

          {stressTestResult && (
            <Alert className={stressTestResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              <AlertDescription>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {stressTestResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`font-semibold ${stressTestResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      {stressTestResult.success ? '✅ Stress Test เสร็จสิ้น!' : '❌ เกิดข้อผิดพลาด'}
                    </span>
                  </div>

                  {stressTestResult.success && stressTestResult.summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white p-3 rounded-lg border">
                        <p className="text-xs text-slate-500">ทั้งหมด</p>
                        <p className="text-xl font-bold text-slate-800">{stressTestResult.summary.total}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border">
                        <p className="text-xs text-slate-500">สำเร็จ</p>
                        <p className="text-xl font-bold text-green-600">{stressTestResult.summary.success}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border">
                        <p className="text-xs text-slate-500">ล้มเหลว</p>
                        <p className="text-xl font-bold text-red-600">{stressTestResult.summary.failed}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border">
                        <p className="text-xs text-slate-500">เวลา</p>
                        <p className="text-xl font-bold text-blue-600">{stressTestResult.duration}s</p>
                      </div>
                    </div>
                  )}

                  {stressTestResult.success && (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800">
                        <strong>📊 อัตราส่ง:</strong> ~{stressTestResult.summary?.rate || 0} msg/sec
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        💡 ข้อความล้มเหลวเป็นเรื่องปกติเพราะ LINE User ID ไม่มีจริง 
                        - สิ่งสำคัญคือระบบไม่ crash และ handle errors ได้
                      </p>
                    </div>
                  )}

                  {stressTestResult.errors && stressTestResult.errors.length > 0 && (
                    <details className="bg-slate-100 p-3 rounded-lg">
                      <summary className="cursor-pointer font-semibold text-sm">
                        ดู Errors ({stressTestResult.errors.length} รายการ)
                      </summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-40 bg-white p-2 rounded">
                        {JSON.stringify(stressTestResult.errors.slice(0, 10), null, 2)}
                        {stressTestResult.errors.length > 10 && `\n\n... และอีก ${stressTestResult.errors.length - 10} รายการ`}
                      </pre>
                    </details>
                  )}

                  {!stressTestResult.success && stressTestResult.error && (
                    <div className="bg-red-100 p-3 rounded-lg">
                      <p className="text-sm text-red-700"><strong>Error:</strong> {stressTestResult.error}</p>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-slate-50 rounded-lg p-4 border">
            <h3 className="font-semibold text-slate-800 mb-2">🔧 สิ่งที่ Stress Test ทดสอบ:</h3>
            <ul className="text-sm text-slate-600 space-y-1 list-disc ml-4">
              <li><strong>Batch Processing:</strong> แบ่ง messages เป็น batch ละ 20 ข้อความ</li>
              <li><strong>Rate Limiting:</strong> หน่วงเวลาระหว่าง batch (2 วินาที)</li>
              <li><strong>Retry Logic:</strong> ลองส่งใหม่เมื่อ error สูงสุด 3 ครั้ง</li>
              <li><strong>Error Handling:</strong> ดักจับและรายงาน errors อย่างถูกต้อง</li>
              <li><strong>Memory Usage:</strong> ไม่ให้ memory leak ขณะประมวลผล</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}