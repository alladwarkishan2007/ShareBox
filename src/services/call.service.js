import { store } from './store.js';
import { RTC_CONFIG } from '../config/constants.js';

class CallService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.activeCallId = null;
    this.ringTimeout = null;
    this.onRemoteStreamCallback = null;
    this.onCallEndedCallback = null;
  }

  async startCall({ requestId, callerUser, calleeId, onRemoteStream, onCallEnded }) {
    this.onRemoteStreamCallback = onRemoteStream;
    this.onCallEndedCallback = onCallEnded;

    // 1. Get User Media (Audio only)
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      throw new Error('Microphone access denied. Please grant microphone permissions in browser settings.');
    }

    // 2. Initialize RTCPeerConnection
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();

    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    this.peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        this.remoteStream.addTrack(track);
      });
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    const callId = `call_${requestId}`;
    this.activeCallId = callId;

    // 3. ICE Candidates handling
    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        const candId = 'cand_' + Math.random().toString(36).substring(2, 7);
        await store.setDoc(`candidates_caller_${callId}`, candId, event.candidate.toJSON());
      }
    };

    // 4. Create Offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    const callDoc = {
      id: callId,
      requestId,
      callerId: callerUser.uid,
      callerName: callerUser.name || callerUser.email,
      calleeId,
      status: 'calling',
      offer: { type: offer.type, sdp: offer.sdp },
      answer: null,
      createdAt: new Date().toISOString()
    };

    await store.setDoc('calls', callId, callDoc);

    // 5. 30s Callee timeout
    this.ringTimeout = setTimeout(() => {
      if (this.peerConnection && this.peerConnection.connectionState !== 'connected') {
        this.endCall('No answer from user.');
      }
    }, 30000);

    // 6. Listen for Callee Answer
    this.unsubscribeCall = store.subscribe('calls', (c) => c.id === callId, async (calls) => {
      const call = calls[0];
      if (!call) return;

      if (call.status === 'rejected') {
        this.endCall('Call was declined.');
      } else if (call.status === 'ended') {
        this.endCall('Call ended.');
      } else if (call.status === 'accepted' && call.answer && !this.peerConnection.currentRemoteDescription) {
        clearTimeout(this.ringTimeout);
        const answerDesc = new RTCSessionDescription(call.answer);
        await this.peerConnection.setRemoteDescription(answerDesc);

        // Listen for Callee ICE Candidates
        this.unsubscribeCandidates = store.subscribe(`candidates_callee_${callId}`, null, (candidates) => {
          candidates.forEach(async (cand) => {
            try {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('Error adding ICE candidate:', e);
            }
          });
        });
      }
    });

    return callId;
  }

  async answerCall({ callId, calleeUser, onRemoteStream, onCallEnded }) {
    this.activeCallId = callId;
    this.onRemoteStreamCallback = onRemoteStream;
    this.onCallEndedCallback = onCallEnded;

    const call = await store.getDoc('calls', callId);
    if (!call || call.status !== 'calling') {
      throw new Error('Call is no longer active.');
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      await store.updateDoc('calls', callId, { status: 'rejected' });
      throw new Error('Microphone access denied. Cannot answer voice call.');
    }

    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();

    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    this.peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        this.remoteStream.addTrack(track);
      });
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        const candId = 'cand_' + Math.random().toString(36).substring(2, 7);
        await store.setDoc(`candidates_callee_${callId}`, candId, event.candidate.toJSON());
      }
    };

    // Set Remote Description (Caller Offer)
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(call.offer));

    // Create & Set Local Answer
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    await store.updateDoc('calls', callId, {
      status: 'accepted',
      answer: { type: answer.type, sdp: answer.sdp }
    });

    // Listen for Caller ICE Candidates
    this.unsubscribeCandidates = store.subscribe(`candidates_caller_${callId}`, null, (candidates) => {
      candidates.forEach(async (cand) => {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      });
    });

    // Listen for Call Terminations
    this.unsubscribeCall = store.subscribe('calls', (c) => c.id === callId, (calls) => {
      const currentCall = calls[0];
      if (currentCall && currentCall.status === 'ended') {
        this.endCall('Call ended.');
      }
    });

    return true;
  }

  async rejectCall(callId) {
    if (callId) {
      await store.updateDoc('calls', callId, { status: 'rejected' });
    }
  }

  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled; // returns isMuted
      }
    }
    return false;
  }

  async endCall(reason = 'Call ended') {
    if (this.ringTimeout) clearTimeout(this.ringTimeout);

    if (this.unsubscribeCall) this.unsubscribeCall();
    if (this.unsubscribeCandidates) this.unsubscribeCandidates();

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.activeCallId) {
      try {
        await store.updateDoc('calls', this.activeCallId, { status: 'ended' });
      } catch (e) {}
      this.activeCallId = null;
    }

    if (this.onCallEndedCallback) {
      this.onCallEndedCallback(reason);
      this.onCallEndedCallback = null;
    }
  }

  listenForIncomingCalls(userId, callback) {
    return store.subscribe('calls', (call) => {
      return call.calleeId === userId && call.status === 'calling';
    }, (calls) => {
      if (calls.length > 0) {
        callback(calls[0]);
      }
    });
  }
}

export const callService = new CallService();
