import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function testUnsupported() {
  // Step 1: Create a real audit session on :3005
  const createResp = await fetch('http://localhost:3005/api/sessions/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: 'audit_lang_unsupported_test',
      language: 'en'
    })
  });
  const sessionData = await createResp.json();
  const sessionId = sessionData.sessionId;
  console.log(`Created session ${sessionId}`);

  const testCodes = ['sa', 'kok', 'sat', 'hi'];
  const results = {};

  for (const code of testCodes) {
    try {
      const resp = await fetch('http://localhost:3005/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Hello world, welcome to BharatBridge.',
          sourceLanguage: 'en',
          targetLanguage: code,
          sessionId: sessionId
        })
      });

      const data = await resp.json();
      results[code] = {
        status: resp.status,
        data
      };
      console.log(`[Translate API] target=${code}: status=${resp.status}, response=`, data);
    } catch (err) {
      results[code] = { error: err.message };
      console.log(`[Translate API] target=${code}: error=${err.message}`);
    }
  }

  // Also test Azure Translator direct call for 'sa', 'kok', 'sat'
  const key = process.env.AZURE_TRANSLATOR_KEY || '';
  const region = process.env.AZURE_TRANSLATOR_REGION || 'centralindia';

  for (const code of ['sa', 'kok', 'sat', 'gom']) {
    try {
      const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=${code}`;
      const azureResp = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Ocp-Apim-Subscription-Region': region,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{ Text: 'Hello world' }])
      });
      const azureData = await azureResp.json();
      results[`azure_direct_${code}`] = {
        status: azureResp.status,
        data: azureData
      };
      console.log(`[Azure Direct] code=${code}: status=${azureResp.status}, data=`, JSON.stringify(azureData));
    } catch (e) {
      results[`azure_direct_${code}`] = { error: e.message };
    }
  }

  return results;
}

testUnsupported().then(r => {
  console.log("Finished testing unsupported languages.");
}).catch(console.error);
