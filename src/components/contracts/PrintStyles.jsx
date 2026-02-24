
export const getPrintStyles = () => `
  @page {
    size: A4 portrait;
    margin: 1cm;
  }
  
  @media print {
    * { 
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    html, body { 
      margin: 0 !important; 
      padding: 0 !important;
      width: 210mm !important;
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
      width: 210mm !important;
      height: auto !important;
    }
    
    .contract-print {
      display: block !important;
      width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: white !important;
    }
    
    .contract-page {
      page-break-after: always !important;
      page-break-inside: avoid !important;
      display: block !important;
      width: 210mm !important;
      height: 297mm !important;
      margin: 0 !important;
      padding: 15mm 15mm 20mm 15mm !important;
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
    width: 210mm;
    margin: 20px auto;
  }
  
  .contract-page {
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    margin-bottom: 20px;
    width: 210mm;
    height: 297mm;
  }

  .contract-print p,
  .contract-print div {
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: keep-all;
  }
`;
