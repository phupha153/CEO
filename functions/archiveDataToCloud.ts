import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Archive ข้อมูลทางการเงินและเอกสารไปยัง Cloud Storage
 * รองรับการ backup ทั้งหมดหรือเฉพาะสาขา พร้อมตัวเลือกลบข้อมูลเก่า
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // ตรวจสอบสิทธิ์ - ต้องเป็น developer เท่านั้น
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
    if (userRole !== 'developer') {
      return Response.json({ error: 'Permission denied. Developer only.' }, { status: 403 });
    }

    const { 
      branch_id, 
      start_date, 
      end_date, 
      include_entities = ['Payment', 'Expense', 'Booking', 'MeterReading', 'MaintenanceRequest', 'Contract'],
      delete_after_archive = false 
    } = await req.json();

    console.log('📦 Starting archive process...', {
      branch_id,
      start_date,
      end_date,
      include_entities,
      delete_after_archive
    });

    // ดึงข้อมูลแต่ละ Entity
    const archiveData = {
      metadata: {
        archived_at: new Date().toISOString(),
        archived_by: user.email,
        branch_id: branch_id || 'all_branches',
        date_range: { start_date, end_date },
        entities: include_entities
      },
      data: {}
    };

    const entitiesToArchive = [];
    const filterQuery = {};
    
    if (branch_id) {
      filterQuery.branch_id = branch_id;
    }

    // ดึงข้อมูลแต่ละ Entity
    for (const entityName of include_entities) {
      try {
        console.log(`📥 Fetching ${entityName}...`);
        
        // ดึงข้อมูลทั้งหมดของ entity นี้
        const allData = await base44.asServiceRole.entities[entityName].list('-created_date', 10000);
        
        // กรองข้อมูลตามเงื่อนไข
        let filteredData = allData;
        
        // กรองตาม branch_id
        if (branch_id) {
          filteredData = filteredData.filter(item => item.branch_id === branch_id);
        }
        
        // กรองตามวันที่ (ใช้ created_date เป็นหลัก)
        if (start_date && end_date) {
          filteredData = filteredData.filter(item => {
            if (!item.created_date) return false;
            const itemDate = new Date(item.created_date);
            return itemDate >= new Date(start_date) && itemDate <= new Date(end_date);
          });
        }
        
        archiveData.data[entityName] = filteredData;
        console.log(`✅ ${entityName}: ${filteredData.length} records`);
        
        // เก็บ ID สำหรับลบทีหลัง
        if (delete_after_archive && filteredData.length > 0) {
          entitiesToArchive.push({
            entityName,
            ids: filteredData.map(item => item.id)
          });
        }
      } catch (error) {
        console.error(`❌ Error fetching ${entityName}:`, error);
        archiveData.data[entityName] = { error: error.message };
      }
    }

    // สร้างไฟล์ JSON
    const archiveJson = JSON.stringify(archiveData, null, 2);
    const blob = new Blob([archiveJson], { type: 'application/json' });
    
    // สร้างชื่อไฟล์
    const branchLabel = branch_id || 'all_branches';
    const dateLabel = start_date && end_date 
      ? `${start_date}_to_${end_date}`.replace(/:/g, '-')
      : new Date().toISOString().split('T')[0];
    const fileName = `archive_${branchLabel}_${dateLabel}.json`;
    
    // อัปโหลดไปยัง Cloud Storage
    const file = new File([blob], fileName, { type: 'application/json' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    
    console.log('☁️ Archived to cloud:', file_url);

    // ลบข้อมูลเก่า (ถ้าเลือก)
    const deletionResults = [];
    if (delete_after_archive && entitiesToArchive.length > 0) {
      console.log('🗑️ Deleting archived data...');
      
      for (const { entityName, ids } of entitiesToArchive) {
        try {
          // ลบทีละรายการ (เพราะ Base44 ไม่มี bulk delete)
          let deletedCount = 0;
          for (const id of ids) {
            try {
              await base44.asServiceRole.entities[entityName].delete(id);
              deletedCount++;
            } catch (error) {
              console.error(`Failed to delete ${entityName} ${id}:`, error.message);
            }
          }
          
          deletionResults.push({
            entity: entityName,
            total: ids.length,
            deleted: deletedCount
          });
          
          console.log(`✅ Deleted ${deletedCount}/${ids.length} ${entityName} records`);
        } catch (error) {
          console.error(`❌ Error deleting ${entityName}:`, error);
          deletionResults.push({
            entity: entityName,
            error: error.message
          });
        }
      }
    }

    // สรุปผลลัพธ์
    const summary = {
      total_records: Object.values(archiveData.data).reduce((sum, entity) => {
        return sum + (Array.isArray(entity) ? entity.length : 0);
      }, 0),
      by_entity: Object.entries(archiveData.data).reduce((acc, [key, value]) => {
        acc[key] = Array.isArray(value) ? value.length : 0;
        return acc;
      }, {})
    };

    return Response.json({
      success: true,
      message: 'Data archived successfully',
      archive_url: file_url,
      summary,
      deletion_results: delete_after_archive ? deletionResults : null,
      metadata: archiveData.metadata
    });

  } catch (error) {
    console.error('❌ Archive error:', error);
    return Response.json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});