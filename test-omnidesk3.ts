import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const settings = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'storage/settings.json'), 'utf8'));

async function testId(caseId: string) {
    const domain = settings.omnidesk_domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const auth = Buffer.from(`${settings.omnidesk_email}:${settings.omnidesk_api_key}`).toString('base64');
    
    console.log(`Fetching from: https://${domain}/api/cases/${caseId}.json`);
    const caseRes = await fetch(`https://${domain}/api/cases/${caseId}.json`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    console.log(caseId, caseRes.status);
    if (!caseRes.ok) console.log(await caseRes.text());
}
testId("234");
testId("323967");
testId("234-323967");
