# Buttplug MRe

A PoC callout to Buttplug.io from within AltSpaceVR.


## Testing the PoC

Corners have been cut to get a PoC running:
* Everything is assumed to be running on one box: no multi-user

* There's a button, it casues any connected vibrating devices to vibrate for a few seconds

* The button only appears once a device is connected

  

1. Install Node.js 10+
2. Install AltSpaceVR
3. Install [Intiface](https://intiface.com/desktop/)
2. Clone the repo
3. Run `npm install`
4. Run `npm run build`
5. Run `npm start` (you should now have a server running)
6. Start Intiface
7. Start AltSpaceVR
8. From Settings, enable the Worlds Beta features
9. From the World Editor menu, click SDK Apps and chose "local server"
10. Disable edit mode and close the World Builder menu
11. Turn on a Buttplug.io supported Vibe (the Buzz button should appear)
12. Press the button and your vibe should run for a few seconds

## Real world moving parts

There's a few moving parts to this:
1. The AltSpaceVR client (user-device) connects to the MRe websocket service (public webservice)
2. The MRe service creates a connection to a Buttplug.io server (the connection will come from wherever the MRe is hosted, so the Buttplug.io server must also be on the public internet)
3. Since setting up port forwarding for Buttplug is a security risk, it's best to use an intermediary Buttplug relay/forwarding service. This is still a WIP so the instructions will be updated when that piece has matured.
4. The Buttplug server connects to your hardware and reports back, ideally causing the MRe to render something nice in AltSpaceVR

Until point 3 is addressed, general usage will be difficult to support.


## Dev notes

### Editing

* Open this folder in VSCode.

### Building

* From inside VSCode: `Shift+Ctrl+B`
* From command line: `npm run build`

### Running

* From inside VSCode: `F5`
* From command line: `npm start`
