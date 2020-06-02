/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as http from 'http';
import QueryString from 'query-string';
import * as Restify from 'restify';
import semver from 'semver';
import * as WS from 'ws';
import UrlPattern from 'url-pattern';
import UUID from 'uuid';

import {
	Context,
	log,
	ParameterSet,
	MultipeerAdapterOptions
} from '@microsoft/mixed-reality-extension-sdk';
import {
	Adapter,
	AdapterOptions,
	Client,
	ClientHandshake,
	ClientStartup,
	Constants,
	Pipe,
	Session,
	verifyClient,
	WebSocket
} from '@microsoft/mixed-reality-extension-sdk/built/internal';

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
const forwarded: (res: http.IncomingMessage, headers: http.IncomingHttpHeaders) => {ip: string; port: number}
	= require('forwarded-for');
/* eslint-enable @typescript-eslint/no-var-requires */
/* eslint-enable @typescript-eslint/no-unsafe-assignment */

function verifyClient2(
	info: { origin: string; secure: boolean; req: http.IncomingMessage },
	cb: (res: boolean, code?: number, message?: string, headers?: http.OutgoingHttpHeaders) => void): void {
	// See if this is our WS URL
	const url = info?.req?.url || "";
	if(!new UrlPattern("/").match(url)) {
		cb(true);
		return;
	}

	verifyClient(info, cb);
}

/**
 * The SessionMap type: Session ID to the session + context
 */
export type SessionMap =
	{ [id: string]: {
		session: Session;
		context: Context;
	}; };

/**
 * The callback type for Alternative WS Handlers
 */
export type AltWSHandler =
	(sessions: SessionMap,
	ws: WS,
	req: http.IncomingMessage,
	pattern: UrlPattern) => void;

/**
 * The `MultipeerAdapterEx` is an modified 'MultipeerAdapter' that provides
 * a means for handling additional WebSocket connections on alternative paths.
 */
export class MultipeerAdapterEx extends Adapter {

	private altPatterns = new Map<UrlPattern, AltWSHandler>();

	private sessions: SessionMap = {};

	/** @override */
	protected get options(): MultipeerAdapterOptions { return this._options; }

	/**
	 * Creates a new instance of the Multi-peer Adapter
	 */
	constructor(options?: MultipeerAdapterOptions) {
		super(options);
		this._options = { peerAuthoritative: true, ...this._options } as AdapterOptions;
	}

	/**
	 * Registers a new Alternative WebSocket Handler
	 * 
	 * These can be used to add alternative communication channels to the MRe.
	 * 
	 * @param path The UrlPattern to handle
	 * @param cb The callback method to handle the new WebSocket
	 */
	public handlePath(path: string, cb: AltWSHandler): void {
		this.altPatterns.set(new UrlPattern(path), cb);
	}

	/**
	 * Start the adapter listening for new incoming connections from engine clients
	 */
	public listen(): Promise<Restify.Server> {
		if (!this.server) {
			// If necessary, create a new web server
			return new Promise<Restify.Server>((resolve) => {
				const server = this.server = Restify.createServer({ name: "Multi-peer Adapter" });
				this.server.listen(this.port, () => {
					this.startListening();
					resolve(server);
				});
			});
		} else {
			// Already have a server, so just start listening
			this.startListening();
			return Promise.resolve(this.server);
		}
	}

	private async getOrCreateSession(sessionId: string, params: ParameterSet) {
		let session = this.sessions[sessionId]?.session;
		if (!session) {
			// Create an in-memory "connection" (If the app were running remotely, we would connect
			// to it via WebSocket here instead)
			const pipe = new Pipe();
			pipe.local.statsTracker.on('incoming', bytes => pipe.remote.statsTracker.recordIncoming(bytes));
			pipe.local.statsTracker.on('outgoing', bytes => pipe.remote.statsTracker.recordOutgoing(bytes));
			pipe.local.on('linkQuality', quality => pipe.remote.linkConnectionQuality(quality));

			// Create a new context for the connection, passing it the remote side of the pipe.
			const context = new Context({
				sessionId,
				connection: pipe.remote
			});
			// Start the context listening to network traffic.
			context.internal.startListening().catch(() => pipe.remote.close());
			// Instantiate a new session.
			session = new Session(
				pipe.local, sessionId, this.options.peerAuthoritative);

			this.sessions[sessionId] = { session, context };
			// Handle session close.
			session.on('close', () => delete this.sessions[sessionId]);
			// Connect the session to the context.
			await session.connect(); // Allow exceptions to propagate.
			// Pass the new context to the app.
			this.emitter.emit('connection', context, params);
			// Start context's update loop.
			context.internal.start();
		}
		return session;
	}


	private startListening() {
		// Create a server for upgrading HTTP connections to WebSockets
		const wss = new WS.Server({ server: this.server, verifyClient: verifyClient2 });

		// Handle WebSocket connection upgrades
		wss.on('connection', async (ws: WS, req: http.IncomingMessage) => {
			if(!new UrlPattern("/").match(req['url'] || "")) {
				log.info('network', "New alt connection");
				for(const k of Array.from(this.altPatterns.keys())) {
					if(k.match(req['url'] || "")) {
						this.altPatterns.get(k)(this.sessions, ws, req, k);
						return; 
					}
				}
				
				log.error('network', "Alt connection unhandled");
				ws.close();
			}

			try {
				log.info('network', "New Multi-peer connection");

				// Read the sessionId header.
				let sessionId = req.headers[Constants.HTTPHeaders.SessionID] as string || UUID.v4();
				sessionId = decodeURIComponent(sessionId);

				// Read the client's version number
				const version = semver.coerce(req.headers[Constants.HTTPHeaders.CurrentClientVersion] as string);

				// Parse URL parameters.
				const params = QueryString.parseUrl(req.url).query;

				// Get the client's IP address rather than the last proxy connecting to you.
				const address = forwarded(req, req.headers);

				// Create a WebSocket for this connection.
				const conn = new WebSocket(ws, address.ip);

				// Instantiate a client for this connection.
				const client = new Client(conn, version);

				// Join the client to the session.
				await this.joinClientToSession(client, sessionId, params);
			} catch (e) {
				log.error('network', e);
				ws.close();
			}
		});
	}

	private async joinClientToSession(client: Client, sessionId: string, params: QueryString.ParsedQuery) {
		try {
			// Handshake with the client.
			const handshake = new ClientHandshake(client, sessionId);
			await handshake.run();

			// Measure the connection quality and wait for sync-request message.
			const startup = new ClientStartup(client, handshake.syncRequest);
			await startup.run();

			// Get the session for the sessionId.
			const session = await this.getOrCreateSession(sessionId, params);

			// Join the client to the session.
			await session.join(client);
		} catch (e) {
			log.error('network', e);
			client.conn.close();
		}
	}
}
