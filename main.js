let APP_ID = "97ee448957c04bd8896daf5a83b2891b"
let token = "4d851ee369c3425ca483a291c3d65d33";
let uid = String(Math.floor(Math.random() * 10000))

let client;
let channel;

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if(!roomId){
    window.location = 'lobby.html'
}

let localStream;
let remoteStream;
let peerConnection;

let chatMessages = []
let participants = []

const servers = {
    iceServers:[
        {
            urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}


let constraints = {
    video:{
        width:{min:640, ideal:1920, max:1920},
        height:{min:480, ideal:1080, max:1080},
    },
    audio:true
}
function addChatMessage(MemberId, message) {
    chatMessages.push({ MemberId, message });
}


// Function to remove a participant
function removeParticipant(MemberId) {
    const index = participants.indexOf(MemberId);
    if (index !== -1) {
        participants.splice(index, 1);
    }
}
// Function to update the chat UI with the messages
function updateChatUI() {
    const chatMessagesContainer = document.getElementById('chat-messages');
    chatMessagesContainer.innerHTML = '';
  
    for (const chatMessage of chatMessages) {
        const messageElement = document.createElement('li');
        messageElement.textContent = ` ${chatMessage.message}`;
        chatMessagesContainer.appendChild(messageElement);
    }
}

// Function to send a chat message
async function sendChatMessage(message) {
    console.log('sendChatMessage called on user 2', participants);
    if (!peerConnection) {
        console.log('PeerConnection not initialized');
        return;
      }
    
      try {
        const chatMessage = {
          type: 'chat',
          content: message,
        };
    
        const members = await channel.getMembers();
        console.log(members)
        for (const participant of members) {
          if (participant !== uid) {
            console.log("participant",participant)
            await client.sendMessageToPeer({ text: JSON.stringify(chatMessage) }, participant);
          }
        }
    
        addChatMessage(uid, message);
        updateChatUI();
      } catch (error) {
        console.log(error);
      }
    }

let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid, token})

    channel = client.createChannel(roomId)
    await channel.join()

    channel.on('MemberJoined', handleUserJoined)
    channel.on('MemberLeft', handleUserLeft)
    client.on('MessageFromPeer', handleMessageFromPeer)

    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    document.getElementById('user-1').srcObject = localStream
    document.getElementById('chatForm').addEventListener('submit', async (event) => {
    event.preventDefault()

    const message = document.getElementById('chat-message-input').value
    document.getElementById('chat-message-input').value = ''

    await sendChatMessage(message)
    })
}
 

let handleUserLeft = (MemberId) => {
    removeParticipant(MemberId)
    document.getElementById('user-2').style.display = 'none'
    document.getElementById('user-1').classList.remove('smallFrame')
}

let handleMessageFromPeer = async (message, MemberId) => {

    message = JSON.parse(message.text);
   console.log("receiving from" , MemberId);
   
      if (message.type === 'chat') {
        const chatMessageContent = message.content;
        const chatMessagesContainer = document.getElementById('chat-messages');
        const messageElement = document.createElement('li');
        messageElement.textContent = `${chatMessageContent}`;
        chatMessagesContainer.appendChild(messageElement);
        addChatMessage(MemberId, chatMessageContent); // Add the chat message to the chatMessages array
        updateChatUI();
      }
  
      if (message.type === 'offer') {
        createAnswer(MemberId, message.offer);
      }
  
      if (message.type === 'answer') {
        addAnswer(message.answer);
      }
  
      if (message.type === 'candidate') {
        if (peerConnection) {
          peerConnection.addIceCandidate(message.candidate);
        }
      }
      updateChatUI();
    }
  
let handleUserJoined = async (MemberId) => {
    participants.push(MemberId);
    console.log('A new user joined the channel:', MemberId)
    createOffer(MemberId)
}


let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers)

    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream
    document.getElementById('user-2').style.display = 'block'

    document.getElementById('user-1').classList.add('smallFrame')


    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:false})
        document.getElementById('user-1').srcObject = localStream
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }

    peerConnection.onicecandidate = async (event) => {
        if(event.candidate){
            client.sendMessageToPeer({text:JSON.stringify({'type':'candidate', 'candidate':event.candidate})}, MemberId)
        }
    }
}

let createOffer = async (MemberId) => {
    await createPeerConnection(MemberId)

    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'offer', 'offer':offer})}, MemberId)
}


let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'answer', 'answer':answer})}, MemberId)
}


let addAnswer = async (answer) => {
    if(!peerConnection.currentRemoteDescription){
        peerConnection.setRemoteDescription(answer)
    }
}


let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if(videoTrack.enabled){
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }else{
        videoTrack.enabled = true
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if(audioTrack.enabled){
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }else{
        audioTrack.enabled = true
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}
  
window.addEventListener('beforeunload', leaveChannel)

document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)

init()