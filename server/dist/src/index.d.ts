/**
 * Agent Orchestration Platform - Server Entry Point
 * Express + Socket.IO server with CORS and health check
 */
import { Express } from 'express';
import { Server } from 'socket.io';
import http from 'http';
declare const app: Express;
declare const server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
declare const io: Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare function createServer(): Promise<http.Server>;
export { app, io, server };
//# sourceMappingURL=index.d.ts.map