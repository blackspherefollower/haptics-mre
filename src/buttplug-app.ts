import { ButtplugServer, ButtplugServerForwardedConnector, FromJSON,
	RequestServerInfo, ButtplugMessage } from "buttplug";
import * as WS from 'ws';
import { EventEmitter } from "events";
import { log } from "@microsoft/mixed-reality-extension-sdk";

let forwarderConnected = true;
let remoteConnected = true;
class StatusEmitter extends EventEmitter {
	public emitLocalDisconnect() {
		this.emit("local_disconnect");
	}

	public emitRemoteConnect() {
		log.info("app", "Remote connected");
		this.emit("remote_connect");
	}

	public emitRemoteDisconnect() {
		this.emit("remote_disconnect");
	}
}

const statusEmitter = new StatusEmitter();

  
export class ButtplugWebsocketServer extends ButtplugServer {
	public constructor(name: string, maxPingTime = 0) {
		super(name, maxPingTime);
	}

	// We'll just kill this server on disconnect, so assume it's always live.
	public get IsRunning(): boolean {
		return true;
	}

	// Shuts down the server, closing all connections.
	public StopServer = async (): Promise<void> => {
		await this.Shutdown();
	}

	// Once we've got a remote connection, set it up here.
	public InitServer = (wsClient: WS, room: string, bridge: Map<string, ButtplugServer>) => {
		// Same drill as the websocket setups above. If we error or close, clear
		// our connection status and emit.
		wsClient.on("error", (err) => {
			log.error("app", `Error in websocket connection: ${err.message}`);
			wsClient.terminate();
			statusEmitter.emitRemoteDisconnect();
			remoteConnected = false;
		});
		wsClient.on("close", () => {
			log.info("app", "Remote connection closed.");
			statusEmitter.emitRemoteDisconnect();
			remoteConnected = false;
		});
		// If we see that the sharer disconnected, we should kick the controller
		// too.
		statusEmitter.addListener("local_disconnect", () => {
			wsClient.close()
		});
		wsClient.on("message", async (message) => {

			// If we've gotten the password, we expect to be receiving JSON from the
			// controller. This means we're now basically functioning as a proxy
			// here.
			//
			// Unpack the JSON into a message object array, send it through our
			// server (which will set it to the sharer), and once we get a response,
			// send that back to the controller.
			const msg = FromJSON(message);
			for (const m of msg) {
				if (m.Type === RequestServerInfo) {
					statusEmitter.emitRemoteConnect();
				}
				const outgoing = await this.SendMessage(m);
				// Make sure our message is packed in an array, as the buttplug spec
				// requires.
				wsClient.send("[" + outgoing.toJSON() + "]");
			}
		});

		// If our server emits a message for some reason, just shove it over to
		// the controller.
		this.on("message", (message) => {
			// Make sure our message is packed in an array, as the buttplug spec
			// requires.
			wsClient.send("[" + message.toJSON() + "]");
		});

		// Now that we've finished socket setup, mark the controller as connected.
		remoteConnected = true;
	}
}

// ButtplugServerForwardedConnectors are what the ForwardedDeviceManager
// mentioned above uses to receive proxied devices. For this specific example,
// it will listen on a websocket, but we can proxy over any network or IPC
// connection.
//
// This will also handle some of our security, as the sharer password exchange
// happens here.
export class ButtplugServerForwardedNodeWebsocketConnector extends 
	EventEmitter implements ButtplugServerForwardedConnector {

	public constructor(private wsClient: any) {
		super();
	}

	// We'll never want this to disconnect on the connector end. It should stay
	// connected for the lifetime of the sharer's session.
	public Disconnect = (): Promise<void> => {
		return Promise.resolve();
	}

	// Send a message to the sharer.
	public SendMessage = (msg: ButtplugMessage): Promise<void> => {
		this.wsClient.send("[" + msg.toJSON() + "]");
		return Promise.resolve();
	}

	// The name here is a bit misleading, as since we're using expressWs, the
	// listener is set up earlier. However, since this is expected to a server,
	// we have to fill this in anyways, so we use this as a chance to set up the
	// websocket client we've received.
	public Listen = (): Promise<void> => {		
		// If the websocket errors out for some reason, just terminate connection.
		this.wsClient.on("error", (err: any) => {
			log.error("app", `Error in websocket connection: ${err.message}`);
			forwarderConnected = false;
			statusEmitter.emitLocalDisconnect();
			this.wsClient.terminate();
			this.wsClient.removeAllListeners();
			this.emit("disconnect");
		});

		// If the websocket closes, we want to update our status so another sharer
		// can connect (or the same one can reconnect), then let the rest of the
		// system know that the sharer disconnected, so we can do things like
		// kicking the controller out too.
		this.wsClient.on("close", () => {
			log.info("app", "Local side disconnected");
			forwarderConnected = false;
			statusEmitter.emitLocalDisconnect();
			this.wsClient.removeAllListeners();
			this.emit("disconnect");
		});

		// If we get a message, a couple of things can happen, so just keep
		// reading the internal comments.
		this.wsClient.on("message", (message: any) => {
			const msg = FromJSON(message);
			for (const m of msg) {
				log.debug("app", m);
				this.emit("message", m);
			}
		});
		// This function can sometimes be async. Now is not one of those times.
		return Promise.resolve();
	}
}
