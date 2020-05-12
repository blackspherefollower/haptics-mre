import { ButtplugServer, FromJSON,
	RequestServerInfo } from "buttplug";
import * as WS from 'ws';
import { log } from "@microsoft/mixed-reality-extension-sdk";
import { StatusEmitter } from "./StatusEmitter";

export class ButtplugForwardedNodeWebsocketServer extends ButtplugServer {
	private remoteConnected = false;

	public constructor(name: string, private statusEmitter: StatusEmitter, maxPingTime = 0) {
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
			this.statusEmitter.emitRemoteDisconnect();
			this.remoteConnected = false;
		});
		wsClient.on("close", () => {
			log.info("app", "Remote connection closed.");
			this.statusEmitter.emitRemoteDisconnect();
			this.remoteConnected = false;
		});
		// If we see that the sharer disconnected, we should kick the controller
		// too.
		this.statusEmitter.addListener("local_disconnect", () => {
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
					this.statusEmitter.emitRemoteConnect();
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
		this.remoteConnected = true;
	}
}
