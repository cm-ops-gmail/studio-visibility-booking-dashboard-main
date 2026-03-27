'use server';

const N8N_WEBHOOK_URL = 'https://vibeacademy.cloud/webhook/4a9b90cf-f01d-4135-950b-eb72bd900d32';

export async function sendMessageToAgent(message: string): Promise<string> {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Changed 'message' to 'question' to match user's example
      body: JSON.stringify({ question: message }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }

    // The user's n8n configuration suggests a plain text response body.
    const text = await response.text();
    
    try {
      // It's possible n8n still wraps a plain text response in JSON.
      const data = JSON.parse(text);
      const reply = data.answer || data.text || text;
      return reply;
    } catch (e) {
      // If parsing fails, it's just plain text.
      return text;
    }

  } catch (error) {
    console.error('Error calling n8n webhook:', error);
    return 'An error occurred while trying to contact the agent.';
  }
}
