import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const cmd = new Deno.Command("grep", {
            args: ["-ri", "W RESIDENTS", "/app"],
            stdout: "piped",
            stderr: "piped"
        });
        const output = await cmd.output();
        const stdout = new TextDecoder().decode(output.stdout);
        
        const cmd2 = new Deno.Command("grep", {
            args: ["-ri", "Wresident", "/app"],
            stdout: "piped",
            stderr: "piped"
        });
        const output2 = await cmd2.output();
        const stdout2 = new TextDecoder().decode(output2.stdout);

        return Response.json({ grep1: stdout, grep2: stdout2 });
    } catch (e) {
        return Response.json({ error: e.message });
    }
});