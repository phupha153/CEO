import React, { useState, useRef, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Check, Trash2, Loader2, Copy, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";

const COLUMNS = [
  { key: 'full_name', label: 'ชื่อ-นามสกุล', width: 180, editable: true, type: 'text' },
  { key: 'phone', label: 'เบอร์โทร', width: 120, editable: true, type: 'tel' },
  { key: 'gender', label: 'เพศ', width: 80, editable: true, type: 'select', options: [
    { value: '', label: '-' },
    { value: 'male', label: 'ชาย' },
    { value: 'female', label: 'หญิง' },
    { value: 'other', label: 'อื่นๆ' }
  ]},
  { key: 'age', label: 'อายุ', width: 60, editable: true, type: 'number' },
  { key: 'line_id', label: 'LINE ID', width: 120, editable: true, type: 'text' },
  { key: 'national_id', label: 'เลขบัตรปชช', width: 140, editable: true, type: 'text' },
  { key: 'email', label: 'อีเมล', width: 150, editable: true, type: 'email' },
  { key: 'address', label: 'ที่อยู่', width: 200, editable: true, type: 'text' },
  { key: 'emergency_contact', label: 'เบอร์ฉุกเฉิน', width: 120, editable: true, type: 'tel' },
  { key: 'rooms', label: 'ห้องที่เช่า', width: 120, editable: false },
  { key: 'prepaid_balance', label: 'เงินล่วงหน้า', width: 100, editable: false },
  { key: 'rating', label: 'คะแนน', width: 80, editable: false },
  { key: 'status', label: 'สถานะ', width: 80, editable: true, type: 'select', options: [
    { value: 'active', label: 'อยู่' },
    { value: 'moved_out', label: 'ย้ายออก' }
  ]},
  { key: 'notes', label: 'หมายเหตุ', width: 200, editable: true, type: 'text' },
  { key: 'created_date', label: 'วันที่สร้าง', width: 140, editable: false },
];

export default function ExcelTable({
  tenants,
  getActiveBookings,
  getRoomInfo,
  getTenantAverageRating,
  onCellUpdate,
  onBulkUpdate,
  onDelete,
  canEdit,
  canDelete,
  isSelectionMode,
  selectedTenants,
  onToggleSelection,
  onToggleSelectAll,
  deleteMutation
}) {
  const tableRef = useRef(null);
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, colKey }
  const [editValue, setEditValue] = useState('');
  const [isTableActive, setIsTableActive] = useState(false); // Track if table is active
  
  // Selection state
  const [selectionStart, setSelectionStart] = useState(null); // { row, col }
  const [selectionEnd, setSelectionEnd] = useState(null); // { row, col }
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCells, setSelectedCells] = useState(new Set()); // Set of "row-col" strings
  const [copiedData, setCopiedData] = useState(null); // { data: [[]], startRow, startCol }

  // Get column index by key
  const getColIndex = (key) => COLUMNS.findIndex(c => c.key === key);

  // Calculate selected range
  const getSelectedRange = useCallback(() => {
    if (!selectionStart || !selectionEnd) return null;
    
    const minRow = Math.min(selectionStart.row, selectionEnd.row);
    const maxRow = Math.max(selectionStart.row, selectionEnd.row);
    const minCol = Math.min(selectionStart.col, selectionEnd.col);
    const maxCol = Math.max(selectionStart.col, selectionEnd.col);
    
    return { minRow, maxRow, minCol, maxCol };
  }, [selectionStart, selectionEnd]);

  // Check if cell is in selection
  const isCellSelected = useCallback((row, col) => {
    const range = getSelectedRange();
    if (!range) return false;
    return row >= range.minRow && row <= range.maxRow && col >= range.minCol && col <= range.maxCol;
  }, [getSelectedRange]);

  // Handle cell mouse down - start selection
  const handleCellMouseDown = (e, rowIndex, colIndex) => {
    if (e.button !== 0) return; // Only left click
    
    // ⭐ Always activate table when clicking on cells
    setIsTableActive(true);
    
    // If shift is held, extend selection
    if (e.shiftKey && selectionStart) {
      setSelectionEnd({ row: rowIndex, col: colIndex });
      return;
    }

    setSelectionStart({ row: rowIndex, col: colIndex });
    setSelectionEnd({ row: rowIndex, col: colIndex });
    setIsDragging(true);
    setEditingCell(null);
    
    console.log('🟢 Cell selected:', { row: rowIndex, col: colIndex });
  };

  // Handle cell mouse enter - extend selection while dragging
  const handleCellMouseEnter = (rowIndex, colIndex) => {
    if (isDragging) {
      setSelectionEnd({ row: rowIndex, col: colIndex });
    }
  };

  // Handle mouse up - end dragging
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Handle double click to edit
  const handleCellDoubleClick = (rowIndex, colKey, currentValue) => {
    if (!canEdit) return;
    const col = COLUMNS.find(c => c.key === colKey);
    if (!col?.editable) return;
    
    setEditingCell({ rowIndex, colKey });
    setEditValue(currentValue || '');
  };

  // Handle edit complete
  const handleEditComplete = async (tenant, colKey, value) => {
    const col = COLUMNS.find(c => c.key === colKey);
    let finalValue = value;
    
    if (col?.type === 'number') {
      finalValue = value ? parseFloat(value) : null;
    }
    
    try {
      await onCellUpdate(tenant.id, colKey, finalValue);
      setEditingCell(null);
      setEditValue('');
    } catch (error) {
      console.error('Edit error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + (error.message || 'Rate limit exceeded'));
      setEditingCell(null);
      setEditValue('');
    }
  };

  // Handle column header click - select entire column
  const handleColumnHeaderClick = (colIndex, e) => {
    if (e.shiftKey && selectionStart) {
      // Extend to column
      setSelectionEnd({ row: tenants.length - 1, col: colIndex });
    } else {
      // Select entire column
      setSelectionStart({ row: 0, col: colIndex });
      setSelectionEnd({ row: tenants.length - 1, col: colIndex });
    }
  };

  // Handle row header click - select entire row
  const handleRowHeaderClick = (rowIndex, e) => {
    if (e.shiftKey && selectionStart) {
      setSelectionEnd({ row: rowIndex, col: COLUMNS.length - 1 });
    } else {
      setSelectionStart({ row: rowIndex, col: 0 });
      setSelectionEnd({ row: rowIndex, col: COLUMNS.length - 1 });
    }
  };

  // Handle select all (click on corner)
  const handleSelectAll = () => {
    setSelectionStart({ row: 0, col: 0 });
    setSelectionEnd({ row: tenants.length - 1, col: COLUMNS.length - 1 });
  };

  // Copy selected cells
  const handleCopy = useCallback(() => {
    const range = getSelectedRange();
    if (!range) {
      console.log('❌ handleCopy: No selection range');
      toast.error('กรุณาเลือกเซลล์ก่อนคัดลอก');
      return;
    }

    console.log('✅ handleCopy: Copying range', range);

    const data = [];
    for (let r = range.minRow; r <= range.maxRow; r++) {
      const row = [];
      for (let c = range.minCol; c <= range.maxCol; c++) {
        const tenant = tenants[r];
        const col = COLUMNS[c];
        let value = tenant[col.key] || '';
        
        // Special handling for display-only columns
        if (col.key === 'gender') {
          value = value === 'male' ? 'ชาย' : value === 'female' ? 'หญิง' : value === 'other' ? 'อื่นๆ' : '';
        } else if (col.key === 'status') {
          value = value === 'active' ? 'อยู่' : 'ย้ายออก';
        }
        
        row.push(String(value));
      }
      data.push(row);
    }

    // Copy to clipboard as TSV
    const text = data.map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedData({ data, startRow: range.minRow, startCol: range.minCol });
      toast.success(`คัดลอก ${data.length} แถว x ${data[0].length} คอลัมน์`);
    }).catch(err => {
      console.error('Clipboard write failed:', err);
      toast.error('ไม่สามารถคัดลอกได้');
    });
  }, [getSelectedRange, tenants]);

  // Paste data
  const handlePaste = useCallback(async () => {
    if (!canEdit) {
      toast.error('คุณไม่มีสิทธิ์แก้ไข');
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error('ไม่มีข้อมูลใน clipboard');
        return;
      }

      // Parse TSV/CSV data
      const rows = text.trim().split('\n').map(row => 
        row.split('\t').length > 1 ? row.split('\t') : row.split(',')
      );

      const range = getSelectedRange();
      const startRow = range ? range.minRow : 0;
      const startCol = range ? range.minCol : 0;

      const updates = [];
      
      for (let r = 0; r < rows.length; r++) {
        const targetRowIndex = startRow + r;
        if (targetRowIndex >= tenants.length) break;
        
        const tenant = tenants[targetRowIndex];
        const updateData = {};
        
        for (let c = 0; c < rows[r].length; c++) {
          const targetColIndex = startCol + c;
          if (targetColIndex >= COLUMNS.length) break;
          
          const col = COLUMNS[targetColIndex];
          if (!col.editable) continue;
          
          let value = rows[r][c].trim();
          
          // Convert display values back to actual values
          if (col.key === 'gender') {
            if (value === 'ชาย') value = 'male';
            else if (value === 'หญิง') value = 'female';
            else if (value === 'อื่นๆ') value = 'other';
          } else if (col.key === 'status') {
            if (value === 'อยู่') value = 'active';
            else if (value === 'ย้ายออก') value = 'moved_out';
          } else if (col.type === 'number') {
            value = value ? parseFloat(value) : null;
          }
          
          updateData[col.key] = value;
        }
        
        if (Object.keys(updateData).length > 0) {
          updates.push({ tenantId: tenant.id, data: updateData });
        }
      }

      if (updates.length > 0) {
        // ⭐ แก้ไข: ส่งข้อมูลทีละชุดเพื่อป้องกัน rate limit
        toast.info(`กำลังบันทึก ${updates.length} รายการ...`);
        const chunkSize = 5;
        for (let i = 0; i < updates.length; i += chunkSize) {
          const chunk = updates.slice(i, i + chunkSize);
          await onBulkUpdate(chunk);
          if (i + chunkSize < updates.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        toast.success(`วางข้อมูลสำเร็จ ${updates.length} แถว`);
      }
    } catch (error) {
      console.error('Paste error:', error);
      toast.error('เกิดข้อผิดพลาดในการวาง: ' + (error.message || 'Rate limit exceeded'));
    }
  }, [canEdit, getSelectedRange, tenants, onBulkUpdate]);

  // Handle keyboard shortcuts - use document level listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ⭐ ต้อง log ทุกครั้งที่กด key เพื่อ debug
      if (e.ctrlKey || e.metaKey) {
        console.log('🔑 Key pressed:', e.key, 'Ctrl:', e.ctrlKey, 'Meta:', e.metaKey);
      }
      
      // Don't intercept if typing in an input/textarea outside the table
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (!tableRef.current?.contains(e.target)) {
          console.log('⚠️ Skipped: focus on input outside table');
          return;
        }
      }

      // Ctrl+C - Copy (ทำงานเมื่อมี selection)
      // ⭐ ใช้ e.code แทน e.key เพราะ keyboard ไทยจะส่ง "แ" แทน "c"
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyC' || e.key.toLowerCase() === 'c')) {
        const hasSelection = !!getSelectedRange();
        console.log('🔵 Ctrl+C detected, hasSelection:', hasSelection, 'selectionStart:', selectionStart, 'selectionEnd:', selectionEnd);
        if (hasSelection) {
          e.preventDefault();
          e.stopPropagation();
          handleCopy();
          return;
        } else {
          console.log('❌ No selection to copy');
        }
      }

      // Only process other shortcuts if table is active
      if (!isTableActive) {
        return;
      }
      
      // Ctrl+V - Paste (ใช้ e.code สำหรับ keyboard ไทย)
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV' || e.key.toLowerCase() === 'v')) {
        e.preventDefault();
        e.stopPropagation();
        handlePaste();
      }

      // Ctrl+A - Select all (ใช้ e.code สำหรับ keyboard ไทย)
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyA' || e.key.toLowerCase() === 'a')) {
        e.preventDefault();
        e.stopPropagation();
        handleSelectAll();
      }

      // Escape - Clear selection and deactivate table
      if (e.key === 'Escape') {
        setSelectionStart(null);
        setSelectionEnd(null);
        setEditingCell(null);
        setIsTableActive(false);
      }

      // Arrow keys - Move selection
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectionStart && !editingCell) {
        e.preventDefault();
        const delta = {
          ArrowUp: { row: -1, col: 0 },
          ArrowDown: { row: 1, col: 0 },
          ArrowLeft: { row: 0, col: -1 },
          ArrowRight: { row: 0, col: 1 },
        }[e.key];

        const newRow = Math.max(0, Math.min(tenants.length - 1, selectionStart.row + delta.row));
        const newCol = Math.max(0, Math.min(COLUMNS.length - 1, selectionStart.col + delta.col));

        if (e.shiftKey) {
          setSelectionEnd({ row: newRow, col: newCol });
        } else {
          setSelectionStart({ row: newRow, col: newCol });
          setSelectionEnd({ row: newRow, col: newCol });
        }
      }

      // Enter - Start editing or move down
      if (e.key === 'Enter' && !editingCell && selectionStart) {
        e.preventDefault();
        const col = COLUMNS[selectionStart.col];
        if (col?.editable && canEdit) {
          const tenant = tenants[selectionStart.row];
          handleCellDoubleClick(selectionStart.row, col.key, tenant[col.key]);
        }
      }

      // Tab - Move to next cell
      if (e.key === 'Tab' && selectionStart && !editingCell) {
        e.preventDefault();
        const newCol = e.shiftKey 
          ? Math.max(0, selectionStart.col - 1)
          : Math.min(COLUMNS.length - 1, selectionStart.col + 1);
        setSelectionStart({ row: selectionStart.row, col: newCol });
        setSelectionEnd({ row: selectionStart.row, col: newCol });
      }

      // Delete or Backspace - Clear selected cells
      if ((e.key === 'Delete' || e.key === 'Backspace') && getSelectedRange() && canEdit && !editingCell) {
        e.preventDefault();
        handleClearSelection();
      }
    };

    // Click outside to deactivate table
    const handleClickOutside = (e) => {
      if (tableRef.current && !tableRef.current.contains(e.target)) {
        setIsTableActive(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleCopy, handlePaste, selectionStart, editingCell, tenants, canEdit, getSelectedRange, isTableActive]);

  // Clear selected cells
  const handleClearSelection = async () => {
    const range = getSelectedRange();
    if (!range) {
      toast.error('กรุณาเลือกเซลล์ก่อน');
      return;
    }

    // Count editable cells
    let editableCellCount = 0;
    for (let r = range.minRow; r <= range.maxRow; r++) {
      for (let c = range.minCol; c <= range.maxCol; c++) {
        const col = COLUMNS[c];
        if (col.editable) editableCellCount++;
      }
    }

    if (editableCellCount === 0) {
      toast.error('ไม่มีเซลล์ที่สามารถลบได้');
      return;
    }

    const updates = [];
    for (let r = range.minRow; r <= range.maxRow; r++) {
      const tenant = tenants[r];
      if (!tenant) continue;
      
      const updateData = {};
      
      for (let c = range.minCol; c <= range.maxCol; c++) {
        const col = COLUMNS[c];
        if (!col.editable) continue;
        updateData[col.key] = col.type === 'number' ? null : '';
      }
      
      if (Object.keys(updateData).length > 0) {
        updates.push({ tenantId: tenant.id, data: updateData });
      }
    }

    if (updates.length > 0) {
      try {
        toast.info(`กำลังล้างข้อมูล ${updates.length} แถว...`);
        // ⭐ ส่งทีละ chunk เพื่อป้องกัน rate limit
        const chunkSize = 5;
        for (let i = 0; i < updates.length; i += chunkSize) {
          const chunk = updates.slice(i, i + chunkSize);
          await onBulkUpdate(chunk);
          if (i + chunkSize < updates.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        toast.success(`ล้างข้อมูล ${updates.length} แถวสำเร็จ`);
      } catch (error) {
        toast.error('เกิดข้อผิดพลาดในการล้างข้อมูล: ' + (error.message || 'Rate limit exceeded'));
      }
    }
  };

  // Render cell content
  const renderCell = (tenant, col, rowIndex, colIndex) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colKey === col.key;
    const isSelected = isCellSelected(rowIndex, colIndex);
    
    // Get display value
    let displayValue = tenant[col.key];
    
    if (col.key === 'rooms') {
      const activeBookings = getActiveBookings(tenant.id);
      if (activeBookings.length > 0) {
        return (
          <div className="flex flex-wrap gap-1">
            {activeBookings.map(b => {
              const room = getRoomInfo(b.room_id);
              return (
                <Badge key={b.id} className="bg-green-100 text-green-700 text-xs">
                  {room?.room_number}
                </Badge>
              );
            })}
          </div>
        );
      }
      return <span className="text-slate-400">-</span>;
    }
    
    if (col.key === 'prepaid_balance') {
      return (
        <span className="font-semibold text-green-700">
          {(displayValue || 0).toLocaleString()}
        </span>
      );
    }
    
    if (col.key === 'rating') {
      const avgRating = getTenantAverageRating(tenant.id);
      if (avgRating !== null) {
        return (
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="font-semibold text-xs">{avgRating.toFixed(1)}</span>
          </div>
        );
      }
      return <span className="text-slate-400">-</span>;
    }
    
    if (col.key === 'status') {
      const status = displayValue || 'active';
      return (
        <Badge className={status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>
          {status === 'active' ? 'อยู่' : 'ย้ายออก'}
        </Badge>
      );
    }
    
    if (col.key === 'gender') {
      displayValue = displayValue === 'male' ? 'ชาย' : displayValue === 'female' ? 'หญิง' : displayValue === 'other' ? 'อื่นๆ' : '';
    }
    
    if (col.key === 'created_date') {
      if (displayValue) {
        try {
          const date = new Date(displayValue);
          displayValue = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch {
          displayValue = '-';
        }
      }
    }

    // Editing mode
    if (isEditing) {
      if (col.type === 'select') {
        return (
          <select
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleEditComplete(tenant, col.key, editValue)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEditComplete(tenant, col.key, editValue);
              if (e.key === 'Escape') { setEditingCell(null); setEditValue(''); }
            }}
            className="w-full h-full px-1 py-0.5 border-2 border-blue-500 rounded focus:outline-none text-sm bg-white"
          >
            {col.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      }
      
      return (
        <input
          type={col.type === 'number' ? 'number' : 'text'}
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleEditComplete(tenant, col.key, editValue)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleEditComplete(tenant, col.key, editValue);
            if (e.key === 'Escape') { setEditingCell(null); setEditValue(''); }
            if (e.key === 'Tab') {
              e.preventDefault();
              handleEditComplete(tenant, col.key, editValue);
              // Move to next editable cell
              const nextColIndex = e.shiftKey 
                ? COLUMNS.slice(0, colIndex).reverse().findIndex(c => c.editable)
                : COLUMNS.slice(colIndex + 1).findIndex(c => c.editable);
              if (nextColIndex !== -1) {
                const actualIndex = e.shiftKey ? colIndex - 1 - nextColIndex : colIndex + 1 + nextColIndex;
                setSelectionStart({ row: rowIndex, col: actualIndex });
                setSelectionEnd({ row: rowIndex, col: actualIndex });
              }
            }
          }}
          className="w-full h-full px-1 py-0.5 border-2 border-blue-500 rounded focus:outline-none text-sm"
        />
      );
    }

    return (
      <span className={`${col.editable && canEdit ? 'cursor-text' : ''} text-sm text-slate-700 block truncate`}>
        {displayValue || '-'}
      </span>
    );
  };

  const range = getSelectedRange();

  // Activate table when clicking anywhere on it
  const handleTableMouseDown = (e) => {
    setIsTableActive(true);
    if (tableRef.current) {
      tableRef.current.focus();
    }
  };

  return (
    <div 
      className={`relative outline-none ${isTableActive ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
      ref={tableRef} 
      tabIndex={0}
      onMouseDown={handleTableMouseDown}
      onFocus={() => setIsTableActive(true)}
    >
      {/* Toolbar */}
      {range && (
        <div className="sticky top-0 z-20 bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-3">
          <span className="text-sm font-medium text-blue-700">
            เลือก {range.maxRow - range.minRow + 1} แถว x {range.maxCol - range.minCol + 1} คอลัมน์
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy} className="h-7 text-xs">
              <Copy className="w-3 h-3 mr-1" />
              คัดลอก (Ctrl+C)
            </Button>
            <Button size="sm" variant="outline" onClick={handlePaste} className="h-7 text-xs">
              <ClipboardPaste className="w-3 h-3 mr-1" />
              วาง (Ctrl+V)
            </Button>
            {canEdit && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleClearSelection}
                className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                ล้างข้อมูล (Delete)
              </Button>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => { setSelectionStart(null); setSelectionEnd(null); }}
              className="h-7 text-xs"
            >
              ยกเลิกเลือก
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse select-none" style={{ minWidth: COLUMNS.reduce((sum, c) => sum + c.width, 100) }}>
          <thead className="bg-slate-100 sticky top-0 z-10">
            <tr>
              {/* Corner cell - select all */}
              <th 
                className="w-12 border border-slate-200 bg-slate-200 cursor-pointer hover:bg-slate-300"
                onClick={handleSelectAll}
                title="เลือกทั้งหมด"
              >
                <div className="w-full h-full flex items-center justify-center py-2">
                  {isSelectionMode && (
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedTenants.length === tenants.length && tenants.length > 0
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300'
                      }`}
                      onClick={(e) => { e.stopPropagation(); onToggleSelectAll(); }}
                    >
                      {selectedTenants.length === tenants.length && tenants.length > 0 && (
                        <Check className="w-3 h-3" />
                      )}
                    </div>
                  )}
                </div>
              </th>
              
              {/* Column headers */}
              {COLUMNS.map((col, colIndex) => (
                <th
                  key={col.key}
                  className={`px-2 py-2 text-left text-xs font-bold text-slate-700 border border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors ${
                    range && colIndex >= range.minCol && colIndex <= range.maxCol ? 'bg-blue-100' : 'bg-slate-100'
                  }`}
                  style={{ minWidth: col.width, width: col.width }}
                  onClick={(e) => handleColumnHeaderClick(colIndex, e)}
                >
                  {col.label}
                </th>
              ))}
              
              {/* Delete column */}
              <th className="w-12 border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700 text-center">
                ลบ
              </th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant, rowIndex) => {
              const isRowSelected = range && rowIndex >= range.minRow && rowIndex <= range.maxRow;
              
              return (
                <tr
                  key={tenant.id}
                  className={`${isRowSelected ? 'bg-blue-50' : 'hover:bg-slate-50'} ${
                    isSelectionMode && selectedTenants.includes(tenant.id) ? 'bg-blue-100' : ''
                  }`}
                >
                  {/* Row header */}
                  <td
                    className={`border border-slate-200 text-center text-xs text-slate-500 cursor-pointer hover:bg-slate-100 ${
                      isRowSelected ? 'bg-blue-100' : 'bg-slate-50'
                    }`}
                    onClick={(e) => handleRowHeaderClick(rowIndex, e)}
                  >
                    {isSelectionMode ? (
                      <div
                        className={`w-5 h-5 mx-auto rounded border-2 flex items-center justify-center cursor-pointer ${
                          selectedTenants.includes(tenant.id)
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 hover:border-blue-400'
                        }`}
                        onClick={(e) => { e.stopPropagation(); onToggleSelection(tenant.id); }}
                      >
                        {selectedTenants.includes(tenant.id) && <Check className="w-3 h-3" />}
                      </div>
                    ) : (
                      rowIndex + 1
                    )}
                  </td>
                  
                  {/* Data cells */}
                  {COLUMNS.map((col, colIndex) => {
                    const isSelected = isCellSelected(rowIndex, colIndex);
                    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colKey === col.key;
                    
                    return (
                      <td
                        key={col.key}
                        className={`px-2 py-1.5 border border-slate-200 ${
                          isSelected ? 'bg-blue-100 outline outline-2 outline-blue-500 -outline-offset-2' : ''
                        } ${isEditing ? 'p-0' : ''}`}
                        style={{ minWidth: col.width, width: col.width }}
                        onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                        onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        onDoubleClick={() => handleCellDoubleClick(rowIndex, col.key, tenant[col.key])}
                      >
                        {renderCell(tenant, col, rowIndex, colIndex)}
                      </td>
                    );
                  })}
                  
                  {/* Delete button */}
                  <td className="border border-slate-200 text-center">
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                        onClick={() => {
                          if (confirm(`ลบผู้เช่า "${tenant.full_name}"?`)) {
                            onDelete(tenant.id);
                          }
                        }}
                        disabled={deleteMutation?.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {tenants.length === 0 && (
        <div className="p-8 text-center text-slate-500">
          <span className="text-lg">ไม่พบผู้เช่า</span>
        </div>
      )}
    </div>
  );
}