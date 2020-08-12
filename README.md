# Haptics MRe

A PoC bridge between AltSpaceVR and haptic hardware using [Intiface](https://intiface.com/desktop/)


## Testing the PoC

Corners have been cut to get a PoC running:
* Only browser based Intiface connections have been tested (YMMV if using Intiface desktop)
* There's a button, it casues any connected vibrating devices to vibrate for a few seconds


1. Install Node.js 10+
2. Install AltSpaceVR
3. Install [Intiface](https://intiface.com/desktop/)
2. Clone the repo
3. Run `npm install`
4. Run `npm run build`
5. Run `npm start` (you should now have a server running on http://localhost:3901)
6. Navigate to the web-app in a browser (I recommend Chrome since it has WebBluetooth support on most platforms)
7. Click `Connect in-browser`
8. Click `Start Scanning`
9. Select your device from the Bluetooth device list (Note: this will show the raw BLE advertisement names)
10. When the device is listed on the page, check the "Share Control" check-box
11. Take note of the 6 character big blue code: you'll need to enter this in AltSpaceVR in a few steps
12. Launch AltSpaceVR
13. From Settings, enable the Worlds Beta features
14. From the World Editor menu, click SDK Apps and chose "local server"
15. The Haptics Uplink object should have appeared
16. Disable edit mode and close the World Builder menu
17. Click on the Haptics Uplink object
18. You should be presented with a text prompt asking "Please enter the haptics token"; enter the 6 character code from step 11 and click "OK" (hitting return will be seen as a cancel)
19. The MRe you placed in the world should now have manifested as a gray button next to the label "Buzz"
20. Press the button and your vibe should run for a few seconds

## Real world moving parts

There's a few moving parts to this:
1. The AltSpaceVR client (2D or VR mode on desktop or on a standalone headset) connects to the MRe WebSocket server (in the real world this will need to be hosted on a publicly accessible server)
2. The browser based web-app is served initially from MRe static assets hosted by the MRe's server, but then makes additional WebSocket connections to non-MRe endpoints on the MRe server.
3. For browsers without WebBluetooth, the browser based web-app will need to create a connection to Intiface Desktop (another WebSocket connection which will then forwarded across another WebSocket connection to the MRe server)
4. The non-MRe connection to Intiface will be associated with an AltSpaceVR user connected to the MRe by matching the 6 character code from the browser.


## Dev notes

### Editing

* Open this folder in VSCode.

### Building

* From inside VSCode: `Shift+Ctrl+B`
* From command line: `npm run build`

### Running

* From inside VSCode: `F5`
* From command line: `npm start`


## Code Walkthrough

### Server-Side

Normally, MRes only communicate with AltSpace and don't have any browser interaction. That's not the case here, but to make that work, we needed to be able to add additional WebSocket handlers to the Restify HTTP Server that the MRe SDK is built on. To do that we had to modify part of the SDK (see [src/mre-ex/README.md] for details).

[src/server.ts] makes use of the extended versions of the MRe SDK classes, adding 3 extra WebSocket handlers in addition to the MRe itself:

#### [src/app/BPInteractionMRE.ts]

This is the MRe class itself. It handles all the AltSpace stuff:
* Creating the uplink object
* Prompting users for their pairing code
* Linking users in AltSpace to their browser sessions
* Adding colliders to users and reporting collisions to the appropriate user's browser
* There's also a "Buzz" button which uses a forwarded Buttplug connection to vibrate connected devices for a few seconds, but this is to be removed in favour of using the the collision events sent to the client app (the client app will call the ButtplugClient directly)

#### [src/app/ButtplugBridge.ts]

This is the WebSocket handler for the forwarded Buttplug connection infrastructure used by the "Buzz" button.

I won't cover this in any further detail as it will be removed.

#### [src/app/Room.ts]

This is the WebSocket handler that forms the client in-browser app to web-app link:
* It issues a room ID/pairing code
* It sends updates to the client app whenever the AltSpace or Buttplug connections change status
* It also acts as the transport for the collision event reporting

#### [src/app/Status.ts]

This is a temporary WebSocket handler that send the status of the whole web-app to the browser.

It currently reports:
* Connected MRe sessions (AltSpace rooms + Users in those rooms)
* Connected user sessions (Browsers connected)

It should be included in production environments.

### Client (browser) Side

#### [public/webapp.js]

This is the client-side logic, all written as a single JavaScript file loaded by index.html

`getRoom();` is called at the end of the script, which sets up the room websocket, collects the room ID/token and keeps the browser->MRe connection up.

The events returned on this websocket should be interpreted to invoke actions: either driving any attached devices, or indicating events to the user.
