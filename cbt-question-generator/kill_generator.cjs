const { execSync } = require('child_process');

try {
    // Try to find the PID using Get-CimInstance which is more reliable on modern Windows than WMIC
    const psCmd = 'powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like \'*generate_empty_topics.js*\' } | Select-Object ProcessId"';
    const output = execSync(psCmd).toString();
    const match = output.match(/\d+/);
    if (match) {
        const pid = match[0];
        console.log(`Found PID ${pid}. Killing...`);
        execSync(`taskkill /f /pid ${pid}`);
        console.log("Process terminated.");
    } else {
        console.log("Could not find process via PowerShell. Trying tasklist...");
        const tlOutput = execSync('tasklist /v /fi "IMAGENAME eq node.exe"').toString();
        console.log("Check this list manually or try again:");
        console.log(tlOutput);
    }
} catch (e) {
    console.error("Error:", e.message);
}
