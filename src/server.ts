import { WebHost2 } from './WebHost2';
import dotenv from 'dotenv';
import { resolve as resolvePath } from 'path';
import App from './mre-app';
import { ForwardedDeviceManager, ButtplugServer } from 'buttplug';
import { log } from '@microsoft/mixed-reality-extension-sdk';
import { ButtplugWebsocketServer, ButtplugServerForwardedNodeWebsocketConnector } from './buttplug-app';

log.enable("app");

/* eslint-disable no-console */
process.on('uncaughtException', err => console.log('uncaughtException', err));
process.on('unhandledRejection', reason => console.log('unhandledRejection', reason));
/* eslint-enable no-console */

// Read .env if file exists
dotenv.config();

// Start listening for connections, and serve static files
const server = new WebHost2({
	// baseUrl: 'http://<ngrok-id>.ngrok.io',
	baseDir: resolvePath(__dirname, '../public')
});

// Bridge context
const bridge = new Map<string, ButtplugServer>();

// Handle new application sessions
server.adapter.onConnection(context => new App(context, server.baseUrl, bridge));
server.adapter.handlePath("/status", (sessions, ws) => {
	ws.on('message', () => {
		const rooms: any = {};
		for (const room of Object.keys(sessions)) {
			const users: any = {};
			sessions[room].context.users.forEach(v => { users[v.id.toString()] = v.name; });
			rooms[room] = users;
		}
		ws.send(JSON.stringify(rooms));
	});
});

let timeout: NodeJS.Timeout = null;
server.adapter.handlePath("/room", (sessions, ws) => {
	let ran = "";
	do {
		ran = Math.random().toString(36).replace(/[^a-z0-9]+/ug, '').substr(0, 6);
	} while (bridge.has(ran));
	bridge.set(ran, null);
	timeout = setInterval(() => ws.ping(), 10000);

	ws.on('close', () => {
		bridge.delete(ran);
		clearInterval(timeout);
	})

	ws.send(JSON.stringify({room: ran}));

});


server.adapter.handlePath("/room/:room", (sessions, ws, req, pattern) => {
	const room = pattern.match(req.url)['room'];
	if(room === undefined) {
		ws.close();
		return;
	}

	log.info("app", "Connection to room " + room + " requested");
	if(!bridge.has(room)) {
		ws.close();
		log.info("app", "No such room " + room);
		return;
	}

	if (bridge.get(room) !== null) {
		log.info("app", "Connection is already active on room " + room);
		ws.close();
		return;
	}
  
	// Set up the forwarder and server. First, we have to create a forwarder
	// connector, which uses a websocket to listen for forwarder commands
	// (AddDevice, RemoveDevice), and sends device commands from the controller
	// back to the client that is connected to the forwarder. This connector
	// class is defined below, so in-depth explanation will happen there.
	const connector = new ButtplugServerForwardedNodeWebsocketConnector(ws);
	log.info("app","Starting forwarder listener...");
	connector.Listen();
  
	// Now we set up the server that will host forwarded devices.
	const bps = new ButtplugWebsocketServer("Remote Server", 10000);

	// Forwarded devices use a "device communication manager", which is another
	// common structure in Buttplug. Device communication managers handle a
	// certain class of devices: bluetooth devices, USB devices, etc... The
	// forwarded device manager doesn't manage actual hardware, but instead
	// manages proxies to devices running in other buttplug instances.
	const fdm = new ForwardedDeviceManager(undefined, connector);
	bps.AddDeviceManager(fdm);
	log.info("app", "Starting server...");

	bridge.set(room, bps);
});
