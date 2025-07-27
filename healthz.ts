import express, { Request, Response } from 'express';
import { Client } from 'pg';

const app = express();
const port = process.env.HEALTHZ_PORT || 3001;

interface ServiceHealth {
  status: 'up' | 'down';
  response_time_ms?: number;
  error?: string;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    n8n: ServiceHealth;
    postgresql: ServiceHealth;
    external_apis: {
      gemini: ServiceHealth;
      gmail: ServiceHealth;
      twilio: ServiceHealth;
    };
  };
}

async function checkPostgreSQL(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const client = new Client({
      host: process.env.DB_POSTGRESDB_HOST || 'postgres',
      port: parseInt(process.env.DB_POSTGRESDB_PORT || '5432'),
      database: process.env.DB_POSTGRESDB_DATABASE || 'n8n',
      user: process.env.DB_POSTGRESDB_USER || 'n8n',
      password: process.env.DB_POSTGRESDB_PASSWORD || 'n8n',
    });

    await client.connect();
    await client.query('SELECT 1');
    await client.end();

    return {
      status: 'up',
      response_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkN8N(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`http://n8n:5678/healthz`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        status: 'up',
        response_time_ms: Date.now() - start,
      };
    } else {
      return {
        status: 'down',
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkGeminiAPI(): Promise<ServiceHealth> {
  const start = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      status: 'down',
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Health check test',
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (response.ok || response.status === 400) {
      // 400 is acceptable for health check as it means API is responding
      return {
        status: 'up',
        response_time_ms: Date.now() - start,
      };
    } else {
      return {
        status: 'down',
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkGmailAPI(): Promise<ServiceHealth> {
  const start = Date.now();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      status: 'down',
      error: 'Gmail OAuth credentials not configured',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Check OAuth2 discovery endpoint
    const response = await fetch('https://accounts.google.com/.well-known/openid_configuration', {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        status: 'up',
        response_time_ms: Date.now() - start,
      };
    } else {
      return {
        status: 'down',
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkTwilioAPI(): Promise<ServiceHealth> {
  const start = Date.now();
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return {
      status: 'down',
      error: 'Twilio credentials not configured',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Check Twilio account endpoint
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      method: 'GET',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        status: 'up',
        response_time_ms: Date.now() - start,
      };
    } else {
      return {
        status: 'down',
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

app.get('/healthz', async (req: Request, res: Response) => {
  const [n8nHealth, pgHealth, geminiHealth, gmailHealth, twilioHealth] = await Promise.all([
    checkN8N(),
    checkPostgreSQL(),
    checkGeminiAPI(),
    checkGmailAPI(),
    checkTwilioAPI(),
  ]);

  const coreServicesHealthy = n8nHealth.status === 'up' && pgHealth.status === 'up';
  const externalApisHealthy =
    geminiHealth.status === 'up' && gmailHealth.status === 'up' && twilioHealth.status === 'up';

  const healthStatus: HealthStatus = {
    status: coreServicesHealthy && externalApisHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      n8n: n8nHealth,
      postgresql: pgHealth,
      external_apis: {
        gemini: geminiHealth,
        gmail: gmailHealth,
        twilio: twilioHealth,
      },
    },
  };

  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// Metrics endpoint that returns n8n metrics if available
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('http://n8n:5678/metrics', {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const metrics = await response.text();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    } else {
      res.status(503).json({
        error: 'n8n metrics endpoint not available',
        status: response.status,
      });
    }
  } catch (error) {
    res.status(503).json({
      error: 'Failed to fetch n8n metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.listen(port, () => {
  console.log(`Health check server running on port ${port}`);
});
