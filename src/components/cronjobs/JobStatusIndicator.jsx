import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";

export default function JobStatusIndicator({ logs = [], functionName }) {
  if (logs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Clock className="w-3.5 h-3.5" />
        <span>ยังไม่เคยรัน</span>
      </div>
    );
  }

  const lastLog = logs[0];
  const recentLogs = logs.slice(0, 10);
  
  // คำนวณ success rate
  const successCount = recentLogs.filter(log => log.status === 'success').length;
  const successRate = (successCount / recentLogs.length) * 100;
  
  // คำนวณเวลาเฉลี่ย
  const logsWithTime = recentLogs.filter(log => log.execution_time_ms);
  const avgTime = logsWithTime.length > 0
    ? logsWithTime.reduce((sum, log) => sum + log.execution_time_ms, 0) / logsWithTime.length
    : 0;

  // ตรวจสอบ trend (เทียบกับ 5 ครั้งก่อนหน้า vs 5 ครั้งหลัง)
  const firstHalf = recentLogs.slice(0, 5).filter(log => log.execution_time_ms);
  const secondHalf = recentLogs.slice(5, 10).filter(log => log.execution_time_ms);
  const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((s, l) => s + l.execution_time_ms, 0) / firstHalf.length : 0;
  const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((s, l) => s + l.execution_time_ms, 0) / secondHalf.length : 0;
  const isSlowingDown = avgFirst > avgSecond * 1.2 && avgFirst > 1000;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {lastLog.status === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        ) : (
          <XCircle className="w-4 h-4 text-red-600" />
        )}
        <span className="text-xs text-slate-600">
          {formatDistanceToNow(new Date(lastLog.run_timestamp), { addSuffix: true, locale: th })}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge 
          variant={successRate >= 80 ? 'default' : successRate >= 50 ? 'secondary' : 'destructive'}
          className="text-xs"
        >
          {successRate.toFixed(0)}% สำเร็จ
        </Badge>
        
        {avgTime > 0 && (
          <Badge variant="outline" className="text-xs">
            ⏱️ {(avgTime / 1000).toFixed(1)}s เฉลี่ย
          </Badge>
        )}

        {isSlowingDown && (
          <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
            <TrendingDown className="w-3 h-3 mr-1" />
            ช้าลง
          </Badge>
        )}

        {lastLog.branch_results && lastLog.branch_results.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {lastLog.branch_results.length} สาขา
          </Badge>
        )}
      </div>

      {/* แสดงสาขาที่มีปัญหา */}
      {lastLog.branch_results && lastLog.branch_results.some(br => br.status === 'error' || br.failed > 0) && (
        <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-200">
          <p className="text-xs font-semibold text-red-800 mb-1">สาขาที่มีปัญหา:</p>
          <div className="space-y-1">
            {lastLog.branch_results
              .filter(br => br.status === 'error' || br.failed > 0)
              .slice(0, 3)
              .map((br, idx) => (
                <div key={idx} className="text-xs text-red-700">
                  • {br.branch_name || br.branch_id}: {br.error || `ล้มเหลว ${br.failed} รายการ`}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* แสดง error message ของ log ล่าสุด */}
      {lastLog.status === 'error' && lastLog.message && (
        <div className="p-2 bg-red-50 rounded-lg border border-red-200">
          <p className="text-xs text-red-700">{lastLog.message}</p>
        </div>
      )}
    </div>
  );
}