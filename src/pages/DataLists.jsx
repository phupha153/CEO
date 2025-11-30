import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, Search, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import PageHeader from "../components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";

const ENTITIES = [
  { name: 'Branch', label: 'สาขา' },
  { name: 'Room', label: 'ห้องพัก' },
  { name: 'Tenant', label: 'ผู้เช่า' },
  { name: 'Booking', label: 'การจอง' },
  { name: 'Payment', label: 'การชำระเงิน' },
  { name: 'MeterReading', label: 'บันทึกมิเตอร์' },
  { name: 'Expense', label: 'ค่าใช้จ่าย' },
  { name: 'MaintenanceRequest', label: 'แจ้งซ่อม' },
  { name: 'MaterialDelivery', label: 'พัสดุ' },
  { name: 'Contract', label: 'สัญญา' },
  { name: 'TenantRating', label: 'การให้คะแนนผู้เช่า' },
  { name: 'Config', label: 'การตั้งค่า' },
  { name: 'NotificationConfig', label: 'การตั้งค่าแจ้งเตือน' },
  { name: 'User', label: 'ผู้ใช้งาน' },
];

export default function DataLists() {
  const [selectedEntity, setSelectedEntity] = useState('Payment');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState(new Set());

  const { data: items = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dataList', selectedEntity],
    queryFn: async () => {
      return await base44.entities[selectedEntity].list('-created_date', 200);
    },
    enabled: !!selectedEntity,
    staleTime: 0,
    gcTime: 1000,
  });

  const filteredItems = items.filter(item => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const itemString = JSON.stringify(item).toLowerCase();
    return itemString.includes(query);
  });

  const toggleExpand = (id) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const renderValue = (value) => {
    if (value === null || value === undefined) return <span className="text-slate-400">null</span>;
    if (typeof value === 'boolean') return value ? '✓ true' : '✗ false';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'string' && value.startsWith('http')) {
      return <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block">{value}</a>;
    }
    return String(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100">
      <PageHeader
        title="ดูข้อมูล Entity"
        subtitle="ดูรายการข้อมูลทั้งหมดในระบบ"
        icon={Database}
        showNotifications={false}
        showBackButton={true}
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-4">
          
          {/* Controls */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">เลือก Entity:</label>
                  <Select value={selectedEntity} onValueChange={(val) => {
                    setSelectedEntity(val);
                    setSearchQuery('');
                    setExpandedItems(new Set());
                  }}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITIES.map(entity => (
                        <SelectItem key={entity.name} value={entity.name}>
                          {entity.label} ({entity.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">ค้นหา:</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ค้นหาในข้อมูล..."
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    variant="outline"
                    className="gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                    รีเฟรช
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <CardContent className="p-4">
                <p className="text-blue-100 text-sm mb-1">จำนวนทั้งหมด</p>
                <p className="text-3xl font-bold">{items.length}</p>
                <p className="text-xs text-blue-100 mt-1">รายการ</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
              <CardContent className="p-4">
                <p className="text-purple-100 text-sm mb-1">แสดงผล</p>
                <p className="text-3xl font-bold">{filteredItems.length}</p>
                <p className="text-xs text-purple-100 mt-1">รายการ</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <CardContent className="p-4">
                <p className="text-green-100 text-sm mb-1">ขยาย</p>
                <p className="text-3xl font-bold">{expandedItems.size}</p>
                <p className="text-xs text-green-100 mt-1">รายการ</p>
              </CardContent>
            </Card>
          </div>

          {/* Data Display */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-600">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <Card className="bg-white/80">
              <CardContent className="p-8 text-center">
                <Database className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">ไม่พบข้อมูล</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item, idx) => {
                const isExpanded = expandedItems.has(item.id);
                
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                  >
                    <Card className="bg-white/90 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-shadow">
                      <CardContent className="p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-blue-100 text-blue-700 font-mono text-xs">
                                {item.id}
                              </Badge>
                              {item.created_date && (
                                <span className="text-xs text-slate-500">
                                  {new Date(item.created_date).toLocaleString('th-TH')}
                                </span>
                              )}
                            </div>
                            
                            {/* Quick Preview - แสดง 3 fields แรก */}
                            <div className="grid md:grid-cols-3 gap-2 text-sm">
                              {Object.entries(item)
                                .filter(([key]) => !['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', 'entity_name', 'app_id', 'is_sample', 'is_deleted', 'deleted_date'].includes(key))
                                .slice(0, 3)
                                .map(([key, value]) => (
                                  <div key={key} className="truncate">
                                    <span className="text-slate-500 text-xs">{key}:</span>{' '}
                                    <span className="font-medium text-slate-800">{renderValue(value)}</span>
                                  </div>
                                ))}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(item.id)}
                            className="flex-shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-t pt-3 mt-3"
                          >
                            <pre className="bg-slate-50 rounded-lg p-4 overflow-x-auto text-xs">
                              {JSON.stringify(item, null, 2)}
                            </pre>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}