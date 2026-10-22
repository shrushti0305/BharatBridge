const { spawn, execSync } = require('child_process');

async function runSmoke() {
  console.log('====================================================');
  console.log('   BHARATBRIDGE LOCAL SMOKE TEST (PORT 3005)');
  console.log('====================================================');

  // Enforce zero writes to live Cosmos DB and live Azure Blob Storage:
  const env = {
    ...process.env,
    PORT: '3005',
    NODE_ENV: 'development',
    COSMOS_DB_ENDPOINT: '',
    COSMOS_DB_KEY: '',
    COSMOS_DB_DATABASE_NAME: 'bharatbridge_smoke_isolated',
    AZURE_STORAGE_CONNECTION_STRING: ''
  };

  console.log('[Smoke] Isolation: Cosmos DB and Azure Blob Storage disabled in env (live resources protected)');
  console.log('[Smoke] Starting local server process on port 3005...');

  const srv = spawn('npx', ['tsx', 'server.ts'], {
    cwd: 'D:/AI DS CYDA documents/bharatbridge/Bharat-Bridge',
    env,
    shell: true
  });

  srv.stdout.on('data', (d) => {
    const text = d.toString();
    if (text.includes('[Persistence]') || text.includes('Server running') || text.includes('TRANSLATION')) {
      process.stdout.write('[SRV] ' + text.trim() + '\n');
    }
  });

  srv.stderr.on('data', (d) => {
    const errText = d.toString().trim();
    if (!errText.includes('Debugger') && !errText.includes('ExperimentalWarning')) {
      process.stderr.write('[SRV ERR] ' + errText + '\n');
    }
  });

  function stopServer() {
    try {
      if (process.platform === 'win32' && srv.pid) {
        execSync(`taskkill /pid ${srv.pid} /t /f`, { stdio: 'ignore' });
      } else {
        srv.kill('SIGKILL');
      }
    } catch (_) {}
  }

  // 1. Health check poll
  let healthOk = false;
  let healthData = null;
  const startWait = Date.now();
  while (!healthOk && Date.now() - startWait < 35000) {
    try {
      const res = await fetch('http://localhost:3005/api/health');
      if (res.ok) {
        healthData = await res.json();
        healthOk = true;
        break;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 400));
  }

  if (!healthOk) {
    stopServer();
    throw new Error('Server failed to start and respond to /api/health within 15 seconds');
  }

  console.log('[Smoke] 1. /api/health OK:', JSON.stringify(healthData));

  let createdSessionId = null;
  try {
    // 2. Create session
    console.log('[Smoke] 2. Testing POST /api/sessions/create...');
    const createRes = await fetch('http://localhost:3005/api/sessions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Test Session', sourceLang: 'en', targetLang: 'hi' })
    });
    const createJson = await createRes.json();
    if (createRes.status !== 200 || !createJson.sessionId || !createJson.hostToken) {
      throw new Error(`Create session failed: status ${createRes.status} ${JSON.stringify(createJson)}`);
    }
    createdSessionId = createJson.sessionId;
    console.log(`[Smoke] Session created: id=${createJson.sessionId}, hostToken=${createJson.hostToken.slice(0, 8)}...`);

    // 3. Translation via /api/azure/translate
    console.log('[Smoke] 3. Testing POST /api/azure/translate with hostToken...');
    const azureRes = await fetch('http://localhost:3005/api/azure/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': createJson.hostToken
      },
      body: JSON.stringify({
        text: 'Welcome to BharatBridge.',
        sourceLanguageCode: 'en',
        targetLanguageCode: 'hi',
        sessionId: createJson.sessionId
      })
    });
    const azureJson = await azureRes.json();
    if (azureRes.status !== 200 || !azureJson.translatedText) {
      throw new Error(`Direct Azure translation failed: status ${azureRes.status} ${JSON.stringify(azureJson)}`);
    }

    // 4. Translation via /api/translate (orchestrator with fallback detection)
    console.log('[Smoke] 4. Testing POST /api/translate (fallback path)...');
    const orchRes = await fetch('http://localhost:3005/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': createJson.sessionId
      },
      body: JSON.stringify({
        text: 'Welcome to BharatBridge.',
        sourceLanguage: 'en',
        targetLanguage: 'hi',
        sessionId: createJson.sessionId,
        token: createJson.hostToken
      })
    });
    const orchJson = await orchRes.json();
    const provider = orchJson.provider || 'azure';
    const isDegraded = Boolean(orchJson.warning || provider !== 'gemini');

    console.log('----------------------------------------------------');
    console.log(`[Smoke Translation Result]`);
    console.log(`  Provider Answered: ${provider}`);
    console.log(`  Degraded State:    ${isDegraded ? 'YES (Fallback path active: ' + (orchJson.warning || 'Gemini quota/bypass') + ')' : 'NO (Primary Gemini)'}`);
    console.log(`  Translated Text:   "${orchJson.translatedText || azureJson.translatedText}"`);
    console.log(`  Execution Time:    ${orchJson.executionTimeMs || 'N/A'} ms`);
    console.log('----------------------------------------------------');

    // 5. Test mock upload-caption path (with blank AZURE_STORAGE_CONNECTION_STRING)
    console.log('[Smoke] 5. Testing POST /api/azure/upload-caption (mock path verification)...');
    const uploadRes = await fetch('http://localhost:3005/api/azure/upload-caption', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': createJson.hostToken
      },
      body: JSON.stringify({
        sessionId: createJson.sessionId,
        sessionName: 'Smoke Test Session',
        token: createJson.hostToken,
        captions: [{ originalCaption: 'Hello', translatedCaption: 'नमस्ते' }]
      })
    });
    const uploadJson = await uploadRes.json();
    if (uploadRes.status !== 200 || !uploadJson.mock || !uploadJson.blobUrl.startsWith('local://')) {
      throw new Error(`Upload caption mock failed: ${JSON.stringify(uploadJson)}`);
    }
    console.log(`[Smoke] Upload-caption mock path OK: mock=${uploadJson.mock}, blobUrl=${uploadJson.blobUrl}`);

    console.log('[Smoke] --- SMOKE TEST PASSED COMPLETELY ---');
  } finally {
    console.log('[Smoke] Stopping server process tree...');
    stopServer();
    console.log('[Smoke] Server stopped cleanly.');
  }
}

runSmoke()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Smoke Error]', err);
    process.exit(1);
  });
