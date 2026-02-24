import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ExcelUploader from "../shared/ExcelUploader";
import { roomSchema, templateData, templateFilename, transformRoomData } from './RoomImportConfig';

export default function RoomImportDialog({ 
  open, 
  onOpenChange, 
  selectedBranchId, 
  onSuccess 
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>นำเข้าข้อมูลห้องพัก</DialogTitle>
        </DialogHeader>

        <ExcelUploader
          entityName="Room"
          schema={roomSchema}
          templateData={templateData}
          templateFilename={templateFilename}
          useBackendImport={true}
          backendImportFunction="flexibleRoomImport"
          onSuccess={onSuccess}
          additionalData={{ branch_id: selectedBranchId }}
          onTransformData={transformRoomData}
        />
      </DialogContent>
    </Dialog>
  );
}