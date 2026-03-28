import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // ตรวจสอบว่า user login แล้วหรือยัง
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ 
        hasAccess: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // ⭐ รับอีเมลที่ต้องการเช็คจาก parameter (ถ้าไม่ส่งมาให้ใช้อีเมลของผู้ login)
    const payload = await req.json().catch(() => ({}));
    const userEmail = payload.email || user.email;
    
    // เก็บข้อมูล debug
    const debugInfo = {
      loggedInEmail: user.email,
      checkingEmail: userEmail,
      userRole: user.custom_role || (user.role === 'admin' ? 'owner' : 'employee'),
      isParameterProvided: !!payload.email,
      timestamp: new Date().toISOString()
    };

    console.log('🔍 CRM Access Check:', debugInfo);

    // เรียก CRM API เพื่อเช็คว่าอีเมลนี้มีสิทธิ์หรือไม่
    const CRM_API_KEY = Deno.env.get('CRM_API_KEY');
    const CRM_APP_ID = Deno.env.get('CRM_APP_ID');
    const CRM_SERVICE_ROLE_KEY = Deno.env.get('CRM_SERVICE_ROLE_KEY');
    
    if (!CRM_API_KEY || !CRM_APP_ID || !CRM_SERVICE_ROLE_KEY) {
      console.error('Missing CRM configuration');
      return Response.json({ 
        hasAccess: false, 
        error: 'ไม่พบการตั้งค่า CRM - กรุณาติดต่อผู้ดูแลระบบ' 
      }, { status: 200 });
    }

    // 1️⃣ เช็คจาก Employee entity ใน CRM ก่อน (ใช้ service role key)
    try {
      const { createClient } = await import('npm:@base44/sdk@0.8.19');
      const crmClient = createClient({
        appId: CRM_APP_ID,
        serviceRoleKey: CRM_SERVICE_ROLE_KEY,
        baseURL: 'https://app.base44.com'
      });

      const employees = await crmClient.entities.Employee.filter({ email: userEmail });
      
      console.log('📊 CRM Employee Table Result:', {
        email: userEmail,
        found: employees?.length > 0,
        count: employees?.length || 0,
        data: employees?.map(e => ({ email: e.email, full_name: e.full_name, role: e.custom_role }))
      });
      
      if (employees && employees.length > 0) {
        const crmRole = employees[0].custom_role || employees[0].role || 'owner';
        console.log('✅ Found in CRM Employee table:', userEmail);
        console.log('🔑 CRM Role:', crmRole, '| Full Data:', employees[0]);
        return Response.json({ 
          hasAccess: true,
          email: userEmail,
          role: crmRole, // ⭐ ส่ง role กลับมาด้วย
          accessible_branches: employees[0].accessible_branches || [], // ⭐ ส่ง accessible_branches
          message: '✅ พบข้อมูลใน Employee Table ของ CRM',
          source: 'employee_table',
          employee: {
            full_name: employees[0].full_name,
            custom_role: employees[0].custom_role,
            role: employees[0].role,
            accessible_branches: employees[0].accessible_branches
          },
          debug: {
            ...debugInfo,
            employeeCount: employees.length,
            extractedRole: crmRole
          }
        });
      }
    } catch (error) {
      console.error('❌ Error checking Employee table:', error);
      debugInfo.employeeTableError = error.message;
    }

    // 2️⃣ ถ้าไม่เจอใน Employee table ให้เช็คที่ Customer API
    console.log('🔄 Calling CRM API with email:', userEmail);

    // 🔒 Security: เพิ่ม timeout protection (8 วินาที)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const crmResponse = await fetch(
      'https://connect-sphere-crm-8aa1f2d8.base44.app/api/apps/6919c20da02654368aa1f2d8/functions/getCustomers',
      {
        method: 'POST',
        headers: {
          'api_key': CRM_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: userEmail }),
        signal: controller.signal
      }
    ).finally(() => clearTimeout(timeoutId));

    console.log('📡 CRM Response Status:', crmResponse.status);

    if (!crmResponse.ok) {
      const errorText = await crmResponse.text();
      console.error('❌ CRM API error:', errorText);
      return Response.json({ 
        hasAccess: false, 
        email: userEmail,
        error: `ไม่สามารถเชื่อมต่อ CRM ได้ (${crmResponse.status})`,
        debug: {
          ...debugInfo,
          url: 'getCustomers API',
          status: crmResponse.status,
          errorText: errorText,
          email: userEmail
        }
      }, { status: 200 });
    }

    const crmData = await crmResponse.json();

    console.log('📊 CRM Raw Response:', JSON.stringify(crmData, null, 2));
    
    // ⭐ เช็ค structure ที่ CRM ส่งมา
    if (crmData?.employee) {
      console.log('🔍 CRM sent nested employee:', crmData.employee);
    }

    // ⭐ CRM อาจส่งกลับมาเป็น "users", "employees", "customers" หรือ nested "employee"
    const users = crmData?.users || [];
    const employees = crmData?.employees || [];
    const customers = crmData?.customers || [];
    
    // ⭐ ถ้า CRM ส่งมาแบบ nested {employee: {...}} (single object)
    if (crmData?.employee) {
      employees.push(crmData.employee);
    }

    // รวมทั้งหมด
    const allUsers = [...users, ...employees, ...customers];

    console.log('📊 CRM API Response:', {
      success: crmResponse.ok,
      hasUsersArray: !!crmData?.users,
      hasEmployeesArray: !!crmData?.employees,
      hasCustomersArray: !!crmData?.customers,
      totalUsers: users.length,
      totalEmployees: employees.length,
      totalCustomers: customers.length,
      allCount: allUsers.length,
      allEmails: allUsers.map(u => u.email),
      allKeys: Object.keys(crmData || {})
    });

    // ⭐ เช็คจากทุก array
    const foundUser = allUsers.find(user => 
      user.email?.toLowerCase() === userEmail.toLowerCase()
    );

    if (foundUser) {
      console.log('✅ Found in CRM API:', userEmail);
      console.log('🔑 CRM User Data:', foundUser);
    } else {
      console.log('❌ NOT FOUND in CRM - Email:', userEmail);
    }

    // ⭐ ดึง role จาก custom_role หรือ role (รองรับทั้ง 2 field)
    const crmRole = foundUser?.custom_role || foundUser?.role || 'owner';
    console.log('🎯 Extracted Role:', crmRole, '| From:', foundUser ? 'custom_role=' + foundUser.custom_role + ', role=' + foundUser.role : 'N/A');

    return Response.json({ 
      hasAccess: !!foundUser,
      email: userEmail,
      role: crmRole, // ⭐ ส่ง role จาก CRM (รองรับทั้ง custom_role และ role)
      accessible_branches: foundUser?.accessible_branches || [], // ⭐ ส่ง accessible_branches
      message: foundUser 
        ? '✅ พบข้อมูลใน CRM API' 
        : '⚠️ ไม่พบอีเมลในระบบ CRM - กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มสิทธิ์',
      source: foundUser ? 'customer_api' : null,
      debug: {
        ...debugInfo,
        totalUsers: users.length,
        totalEmployees: employees.length,
        totalCustomers: customers.length,
        allEmails: allUsers.map(u => u.email),
        crmResponseOk: crmResponse.ok,
        crmRawData: crmData,
        searchingFor: userEmail.toLowerCase(),
        extractedRole: crmRole,
        foundUserData: foundUser
      }
    });

  } catch (error) {
    console.error('Error checking CRM access:', error);
    
    // 🔒 Security: Timeout = DENY access
    if (error.name === 'AbortError') {
      console.error('⏱️ CRM Timeout - DENYING access');
      return Response.json({ 
        hasAccess: false, 
        timeout: true,
        error: 'CRM timeout - please try again' 
      }, { status: 200 });
    }
    
    return Response.json({ 
      hasAccess: false, 
      error: error.message 
    }, { status: 500 });
  }
});