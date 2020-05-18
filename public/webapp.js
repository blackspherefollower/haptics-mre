//
// High level stuff
//


function getStatus() {
    var status = document.getElementById("status");
    status.innerHTML = '';

    var url = location.protocol === 'https:' ? 'wss://' : 'ws://';
    url += location.host + '/status';
    ws = new WebSocket(url);
    ws.addEventListener('message', function (event) {
        console.log('Message from server ', event.data);
        //var data = JSON.parse(event.data);
        status.innerHTML = event.data;
    });
    ws.addEventListener('open', function (event) {
        console.log('Open! ', event.data); ws.send("rooms");
    });
}


function getRoom() {
    var url = location.protocol === 'https:' ? 'wss://' : 'ws://';
    url += location.host + '/room';
    ws = new WebSocket(url);
    ws.addEventListener('message', function (event) {
        console.log('Message from server ', event.data);
        var data = JSON.parse(event.data);
        if(data.hasOwnProperty("room")) {
           window.history.pushState("object or string", "Title", "/?room=" + data["room"]);
           document.getElementById("room-id").innerHTML = data["room"];
           document.getElementById("bpConn").innerHTML = data["bpConnected"];
           document.getElementById("mreConn").innerHTML = data["mreConnected"];
        } else {
            ws.close();
        }
    });
    ws.addEventListener('open', function (event) {
        console.log('Open! ', event.data);
    });
    ws.addEventListener('close', function (event) {
      document.getElementById("room-id").innerHTML = "Discconected!";
      document.getElementById("bpConn").innerHTML = "false";
      document.getElementById("mreConn").innerHTML = "false";
    });
    ws.addEventListener('ping', function () {
        ws.pong();
    });
}


//
// Buttplug client connection logic (shamelessly borrowed from https://github.com/qdot/simple-teledildonics-app/blob/master/app/script.js)
//

// Creates the base UI for a device when it has connected, for either the local
// or remote instance. Includes:
//
// - Device title
// - A share button if this is the local instance
// - UI for commands the device supports (vibrate, rotate, linear movement)
function create_device_controls_div(container, device, forwarder = undefined) {
    console.log(`${device.Name} connected!`);
    const device_div = document.createElement("div");
    const device_title = document.createElement("h2");
    device_title.innerHTML = validator.escape(device.Name);
    device_div.appendChild(device_title);
    device_div.id = `device-${device.Index}`;
  
    const device_share_checkbox = document.createElement("input");
    device_share_checkbox.type = "checkbox";
    const device_share_checkbox_label = document.createElement("label");
    device_share_checkbox_label.for = device_share_checkbox;
    device_share_checkbox_label.innerHTML = "Share Control";
    device_div.appendChild(device_share_checkbox);
    device_div.appendChild(device_share_checkbox_label);

    device_share_checkbox.addEventListener("click", (ev) => {
    if (device_share_checkbox.checked) {
        forwarder.AddDevice(device).then(() => console.log("Device shared"));
    } else {
        forwarder.RemoveDevice(device).then(() => console.log("Device unshared"));
    }
    });
  
    container.appendChild(device_div);
  }
  
  // Show an error on the sharer side UI
  function set_local_error(msg) {
    const error = document.getElementById("local-error");
    error.style.display = "block";
    error.innerHTML = msg;
  }
  
  // Unset the error on the sharer side UI
  function reset_local_error() {
    const error = document.getElementById("local-error");
    error.style.display = "none";
  }
  
  // Show an error on the controller side UI
  function set_remote_error(msg) {
    const error = document.getElementById("remote-error");
    error.style.display = "block";
    error.innerHTML = msg;
  }
  
  // Unset the error on the controller side UI
  function reset_remote_error() {
    const error = document.getElementById("remote-error");
    error.style.display = "none";
  }

////////////////////////////////////////////////////////////////////////////////
// Generic Connector Setup
////////////////////////////////////////////////////////////////////////////////

// Function for setting up all of the events we need to listen to on a
// ButtplugClient, both on the sharer and controller sides. Takes the client and
// connector objects, as well as the div container to insert everything into.
// We'll set can_share to true and pass in the forwarder for the sharer.
async function setup_client(client, connector, container, forwarder = undefined) {
    client.addListener('deviceadded', async (device) => {
      create_device_controls_div(container, device, forwarder);
    });
  
    client.addListener('deviceremoved', (device) => {
      const device_div = document.getElementById(`device-${device.Index}`);
      container.removeChild(device_div);
    });
  
    client.addListener('disconnect', () => {
      for (const child of container.children) {
        container.removeChild(child);
      }
    });

    await client.Connect(connector);
    console.log("Connected!");
  }

////////////////////////////////////////////////////////////////////////////////
// Local Connector
////////////////////////////////////////////////////////////////////////////////
 
// Start Scanning Button Click Event Handler. Starts up the local connection,
// connecting us to:
//
// - The local buttplug server, so we can access hardware
// - The remote device forwarder, so we can share control of devices
// - The remote status endpoint, so we can know when someone has connected to
//   control our devices.
const startConnection = async function (connector) {
    // If there's any error showing in the UI, clear it.
    reset_local_error();

    const urlParams = new URLSearchParams(window.location.search);

    // First, we'll set up the forwarder. Once again, since we assume we're
    // running on glitch, the server address should be the same as the address
    // that's hosting this script. So we just build off of that.

    const fconnector = new Buttplug.ButtplugClientForwarderBrowserWebsocketConnector((window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.hostname + (window.location.port ? ':' + window.location.port : '') + "/room/" + urlParams.get('room'));
    const forwarder = new Buttplug.ButtplugClientForwarder("Forwarder connector", fconnector);
    await forwarder.Connect();

    // Now we set up our ButtplugClient. We just give it a generic name because
    // client name doesn't really matter here.
    const client = new Buttplug.ButtplugClient("MRe Client");
    // We'll use an embedded connector, so our Buttplug Server will exist within
    // our client.
    //const connector = new Buttplug.ButtplugEmbeddedClientConnector();

    // Set up our device UI container so we can pass it to the setup function.
    const container = document.getElementById("local-device-list");

    // Take everything we've built so far, and make the UI for it.
    await setup_client(client, connector, container, forwarder);

    // Hook up the Start Scanning button to our client.
    const button = document.getElementById("buttplug-local-button");
    button.addEventListener("click", async () => {
        await client.StartScanning();
    })

    document.getElementById("local-no-bluetooth").style.display = "none";
    document.getElementById("local-control").style.display = "block";
    document.getElementById("local-ident").style.display = "none";

    // If we're in a browser without WebBluetooth, don't allow sharers to connect,
    // because most of the hardware we support is bluetooth.
    /*if (navigator.bluetooth === undefined) {
        document.getElementById("local-no-bluetooth").style.display = "block";
        document.getElementById("local-ident").style.display = "none";
        document.getElementById("local-control").style.display = "none";
    } else {
        document.getElementById("local-no-bluetooth").style.display = "none";
    }*/
}

const startLocalConnection = async function () {
    startConnection(new Buttplug.ButtplugEmbeddedClientConnector());
}

const startWsConnection = async function () {
    startConnection(new Buttplug.ButtplugBrowserWebsocketClientConnector("wss://localhost:12346/buttplug"));
}

getRoom();