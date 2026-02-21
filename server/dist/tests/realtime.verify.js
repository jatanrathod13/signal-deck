"use strict";
/**
 * Real-time Updates Test Script
 * Tests Socket.IO connection and event emission latency
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
    log('Starting real-time updates tests...');
    log(`Server URL: ${SERVER_URL}`);
    // Test 1: Socket.IO connection
    log('\n--- Test 1: Socket.IO Connection ---');
    let socket;
    try {
        const startTime = Date.now();
        socket = (0, socket_io_client_1.io)(SERVER_URL, {
            transports: ['websocket'],
            forceNew: true,
        });
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Connection timeout')), TIMEOUT_MS);
            socket.on('connect', () => {
                clearTimeout(timer);
                resolve();
            });
            socket.on('connect_error', (err) => {
                clearTimeout(timer);
                reject(err);
            });
        });
        const latency = Date.now() - startTime;
        addResult('Socket.IO Connection', true, latency);
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        addResult('Socket.IO Connection', false, undefined, errorMsg);
        log(`Error: ${errorMsg}`);
        process.exit(1);
    }
    // Test 2: Agent status update latency
    log('\n--- Test 2: Agent Status Update Latency ---');
    try {
        const startTime = Date.now();
        // Create a promise that resolves when we receive the agent-status event
        const eventPromise = waitForEvent(socket, 'agent-status', TIMEOUT_MS);
        // Deploy an agent via API to trigger the event
        const response = await fetch(`${SERVER_URL}/api/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'test-agent-latency', type: 'worker' }),
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        // Wait for the socket event
        await eventPromise;
        const latency = Date.now() - startTime;
        addResult('Agent Status Update (Socket.IO)', latency <= 2000, latency, latency > 2000 ? 'Exceeds 2 second threshold' : undefined);
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        addResult('Agent Status Update (Socket.IO)', false, undefined, errorMsg);
    }
    // Test 3: Task status update latency
    log('\n--- Test 3: Task Status Update Latency ---');
    try {
        const startTime = Date.now();
        // First deploy an agent
        const agentResponse = await fetch(`${SERVER_URL}/api/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'test-agent-for-task', type: 'worker' }),
        });
        if (!agentResponse.ok) {
            throw new Error(`Failed to create agent: ${agentResponse.status}`);
        }
        const agentData = await agentResponse.json();
        const agentId = agentData.data.id;
        // Create a promise that resolves when we receive the task-status event
        const eventPromise = waitForEvent(socket, 'task-status', TIMEOUT_MS);
        // Submit a task
        const taskResponse = await fetch(`${SERVER_URL}/api/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, type: 'test-task', data: { test: true } }),
        });
        if (!taskResponse.ok) {
            throw new Error(`API error: ${taskResponse.status}`);
        }
        // Wait for the socket event
        await eventPromise;
        const latency = Date.now() - startTime;
        addResult('Task Status Update (Socket.IO)', latency <= 2000, latency, latency > 2000 ? 'Exceeds 2 second threshold' : undefined);
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        addResult('Task Status Update (Socket.IO)', false, undefined, errorMsg);
    }
    // Test 4: Verify no page refresh required (events are received via socket)
    log('\n--- Test 4: No Page Refresh Required ---');
    try {
        // If we received events without polling, the test passes
        const passed = results.some(r => r.name.includes('Agent Status') && r.passed) ||
            results.some(r => r.name.includes('Task Status') && r.passed);
        addResult('Real-time Events (No Polling)', passed, undefined, passed ? undefined : 'No real-time events received');
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        addResult('Real-time Events (No Polling)', false, undefined, errorMsg);
    }
    // Test 5: Verify browser console shows no socket errors
    log('\n--- Test 5: No Socket Errors ---');
    let hasSocketErrors = false;
    socket.on('error', () => {
        hasSocketErrors = true;
    });
    // Give some time to detect any error events
    await new Promise(resolve => setTimeout(resolve, 500));
    addResult('No Socket Errors', !hasSocketErrors, undefined, hasSocketErrors ? 'Socket errors detected' : undefined);
    // Cleanup
    socket.disconnect();
    // Print summary
    log('\n=== Test Summary ===');
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    results.forEach(r => {
        const status = r.passed ? 'PASS' : 'FAIL';
        const latencyStr = r.latency !== undefined ? ` (${r.latency}ms)` : '';
        console.log(`  [${status}] ${r.name}${latencyStr}`);
    });
    log(`\nTotal: ${passedCount}/${totalCount} tests passed`);
    if (passedCount === totalCount) {
        log('\nAll real-time update tests passed!');
        process.exit(0);
    }
    else {
        log('\nSome tests failed!');
        process.exit(1);
    }
}
runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});
//# sourceMappingURL=realtime.verify.js.map