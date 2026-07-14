const fs = require('fs');
const readline = require('readline');

async function extract() {
    const fileStream = fs.createReadStream('C:\\Users\\drmah\\.gemini\\antigravity\\brain\\b19c967e-3861-4747-93e6-60905f30babf\\.system_generated\\logs\\transcript.jsonl');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (line.includes('WamanAhyaahaSystem.tsx') && line.includes('VIEW_FILE')) {
            const data = JSON.parse(line);
            console.log(`Step ${data.step_index}: content length = ${data.content ? data.content.length : 0}`);
            if (data.content && data.content.includes('WamanAhyaahaSystemProps')) {
                console.log(`Found step ${data.step_index} with WamanAhyaahaSystemProps`);
                fs.writeFileSync(`scratch_step_${data.step_index}.txt`, data.content);
            }
        }
    }
}

extract();
