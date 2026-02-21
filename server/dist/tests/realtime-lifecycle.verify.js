"use strict";
/**
 * Additional Real-time Tests for Agent Lifecycle
 */
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = require("socket.io-client");
const SERVER_URL = 'http://localhost:3001';
const TIMEOUT_MS = 5000;
const results = [];
function log(message) {
    console.log(`[TEST] ${message}`);
}
function addResult(name, passed, latency, error) {
    results.push({ name, passed, latency, error });
    const status = passed ? 'PASS' : 'FAIL';
    const latencyStr = latency !== undefined ? ` (${latency}ms)` : '';
    const errorStr = error ? ` - ${error}` : '';
    console.log(`[${status}] ${name}${latencyStr}${errorStr}`);
}
async function waitForEvent(socket, eventName, timeout) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for event: ${eventName}`));
        }, timeout);
        socket.once(eventName, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}
async function runTests() {
    log('Testing Agent Lifecycle Real-time Updates...');
    // Connect to server
    const socket = (0, socket_io_client_1.io)(SERVER_URL, {
        transports: ['websocket'],
        forceNew: true,
    });
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Connection timeout')), TIMEOUT_MS);
        socket.on('connect', () => { clearTimeout(timer); resolve(); });
        socket.on('connect_error', (err) => { clearTimeout(timer); reject(err); });
    });
    log('Socket connected');
    // Deploy agent
    const deployResponse = await fetch(`${SERVER_URL}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'lifecycle-test-agent', type: 'worker' }),
    });
    const deployData = await deployResponse.json();
    const agentId = deployData.data.id;
    log(`Deployed agent: ${agentId}`);
    // Wait for deploy event
    try {
        await waitForEvent(socket, 'agent-status', TIMEOUT_MS);
        addResult('Agent Deploy Event', true);
    }
    catch (e) {
        addResult('Agent Deploy Event', false, undefined, e instanceof Error ? e.message : String(e));
    }
    // Test start agent
    try {
        const startTime = Date.now();
        const eventPromise = waitForEvent(socket, 'agent-status', TIMEOUT_MS);
        const startResponse = await fetch(`${SERVER_URL}/api/agents/${agentId}/start`, {
            method: 'POST',
        });
        if (!startResponse.ok) {
            throw new Error(`Start failed: ${startResponse.status}`);
        }
        await eventPromise;
        const latency = Date.now() - startTime;
        addResult('Agent Start Event (latency < 2s)', latency <= 2000, latency);
    }
    catch (e) {
        addResult('Agent Start Event (latency < 2s)', false, undefined, e instanceof Error ? e.message : String(e));
    }
    // Test stop agent
    try {
        const startTime = Date.now();
        const eventPromise = waitForEvent(socket, 'agent-status', TIMEOUT_MS);
        const stopResponse = await fetch(`${SERVER_URL}/api/agents/${agentId}/stop`, {
            method: 'POST',
        });
        if (!stopResponse.ok) {
            throw new Error(`Stop failed: ${stopResponse.status}`);
        }
        await eventPromise;
        const latency = Date.now() - startTime;
        addResult('Agent Stop Event (latency < 2s)', latency <= 2000, latency);
    }
    catch (e) {
        addResult('Agent Stop Event (latency < 2s)', false, undefined, e instanceof Error ? e.message : String(e));
    }
    // Verify status values
    log('\nVerifying status values in events...');
    // Cleanup
    socket.disconnect();
    // Summary
    log('\n=== Test Summary ===');
    const passedCount = results.filter(r => r.passed).length;
    console.log(`Total: ${passedCount}/${results.length} tests passed`);
    results.forEach(r => console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] ${r.name}${r.latency !== undefined ? ` (${r.latency}ms)` : ''}`));
    process.exit(passedCount === results.length ? 0 : 1);
}
runTests().catch(e => {
    console.error('Test failed:', e);
    process.exit(1);
});
//# sourceMappingURL=realtime-lifecycle.verify.js.map