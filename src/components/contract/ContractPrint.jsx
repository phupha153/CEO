import React from "react";

export default function ContractPrint({ printMode, content }) {
  return (
    <div className="contract-print">
      <style>{`
        /* Control visibility based on selected mode (Screen & Print) */
        ${printMode === 'page1' ? '.contract-page:not(:nth-of-type(1)) { display: none !important; }' : ''}
        ${printMode === 'page2' ? '.contract-page:not(:nth-of-type(2)) { display: none !important; }' : ''}
        ${printMode === 'page3' ? '.contract-page:not(:nth-of-type(3)) { display: none !important; }' : ''}

        @page {
          size: A4 portrait;
          margin: 0;
        }
        
        @media print {
          * { 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          html, body { 
            margin: 0 !important; 
            padding: 0 !important;
            width: 100% !important;
          }
          
          .no-print,
          aside, 
          nav, 
          [role="navigation"], 
          [data-sidebar], 
          .sidebar, 
          header {
            display: none !important;
          }
          
          .ql-toolbar,
          .ql-container .ql-tooltip { 
            display: none !important; 
          }
          
          #root, main { 
            display: block !important;
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important;
            width: 100% !important;
            height: auto !important;
          }
          
          .contract-print {
            display: block !important;
            width: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          
          .contract-page {
            page-break-after: always !important;
            page-break-inside: avoid !important;
            display: block !important;
            width: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 1.5cm 1.5cm 2cm 1.5cm !important;
            background: white !important;
            box-sizing: border-box !important;
            overflow: visible !important;
          }
          
          .contract-page:last-child {
            page-break-after: avoid !important;
          }
        }
        
        .contract-print {
          font-family: 'TH Sarabun New', 'Sarabun', sans-serif;
          background: white;
          width: 21cm;
          margin: 20px auto;
        }
        
        .contract-page {
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }

        .contract-print p,
        .contract-print div {
          word-wrap: break-word;
          overflow-wrap: break-word;
          word-break: keep-all;
        }
      `}</style>

      <div dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}