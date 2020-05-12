import { WebHostEx } from './mre-ex/WebHostEx';
import dotenv from 'dotenv';
import { resolve as resolvePath } from 'path';
import BPInteractionMRE from './app/BPInteractionMRE';
import { ButtplugServer } from 'buttplug';
import { log } from '@microsoft/mixed-reality-extension-sdk';
import { ButtplugBridge } from './app/ButtplugBridge';
import { Room } from './app/Room';
import { Status } from './app/status';

log.enable("app");

/* eslint-disable no-console */
process.on('uncaughtException', err => console.log('uncaughtException', err));
process.on('unhandledRejection', reason => console.log('unhandledRejection', reason));
/* eslint-enable no-console */

// Read .env if file exists
dotenv.config();

// Start listening for connections, and serve static files
const server = new WebHostEx({
	// baseUrl: 'http://<ngrok-id>.ngrok.io',
	baseDir: resolvePath(__dirname, '../public')
});

// Bridge context
const bridge = new Map<string, ButtplugServer>();

// Handle new application sessions
server.adapter.onConnection(context => new BPInteractionMRE(context, server.baseUrl, bridge));
server.adapter.handlePath("/status", (sessions, ws) => new Status(sessions, bridge, ws));
server.adapter.handlePath("/room", (sessions, ws) => new Room(sessions, bridge, ws));
server.adapter.handlePath("/room/:room", (_, ws, req, pattern) =>
	new ButtplugBridge(bridge, ws, pattern.match(req.url)['room']));
