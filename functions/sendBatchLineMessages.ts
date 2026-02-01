import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async (fn, maxRetries = 5, baseDelay = 2000) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRateLimit = error.message?.includes('429') || 
                         error.message?.includes('Too Many Requests') || 
                         error.message?.includes('Rate limit') ||
                         error.message?.includes('fetch failed'); // Network glitches
      
      if (isRateLimit) {
        const waitTime = baseDelay * Math.pow(2, i);
        console.log(`⚠️ Rate limit/Network error. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

async function getLineToken(base44, configs, branchId = null) {
    try {
        // 1. ลองหา token เฉพาะสาขา
        if (branchId) {
            const branchToken = configs.find(c => c.key === 'line_channel_access_token' && c.branch_id === branchId);
            if (branchToken?.value?.trim()) {
                return branchToken.value.trim();
            }
        }
        
        // 2. หา global token
        const globalToken = configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
        if (globalToken?.value?.trim()) {
            return globalToken.value.trim();
        }
        
        // 3. Fallback environment variable
        const envToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
        if (envToken?.trim()) {
            return envToken.trim();
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error fetching LINE token:', error);
        return null;
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // ⭐ ฟังก์ชันนี้เป็น internal utility - ไม่ตรวจสอบแพ็กเกจ
        // (ให้ entry point functions เช่น sendPaymentReminder เช็คแทน)

        const { recipients, options = {} } = await req.json();

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return Response.json({ 
                error: 'recipients array is required and must not be empty' 
            }, { status: 400 });
        }

        // Fetch Configs once
        const configs = await base44.asServiceRole.entities.Config.list();
        
        const getConfigValue = (key, defaultValue, branchId = null) => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig ? globalConfig.value : defaultValue;
        };

        // Group by branch
        const recipientsByBranch = new Map();
        const results = {
            total: recipients.length,
            success: 0,
            failed: 0,
            errors: [],
            details: []
        };
        
        for (const recipient of recipients) {
            const branchId = recipient.branchId || recipient.metadata?.branchId;
            if (!branchId) {
                const errMsg = `No branch_id for recipient ${recipient.lineUserId}`;
                console.error(`❌ ${errMsg}`);
                results.errors.push({
                    lineUserId: recipient.lineUserId,
                    error: errMsg
                });
                results.failed++;
                continue;
            }
            if (!recipientsByBranch.has(branchId)) {
                recipientsByBranch.set(branchId, []);
            }
            recipientsByBranch.get(branchId).push(recipient);
        }
        
        console.log(`📊 Grouped recipients by branch: ${recipientsByBranch.size} branches`);

        // Process by Branch
        for (const [branchId, branchRecipients] of recipientsByBranch) {
            console.log(`🔍 Processing branch: ${branchId}, checking token...`);
            const token = await getLineToken(base44, configs, branchId);
            if (!token) {
                const errMsg = `No LINE Token found for branch ${branchId}`;
                console.error(`❌ ${errMsg}`);
                branchRecipients.forEach(r => {
                    results.errors.push({ lineUserId: r.lineUserId, error: errMsg, branchId });
                    results.failed++;
                });
                continue;
            }
            console.log(`✅ Token found for branch ${branchId} (${token.substring(0, 20)}...)`);
            console.log(`📤 Sending ${branchRecipients.length} messages for branch ${branchId}`);

            // Get Rate Limit Settings from Config (Priority: Config > Options > Default)
            const batchSize = parseInt(getConfigValue('line_batch_size', options.batchSize || '20', branchId));
            const delayBetweenBatches = parseInt(getConfigValue('line_batch_delay_ms', options.delayBetweenBatches || '2000', branchId));
            const delayBetweenMessages = parseInt(getConfigValue('line_message_delay_ms', options.delayBetweenMessages || '100', branchId));
            const retryAttempts = parseInt(getConfigValue('line_max_retries', options.retryAttempts || '3', branchId));

            console.log(`🚀 Sending to Branch ${branchId}: ${branchRecipients.length} recipients`);
            console.log(`⚙️ Config: Batch=${batchSize}, BatchDelay=${delayBetweenBatches}ms, MsgDelay=${delayBetweenMessages}ms`);

            // Create Batches
            const batches = [];
            for (let i = 0; i < branchRecipients.length; i += batchSize) {
                batches.push(branchRecipients.slice(i, i + batchSize));
            }

            for (let bIdx = 0; bIdx < batches.length; bIdx++) {
                const batch = batches[bIdx];
                
                // Send batch messages concurrently
                const batchPromises = batch.map(async (recipient, idx) => {
                    // Stagger messages
                    await delay(idx * delayBetweenMessages);

                    return await retryOperation(async () => {
                        const messages = [{ type: 'text', text: recipient.message }];
                        const response = await fetch('https://api.line.me/v2/bot/message/push', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                to: recipient.lineUserId,
                                messages: messages
                            })
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || `HTTP ${response.status}`);
                        }
                        return { success: true, lineUserId: recipient.lineUserId };
                    }, retryAttempts, 1000);
                }).map(p => p.catch(e => ({ success: false, lineUserId: null, error: e.message })));

                const batchResults = await Promise.all(batchPromises);
                
                batchResults.forEach(res => {
                    if (res.success) results.success++;
                    else {
                        results.failed++;
                        results.errors.push({ error: res.error });
                    }
                });

                // Delay between batches
                if (bIdx < batches.length - 1) {
                    await delay(delayBetweenBatches);
                }
            }
        }

        return Response.json({
            success: true,
            message: `Sent ${results.success}/${results.total}`,
            ...results
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});