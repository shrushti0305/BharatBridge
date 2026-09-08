// Browsers connect to Azure Speech (STT + TTS) directly for low latency, but never see the
// real subscription key. Instead, this mints a short-lived (10 minute) authorization token
// server-side and hands that to the browser. If the token leaks, it's useless within minutes.

export async function mintSpeechToken() {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    throw new Error(
      "AZURE_SPEECH_KEY / AZURE_SPEECH_REGION are not set — add them to server/.env"
    );
  }

  const res = await fetch(
    `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": speechKey,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": "0",
      },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Azure Speech token request failed (${res.status}): ${body}`);
  }

  const token = await res.text();
  return { token, region: speechRegion };
}