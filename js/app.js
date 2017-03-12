const localVideo = document.getElementById('local_video');
const remoteVideo = document.getElementById('remote_video');

const loginContainer = document.getElementById('login_container');
const callContainer = document.getElementById('call_container');

const loginButton = document.getElementById('login_button');
const hangupButton = document.getElementById('hangup_button');

const userInput = document.getElementById('user');
const store = {};
store.user = null;
store.callee = null;
store.myPeerConnection = null;
store.hasAddTrack = false;

const mediaConstraints = {audio: true, video: true};
const configuration = {
    'iceServers': [{
        'url': 'stun:stun3.l.google.com:19302'
    }]
};

window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
loginContainer.style.display = 'block';

/** create connection to signaling server **/
const ws = new WebSocket('ws://localhost:8080');
ws.onopen = () => {
    log(`*** connected to WebSocket signaling server ***`);
};

/** signaling server message response handlers **/
ws.onmessage = (message) => {
    let data = JSON.parse(message.data);

    log(`*** signaling server event: ${data.type} ***`);
    switch (data.type) {
        case 'login':
            log(`*** signaling server event: login ***`);
            document.getElementById('online').innerHTML = `Online Users: ${data.payload.users.length}`;
            let li = '';
            data.payload.users.forEach((user) => {
                    li += '<li>' + user;
                    if (store.user !== user) {
                        li += `&nbsp;<button onclick="startCall('${user}');">Call</button>`;
                    }
                    li += '</li>';
                }
            );
            document.getElementById('users_list').innerHTML = li;
            break;

        case 'offer' && data.callee === store.user:
            log(`*** call invitation received by ${store.user} ***`);
            createPeerConnection();

            log(`*** setting remote description from peer ***`);
            store.myPeerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
                log(`*** accessing local media ***`);
                return navigator.mediaDevices.getUserMedia(mediaConstraints);
            }).then((localStream) => {
                log(`*** local media stream obtained ***`);
                localVideo.srcObject = localStream;

                if (store.hasAddTrack) {
                    log(`*** adding tracks ***`);
                    localStream.getTracks().forEach(track => store.myPeerConnection.addTrack(track, localStream));
                } else {
                    log(`*** adding streams ***`);
                    store.myPeerConnection.addStream(localStream);
                }
            }).then(() => {
                log(`*** creating answer ***`);
                return store.myPeerConnection.createAnswer();
            }).then((answer) => {
                log(`*** setting local description after creating answer ***`);
                return store.myPeerConnection.setLocalDescription(answer);
            }).then(() => {
                let data = {
                    callee: store.user,
                    caller: data.caller,
                    type: 'answer',
                    sdp: store.myPeerConnection.localDescription
                };
                sendToServer(data);
                log(`*** local answer sdp sent to remote peer ***`);
            }).catch((e) => {
                swal('Oops!', e.message, 'error');
            });
            break;

        case 'candidate' && data.callee === store.user:
            store.myPeerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            log(`*** added received ice candidate ***`);
            break;

        case 'answer' && data.caller === store.user:
            log(`*** ${data.callee} has accepted the call of ${store.user} ***`);
            store.myPeerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            log(`*** set remote description from peer ***`);
            break;

        case 'hangup':
            closeVideoCall();
            break;
    }
};

/** login button click listener */
loginButton.onclick = () => {
    if (userInput.value.length > 0) {
        store.user = userInput.value;
    } else {
        swal('Oops!', 'Please enter a name', 'error');
    }

    log(`*** login data sent to signaling server ***`);
    let data = {type: 'login', name: store.user};
    sendToServer(data);

    loginContainer.style.display = 'none';
    callContainer.style.display = 'block';

    swal('Yay!', `Logged in as, ${store.user}`, 'success');
};

/** call button click listener **/
function startCall(callee) {
    store.callee = callee;

    log(`*** calling started to ${callee} ***`);
    createPeerConnection();

    log(`*** accessing local media ***`);
    navigator.mediaDevices.getUserMedia(mediaConstraints).then((localStream) => {
        log(`*** local media stream obtained ***`);
        localVideo.srcObject = localStream;

        if (store.hasAddTrack) {
            log(`*** adding tracks ***`);
            localStream.getTracks().forEach(track => store.myPeerConnection.addTrack(track, localStream));
        } else {
            log(`*** adding streams ***`);
            store.myPeerConnection.addStream(localStream);
        }
    }).catch((e) => {
        swal('Oops!', e.message, 'error');
    });
}

/** hangup button click listener */
hangupButton.onclick = () => {
    closeVideoCall();
    let data = {
        target: store.target,
        type: 'hangup',
    };
    sendToServer(data);
};

/** create peer connection and handle related events **/
function createPeerConnection() {
    log(`*** setting up WebRTC peer connection ***`);
    store.myPeerConnection = new window.RTCPeerConnection(configuration);

    // Do we have addTrack()? If not, we will use streams instead.
    store.hasAddTrack = (store.myPeerConnection.addTrack !== undefined);
    /** remote stream handling **/
    if (store.hasAddTrack) {
        store.myPeerConnection.ontrack = (event) => {
            log("*** ontrack event available - setting remote stream ***");
            remoteVideo.srcObject = event.streams[0];
            hangupButton.disabled = false;
        };
    } else {
        store.myPeerConnection.onaddstream = (event) => {
            log("*** ontrack not available, onaddstream (deprecated) used - setting remote stream ***");
            remoteVideo.srcObject = event.stream;
            hangupButton.disabled = false;
        };
    }

    /** onnegotiation handling **/
    store.myPeerConnection.onnegotiationneeded = () => {
        log("*** negotiation needed ***");

        log("*** creating offer ***");
        store.myPeerConnection.createOffer().then((offer) => {
            log("*** creating local sdp for sending to remote ***");
            return store.myPeerConnection.setLocalDescription(offer);
        }).then(() => {
            let data = {
                caller: store.user,
                callee: store.callee,
                type: 'offer',
                sdp: store.myPeerConnection.localDescription
            };
            sendToServer(data);
            log("*** local offer sdp sent to remote peer ***");
        });
    };

    /** onicecandidate handling **/
    store.myPeerConnection.onicecandidate = function (event) {
        log("*** icecandidate found ***");

        log("*** sending icecandidate to remote ***");
        if (event.candidate) {
            let data = {
                callee: store.callee,
                type: 'candidate',
                candidate: event.candidate
            };
            sendToServer(data);
            log("*** icecandidate sent to remote ***");
        }
    };
}

/** helper function to close video call */
function closeVideoCall() {
    if (store.myPeerConnection) {
        store.myPeerConnection.onaddstream = null;  // For older implementations
        store.myPeerConnection.onremovestream = null;
        store.myPeerConnection.onnicecandidate = null;
        store.myPeerConnection.onnotificationneeded = null;

        if (remoteVideo.srcObject) {
            remoteVideo.srcObject.getTracks().forEach(track => track.stop());
            remoteVideo.srcObject = null;
        }

        if (localVideo.srcObject) {
            localVideo.srcObject.getTracks().forEach(track => track.stop());
            localVideo.srcObject = null;
        }

        store.myPeerConnection.close();
        store.myPeerConnection = null;
    }

    hangupButton.disabled = true;
    store.callee = null;
}

/** helper function to send data to signaling server **/
function sendToServer(data) {
    return ws.send(JSON.stringify(data));
}

/** helper function to log data **/
function log(data) {
    console.log(data);
}
