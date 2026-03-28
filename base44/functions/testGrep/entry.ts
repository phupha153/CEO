import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const results = [];
        for await (const dirEntry of Deno.readDir("/tmp/src/functions")) {
            if (dirEntry.isFile && dirEntry.name.endsWith('.js')) {
                const content = await Deno.readTextFile(`/tmp/src/functions/${dirEntry.name}`);
                if (content.includes('Config.list()')) {
                    results.push(dirEntry.name);
                }
            }
        }
        return Response.json({ results });
    } catch (e) {
        return Response.json({ error: e.message });
    }
});