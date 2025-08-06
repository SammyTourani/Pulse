import * as crypto from 'crypto';

/**
 * Request parameters for calling a brick through the Pulse Gateway
 */
export interface CallBrickRequest {
  /** The brick identifier (e.g., 'gmail.send_email') */
  brick: string;
  /** Connection ID for the brick execution */
  connectionId: string;
  /** Parameters to pass to the brick */
  params: Record<string, any>;
  /** Optional request ID for tracking */
  requestId?: string;
  /** Optional idempotency key for duplicate prevention */
  idempotencyKey?: string;
}

/**
 * Normalized response from brick execution
 */
export interface CallBrickResponse {
  ok: boolean;
  brick: string;
  brickVersion: string;
  timestamp: string;
  requestId: string | null;
  cached?: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    retryAfterMs?: number;
    details?: Record<string, any>;
  };
}

/**
 * Configuration for the brick client
 */
export interface BrickClientConfig {
  /** Base URL of the Pulse Gateway (e.g., 'http://localhost:5678') */
  gatewayUrl: string;
  /** HMAC secret for request signing */
  hmacSecret: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

/**
 * Error thrown when brick execution fails
 */
export class BrickExecutionError extends Error {
  constructor(
    message: string,
    public readonly response: CallBrickResponse
  ) {
    super(message);
    this.name = 'BrickExecutionError';
  }
}

/**
 * Signs a request payload using HMAC-SHA256
 */
function signRequest(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Signs a request payload with timestamp using HMAC-SHA256
 */
function signRequestWithTimestamp(timestamp: string, payloadString: string, secret: string): string {
  const hmacPayload = timestamp + payloadString;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(hmacPayload);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Calls a brick through the Pulse Gateway with HMAC authentication
 * 
 * @param config - Client configuration
 * @param request - Brick execution request
 * @returns Promise resolving to the brick response
 * @throws BrickExecutionError on brick execution failures
 * @throws Error on network or gateway errors
 */
export async function callBrick(
  config: BrickClientConfig,
  request: CallBrickRequest
): Promise<CallBrickResponse> {
  // Generate request ID if not provided
  const requestId = request.requestId || crypto.randomUUID();
  
  // Build the request payload
  const payload = {
    brick: request.brick,
    connectionId: request.connectionId,
    params: request.params,
    requestId,
    ...(request.idempotencyKey && { idempotencyKey: request.idempotencyKey })
  };
  
  const payloadString = JSON.stringify(payload);
  
  // Generate timestamp and signature
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signRequestWithTimestamp(timestamp, payloadString, config.hmacSecret);
  
  // Make the HTTP request
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    config.timeoutMs || 30000
  );
  
  try {
    const response = await fetch(`${config.gatewayUrl}/webhook/pulse-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pulse-Timestamp': timestamp,
        'X-Pulse-Signature': signature
      },
      body: payloadString,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Handle HTTP errors
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Gateway request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
    
    // Parse the response
    const result = await response.json() as CallBrickResponse;
    
    // Check if brick execution failed
    if (!result.ok) {
      throw new BrickExecutionError(
        `Brick execution failed: ${result.error?.message || 'Unknown error'}`,
        result
      );
    }
    
    return result;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof BrickExecutionError) {
      throw error;
    }
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${config.timeoutMs || 30000}ms`);
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Network error: ${errorMessage}`);
  }
}

/**
 * Creates a brick client with pre-configured settings
 * 
 * @param config - Client configuration
 * @returns Function that calls bricks with the provided config
 */
export function createBrickClient(config: BrickClientConfig) {
  return (request: CallBrickRequest): Promise<CallBrickResponse> => {
    return callBrick(config, request);
  };
}
