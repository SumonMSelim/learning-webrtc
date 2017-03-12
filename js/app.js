const localVideo = document.getElementById('local_video');
const remoteVideo = document.getElementById('remote_video');

const loginContainer = document.getElementById('login_container');
const callContainer = document.getElementById('call_container');

const loginButton = document.getElementById('login_button');
const logoutButton = document.getElementById('logout_button');
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
//const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

/** listen to signaling server connection */
ws.onopen = (res) => {
    log(`Connected to signaling server: ${JSON.stringify(res)}`);
};

/** Subscribe to signaling server and listen to message */
ws.onmessage = (message) => {
    let data = JSON.parse(message.data);

    switch (data.type) {
        case 'login':
            document.getElementById('online').innerHTML = `Online Users: ${response.channels.webrtc.occupancy}`;
            let li = '';
            response.channels.webrtc.occupants.forEach((item) => {
                    li += '<li>' + item.state.name + ' - ' + item.uuid;
                    if (store.currentUser !== item.state.name) {
                        li += `&nbsp;<button onclick="startCall('${item.uuid }');">Call</button>`;
                    }
                    li += '</li>';
                }
            );
            document.getElementById('users_list').innerHTML = li;
            break;
        case 'offer':
            console.log(`Offer received`);
            /** create RTCPeerConnection object */
            if (store.myPeerConnection === null) {
                store.myPeerConnection = new RTCPeerConnection(configuration);
            }

            store.myPeerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
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
                let data = {
                    name: store.currentUUID,
                    target: data.name,
                    type: 'answer',
                    sdp: store.myPeerConnection.localDescription
                };
                send(data).then(console.log(`Answer sent to ${data.target}`));
            }).catch((e) => {
                swal('Oops!', e.message, 'error');
            });
            break;

        case 'answer':
            console.log(`Answer started`);
            store.myPeerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(console.log('Answer SDP set.'));
            break;

        case 'candidate':
            /** create RTCPeerConnection object */
            if (store.myPeerConnection === null) {
                store.myPeerConnection = new window.RTCPeerConnection(configuration);
            }
            let candidate = new RTCIceCandidate(data.candidate);
            store.myPeerConnection.addIceCandidate(candidate).then(console.log(`Candidate added to ${data.target}`));
            break;
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
    send(data).then(() => {
        loginContainer.style.display = 'none';
        callContainer.style.display = 'block';

        swal('Yay!', `Logged in as, ${store.currentUser}`, 'success');
    }).catch((error) => {
        swal('Oops!', error, 'error');
    });
};

/** logout button click listener */
logoutButton.onclick = () => {
    logout();
};

function startCall(uuid) {
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
                name: store.currentUUID,
                target: uuid,
                type: 'offer',
                sdp: store.myPeerConnection.localDescription
            };
            send(data).then(console.log(`Local SDP sent`));
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
                target: uuid,
                type: 'candidate',
                candidate: event.candidate
            };
            send(data);
        }
    };
}


/** helper function to send data to signaling server */
function send(data) {
    return ws.send(data);
}

/** helper function to log data */
function log(data) {
    console.log(data);
}

/** helper function to logout */
function logout() {
    loginContainer.style.display = 'block';
    callContainer.style.display = 'none';
}

