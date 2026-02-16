import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('🔍 Debug Test Data - Starting...');

    const entities = [
      { name: 'Branch', fields: ['branch_name', 'branch_code', 'description'] },
      { name: 'Room', fields: ['room_number', 'description'] },
      { name: 'Tenant', fields: ['full_name', 'email', 'notes'] },
      { name: 'Booking', fields: ['notes', 'guest_name'] },
      { name: 'Payment', fields: ['notes'] },
      { name: 'MeterReading', fields: ['notes'] },
      { name: 'MaintenanceRequest', fields: ['title', 'description', 'notes'] }
    ];

    const testPatterns = [
      '[TEST-', 'TEST-', '[test-', 'test-',
      '[HEAVY-', 'HEAVY-', '[heavy-', 'heavy-',
      '[MASSIVE-', 'MASSIVE-', '[massive-', 'massive-',
      'ทดสอบ', 'mass_', 'MASS-'
    ];

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Debug Test Data</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            padding: 20px; 
            background: #f8fafc; 
          }
          .container { max-width: 1200px; margin: 0 auto; }
          h1 { color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
          h2 { color: #475569; background: #e0f2fe; padding: 10px; border-radius: 8px; }
          .entity-section { 
            background: white; 
            margin: 20px 0; 
            padding: 20px; 
            border-radius: 12px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
          }
          .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
            gap: 15px; 
            margin: 15px 0; 
          }
          .stat-box { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 15px; 
            border-radius: 8px; 
            text-align: center; 
          }
          .stat-label { font-size: 12px; opacity: 0.9; }
          .stat-value { font-size: 28px; font-weight: bold; margin-top: 5px; }
          .record { 
            background: #f8fafc; 
            margin: 10px 0; 
            padding: 15px; 
            border-radius: 8px; 
            border-left: 4px solid #3b82f6; 
          }
          .test-record { 
            border-left-color: #ef4444; 
            background: #fef2f2; 
          }
          .field { margin: 5px 0; font-size: 14px; }
          .field-name { 
            color: #64748b; 
            font-weight: 600; 
            display: inline-block; 
            min-width: 120px; 
          }
          .field-value { color: #1e293b; font-family: monospace; }
          .match { 
            background: #fef3c7; 
            padding: 2px 6px; 
            border-radius: 4px; 
            color: #92400e; 
            font-weight: bold; 
          }
          .no-data { 
            text-align: center; 
            color: #64748b; 
            padding: 40px; 
            font-style: italic; 
          }
          .patterns { 
            background: #f1f5f9; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 15px 0; 
          }
          .pattern-list { 
            display: flex; 
            flex-wrap: wrap; 
            gap: 8px; 
            margin-top: 10px; 
          }
          .pattern-tag { 
            background: #6366f1; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-family: monospace; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 Debug: ข้อมูลทดสอบในระบบ</h1>
          
          <div class="patterns">
            <strong>🎯 Patterns ที่กำลังค้นหา:</strong>
            <div class="pattern-list">
              ${testPatterns.map(p => `<span class="pattern-tag">${p}</span>`).join('')}
            </div>
          </div>
    `;

    let totalAll = 0;
    let totalTest = 0;

    for (const entity of entities) {
      const records = await base44.asServiceRole.entities[entity.name].list('-created_date', 100);
      totalAll += records.length;

      const testRecords = records.filter(r => {
        const values = entity.fields.map(f => r[f]).filter(v => v && typeof v === 'string');
        return values.some(v => testPatterns.some(p => v.includes(p)));
      });
      totalTest += testRecords.length;

      html += `
        <div class="entity-section">
          <h2>📦 ${entity.name}</h2>
          <div class="stats">
            <div class="stat-box">
              <div class="stat-label">ทั้งหมด</div>
              <div class="stat-value">${records.length}</div>
            </div>
            <div class="stat-box" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
              <div class="stat-label">ข้อมูลทดสอบ</div>
              <div class="stat-value">${testRecords.length}</div>
            </div>
          </div>
          
          <h3 style="color: #ef4444; margin-top: 20px;">🧪 ข้อมูลทดสอบ (${testRecords.length} รายการ):</h3>
          ${testRecords.length > 0 ? testRecords.slice(0, 5).map(r => {
            let recordHtml = '<div class="record test-record">';
            entity.fields.forEach(field => {
              if (r[field]) {
                const value = String(r[field]);
                const matchedPattern = testPatterns.find(p => value.includes(p));
                const highlightedValue = matchedPattern 
                  ? value.replace(new RegExp(matchedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 
                      match => `<span class="match">${match}</span>`)
                  : value;
                recordHtml += `
                  <div class="field">
                    <span class="field-name">${field}:</span>
                    <span class="field-value">${highlightedValue.substring(0, 100)}</span>
                  </div>
                `;
              }
            });
            recordHtml += '</div>';
            return recordHtml;
          }).join('') : '<div class="no-data">✅ ไม่พบข้อมูลทดสอบ</div>'}
          
          <h3 style="color: #3b82f6; margin-top: 20px;">📋 ข้อมูลทั้งหมด (${records.length} รายการ - แสดง 3 รายการแรก):</h3>
          ${records.length > 0 ? records.slice(0, 3).map(r => {
            let recordHtml = '<div class="record">';
            entity.fields.forEach(field => {
              if (r[field]) {
                recordHtml += `
                  <div class="field">
                    <span class="field-name">${field}:</span>
                    <span class="field-value">${String(r[field]).substring(0, 100)}</span>
                  </div>
                `;
              }
            });
            recordHtml += '</div>';
            return recordHtml;
          }).join('') : '<div class="no-data">ไม่มีข้อมูล</div>'}
        </div>
      `;
    }

    html += `
          <div class="entity-section" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <h2 style="color: white; background: transparent;">📊 สรุปรวม</h2>
            <div class="stats">
              <div class="stat-box" style="background: rgba(255,255,255,0.2);">
                <div class="stat-label">ข้อมูลทั้งหมด</div>
                <div class="stat-value">${totalAll}</div>
              </div>
              <div class="stat-box" style="background: rgba(255,255,255,0.2);">
                <div class="stat-label">ข้อมูลทดสอบ</div>
                <div class="stat-value">${totalTest}</div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('❌ Debug error:', error);
    return new Response(`Error: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
});