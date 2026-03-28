import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

        // Fetch Configs once (using filter to get all necessary configs)
        const branchIds = [...new Set(recipients.map(r => r.branchId || r.metadata?.branchId).filter(Boolean))];
        const globalConfigsPromise = base44.asServiceRole.entities.Config.filter({ branch_id: null }, '', 1000);
        const branchConfigsPromises = branchIds.map(id => base44.asServiceRole.entities.Config.filter({ branch_id: id }, '', 1000));
        
        const allConfigResults = await Promise.all([globalConfigsPromise, ...branchConfigsPromises]);
        const configs = allConfigResults.flat();
        
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
                results.errors.push({
                    lineUserId: recipient.lineUserId,
                    error: 'No branch_id provided',
                    metadata: recipient.metadata
                });
                results.failed++;
                continue;
            }
            if (!recipientsByBranch.has(branchId)) {
                recipientsByBranch.set(branchId, []);
            }
            recipientsByBranch.get(branchId).push(recipient);
        }

        // Process by Branch
         for (const [branchId, branchRecipients] of recipientsByBranch) {
              const token = await getLineToken(base44, configs, branchId);
              console.log(`🔍 getLineToken check: branchId=${branchId.substring(0, 8)}... | token exists? ${!!token} | token length=${token?.length || 0}`);

              if (!token) {
                  // ⭐ DEBUG: เช็ค configs
                  const branchSpecific = configs.find(c => c.key === 'line_channel_access_token' && c.branch_id === branchId);
                  const globalConfig = configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
                  const envToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');

                  console.error(`❌ CRITICAL: No LINE token found for branch ${branchId.substring(0, 8)}...`);
                  console.error(`   Branch-specific config: ${branchSpecific ? 'YES (value=' + (branchSpecific.value?.substring(0, 10) || 'EMPTY') + '...)' : 'NO'}`);
                  console.error(`   Global config: ${globalConfig ? 'YES (value=' + (globalConfig.value?.substring(0, 10) || 'EMPTY') + '...)' : 'NO'}`);
                  console.error(`   ENV variable: ${envToken ? 'YES (length=' + envToken.length + ')' : 'NO'}`);
                  console.error(`   Recipients affected: ${branchRecipients.length}`);

                  branchRecipients.forEach(r => {
                      results.errors.push({ lineUserId: r.lineUserId, error: 'No LINE Token found' });
                      results.failed++;
                  });
                  continue;
              }

              console.log(`✅ LINE token found for branch ${branchId.substring(0, 8)}... (length: ${token.length})`);

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
                        if (recipient.imageUrl) {
                            messages.push({
                                type: 'image',
                                originalContentUrl: recipient.imageUrl,
                                previewImageUrl: recipient.imageUrl
                            });
                        }
                        const payload = {
                            to: recipient.lineUserId,
                             messages: messages
                         };
                         const authHeader = `Bearer ${token}`;

                         // ⭐ DEBUG: Log request details
                         console.log(`📤 LINE API Request for ${recipient.lineUserId?.substring(0, 10) || 'UNKNOWN'}...:`);
                         console.log(`   to: ${recipient.lineUserId ? '✅' : '❌'} (${recipient.lineUserId || 'NULL/UNDEFINED'})`);
                         console.log(`   Authorization: Bearer ${token?.substring(0, 15) || 'EMPTY'}...${token?.substring(token.length - 5) || ''}`);
                         console.log(`   Body: ${JSON.stringify(payload)}`);

                         const response = await fetch('https://api.line.me/v2/bot/message/push', {
                             method: 'POST',
                             headers: {
                                 'Content-Type': 'application/json',
                                 'Authorization': authHeader
                             },
                             body: JSON.stringify(payload)
                         });

                         if (!response.ok) {
                              const errorData = await response.json();
                              let errorMsg = errorData.message || `HTTP ${response.status}`;
                              if (errorData.details && Array.isArray(errorData.details)) {
                                  errorMsg += ` - ${errorData.details.map(d => d.property + ': ' + d.message).join(', ')}`;
                              }
                              console.error(`❌ LINE API Error for ${recipient.lineUserId}: ${errorMsg}`);
                              console.error(`   Error detail: ${JSON.stringify(errorData)}`);
                              throw new Error(errorMsg);
                          }
                          console.log(`✅ LINE sent to ${recipient.lineUserId.substring(0, 10)}...`);
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