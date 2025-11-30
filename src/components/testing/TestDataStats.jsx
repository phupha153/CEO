import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TestDataStats() {
  const [showDebugDialog, setShowDebugDialog] = useState(false);
  
  const { data: stats, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ['testDataStats'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDataStats');
      console.log('📊 Full response:', response);
      console.log('📊 Response.data:', response.data);
      console.log('📊 Stats object:', response.data?.stats);
      console.log('📊 Test total:', response.data?.stats?.test?.total);
      console.log('📊 Real total:', response.data?.stats?.real?.total);
      console.log('📊 All total:', response.data?.stats?.all?.total);
      return response.data.stats;
    },
    refetchOnWindowFocus: false,
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000
  });

  const { data: debugData, isLoading: debugLoading, refetch: refetchDebug } = useQuery({
    queryKey: ['debugTestData'],
    queryFn: async () => {
      const entities = ['Branch', 'Room', 'Tenant', 'Booking', 'Payment', 'MeterReading', 'MaintenanceRequest'];
      const fieldsMap = {
        'Branch': ['branch_name', 'branch_code', 'description'],
        'Room': ['room_number', 'description'],
        'Tenant': ['full_name', 'email', 'notes'],
        'Booking': ['notes', 'guest_name'],
        'Payment': ['notes'],
        'MeterReading': ['notes'],
        'MaintenanceRequest': ['title', 'description', 'notes']
      };
      
      const testPatterns = [
        '[TEST-', 'TEST-', '[test-', 'test-',
        '[HEAVY-', 'HEAVY-', '[heavy-', 'heavy-',
        '[MASSIVE-', 'MASSIVE-', '[massive-', 'massive-',
        'ทดสอบ', 'mass_', 'MASS-'
      ];
      
      const results = [];
      
      for (const entityName of entities) {
        const records = await base44.entities[entityName].list('-created_date', 50);
        const fields = fieldsMap[entityName];
        
        const testRecords = records.filter(r => {
          const values = fields.map(f => r[f]).filter(v => v && typeof v === 'string');
          return values.some(v => testPatterns.some(p => v.includes(p)));
        });
        
        results.push({
          entity: entityName,
          fields,
          total: records.length,
          testCount: testRecords.length,
          allRecords: records.slice(0, 3),
          testRecords: testRecords.slice(0, 5),
          patterns: testPatterns
        });
      }
      
      return results;
    },
    enabled: false,
    staleTime: 60000
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Database className="w-6 h-6 animate-pulse" />
            📊 สถิติข้อมูลทดสอบในระบบ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm text-slate-600">กำลังนับข้อมูล... อาจใช้เวลา 10-30 วินาที</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-300 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-800">
            <Database className="w-6 h-6" />
            ⚠️ เกิดข้อผิดพลาด
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-red-700">ไม่สามารถโหลดข้อมูลได้: {error.message}</p>
            <Button
              onClick={() => refetch()}
              disabled={isFetching}
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isFetching ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  กำลังลองใหม่...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  ลองอีกครั้ง
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Database className="w-6 h-6" />
            📊 สถิติข้อมูลในระบบทั้งหมด
          </CardTitle>
          <div className="flex gap-2">
            <Button
              onClick={() => refetch()}
              disabled={isFetching}
              size="sm"
              variant="outline"
              className="shadow-md"
            >
              {isFetching ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  รีเฟรช
                </>
              )}
            </Button>
            <Button
              onClick={() => {
                setShowDebugDialog(true);
                refetchDebug();
              }}
              size="sm"
              variant="outline"
              className="shadow-md border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <Search className="w-4 h-4 mr-1" />
              Debug ข้อมูล
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats ? (
          <>
            {/* สรุปรวมทั้งหมด */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-4 text-white shadow-lg">
                <p className="text-sm opacity-90">🌐 ข้อมูลทั้งหมด</p>
                <p className="text-4xl font-bold mt-1">{stats.all.total.toLocaleString()}</p>
                <p className="text-xs opacity-80 mt-1">รายการ</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg p-4 text-white shadow-lg">
                <p className="text-sm opacity-90">✅ ข้อมูลจริง</p>
                <p className="text-4xl font-bold mt-1">{stats.real.total.toLocaleString()}</p>
                <p className="text-xs opacity-80 mt-1">รายการ</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg p-4 text-white shadow-lg">
                <p className="text-sm opacity-90">🧪 ข้อมูลทดสอบ</p>
                <p className="text-4xl font-bold mt-1">{stats.test.total.toLocaleString()}</p>
                <p className="text-xs opacity-80 mt-1">รายการ</p>
              </div>
            </div>

            {/* รายละเอียดแต่ละประเภท */}
            <div className="bg-white rounded-lg p-4 border-2 border-slate-200">
              <h4 className="font-semibold text-slate-800 mb-3">📋 รายละเอียดตามประเภทข้อมูล:</h4>
              <div className="space-y-2 text-sm">
                {[
                  { key: 'branches', icon: '🏢', label: 'สาขา' },
                  { key: 'rooms', icon: '🏠', label: 'ห้องพัก' },
                  { key: 'tenants', icon: '👥', label: 'ผู้เช่า' },
                  { key: 'bookings', icon: '📋', label: 'การจอง' },
                  { key: 'contracts', icon: '📄', label: 'สัญญา' },
                  { key: 'payments', icon: '💰', label: 'บิล' },
                  { key: 'meterReadings', icon: '📏', label: 'มิเตอร์' },
                  { key: 'maintenance', icon: '🔧', label: 'แจ้งซ่อม' },
                  { key: 'expenses', icon: '💸', label: 'ค่าใช้จ่าย' }
                ].map(({ key, icon, label }) => (
                  <div key={key} className="grid grid-cols-4 gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="font-medium text-slate-700">{icon} {label}</div>
                    <div className="text-center">
                      <div className="text-xs text-slate-500">ทั้งหมด</div>
                      <div className="font-bold text-blue-700">{(stats.all[key] || 0).toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-500">จริง</div>
                      <div className="font-bold text-green-700">{(stats.real[key] || 0).toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-500">ทดสอบ</div>
                      <div className="font-bold text-purple-700">{(stats.test[key] || 0).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {stats && stats.test.total > 0 && (
          <div className="bg-amber-50 rounded-lg p-4 border-2 border-amber-300">
            <h4 className="font-semibold text-amber-900 mb-2">⚠️ พบข้อมูลทดสอบ:</h4>
            <p className="text-amber-800 text-sm">
              ระบบตรวจพบข้อมูลทดสอบ <span className="font-bold text-lg">{stats.test.total.toLocaleString()}</span> รายการ
            </p>
            <p className="text-xs text-amber-700 mt-2">
              💡 คุณสามารถลบข้อมูลทดสอบได้ด้วยปุ่ม "ลบข้อมูลทดสอบ" ด้านล่าง
            </p>
          </div>
        )}

        {stats && stats.test.total === 0 && stats.all.total > 0 && (
          <div className="bg-green-50 rounded-lg p-6 border border-green-200 text-center">
            <Database className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <p className="text-green-800 font-semibold">✅ ไม่มีข้อมูลทดสอบในระบบ</p>
            <p className="text-sm text-green-600 mt-1">มีเฉพาะข้อมูลจริง {stats.real.total.toLocaleString()} รายการ</p>
          </div>
        )}

        {stats && stats.all.total === 0 && (
          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200 text-center">
            <Database className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 font-semibold">📭 ไม่มีข้อมูลในระบบ</p>
            <p className="text-sm text-slate-500 mt-1">เริ่มต้นสร้างข้อมูลทดสอบได้เลย</p>
          </div>
        )}
        </CardContent>
        </Card>

        <Dialog open={showDebugDialog} onOpenChange={setShowDebugDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-purple-600" />
            🔍 Debug: ข้อมูลทดสอบในระบบ
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(80vh-100px)]">
          {debugLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : debugData ? (
            <div className="space-y-6 pr-4">
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <strong className="text-purple-900">🎯 Patterns ที่กำลังค้นหา:</strong>
                <div className="flex flex-wrap gap-2 mt-2">
                  {debugData[0]?.patterns.map((p, i) => (
                    <span key={i} className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-mono">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {debugData.map((entity) => (
                <div key={entity.entity} className="bg-white border rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">
                    📦 {entity.entity}
                  </h3>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg p-3 text-center">
                      <div className="text-xs opacity-90">ทั้งหมด</div>
                      <div className="text-2xl font-bold">{entity.total}</div>
                    </div>
                    <div className="bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-lg p-3 text-center">
                      <div className="text-xs opacity-90">ข้อมูลทดสอบ</div>
                      <div className="text-2xl font-bold">{entity.testCount}</div>
                    </div>
                  </div>

                  {entity.testCount > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-red-600 mb-2">
                        🧪 ข้อมูลทดสอบ ({entity.testCount} รายการ):
                      </h4>
                      {entity.testRecords.map((record, idx) => (
                        <div key={idx} className="bg-red-50 border-l-4 border-red-500 rounded p-3 mb-2 text-sm">
                          {entity.fields.map(field => {
                            if (record[field]) {
                              const value = String(record[field]);
                              const matchedPattern = entity.patterns.find(p => value.includes(p));
                              return (
                                <div key={field} className="mb-1">
                                  <span className="font-semibold text-slate-600">{field}:</span>{' '}
                                  <span className="font-mono text-slate-800">
                                    {matchedPattern ? (
                                      <>
                                        {value.split(matchedPattern)[0]}
                                        <span className="bg-yellow-200 px-1 rounded font-bold text-red-700">
                                          {matchedPattern}
                                        </span>
                                        {value.split(matchedPattern)[1]?.substring(0, 50)}
                                      </>
                                    ) : value.substring(0, 80)}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-semibold text-blue-600 mb-2">
                      📋 ข้อมูลทั้งหมด (แสดง 3 รายการแรก):
                    </h4>
                    {entity.allRecords.map((record, idx) => (
                      <div key={idx} className="bg-slate-50 border-l-4 border-blue-400 rounded p-3 mb-2 text-sm">
                        {entity.fields.map(field => {
                          if (record[field]) {
                            return (
                              <div key={field} className="mb-1">
                                <span className="font-semibold text-slate-600">{field}:</span>{' '}
                                <span className="font-mono text-slate-800">
                                  {String(record[field]).substring(0, 80)}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">📊 สรุปรวม</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/20 rounded-lg p-3 text-center">
                    <div className="text-xs opacity-90">ข้อมูลทั้งหมด</div>
                    <div className="text-2xl font-bold">
                      {debugData.reduce((sum, e) => sum + e.total, 0)}
                    </div>
                  </div>
                  <div className="bg-white/20 rounded-lg p-3 text-center">
                    <div className="text-xs opacity-90">ข้อมูลทดสอบ</div>
                    <div className="text-2xl font-bold">
                      {debugData.reduce((sum, e) => sum + e.testCount, 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </ScrollArea>
        </DialogContent>
        </Dialog>
        </>
        );
        }