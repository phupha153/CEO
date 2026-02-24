import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ContractActionsBar({ canAddContract, isDeveloper }) {
  const navigate = useNavigate();

  if (!canAddContract) return null;

  return (
    <Button
      onClick={() => navigate(createPageUrl('ContractEditor'))}
      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
      disabled={!isDeveloper}
    >
      <Plus className="w-5 h-5 mr-2" />
      สร้างสัญญาใหม่
    </Button>
  );
}