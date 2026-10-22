/**
 * Azure Blob Storage integration helper for archiving original and translated captions.
 */

export interface AzureUploadResult {
  success: boolean;
  blobUrl?: string;
  blobName?: string;
  error?: string;
}

export async function uploadCaptionToAzure(
  sessionId: string,
  sessionName: string,
  messages: Array<{
    sourceLang?: string;
    targetLang?: string;
    originalText: string;
    translatedText: string;
    timestamp?: { seconds: number };
  }>,
  token?: string
): Promise<AzureUploadResult> {
  try {
    const formattedDate = new Date().toISOString();
    const payload = {
      sessionId,
      sessionName,
      exportedAt: formattedDate,
      messageCount: messages.length,
      token,
      captions: messages.map((m) => ({
        timestamp: m.timestamp ? new Date(m.timestamp.seconds * 1000).toISOString() : formattedDate,
        originalLanguage: m.sourceLang || 'en',
        originalCaption: m.originalText,
        translatedLanguage: m.targetLang || 'hi',
        translatedCaption: m.translatedText,
      })),
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['x-host-token'] = token;
      headers['x-session-token'] = token;
    }

    const response = await fetch('/api/azure/upload-caption', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      blobUrl: data.blobUrl,
      blobName: data.blobName,
    };
  } catch (error) {
    console.error('Azure Upload Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
