import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlayCircle, Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "sonner";

export default function QueueMonitor({ branchId }) {
  const queryClient = useQueryClient();

  const { data: queueJobs = [], isLoading, refetch } = useQuery({
    queryKey: ['invoiceQueue', branchId],
    queryFn: async () => {
      const filters = branchId ? { branch_id: branchId } : {};
      const jobs = await base44.entities.InvoiceQueue.filter(filters, '-created_date', 50);
      console.log('🔍 QueueMonitor Query Result:', { filters, jobs_count: jobs?.length, jobs });
      return jobs || [];
    },
    refetchInterval: 5000, // Auto-refresh ทุก 5 วิ (เร็วขึ้น)
    staleTime: 2000,
  });

  const processQueueMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('processQueuedBills', {});
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'ประมวลผลสำเร็จ');
      queryClient.invalidateQueries(['invoiceQueue']);
      queryClient.invalidateQueries(['payments']);
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  });

  const getStatusIcon = (status) => {
    const icons = {
      pending: <Clock className="w-4 h-4 text-yellow-600" />,
      processing: <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />,
      completed: <CheckCircle2 className="w-4 h-4 text-green-600" />,
      failed: <XCircle className="w-4 h-4 text-red-600" />
    };
    return icons[status] || <AlertTriangle className="w-4 h-4 text-slate-400" />;
  };

  const getStatusBadge = (status) => {
    const configs = {
      pending: { label: 'รอประมวลผล', className: 'bg-yellow-100 text-yellow-700' },
      processing: { label: 'กำลังทำงาน', className: 'bg-blue-100 text-blue-700' },
      completed: { label: 'เสร็จสิ้น', className: 'bg-green-100 text-green-700' },
      failed: { label: 'ล้มเหลว', className: 'bg-red-100 text-red-700' }
    };
    const config = configs[status] || { label: status, className: 'bg-slate-100 text-slate-700' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const pendingCount = queueJobs.filter(j => j.status === 'pending').length;
  const processingCount = queueJobs.filter(j => j.status === 'processing').length;

  console.log('🎯 QueueMonitor Render:', { 
    branchId, 
    jobs_count: queueJobs.length, 
    pendingCount, 
    processingCount,
    isLoading 
  });

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 shadow-lg">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <PlayCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800">🔄 Bill Generation Queue</p>
              <p className="text-xs text-slate-600">
                {pendingCount} รอ | {processingCount} กำลังทำ | {queueJobs.length} ทั้งหมด
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="border-slate-300"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              size="sm"
              onClick={() => processQueueMutation.mutate()}
              disabled={processQueueMutation.isPending || pendingCount === 0}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {processQueueMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Process Now
                </>
              )}
            </Button>
          </div>
        </div>

        {queueJobs.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">
            ไม่มี job ใน Queue
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {queueJobs.map(job => (
              <div
                key={job.id}
                className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {getStatusIcon(job.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-800 truncate">
                        {job.job_name || 'Unnamed Job'}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {getStatusBadge(job.status)}
                        {job.total_count > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {job.completed_count}/{job.total_count}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {job.created_date && (
                          <p>สร้าง: {format(parseISO(job.created_date), 'd MMM HH:mm', { locale: th })}</p>
                        )}
                        {job.completed_at && (
                          <p>เสร็จ: {format(parseISO(job.completed_at), 'd MMM HH:mm', { locale: th })}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {job.error_message && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    ❌ {job.error_message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}