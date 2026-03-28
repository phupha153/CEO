// ⭐ Account matching logic - ยืดหยุ่นตรวจสอบทั้ง bank account และ PromptPay แบบ cross-check
export function verifyAccountMatch(receiverAccount, receiverPromptPay, expectedAccountNumber, expectedPromptPay, isAccountMatch) {
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