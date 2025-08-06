// Minimal test - just log everything
console.log('=== WEBHOOK DEBUG ===');
console.log('$json:', $json);
console.log('$json type:', typeof $json);
console.log('$json keys:', Object.keys($json || {}));
console.log('$json.brick:', $json?.brick);
console.log('Webhook trigger data:', $node["Webhook Trigger"]?.json);
console.log('=====================');

// Always return a simple response for debugging
return {
  json: {
    debug: true,
    receivedJson: $json,
    receivedType: typeof $json,
    receivedKeys: Object.keys($json || {}),
    webhookData: $node["Webhook Trigger"]?.json
  }
};
