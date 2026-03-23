import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // ตรวจสอบ Authentication
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ 
                success: false,
                error: 'Unauthorized' 
            }, { status: 401 });
        }

        // ตรวจสอบว่าเป็น developer หรือ owner เท่านั้น
        const userRole = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
        if (userRole !== 'developer' && userRole !== 'owner') {
            return Response.json({ 
                success: false,
                error: 'Forbidden - Only developer and owner can update tenants branch' 
            }, { status: 403 });
        }

        // Parse request body
        const { tenantIds, newBranchId } = await req.json();

        if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
            return Response.json({ 
                success: false,
                error: 'Invalid tenantIds - must be a non-empty array' 
            }, { status: 400 });
        }

        if (!newBranchId || typeof newBranchId !== 'string') {
            return Response.json({ 
                success: false,
                error: 'Invalid newBranchId - must be a string' 
            }, { status: 400 });
        }

        console.log(`🔧 Starting tenant branch update...`);
        console.log(`Total tenants to update: ${tenantIds.length}`);
        console.log(`Target branch: ${newBranchId}`);

        const results = {
            success: [],
            failed: []
        };

        // Update ทีละคนเพื่อหา error ที่ละเอียด
        for (let i = 0; i < tenantIds.length; i++) {
            const tenantId = tenantIds[i];
            try {
                console.log(`Updating tenant ${i + 1}/${tenantIds.length}: ${tenantId}`);
                
                // ใช้ asServiceRole เพื่อ bypass permission
                await base44.asServiceRole.entities.Tenant.update(tenantId, { 
                    branch_id: newBranchId 
                });
                
                results.success.push(tenantId);
                console.log(`✅ Updated tenant ${tenantId} successfully`);
            } catch (error) {
                console.error(`❌ Failed to update tenant ${tenantId}:`, error);
                results.failed.push({
                    tenantId,
                    error: error.message
                });
            }
        }

        console.log('🎯 Update completed:', results);

        if (results.failed.length > 0) {
            return Response.json({
                success: false,
                message: `อัปเดตสำเร็จ ${results.success.length} คน, ล้มเหลว ${results.failed.length} คน`,
                results
            }, { status: 207 }); // 207 = Multi-Status
        }

        return Response.json({
            success: true,
            message: `อัปเดตสำเร็จ ${results.success.length} คน`,
            results
        });

    } catch (error) {
        console.error('❌ Error in updateTenantsBranch:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});