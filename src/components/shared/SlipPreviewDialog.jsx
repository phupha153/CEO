import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, ExternalLink, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { useState } from "react";

export default function SlipPreviewDialog({ open, onOpenChange, slipUrl, title = "หลักฐานการโอน" }) {
  const [zoom, setZoom] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!slipUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-slate-50">
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setZoom(z => Math.min(3, z + 0.25))}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <a href={slipUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
              <a href={slipUrl} download>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <Download className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </div>
        </DialogHeader>
        <div className="overflow-auto max-h-[calc(90vh-80px)] bg-slate-100 p-4 flex items-center justify-center">
          <img
            src={slipUrl}
            alt="สลิปการโอนเงิน"
            className="max-w-full rounded-lg shadow-lg transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}