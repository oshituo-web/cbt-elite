import { execSync } from 'child_process';

try {
    const output = execSync('wmic process where "name=\'node.exe\'" get commandline,processid').toString();
    const lines = output.split('\n');
    for (const line of lines) {
        if (line.includes('generate_empty_topics.js')) {
            const pid = line.trim().split(/\s+/).pop();
            console.log(`Killing process ${pid}...`);
            process.kill(pid, 'SIGTERM');
        }
    }
} catch (e) {
    // If WMIC fails, try tasklist
    console.log("WMIC failed or not found, trying alternative...");
    const output = execSync('tasklist /v /fi "IMAGENAME eq node.exe"').toString();
    console.log(output);
}
