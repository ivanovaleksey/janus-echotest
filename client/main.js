// JavaScript variables holding stream and connection information
var localStream, remoteStream, peerConnection;

// JavaScript variables associated with HTML5 video elements in the page
var localVideo = document.getElementById("localVideo");
var remoteVideo = document.getElementById("remoteVideo");

// JavaScript variables assciated with call management buttons in the page
var startButton = document.getElementById("startButton");
var callButton = document.getElementById("callButton");
var hangupButton = document.getElementById("hangupButton");

// Just allow the user to click on the Call button at start-up
startButton.disabled = false;
callButton.disabled = true;
hangupButton.disabled = true;

// Associate JavaScript handlers with click events on the buttons
startButton.onclick = start;
callButton.onclick = call;
hangupButton.onclick = hangup;

var sessionId, pluginHandleId;
var janusHost = window.location.protocol + '//' + window.location.hostname + ':8089/janus';

function start() {
  navigator.getUserMedia({ video: true }, successCallback, errorCallback);
  startButton.disabled = true;
  callButton.disabled = false;
}

function call() {
  callButton.disabled = true;
  hangupButton.disabled = false;

  peerConnection = new RTCPeerConnection(null);

  // Triggered whenever a new candidate is made available to the local peer by the ICE protocol machine
  peerConnection.onicecandidate = gotLocalIceCandidate;

  // Triggered on setRemoteDescription() call
  peerConnection.onaddstream = gotRemoteStream;

  peerConnection.addStream(localStream);

  var payload = {
    "janus": "create",
    "transaction": getTransactionId()
  };
  fetch(janusHost, {
    method: 'POST',
    body: JSON.stringify(payload)
  }).then(function (resp) {
    return resp.json();
  }).then(function (data) {
    console.log(data);
    sessionId = data.data.id;

    handleEvents();

    var payload = {
      "janus" : "attach",
      "plugin" : "janus.plugin.echotest",
      "transaction" : getTransactionId()
    };
    fetch(janusHost + '/' + sessionId, {
      method: 'POST',
      body: JSON.stringify(payload)
    }).then(function (resp) {
      return resp.json();
    }).then(function (data) {
      console.log(data);
      pluginHandleId = data.data.id;

      console.log('creating offer');
      peerConnection.createOffer(gotLocalDescription, onSignalingError);
    });
  });
}

function handleEvents() {
  fetch(
    janusHost + '/' + sessionId
  ).then(function (resp) {
    return resp.json();
  }).then(function (event) {
    console.log('Event received');
    console.log(event);

    handleEvent(event);
    handleEvents();
  });
}

function handleEvent(data) {
  if (data.janus == 'event') {
    var jsep = new RTCSessionDescription(data.jsep);
    console.log(jsep);

    if (jsep.type == 'answer') {
      peerConnection.setRemoteDescription(jsep);
    }
  }
}

function hangup() {
  peerConnection.close();

  localStream = null;
  remoteStream = null;

  startButton.disabled = false;
  hangupButton.disabled = true;
}

function gotLocalIceCandidate(event) {
  console.log('gotLocalIceCandidate');
  var candidate = event.candidate;
  console.log(candidate);

  if (candidate) {
    var payload = {
      "janus": "trickle",
      "transaction": getTransactionId(),
      "candidate": candidate
    };
    fetch(janusHost + '/' + sessionId + '/' + pluginHandleId, {
      method: 'POST',
      body: JSON.stringify(payload)
    }).then(function (resp) {
      return resp.json();
    }).then(function (data) {
      console.log('Done uploading ICE candidate');
      console.log(data);
    });
  }
}

function gotRemoteStream(event) {
  console.log('gotRemoteStream');

  remoteStream = event.stream;
  remoteVideo.src = window.URL.createObjectURL(remoteStream);
}

function gotLocalDescription(desc) {
  console.log('got local SDP');
  console.log(desc);

  peerConnection.setLocalDescription(desc);

  var payload = {
    "janus": "message",
    "transaction": getTransactionId(),
    "body": {
      "video": true
    },
    "jsep": {
      "type": "offer",
      "sdp": desc.sdp
    }
  };

  fetch(janusHost + '/' + sessionId + '/' + pluginHandleId, {
    method: 'POST',
    body: JSON.stringify(payload)
  }).then(function (resp) {
    return resp.json();
  }).then(function (data) {
    console.log('Done uploading offer');
    console.log(data);
  });
}

function onSignalingError(error){
  console.log('Failed to create signaling message : ' + error.message);
}

function successCallback(gotStream) {
  localStream = gotStream;
  localVideo.src = window.URL.createObjectURL(localStream);
}

function errorCallback(error) {
  console.log('error' + error);
}

function getTransactionId() {
  return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5);
}
