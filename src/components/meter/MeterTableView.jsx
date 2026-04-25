import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, History, Droplets, Zap, Check, Pencil, Grid } from "lucide-react";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";

export default function MeterTableView({
  displayFloors,
  displayRoomsByFloor,
  meterReadings,
  selectedReadingVersion,
  setSelectedReadingVersion,
  bulkReadings,
  setBulkReadings,
  bulkReadingDate,
  setBulkReadingDate,
  meterTypeSelection,
  setMeterTypeSelection,
  editingPreviousForRoom,
  setEditingPreviousForRoom,
  getActiveBooking,
  getTenantInfo,
  getLatestReading,
  hasRecordedThisMonth,
  setViewMode,
}) {
  return (
    <div className="space-y-6">
      {/* ตัวเลือกเวอร์ชัน + ประเภทมิเตอร์ */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="hidden md:flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              <Label className="font-medium">เวอร์ชัน:</Label>
              <select
                value={selectedReadingVersion}
                onChange={(e) => {
                  setSelectedReadingVersion(e.target.value);
                  setBulkReadings({});
                  if (e.target.value.startsWith('view_')) {
                    setBulkReadingDate(e.target.value.replace('view_', ''));
                  } else {
                    setBulkReadingDate(new Date().toISOString().split('T')[0]);
                  }
                }}
                className="p-2 border rounded-lg hidden md:block min-w-[200px]"
              >
                <option value="new">➕ บันทึกใหม่ (วันนี้)</option>
                {(() => {
                  const dateGroups = {};
                  meterReadings.forEach(r => {
                    if (!dateGroups[r.reading_date]) dateGroups[r.reading_date] = r;
                  });
                  return Object.entries(dateGroups)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 10)
                    .map(([date]) => (
                      <option key={`view_${date}`} value={`view_${date}`}>
                        📋 ดูประวัติ: {format(parseISO(date), 'd MMM yyyy', { locale: th })}
                      </option>
                    ));
                })()}
              </select>
            </div>

            {selectedReadingVersion.startsWith('view_') && (
              <Badge className="bg-blue-100 text-blue-700">ดูประวัติ</Badge>
            )}

            <div className="flex flex-wrap gap-2 md:gap-3">
              {[
                { key: 'water', label: 'น้ำ', icon: <Droplets className="w-3 h-3 md:w-4 md:h-4 mr-1" />, activeClass: 'bg-blue-600 text-white' },
                { key: 'electricity', label: 'ไฟ', icon: <Zap className="w-3 h-3 md:w-4 md:h-4 mr-1" />, activeClass: 'bg-yellow-600 text-white' },
                { key: 'both', label: 'ทั้งสอง', icon: null, activeClass: 'bg-purple-600 text-white' },
              ].map(({ key, label, icon, activeClass }) => {
                const isActive = meterTypeSelection.tableType === key || (!meterTypeSelection.tableType && key === 'both');
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant={isActive ? 'default' : 'outline'}
                    onClick={() => setMeterTypeSelection({ ...meterTypeSelection, tableType: key })}
                    className={`${isActive ? activeClass : ''} text-xs md:text-sm`}
                  >
                    {icon}{label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {displayFloors.map((floor) => {
        const isViewMode = selectedReadingVersion.startsWith('view_');
        const viewDate = isViewMode ? selectedReadingVersion.replace('view_', '') : null;
        const showWater = meterTypeSelection.tableType === 'water' || !meterTypeSelection.tableType || meterTypeSelection.tableType === 'both';
        const showElec = meterTypeSelection.tableType === 'electricity' || !meterTypeSelection.tableType || meterTypeSelection.tableType === 'both';

        return (
          <div key={floor} className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-slate-800">ชั้น {floor}</h2>
                <Badge variant="outline" className="text-sm">{displayRoomsByFloor[floor].length} ห้อง</Badge>
              </div>
              <Button onClick={() => setViewMode('card')} variant="outline" size="sm" className="border-slate-400 text-slate-600 hover:bg-slate-50">
                <Grid className="w-4 h-4 mr-1" />การ์ด
              </Button>
            </div>

            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ห้อง</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 hidden md:table-cell">ผู้เช่า</th>
                        {showWater && (
                          <>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">มิเตอร์น้ำก่อน</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">มิเตอร์น้ำปัจจุบัน</th>
                          </>
                        )}
                        {showElec && (
                          <>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">มิเตอร์ไฟก่อน</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">มิเตอร์ไฟปัจจุบัน</th>
                          </>
                        )}
                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {displayRoomsByFloor[floor].map(room => {
                        const booking = getActiveBooking(room.id);
                        const tenant = booking ? getTenantInfo(booking.tenant_id) : null;
                        const latest = getLatestReading(room.id);
                        const hasExistingReading = !!latest;
                        const waterPrevious = hasExistingReading ? latest.water_current : '';
                        const electricityPrevious = hasExistingReading ? latest.electricity_current : '';
                        const historyReading = viewDate ? meterReadings.find(r => r.room_id === room.id && r.reading_date === viewDate) : null;

                        return (
                          <tr key={room.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-medium text-slate-800">
                              <div className="flex items-center gap-2">
                                {room.room_number}
                                {hasRecordedThisMonth(room.id) && (
                                  <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs">
                                    <Check className="w-3 h-3 mr-1" />บันทึกแล้ว
                                  </Badge>
                                )}
                                {!hasExistingReading && !isViewMode && !hasRecordedThisMonth(room.id) && (
                                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">ครั้งแรก</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">{tenant?.full_name || '-'}</td>

                            {isViewMode ? (
                              <>
                                {showWater && (
                                  <>
                                    <td className="px-4 py-3 text-center">
                                      <div className="font-medium text-slate-600 bg-slate-100 rounded px-2 py-1.5">{historyReading?.water_previous ?? '-'}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="font-bold text-blue-600 bg-blue-50 rounded px-2 py-1.5">
                                        {historyReading?.water_current ?? '-'}
                                        {historyReading && <span className="text-xs text-slate-500 ml-1">({historyReading.water_units})</span>}
                                      </div>
                                    </td>
                                  </>
                                )}
                                {showElec && (
                                  <>
                                    <td className="px-4 py-3 text-center">
                                      <div className="font-medium text-slate-600 bg-slate-100 rounded px-2 py-1.5">{historyReading?.electricity_previous ?? '-'}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="font-bold text-yellow-600 bg-yellow-50 rounded px-2 py-1.5">
                                        {historyReading?.electricity_current ?? '-'}
                                        {historyReading && <span className="text-xs text-slate-500 ml-1">({historyReading.electricity_units})</span>}
                                      </div>
                                    </td>
                                  </>
                                )}
                                <td />
                              </>
                            ) : (
                              <>
                                {showWater && (
                                  <>
                                    <td className="px-4 py-3 text-center">
                                      {editingPreviousForRoom === room.id ? (
                                        <Input
                                          type="number" step="0.01"
                                          value={bulkReadings[room.id]?.water_previous ?? waterPrevious ?? '0'}
                                          onChange={(e) => setBulkReadings(prev => ({ ...prev, [room.id]: { ...prev[room.id], water_previous: e.target.value } }))}
                                          className="w-24 mx-auto" autoFocus
                                        />
                                      ) : (
                                        <span className="font-medium text-slate-700">{bulkReadings[room.id]?.water_previous || waterPrevious || '0'}</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <Input
                                        type="number" step="0.01" placeholder="เช่น 150.5"
                                        value={bulkReadings[room.id]?.water_current ?? ''}
                                        onChange={(e) => setBulkReadings(prev => ({
                                          ...prev,
                                          [room.id]: { ...prev[room.id], water_current: e.target.value, water_previous: prev[room.id]?.water_previous ?? (hasExistingReading ? waterPrevious : '') }
                                        }))}
                                        className="w-32"
                                      />
                                    </td>
                                  </>
                                )}
                                {showElec && (
                                  <>
                                    <td className="px-4 py-3 text-center">
                                      {editingPreviousForRoom === room.id ? (
                                        <Input
                                          type="number" step="0.01"
                                          value={bulkReadings[room.id]?.electricity_previous ?? electricityPrevious ?? '0'}
                                          onChange={(e) => setBulkReadings(prev => ({ ...prev, [room.id]: { ...prev[room.id], electricity_previous: e.target.value } }))}
                                          className="w-24 mx-auto"
                                        />
                                      ) : (
                                        <span className="font-medium text-slate-700">{bulkReadings[room.id]?.electricity_previous || electricityPrevious || '0'}</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <Input
                                        type="number" step="0.01" placeholder="เช่น 250.0"
                                        value={bulkReadings[room.id]?.electricity_current ?? ''}
                                        onChange={(e) => setBulkReadings(prev => ({
                                          ...prev,
                                          [room.id]: { ...prev[room.id], electricity_current: e.target.value, electricity_previous: prev[room.id]?.electricity_previous ?? (hasExistingReading ? electricityPrevious : '') }
                                        }))}
                                        className="w-32"
                                      />
                                    </td>
                                  </>
                                )}
                                <td className="px-4 py-3 text-center">
                                  <Button
                                    variant="ghost" size="sm"
                                    onClick={() => setEditingPreviousForRoom(editingPreviousForRoom === room.id ? null : room.id)}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    {editingPreviousForRoom === room.id ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                                  </Button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}