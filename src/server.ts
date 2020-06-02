import { WebHostEx } from './mre-ex/WebHostEx';
import dotenv from 'dotenv';
import { resolve as resolvePath } from 'path';
import BPInteractionMRE from './app/BPInteractionMRE';
import { log } from '@microsoft/mixed-reality-extension-sdk';
import { ButtplugBridge } from './app/ButtplugBridge';
import { Room } from './app/Room';
import { Status } from './app/Status';

// Make the app loud for debuggings
log.enable("app");

/* eslint-disable no-console */
process.on('uncaughtException', err => console.log('uncaughtException', err));
process.on('unhandledRejection', reason => console.log('unhandledRejection', reason));
/* eslint-enable no-console */

// Read .env if file exists
dotenv.config();

// Start listening for connections, and serve static files
const server = new WebHostEx({
	baseDir: resolvePath(__dirname, '../public')
});

// Bridge context
const bridge = new Map<string, Room>();

//
// Set up WebSocket handlers
//

// Handle new MRe sessions
server.adapter.onConnection(context => new BPInteractionMRE(context, server.baseUrl, bridge));

// Handle requests to the status endpoint
// This probably exposes way too much information for use in production, but handy for debug
server.adapter.handlePath("/status", (sessions, ws) => new Status(sessions, bridge, ws));

// Handle requests to the room endpoint
// Rooms are unique per-broweser-connections which define the real-world side of the connection
server.adapter.handlePath("/room", (sessions, ws) => new Room(sessions, bridge, ws));

// Handle Buttplug connections to the room
// Buttplug already supports communication over WebSockets, so lets re-use what's already available
server.adapter.handlePath("/room/:room", (_, ws, req, pattern) =>
	new ButtplugBridge(bridge, ws, (pattern.match(req.url) as {[m: string]: string}|null)?.room));
