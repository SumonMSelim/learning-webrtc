const localVideo = document.getElementById('local_video');
const remoteVideo = document.getElementById('remote_video');

const loginContainer = document.getElementById('login_container');
const callContainer = document.getElementById('call_container');

const loginButton = document.getElementById('login_button');
const hangupButton = document.getElementById('hangup_button');
const usersButton = document.getElementById('users_button');

const userInput = document.getElementById('user');

const store = {};
store.myPeerConnection = null;

const mediaConstraints = {audio: true, video: true};
const configuration = {
    'iceServers': [{
        'url': 'stun:stun3.l.google.com:19302'
    }]
};

window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
loginContainer.style.display = 'block';

/** create signaling server connection */
const ws = new WebSocket('ws://localhost:8080');

/** listen to signaling server connection */
ws.onopen = (res) => {
    log(`Connected to signaling server: ${JSON.stringify(res)}`);
};

/** Subscribe to signaling server and listen to message */
ws.onmessage = (message) => {
    let data = JSON.parse(message.data);

    if (data.type === 'login') {
        document.getElementById('online').innerHTML = `Online Users: ${data.payload.users.length}`;
        let li = '';
        data.payload.users.forEach((user) => {
                li += '<li>' + user;
                if (store.currentUser !== user) {
                    li += `&nbsp;<button onclick="startCall('${user}');">Call</button>`;
                }
                li += '</li>';
            }
        );
        document.getElementById('users_list').innerHTML = li;
    } else {
        if (store.currentUser === data.target) {
            switch (data.type) {
                case 'candidate':
                    let candidate = new RTCIceCandidate(data.candidate);
                    store.myPeerConnection.addIceCandidate(candidate);
                    break;

                case 'offer':
                    /** create RTCPeerConnection object */
                    if (store.myPeerConnection === null) {
                        console.log(`Offer received`);
                        store.myPeerConnection = new RTCPeerConnection(configuration);
                    }

                    store.myPeerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
                        console.log(`Callee remote SDP set`);
                        return navigator.mediaDevices.getUserMedia(mediaConstraints);
                    }).then((localStream) => {
                        localVideo.srcObject = localStream;
                        console.log(`Callee local stream set`);
                        return store.myPeerConnection.addStream(localStream);
                    }).then(() => {
                        console.log(`Callee answer created`);
                        return store.myPeerConnection.createAnswer();
                    }).then((answer) => {
                        console.log(`Callee local SDP set`);
                        return store.myPeerConnection.setLocalDescription(answer);
                    }).then(() => {
                        let message = {
                            name: store.currentUser,
                            target: data.name,
                            type: 'answer',
                            sdp: store.myPeerConnection.localDescription
                        };
                        send(message);
                        console.log(`Answer sent to ${data.target}`);
                    }).catch((e) => {
                        swal('Oops!', e.message, 'error');
                    });
                    break;

                case 'answer':
                    console.log(`Answer received`);
                    store.myPeerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(console.log('Answer SDP set.'));
                    break;

                case 'hangup':
                    closeVideoCall();
                    break;
            }
        }
    }
};

/** login button click listener */
loginButton.onclick = () => {
    if (userInput.value.length > 0) {
        store.currentUser = userInput.value;
    } else {
        swal('Oops!', 'Please enter a name', 'error');
    }

    let data = {type: 'login', name: store.currentUser};
    /** send data to signaling server */
    console.log(`Login sent: ${JSON.stringify(data)}`);
    send(data);

    loginContainer.style.display = 'none';
    callContainer.style.display = 'block';

    swal('Yay!', `Logged in as, ${store.currentUser}`, 'success');
};

/** logout button click listener */
hangupButton.onclick = () => {
    closeVideoCall();
    let data = {
        target: store.target,
        type: 'hangup',
    };
    send(data);
};

function startCall(user) {
    store.target = user;
    /** create RTCPeerConnection object */
    store.myPeerConnection = new window.RTCPeerConnection(configuration);

    navigator.mediaDevices.getUserMedia(mediaConstraints).then((localStream) => {
        localVideo.srcObject = localStream;
        store.myPeerConnection.addStream(localStream);
        console.log(`Local stream set`);
    }).catch((e) => {
        swal('Oops!', e.message, 'error');
    });

    /** setup negotiation handling */
    store.myPeerConnection.onnegotiationneeded = () => {
        console.log(`Offer negotiation started`);
        store.myPeerConnection.createOffer().then((offer) => {
            console.log(`Setting local SDP`);
            return store.myPeerConnection.setLocalDescription(offer);
        }).then(() => {
            let data = {
                name: store.currentUser,
                target: store.target,
                type: 'offer',
                sdp: store.myPeerConnection.localDescription
            };
            send(data);
            console.log(`Local SDP sent to ${data.target}`);
        });
    };

    /** setup add stream handling */
    store.myPeerConnection.onaddstream = (event) => {
        console.log(`Remote stream set`);
        remoteVideo.srcObject = event.stream;
    };

    /** setup ICE handling */
    store.myPeerConnection.onicecandidate = function (event) {
        if (event.candidate) {
            let data = {
                target: store.target,
                type: 'candidate',
                candidate: event.candidate
            };
            send(data);
        }
    };
}

/** helper function to send data to signaling server */
function send(data) {
    return ws.send(JSON.stringify(data));
}

/** helper function to log data */
function log(data) {
    console.log(data);
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
    store.target = null;
}
