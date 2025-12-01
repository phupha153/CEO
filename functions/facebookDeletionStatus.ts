Deno.serve(async (req) => {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');

    const html = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>สถานะการลบข้อมูล</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .card {
            background: white;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
            width: 90%;
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #1a1a2e;
            margin-bottom: 15px;
            font-size: 24px;
        }
        p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .code {
            background: #f0f0f0;
            padding: 15px;
            border-radius: 10px;
            font-family: monospace;
            font-weight: bold;
            color: #1877f2;
            margin: 20px 0;
            word-break: break-all;
        }
        .status {
            background: #e8f5e9;
            color: #2e7d32;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">✅</div>
        <h1>คำขอลบข้อมูลได้รับการดำเนินการแล้ว</h1>
        <p>
            ข้อมูลของคุณที่เกี่ยวข้องกับ Facebook ได้ถูกลบออกจากระบบของเราเรียบร้อยแล้ว
        </p>
        <div class="status">
            สถานะ: ดำเนินการเสร็จสิ้น
        </div>
        ${code ? `
        <div class="code">
            รหัสยืนยัน:<br>
            ${code}
        </div>
        ` : ''}
        <p style="font-size: 14px; color: #999; margin-top: 30px;">
            หากมีข้อสงสัย กรุณาติดต่อทีมสนับสนุนของเรา
        </p>
    </div>
</body>
</html>
    `;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
});