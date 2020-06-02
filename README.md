# Haptics MRe

A PoC bridge between AltSpaceVR and haptics hardware using [Intiface](https://intiface.com/desktop/)


## Testing the PoC

Corners have been cut to get a PoC running:
* Only browser based Buttplug connections have been tested (YMMV if using Intiface desktop)
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
15. Disable edit mode and close the World Builder menu
16. You should be presented with a text prompt asking "Got Buttplug?"; enter the 6 character code from step 11 and click "OK" (hitting return will be seen as a cancel)
17. The MRe you placed in the world should now have manifested as a gray button next to the label "Buzz"
18. Press the button and your vibe should run for a few seconds

## Real world moving parts

There's a few moving parts to this:
1. The AltSpaceVR client (2D or VR mode on desktop or on a standalone headset) connects to the MRe WebSocket server (in the real world this will need to be hosted on a publicly accessible server)
2. The browser based web-app is served initially from MRe static assets hosted by the MRe's server, but then makes additional WebSocket connections to non-MRe endpoints on the MRe server.
3. For browsers without WebBluetooth, the browser based web-app will need to create a connection to Intiface Desktop (another WebSocket connection which will then forwarded across another WebSocket connection to the MRe server)
4. The non-MRe Buttplug connection will be associated with an AltSpaceVR user connected to the MRe by matching the 6 character code from the browser.


## Dev notes

### Editing

* Open this folder in VSCode.

### Building

* From inside VSCode: `Shift+Ctrl+B`
* From command line: `npm run build`

### Running

* From inside VSCode: `F5`
* From command line: `npm start`
