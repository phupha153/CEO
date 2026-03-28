// ⭐ Helper function สำหรับตรวจสอบเลขบัญชีแบบยืดหยุ่น (cross-check ทุก combination)
// สำหรับใช้ใน lineWebhookHandler.js

// Copy isAccountMatch logic จาก lineWebhookHandler
function isAccountMatch(m, r) {
    if(!m||!r) return false;
    let s = String(m).replace(/[- ]/g,'').toLowerCase();
    let a = String(r).replace(/[- ]/g,'').toLowerCase();
    if(s.startsWith('66')&&s.length===11) s='0'+s.slice(2);
    if(a.startsWith('66')&&a.length===11) a='0'+a.slice(2);
    let c=0, i=s.length-1, j=a.length-1;
    while(i>=0&&j>=0){
        if(s[i]==='x'||s[i]==='*'){i--;j--;continue;}
        if(s[i]===a[j]){c++;i--;j--;}else return false;
    }
    return c>=(s.replace(/[x*]/g,'').length<=3?2:3);
}

export function verifyAccountMatch(receiverAccount, receiverPromptPay, expectedAccountNumber, expectedPromptPay) {
    const combinationsToCheck = [
        { receiver: receiverAccount, expected: expectedAccountNumber, name: 'Bank Account' },
        { receiver: receiverAccount, expected: expectedPromptPay, name: 'Account (vs PromptPay config)' },
        { receiver: receiverPromptPay, expected: expectedPromptPay, name: 'PromptPay' },
        { receiver: receiverPromptPay, expected: expectedAccountNumber, name: 'PromptPay (vs Bank Account config)' }
    ];

    for (const combo of combinationsToCheck) {
        if (combo.receiver && combo.expected && isAccountMatch(combo.receiver, combo.expected)) {
            return { match: true, method: combo.name };
        }
    }

    return { match: false, method: '' };
}