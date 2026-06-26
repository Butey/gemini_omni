import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const settings = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'storage/settings.json'), 'utf8'));

async function fetchOmnideskTicketContext(caseNumber: string) {
  const caseIdMatch = caseNumber.match(/([0-9-]+)$/);
  const caseId = caseIdMatch[1];
  const domain = settings.omnidesk_domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const auth = Buffer.from(`${settings.omnidesk_email}:${settings.omnidesk_api_key}`).toString('base64');
  
  const msgsRes = await fetch(`https://${domain}/api/cases/${caseId}/messages.json`, {
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000)
  });
  console.log('msgsRes status:', msgsRes.status);
  let description = '';
  if (msgsRes.ok) {
    const msgsData = await msgsRes.json();
    console.log(JSON.stringify(msgsData).substring(0, 500));
  }
}

fetchOmnideskTicketContext("234-323967");
