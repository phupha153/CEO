import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function UpdateMyBranches() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('updateUserBranches', {
        accessible_branches: [] // ไม่มีสิทธิ์เข้าสาขาใดเลย
      });
      
      setResult(response.data);
      
      // รีโหลดหน้าหลังจาก 2 วินาที
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>อัปเดตสิทธิ์สาขา</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600">
            คลิกปุ่มด้านล่างเพื่อ<strong>ลบสิทธิ์ทุกสาขา</strong> (accessible_branches = [])
          </p>
          
          <Button
            onClick={handleUpdate}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังอัปเดต...
              </>
            ) : (
              'อัปเดตสิทธิ์ตอนนี้'
            )}
          </Button>

          {result && (
            <div className={`p-4 rounded-lg ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}