import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { walk } from "https://deno.land/std@0.170.0/fs/walk.ts";

Deno.serve(async (req) => {
    try {
        const results = [];
        for await (const entry of walk("/app/pages", { exts: [".js", ".jsx"] })) {
            const content = await Deno.readTextFile(entry.path);
            if (content.includes("ChatSidebar")) {
                results.push(entry.path);
            }
        }
        for await (const entry of walk("/app/components", { exts: [".js", ".jsx"] })) {
            const content = await Deno.readTextFile(entry.path);
            if (content.includes("ChatSidebar")) {
                results.push(entry.path);
            }
        }
        return Response.json({ results });
    } catch (e) {
        return Response.json({ error: e.message });
    }
});