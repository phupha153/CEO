import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";

export default function ExcelUploader({ 
  entityName, 
  schema, 
  onSuccess,
  templateData,
  templateFilename,
  additionalData,
  onTransformData,
  customImportHandler,
  hideDownloadTemplate = false,
  buttonVariant = "default",
  buttonClassName = "",
  onImport,
  useBackendImport = false, // ⭐ NEW: Enable faster backend processing
  backendImportFunction = '' // ⭐ NEW: Backend function name
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
  const [csvText, setCsvText] = useState(null); // ⭐ Store CSV text for fast backend import

  const downloadTemplate = () => {
    try {
      // ตรวจสอบว่ามี templateData และไม่ใช่ array ว่าง
      if (!templateData || !Array.isArray(templateData) || templateData.length === 0) {
        toast.error('ไม่มี Template สำหรับดาวน์โหลด');
        return;
      }
      
      const headers = Object.keys(templateData[0] || {});
      const csvContent = [
        headers.join(','),
        ...templateData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
      ].join('\n');

      // Use explicit BOM bytes for better Excel compatibility
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', templateFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('ดาวน์โหลด Template สำเร็จ');
    } catch (error) {
      console.error('Download template error:', error);
      toast.error('เกิดข้อผิดพลาดในการดาวน์โหลด');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, 'Type:', file.type, 'Size:', file.size);

    setUploading(true);
    setExtractedData(null);
    setErrorMessage(null);

    try {
      // ⭐ NEW: Check if file is Excel (.xlsx)
      const isExcel = file.name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      // ⭐ Read Excel file and convert to CSV text
      let csv_text = '';
      if (isExcel) {
        console.log('📊 Reading Excel file...');
        toast.info('กำลังอ่านไฟล์ Excel...');

        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to CSV
        csv_text = XLSX.utils.sheet_to_csv(worksheet);
        console.log('✅ Excel converted to CSV, length:', csv_text.length);
      } else {
        // Read CSV directly
        csv_text = await file.text();
        console.log('CSV text length:', csv_text.length);
      }

      // ⭐ FIX: For Tenant CSV imports, use custom flexible parser instead of strict API
      if (entityName === 'Tenant') {
        console.log('🔧 Using flexible CSV parser for Tenants...');

        // Use custom import function to PARSE (not import yet)
        const result = await base44.functions.invoke('flexibleTenantImport', {
          csv_text,
          branch_id: additionalData?.branch_id
        });

        if (result.data.success) {
          setUploading(false);
          // Show preview table - don't auto-import yet
          setExtractedData(result.data.data);
          toast.success(result.data.message);
          e.target.value = '';
          return;
        } else {
          throw new Error(result.data.error);
        }
      }

      // Step 1: Upload file
      console.log('Uploading file...');
      toast.info('กำลังอัปโหลดไฟล์...');

      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      console.log('Upload result:', uploadResult);

      if (!uploadResult?.file_url) {
        throw new Error('ไม่สามารถอัปโหลดไฟล์ได้');
      }

      const fileUrl = uploadResult.file_url;
      console.log('File uploaded to:', fileUrl);
      setUploadedFileUrl(fileUrl); // ⭐ Store for backend import

      // ⭐ If using backend import, send CSV text directly (NO AI - super fast!)
      if (useBackendImport && backendImportFunction) {
        console.log('⚡ Fast backend parsing...');
        toast.info('กำลังประมวลผลข้อมูล...');
        
        setCsvText(csv_text); // ⭐ Store for final import

        const previewResult = await base44.functions.invoke(backendImportFunction, {
          csv_text: csv_text,
          branch_id: additionalData?.branch_id,
          preview_only: true
        });

        if (previewResult.data.success && previewResult.data.data) {
          setUploading(false);
          setExtractedData(previewResult.data.data);
          toast.success(previewResult.data.message || `พบข้อมูล ${previewResult.data.data.length} รายการ`);
          e.target.value = '';
          return;
        } else {
          throw new Error(previewResult.data.error || 'ไม่สามารถอ่านข้อมูลได้');
        }
      }

      // Step 2: Extract data
      console.log('Extracting data from file...');
      toast.info('กำลังอ่านข้อมูลจากไฟล์...');

      const extractSchema = schema;
      console.log('Extract schema (ใหม่):', JSON.stringify(extractSchema, null, 2));

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: extractSchema
      });

      console.log('========== DEBUG INFO ==========');
      console.log('Extract result status:', result.status);
      console.log('Extract result.output type:', Array.isArray(result.output) ? 'Array' : typeof result.output);
      console.log('Extract result.output length:', Array.isArray(result.output) ? result.output.length : 'N/A');
      console.log('Extract result.output (full):', JSON.stringify(result.output, null, 2));
      
      if (Array.isArray(result.output) && result.output.length > 0) {
        console.log('First item in output:', result.output[0]);
        console.log('First item type:', typeof result.output[0]);
        console.log('First item keys:', Object.keys(result.output[0] || {}));
      }
      console.log('================================');

      if (result.status === "success") {
        let finalExtractedData = [];
        
        // ✅ CLEAN BOM & INVISIBLE CHARS from column names BEFORE processing
        if (Array.isArray(result.output) && result.output.length > 0) {
          console.log('🧹 Cleaning column names (BOM, ZWNBSP, tabs, spaces)...');
          finalExtractedData = result.output
            .filter(item => 
              item !== null && item !== undefined && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length > 0
            )
            .map(record => {
              const cleanRecord = {};
              Object.keys(record).forEach(key => {
                // ลบอักขระพิเศษทั้งหมด: BOM, Zero-Width Space, tabs, leading/trailing spaces
                const cleanKey = key
                  .replace(/^\ufeff/, '')      // BOM
                  .replace(/\u200b/g, '')      // Zero-Width Space
                  .replace(/\t/g, ' ')         // Tab → Space
                  .trim();                     // Leading/trailing spaces
                cleanRecord[cleanKey] = record[key];
              });
              return cleanRecord;
            })
            .filter(record => {
              // ⭐ CRITICAL FIX: กรองแถวว่างออก (ทุก value เป็น empty, null, undefined, หรือ "-")
              const hasData = Object.values(record).some(v => 
                v !== null && 
                v !== undefined && 
                v !== '' && 
                v !== '-' && 
                String(v).trim() !== ''
              );
              return hasData;
            });
          console.log('✅ Cleaned column names. Sample:', Object.keys(finalExtractedData[0] || {}));
        }

        console.log('Final extracted data count:', finalExtractedData.length);
        console.log('Final extracted data (first 2 items):', JSON.stringify(finalExtractedData.slice(0, 2), null, 2));

        if (finalExtractedData.length > 0) {
          // ตรวจสอบว่าแต่ละรายการเป็น object ที่มี properties จริงๆ
          const validData = finalExtractedData.every(item => 
            item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length > 0
          );
          
          if (!validData) {
            throw new Error('ข้อมูลที่ดึงมาไม่ถูกต้อง กรุณาตรวจสอบรูปแบบไฟล์');
          }
          
          setExtractedData(finalExtractedData);
          toast.success(`อ่านข้อมูลสำเร็จ: ${finalExtractedData.length} รายการ`);
        } else {
          const errorMsg = "ไม่พบข้อมูลที่สามารถนำเข้าได้จากไฟล์ กรุณาตรวจสอบว่าไฟล์ CSV มีข้อมูลและรูปแบบถูกต้อง";
          console.error('Extract failed:', errorMsg);
          setErrorMessage(errorMsg);
          throw new Error(errorMsg);
        }
      } else {
        const errorMsg = result.details || result.message || "ไม่สามารถอ่านข้อมูลจากไฟล์ได้";
        console.error('Extract failed:', errorMsg);
        console.error('Result object:', result);
        setErrorMessage(errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('File upload/extract error:', error);
      const errorMsg = error.message || "เกิดข้อผิดพลาดในการอ่านไฟล์";
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      setExtractedData(null);
    }
    
    setUploading(false);
    e.target.value = '';
  };

  const handleImportClick = async () => {
    if (!extractedData || extractedData.length === 0) {
      toast.error('ไม่มีข้อมูลที่จะนำเข้า');
      return;
    }

    setImporting(true);
    try {
      // ⭐ Backend import (final) - use CSV text from state
      if (useBackendImport && backendImportFunction && csvText) {
        console.log('⚡ Fast backend import (final)');
        
        const response = await base44.functions.invoke(backendImportFunction, {
          csv_text: csvText,
          ...additionalData,
          preview_only: false
        });

        if (response.data.success) {
          toast.success(
            response.data.message || `นำเข้าสำเร็จ: ${response.data.imported} รายการ`,
            { duration: 5000 }
          );
          
          if (response.data.errors && response.data.errors.length > 0) {
            toast.warning(`ข้าม ${response.data.errors.length} รายการที่มีข้อผิดพลาด`);
          }

          setShowDialog(false);
          setExtractedData(null);
          setUploadedFileUrl(null);
          setCsvText(null);
          setErrorMessage(null);
          if (onSuccess) onSuccess();
          return;
        } else {
          throw new Error(response.data.error || 'Backend import failed');
        }
      }

      // ⚡ OPTIMIZATION: Use bulk import function for Tenant entity (10+ records)
      if (entityName === 'Tenant' && extractedData.length >= 10 && additionalData?.branch_id) {
        const response = await base44.functions.invoke('bulkImportTenants', {
          branch_id: additionalData.branch_id,
          tenants_data: extractedData
        });
        
        if (response.data.success) {
          const s = response.data.summary;
          toast.success(
            `✅ นำเข้าสำเร็จ!\nสร้างใหม่: ${s.tenants_created} คน | อัพเดท: ${s.tenants_updated} คน\nสัญญา: ${s.bookings_created + s.bookings_updated} รายการ`,
            { duration: 6000 }
          );
          setShowDialog(false);
          setExtractedData(null);
          setErrorMessage(null);
          if (onSuccess) onSuccess();
          return;
        }
      }

      // ถ้ามี onImport prop ให้ใช้ตัวนั้นแทน
      if (onImport) {
        await onImport(extractedData);
        setShowDialog(false);
        setExtractedData(null);
        setErrorMessage(null);
        if (onSuccess) onSuccess();
        return;
      }

      console.log('========== IMPORT DEBUG ==========');
      console.log('Importing data...', extractedData.length, 'records');
      console.log('Additional data:', additionalData);
      console.log('Sample records to import (first 2):', JSON.stringify(extractedData.slice(0, 2), null, 2));
      console.log('Entity name:', entityName);
      console.log('==================================');
      
      // ผสม additionalData (เช่น branch_id) เข้าไปในแต่ละ record
      let dataToImport = extractedData.map(record => ({
        ...record,
        ...(additionalData || {})
      }));

      // Transform data if prop provided (e.g. map Thai values to Enums)
      if (onTransformData) {
        dataToImport = dataToImport.map(onTransformData);
      }
      
      console.log('Data to import (first 2):', JSON.stringify(dataToImport.slice(0, 2), null, 2));
      
      if (customImportHandler) {
        await customImportHandler(dataToImport);
      } else {
        await base44.entities[entityName].bulkCreate(dataToImport);
      }
      
      console.log('Import successful');
      toast.success(`นำเข้าข้อมูลสำเร็จ: ${extractedData.length} รายการ`);
      
      setShowDialog(false);
      setExtractedData(null);
      setErrorMessage(null);
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('========== IMPORT ERROR ==========');
      console.error('Import error:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      console.error('==================================');
      toast.error(error.message || "เกิดข้อผิดพลาดในการนำเข้าข้อมูล");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {!hideDownloadTemplate && templateData && Array.isArray(templateData) && templateData.length > 0 && (
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            ดาวน์โหลด Template
          </Button>
        )}
        <Button
          variant={buttonVariant}
          onClick={() => setShowDialog(true)}
          className={buttonClassName || "gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"}
        >
          <Upload className="w-4 h-4" />
          อัปโหลด Excel
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              นำเข้าข้อมูลจาก Excel
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto">
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">ข้อควรทราบ:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>ระบบรองรับไฟล์ <strong>Excel (.xlsx)</strong> และ <strong>CSV (.csv)</strong></li>
                  <li>ควรดาวน์โหลด Template และกรอกข้อมูลตามรูปแบบที่กำหนด</li>
                  <li>ตรวจสอบให้แน่ใจว่าข้อมูลครบถ้วนและถูกต้องก่อนอัปโหลด</li>
                </ul>
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-upload"
                disabled={uploading}
              />
              <label 
                htmlFor="excel-upload" 
                className={`cursor-pointer ${uploading ? 'opacity-50' : ''}`}
              >
                <div className="flex flex-col items-center gap-3">
                  {uploading ? (
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                  ) : (
                    <Upload className="w-12 h-12 text-slate-400" />
                  )}
                  <div>
                    <p className="text-lg font-semibold text-slate-700">
                      {uploading ? 'กำลังอ่านไฟล์...' : 'คลิกเพื่อเลือกไฟล์'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      รองรับ Excel (.xlsx) และ CSV (.csv)
                    </p>
                  </div>
                </div>
              </label>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-red-800 mb-1">เกิดข้อผิดพลาด:</p>
                  <p className="text-sm text-red-700">{errorMessage}</p>
                  <p className="text-xs text-red-600 mt-2">
                    กรุณาตรวจสอบไฟล์ของคุณและลองใหม่อีกครั้ง หรือดาวน์โหลด Template เพื่อดูรูปแบบที่ถูกต้อง
                  </p>
                </div>
              </div>
            )}

            <AnimatePresence>
              {extractedData && extractedData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-800">
                        พบข้อมูล {extractedData.length} รายการ
                      </span>
                    </div>
                  </div>

                  <div className="border rounded-xl overflow-hidden">
                    <div className="bg-slate-50 p-3 border-b">
                      <h4 className="font-semibold text-slate-800">ตัวอย่างข้อมูล</h4>
                    </div>
                    <div className="overflow-x-auto overflow-y-auto max-h-96">
                      <table className="w-full">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr>
                            {Object.keys(extractedData[0] || {}).map((key) => (
                              <th key={key} className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {extractedData.map((row, index) => (
                            <tr key={index} className="border-b hover:bg-slate-50">
                              {Object.values(row).map((value, i) => (
                                <td key={i} className="px-4 py-3 text-sm text-slate-600">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value || '-')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-800">
                      โปรดตรวจสอบข้อมูลให้ถูกต้องก่อนกดปุ่ม "นำเข้าข้อมูล" 
                      ข้อมูลที่นำเข้าแล้วจะถูกบันทึกลงในระบบทันที
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDialog(false);
                setExtractedData(null);
                setErrorMessage(null);
              }}
              disabled={importing}
            >
              ยกเลิก
            </Button>
            {extractedData && extractedData.length > 0 && (
              <Button
                onClick={handleImportClick}
                disabled={importing}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังนำเข้า...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    นำเข้าข้อมูล ({extractedData.length} รายการ)
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}