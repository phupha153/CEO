import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Gauge } from "lucide-react";
import PageHeader from "../shared/PageHeader";

export default function MeterLoadingSkeleton({ selectedBranchName }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <PageHeader title="บันทึกมิเตอร์" subtitle={`สาขา ${selectedBranchName}`} icon={Gauge} />
      <div className="px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-white/60 backdrop-blur-xl border-white/50 shadow-xl overflow-hidden">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-slate-200" />
                  </div>
                  <div className="h-4 bg-slate-200 rounded w-24 mb-2" />
                  <div className="h-8 bg-slate-200 rounded w-20 mb-1" />
                  <div className="h-3 bg-slate-200 rounded w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="h-10 bg-slate-200 rounded w-40" />
                <div className="h-10 bg-slate-200 rounded w-32" />
              </div>
            </CardContent>
          </Card>
          <div className="space-y-8">
            {[1, 2].map((floor) => (
              <div key={floor} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-slate-200 rounded" />
                  <div className="h-8 bg-slate-200 rounded w-32" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="bg-white/80 backdrop-blur-sm">
                      <CardContent className="p-6">
                        <div className="h-6 bg-slate-200 rounded w-24 mb-4" />
                        <div className="h-32 bg-slate-100 rounded-xl mb-3" />
                        <div className="h-4 bg-slate-200 rounded w-full mb-2" />
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}