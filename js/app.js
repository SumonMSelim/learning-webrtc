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
store.currentUser = window.localStorage.getItem('user') ? window.localStorage.getItem('user') : null;
store.currentUUID = window.localStorage.getItem('uuid') ? window.localStorage.getItem('uuid') : PubNub.generateUUID();

const mediaConstraints = {audio: true, video: true};
const configuration = {
    'iceServers': [{
        'url': 'stun:stun3.l.google.com:19302'
    }]
};

/** create pubnub instance */
const pubnub = new PubNub({
    publishKey: 'pub-c-c4693146-0daf-41a7-803f-299799022629',
    subscribeKey: 'sub-c-900bebea-018a-11e7-8520-02ee2ddab7fe',
    uuid: store.currentUUID
});

/** Subscribe to pubnub and listen to message */
pubnub.addListener({
    status: (e) => {
        if (e.category === "PNConnectedCategory") {
            window.localStorage.setItem('user', store.currentUser);
            window.localStorage.setItem('uuid', store.currentUUID);
            set({name: store.currentUser});
        }
    },
    message: (m) => {
        console.log(`Target: ${m.message.target}`);
        console.log(`User: ${store.currentUUID}`);

        if (m.message.target === store.currentUUID) {
            switch (m.message.type) {
                case 'offer':
                    console.log(`Offer started`);
                    let localStream = null;

                    /** create RTCPeerConnection object */
                    if (store.myPeerConnection === null) {
                        store.myPeerConnection = new RTCPeerConnection(configuration);
                    }

                    store.myPeerConnection.setRemoteDescription(new RTCSessionDescription(m.message.sdp)).then(() => {
                        return navigator.mediaDevices.getUserMedia(mediaConstraints);
                    }).then((stream) => {
                        localStream = stream;
                        localVideo.srcObject = localStream;
                        return store.myPeerConnection.addStream(localStream);
                    }).then(() => {
                        return store.myPeerConnection.createAnswer();
                    }).then((answer) => {
                        return store.myPeerConnection.setLocalDescription(answer);
                    }).then(() => {
                        let data = {
                            name: store.currentUUID,
                            target: m.message.name,
                            type: 'answer',
                            sdp: store.myPeerConnection.localDescription
                        };
                        send(data);
                    }).catch((e) => {
                        swal('Oops!', e.message, 'error');
                        closeVideoCall();
                    });
                    break;

                case 'answer':
                    console.log(`Answer started`);
                    store.myPeerConnection.setRemoteDescription(new RTCSessionDescription(m.message.sdp));
                    break;

                case 'candidate':
                    console.log(`Candidate started ${store.myPeerConnection}`);
                    /** create RTCPeerConnection object */
                    if (store.myPeerConnection === null) {
                        store.myPeerConnection = new RTCPeerConnection(configuration);
                    }
                    let candidate = new RTCIceCandidate(m.message.candidate);
                    store.myPeerConnection.addIceCandidate(candidate);
                    break;
            }
        }
    }
})
;

if (store.currentUser !== null) {
    getUsers();
    callContainer.style.display = 'block';
} else {
    loginContainer.style.display = 'block';
}

/** login button click listener */
loginButton.onclick = () => {
    logout();
    store.currentUser = userInput.value;
    pubnub.subscribe({channels: ['webrtc'], withPresence: true});
    let data = {type: 'login', name: store.currentUser};
    /** send data to pubnub */
    send(data).then(() => {
        getUsers();
        loginContainer.style.display = 'none';
        callContainer.style.display = 'block';

        swal('Yay!', `Logged in as, ${store.currentUser}`, 'success');
    }).catch((error) => {
        swal('Oops!', error, 'error');
    });
};

/** users list button click listener */
usersButton.onclick = () => {
    getUsers();
};

/** logout button click listener */
logoutButton.onclick = () => {
    logout();
};

function startCall(uuid) {
    /** create RTCPeerConnection object */
    store.myPeerConnection = new RTCPeerConnection(configuration);

    navigator.mediaDevices.getUserMedia(mediaConstraints).then((localStream) => {
        localVideo.srcObject = localStream;
        store.myPeerConnection.addStream(localStream);
    }).catch((e) => {
        swal('Oops!', e.message, 'error');
        closeVideoCall();
    });

    /** setup negotiation handling */
    store.myPeerConnection.onnegotiationneeded = () => {
        console.log(`Offer negotiation started`);
        store.myPeerConnection.createOffer().then((offer) => {
            return store.myPeerConnection.setLocalDescription(offer);
        }).then(() => {
            let data = {
                name: store.currentUUID,
                target: uuid,
                type: 'offer',
                sdp: store.myPeerConnection.localDescription
            };
            send(data).then(response => console.log(response));
        });
    };

    /** setup add stream handling */
    store.myPeerConnection.onaddstream = (event) => {
        remoteVideo.srcObject = event.stream;
    };

    /** setup ICE handling */
    store.myPeerConnection.onicecandidate = function (event) {
        console.log(`ICE found`);
        if (event.candidate) {
            let data = {
                target: uuid,
                type: 'candidate',
                candidate: event.candidate
            };
            send(data).then(response => console.log(response));
        }
    };
}

/** helper function to get online users */
function getUsers() {
    pubnub.hereNow({channels: ['webrtc'], includeState: true}).then((response) => {
        document.getElementById('online').innerHTML = `Online Users: ${response.channels.webrtc.occupancy}`;
        if (response.channels.webrtc.occupancy === 0) {
            logout();
        } else {
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
        }
    });
}


/** helper function to send data to pubnub */
function send(data) {
    return pubnub.publish({message: data, channel: 'webrtc'});
}

/** helper function to set additional data to pubnub */
function set(data) {
    return pubnub.setState({state: data, channels: ["webrtc"]});
}

function logout() {
    window.localStorage.removeItem('uuid');
    window.localStorage.removeItem('user');
    pubnub.unsubscribe({channels: ['webrtc']});

    loginContainer.style.display = 'block';
    callContainer.style.display = 'none';
}

