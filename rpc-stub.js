#!/usr/bin/env node
/**
 * Minimal JSON-RPC 2.0 stub server for development.
 * Responds to common Ethereum RPC calls with stubbed data.
 * This allows the backend to connect and run without a real fhEVM node.
 */

const http = require('http');
const url = require('url');

const PORT = 8545;

const rpcMethods = {
  'web3_clientVersion': () => 'fhEVM-Stub/1.0.0',
  'net_version': () => '9000',
  'net_listening': () => true,
  'eth_chainId': () => '0x2328', // 9000 in hex
  'eth_blockNumber': () => '0x1',
  'eth_getBalance': (params) => '0x0',
  'eth_call': (params) => '0x',
  'eth_sendRawTransaction': (params) => '0x' + '00'.repeat(32),
  'eth_getTransactionReceipt': (params) => null,
  'eth_gasPrice': () => '0x1',
  'eth_estimateGas': (params) => '0x5208',
  'eth_accounts': () => [],
  'eth_getCode': (params) => '0x',
};

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const payload = JSON.parse(body);
      const { jsonrpc = '2.0', id, method, params = [] } = payload;

      const methodHandler = rpcMethods[method];
      if (!methodHandler) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc,
            id,
            error: { code: -32601, message: `Method ${method} not found` },
          })
        );
        return;
      }

      let result;
      try {
        result = methodHandler(params);
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc,
            id,
            error: { code: -32603, message: 'Internal error: ' + err.message },
          })
        );
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc, id, result }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[RPC Stub] JSON-RPC 2.0 stub listening on http://localhost:${PORT}`);
  console.log('[RPC Stub] Supported methods: web3_clientVersion, net_version, eth_chainId, eth_call, eth_sendRawTransaction, ...');
  console.log('[RPC Stub] This is a development stub — not a real fhEVM node.');
});
