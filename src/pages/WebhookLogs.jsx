import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Terminal, Search, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function WebhookLogs() {
  const [searchLineId, setSearchLineId] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedEventType, setSelectedEventType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [expandedLog, setExpandedLog] = useState(null);
  const [limit, setLimit] = useState(100);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    enabled: !!currentUser
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['webhookLogs', searchLineId, selectedBranch, selectedEventType, selectedStatus, limit],
    queryFn: async () => {
      const filter = {};
      
      if (searchLineId) filter.line_user_id = { $regex: searchLineId };
      if (selectedBranch !== 'all') filter.branch_id = selectedBranch;
      if (selectedEventType !== 'all') filter.event_type = selectedEventType;
      if (selectedStatus !== 'all') filter.status = selectedStatus;

      return base44.entities.WebhookLog.filter(filter, '-created_date', limit);
    },
    enabled: !!currentUser && currentUser.role === 'admin'
  });

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-slate-600">Developer access required</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusIcon = (status) => {
    if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (status === 'error') return <AlertCircle className="w-4 h-4 text-red-600" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
  };

  const getStatusBadge = (status) => {
    if (status === 'success') return 'bg-green-100 text-green-700';
    if (status === 'error') return 'bg-red-100 text-red-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Terminal className="w-8 h-8 text-purple-600" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Webhook Logs</h1>
            <p className="text-sm text-slate-600">LINE Webhook Event History</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🔍 Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">LINE User ID</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="ค้นหา LINE ID..."
                    value={searchLineId}
                    onChange={(e) => setSearchLineId(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Branch</label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.branch_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Event Type</label>
                <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="payment_verified">✅ Payment Verified</SelectItem>
                    <SelectItem value="partial_payment">⚠️ Partial Payment</SelectItem>
                    <SelectItem value="slip_duplicate">🔄 Slip Duplicate</SelectItem>
                    <SelectItem value="slip_fraud">🚫 Slip Fraud</SelectItem>
                    <SelectItem value="account_mismatch">👤 Account Mismatch</SelectItem>
                    <SelectItem value="slip_not_found">💨 Slip Not Found</SelectItem>
                    <SelectItem value="maintenance_request">🔧 Maintenance Request</SelectItem>
                    <SelectItem value="registration">📝 Registration</SelectItem>
                    <SelectItem value="error">❌ Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Limit:</label>
              <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-slate-500">logs</span>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              📊 Results ({logs.length} logs)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No logs found</div>
            ) : (
              <div className="space-y-2">
                {logs.map(log => {
                  const isExpanded = expandedLog === log.id;
                  const branch = branches.find(b => b.id === log.branch_id);

                  return (
                    <div
                      key={log.id}
                      className="border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <button
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        className="w-full p-4 flex items-start gap-3 text-left hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <div className="pt-1">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusIcon(log.status)}
                            <span className="font-mono text-xs text-slate-500">
                              {format(parseISO(log.created_date), 'dd/MM/yyyy HH:mm:ss')}
                            </span>
                            <Badge className={getStatusBadge(log.status)}>
                              {log.status}
                            </Badge>
                            <Badge variant="outline">{log.event_type}</Badge>
                            {branch && (
                              <Badge variant="secondary">{branch.branch_name}</Badge>
                            )}
                          </div>

                          <div className="text-sm">
                            <span className="font-semibold">{log.message}</span>
                            {log.amount > 0 && (
                              <span className="ml-2 text-blue-600">
                                ({log.amount.toLocaleString()} ฿)
                              </span>
                            )}
                          </div>

                          {log.line_user_id && (
                            <div className="text-xs text-slate-500 font-mono">
                              LINE ID: {log.line_user_id}
                            </div>
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t bg-slate-50 p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-600">Tenant ID:</span>
                              <p className="font-mono text-xs">{log.tenant_id || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-slate-600">Payment ID:</span>
                              <p className="font-mono text-xs">{log.payment_id || 'N/A'}</p>
                            </div>
                          </div>

                          {log.error_message && (
                            <div className="bg-red-50 border border-red-200 rounded p-3">
                              <p className="text-xs font-semibold text-red-700">Error:</p>
                              <p className="text-xs text-red-600 font-mono mt-1">
                                {log.error_message}
                              </p>
                            </div>
                          )}

                          {log.details && (
                            <div className="bg-white border rounded p-3">
                              <p className="text-xs font-semibold text-slate-700 mb-2">Details:</p>
                              <pre className="text-xs font-mono text-slate-600 overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}