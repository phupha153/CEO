export const getPrintStyles = () => `
  @page {
    size: A4 portrait;
    margin: 0.8cm;
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
      font-size: 12pt !important;
      line-height: 1.4 !important;
    }
    
    .contract-print p,
    .contract-print div,
    .contract-print span {
      font-size: 12pt !important;
      line-height: 1.4 !important;
      margin: 3mm 0 !important;
      padding: 0 !important;
      orphans: 3 !important;
      widows: 3 !important;
    }
    
    .contract-print h1,
    .contract-print h2,
    .contract-print h3 {
      font-size: 13pt !important;
      line-height: 1.3 !important;
      margin: 4mm 0 2mm 0 !important;
      page-break-after: avoid !important;
    }
    
    .contract-print table {
      border-collapse: collapse !important;
      width: 100% !important;
      margin: 2mm 0 !important;
      font-size: 11pt !important;
    }
    
    .contract-print table td,
    .contract-print table th {
      padding: 1mm 2mm !important;
      border: 0.5pt solid #ccc !important;
    }
    
    .contract-print ul,
    .contract-print ol {
      margin: 2mm 0 2mm 8mm !important;
      padding-left: 0 !important;
      font-size: 12pt !important;
    }
    
    .contract-print li {
      margin: 1mm 0 !important;
      line-height: 1.4 !important;
    }
    
    .contract-page {
      page-break-after: always !important;
      page-break-inside: avoid !important;
      display: block !important;
      width: 210mm !important;
      min-height: 297mm !important;
      margin: 0 !important;
      padding: 12mm 12mm 16mm 12mm !important;
      background: white !important;
      box-sizing: border-box !important;
      overflow: visible !important;
    }
    
    .contract-page:last-child {
      page-break-after: avoid !important;
      min-height: auto !important;
    }
  }
  
  .contract-print {
    font-family: 'TH Sarabun New', 'Sarabun', sans-serif;
    background: white;
    width: 210mm;
    margin: 20px auto;
    font-size: 12pt;
    line-height: 1.4;
  }
  
  .contract-print p,
  .contract-print div {
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: keep-all;
    font-size: 12pt;
    line-height: 1.4;
  }
  
  .contract-print h1,
  .contract-print h2,
  .contract-print h3 {
    font-size: 13pt;
    line-height: 1.3;
    margin: 4mm 0 2mm 0;
  }

  .contract-page {
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    margin-bottom: 20px;
    width: 210mm;
    min-height: 297mm;
  }
`;