import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { List, Plus, Save, Trash2 } from "lucide-react";
import ReactQuill from 'react-quill';

export default function ClausesEditor({
  formData,
  handleAddClause,
  handleRemoveClause,
  handleUpdateClause,
  generateTemplate,
  toast
}) {
  return (
    <Card className="mb-4 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="w-5 h-5 text-blue-600" />
            แก้ไขข้อสัญญา ({formData.contract_clauses.length} ข้อ)
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAddClause}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              เพิ่มข้อใหม่
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                generateTemplate();
                toast.success('บันทึกการแก้ไขข้อสัญญาสำเร็จ');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="w-4 h-4 mr-1" />
              บันทึกการแก้ไข
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
        {formData.contract_clauses.map((clause, index) => (
          <div key={index} className="bg-white p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <Label className="font-semibold text-blue-900">ข้อ {clause.clause_number}</Label>
              {formData.contract_clauses.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleRemoveClause(index)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Input
              placeholder="หัวข้อข้อสัญญา (ถ้ามี)"
              value={clause.title || ''}
              onChange={(e) => handleUpdateClause(index, 'title', e.target.value)}
              className="mb-2"
            />
            <ReactQuill
              theme="snow"
              value={clause.content}
              onChange={(value) => handleUpdateClause(index, 'content', value)}
              modules={{ toolbar: [['bold', 'italic', 'underline']] }}
              style={{ backgroundColor: 'white' }}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}