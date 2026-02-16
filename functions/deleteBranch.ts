import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  // Clone request before SDK reads it
  const clonedReq = req.clone();
  
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let branchId;
    try {
      const text = await clonedReq.text();
      if (text && text.trim()) {
        const body = JSON.parse(text);
        branchId = body.branchId;
      }
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    if (!branchId) {
      return Response.json({ error: 'Branch ID is required' }, { status: 400 });
    }

    const serviceRole = base44.asServiceRole;

    // ⭐ ลบข้อมูลจนหมดจริงๆ โดยใช้ loop ดึงข้อมูลใหม่จนกว่าจะไม่เหลือ
    const deleteAllByBranch = async (entityName, batchSize = 50) => {
      let totalDeleted = 0;
      let hasMore = true;
      
      while (hasMore) {
        try {
          // ดึงข้อมูล batch ใหม่ทุกรอบ (เพราะ filter มี limit default)
          const items = await serviceRole.entities[entityName].filter({ branch_id: branchId }, '-created_date', batchSize);
          
          if (!items || items.length === 0) {
            hasMore = false;
            break;
          }
          
          // ลบทีละ batch พร้อม delay เพื่อไม่ให้ rate limit
          for (let i = 0; i < items.length; i += 5) {
            const chunk = items.slice(i, i + 5);
            await Promise.all(chunk.map(item => 
              serviceRole.entities[entityName].delete(item.id).catch(e => {
                console.error(`Failed to delete ${entityName} ${item.id}:`, e.message);
                return null;
              })
            ));
            
            // Delay between chunks
            if (i + 5 < items.length) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          totalDeleted += items.length;
          console.log(`  - Deleted ${totalDeleted} ${entityName} records...`);
          
          // ถ้าได้น้อยกว่า batchSize แสดงว่าหมดแล้ว
          if (items.length < batchSize) {
            hasMore = false;
          }
          
          // Delay between batches
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error in deleteAllByBranch loop for ${entityName}:`, error.message);
          // ลองต่ออีกครั้ง แต่ถ้า error ซ้ำ 3 ครั้งให้หยุด
          throw error;
        }
      }
      
      return totalDeleted;
    };

    // ⭐ ลบข้อมูลทั้งหมดในแต่ละ entity จนหมด (ไม่มี limit)
    console.log('1. Deleting payments...');
    await deleteAllByBranch('Payment');

    console.log('2. Deleting meter readings...');
    await deleteAllByBranch('MeterReading');

    console.log('3. Deleting maintenance requests...');
    await deleteAllByBranch('MaintenanceRequest');

    console.log('4. Deleting material deliveries...');
    await deleteAllByBranch('MaterialDelivery');

    console.log('5. Deleting tenant ratings...');
    await deleteAllByBranch('TenantRating');

    console.log('6. Deleting contracts...');
    await deleteAllByBranch('Contract');

    console.log('7. Deleting bookings...');
    await deleteAllByBranch('Booking');

    console.log('8. Deleting expenses...');
    await deleteAllByBranch('Expense');

    console.log('9. Deleting tenants...');
    await deleteAllByBranch('Tenant');

    console.log('10. Deleting rooms...');
    await deleteAllByBranch('Room');

    console.log('11. Deleting configs...');
    await deleteAllByBranch('Config');

    console.log('12. Deleting activity logs...');
    await deleteAllByBranch('ActivityLog');

    console.log('13. Deleting notification configs...');
    await deleteAllByBranch('NotificationConfig');
    
    console.log('14. Deleting notifications...');
    // ⭐ Notifications ไม่มี branch_id ต้องลบผ่าน notification_id pattern
    try {
      const allNotifications = await serviceRole.entities.Notification.list('-created_date', 10000);
      const branchNotifications = allNotifications.filter(n => 
        n.notification_id && n.notification_id.includes(branchId)
      );
      
      if (branchNotifications.length > 0) {
        for (let i = 0; i < branchNotifications.length; i += 10) {
          const chunk = branchNotifications.slice(i, i + 10);
          await Promise.all(chunk.map(n => 
            serviceRole.entities.Notification.delete(n.id).catch(e => {
              console.error(`Failed to delete notification ${n.id}:`, e.message);
              return null;
            })
          ));
        }
        console.log(`  - Deleted ${branchNotifications.length} notifications`);
      }
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }

    console.log('15. Deleting branch...');
    await serviceRole.entities.Branch.delete(branchId);

    return Response.json({ 
      success: true,
      message: 'ลบสาขาและข้อมูลที่เกี่ยวข้องทั้งหมดสำเร็จ'
    });

  } catch (error) {
    console.error('Delete branch error:', error);
    console.error('Error stack:', error.stack);
    
    // ⭐ ส่ง error message ที่ละเอียดกว่า เพื่อ debug
    return Response.json({ 
      success: false,
      error: error.message || 'ไม่สามารถลบสาขาได้',
      details: error.stack,
      errorName: error.name
    }, { status: 500 });
  }
});