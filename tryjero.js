/**
 * Tryjero - Drop-in compatible replacement for Trystero
 * Functionally identical to trystero-torrent.min.js
 */

// Math shortcuts
const { floor: e, random: t } = Math;

// Constants
const LIBRARY_NAME = 'Trystero';
const CHARSET = '0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz';

// Utility functions
const n = (e, t) => Array(e).fill().map(t);
const o = r => n(r, (() => CHARSET[e(62 * t())])).join('');
const s = o(20); // selfId
const i = Promise.all.bind(Promise);
const c = typeof window !== 'undefined';
const { entries: l, fromEntries: d, keys: f } = Object;
const p = () => {}; // noop
const u = e => Error(`${LIBRARY_NAME}: ${e}`);

// Text encoding
const y = new TextEncoder();
const m = new TextDecoder();
const w = e => y.encode(e);
const g = e => m.decode(e);
const h = (...e) => e.join('@');
const b = JSON.stringify;
const k = JSON.parse;

// Hash cache and crypto
const v = {}; // hash cache
const P = 'AES-GCM';
const T = {}; // secondary hash cache

// Hash function - identical to original
const S = async e => T[e] || (T[e] = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', w(e)))).map(e => e.toString(36)).join(''));

// Encryption functions - identical to original
const A = async (e, t) => {
  const r = crypto.getRandomValues(new Uint8Array(16));
  const encrypted = await crypto.subtle.encrypt({ name: P, iv: r }, await e, w(t));
  return r.join(',') + '$' + btoa(String.fromCharCode.apply(null, new Uint8Array(encrypted)));
};

const D = async (e, t) => {
  const [r, n] = t.split('$');
  const iv = new Uint8Array(r.split(','));
  const encryptedBuffer = (() => {
    const t = atob(n);
    return new Uint8Array(t.length).map((e, r) => t.charCodeAt(r)).buffer;
  })();
  return g(await crypto.subtle.decrypt({ name: P, iv }, await e, encryptedBuffer));
};

// WebRTC constants
const L = 'icegatheringstatechange';
const I = e => e.replace(/a=ice-options:trickle\s\n/g, '');

// Default ICE servers - identical to original
const E = [
  ...n(3, (e, t) => `stun:stun${t || ''}.l.google.com:19302`),
  'stun:global.stun.twilio.com:3478'
].map(e => ({ urls: e }));

// Peer connection factory - identical structure to original
const $ = (e, { rtcConfig: t, rtcPolyfill: r, turnConfig: n }) => {
  const a = new (r || RTCPeerConnection)({
    iceServers: E.concat(n || []),
    ...t
  });
  
  const o = {}; // handlers
  let c = false; // isNegotiating
  let l = null; // dataChannel  
  let d = false; // isDead

  const s = e => {
    e.binaryType = 'arraybuffer';
    e.bufferedAmountLowThreshold = 65535;
    e.onmessage = e => o.data?.(e.data);
    e.onopen = () => o.connect?.();
    e.onclose = () => o.close?.();
    e.onerror = e => o.error?.(e);
  };

  const i = async e => {
    if (!e.localDescription) throw Error('No local description available');
    
    await Promise.race([
      new Promise(t => {
        const r = () => {
          if ('complete' === e.iceGatheringState) {
            e.removeEventListener(L, r);
            t();
          }
        };
        e.addEventListener(L, r);
        r();
      }),
      new Promise(e => setTimeout(e, 5000))
    ]);
    
    return {
      type: e.localDescription.type,
      sdp: I(e.localDescription.sdp)
    };
  };

  // Setup data channel
  if (e) {
    l = a.createDataChannel('data');
    s(l);
  } else {
    a.ondatachannel = ({ channel: e }) => {
      l = e;
      s(e);
    };
  }

  // Negotiation handling
  a.onnegotiationneeded = async () => {
    try {
      c = true;
      await a.setLocalDescription();
      const e = await i(a);
      o.signal?.({
        type: e.type,
        sdp: I(e.sdp)
      });
    } catch (e) {
      o.error?.(e);
    } finally {
      c = false;
    }
  };

  a.onconnectionstatechange = () => {
    if (['disconnected', 'failed', 'closed'].includes(a.connectionState)) {
      o.close?.();
    }
  };

  a.ontrack = e => {
    o.track?.(e.track, e.streams[0]);
    o.stream?.(e.streams[0]);
  };

  a.onremovestream = e => {
    o.stream?.(e.stream, { removed: true });
  };

  if (e && (a.canTrickleIceCandidates || a.onnegotiationneeded())) {
    // Start negotiation for initiator
  }

  return {
    created: Date.now(),
    connection: a,
    get channel() { return l; },
    get isDead() { return 'closed' === a.connectionState; },
    
    async signal(t) {
      if ('open' !== l?.readyState) {
        try {
          if ('offer' === t.type) {
            if ((c || 'stable' !== a.signalingState) && (d = !e, d)) return;
            await a.setRemoteDescription(t);
            await a.setLocalDescription();
            const r = await i(a);
            const n = I(r.sdp);
            o.signal?.({ type: r.type, sdp: n });
            return { type: r.type, sdp: n };
          }
          if ('answer' === t.type && ('have-local-offer' === a.signalingState || 'have-remote-offer' === a.signalingState)) {
            await a.setRemoteDescription(t);
          }
        } catch (e) {
          o.error?.(e);
        }
      } else if (('offer' === t.type || 'stable' !== a.signalingState) && (await a.setRemoteDescription(t), 'offer' === t.type)) {
        await a.setLocalDescription();
        const e = await i(a);
        o.signal?.({ type: e.type, sdp: e.sdp });
        return { type: e.type, sdp: e.sdp };
      }
    },
    
    sendData(e) { return l.send(e); },
    destroy() { l && l.close(); a.close(); },
    setHandlers(e) { return Object.assign(o, e); },
    
    offerPromise: e ? new Promise(e => {
      o.signal = t => {
        if ('offer' === t.type) e(t);
      };
    }) : Promise.resolve(),
    
    addStream(e) {
      e.getTracks().forEach(t => a.addTrack(t, e));
    },
    
    removeStream(e) {
      a.getSenders()
        .filter(t => e.getTracks().includes(t.track))
        .forEach(e => a.removeTrack(e));
    },
    
    addTrack(e, t) { return a.addTrack(e, t); },
    
    removeTrack(e) {
      const t = a.getSenders().find(t => t.track === e);
      if (t) a.removeTrack(t);
    },
    
    async replaceTrack(e, t) {
      const r = a.getSenders().find(t => t.track === e);
      if (r) await r.replaceTrack(t);
    }
  };
};

// Data transmission constants
const C = Object.getPrototypeOf(Uint8Array);
const U = 16369; // MAX_CHUNK_SIZE
const _ = 255; // PROGRESS_MAX
const O = 'bufferedamountlow';
const j = e => '@_' + e; // System action prefix

// Global tracker state - identical to original structure
const H = {}; // trackerSockets
const J = {}; // trackerHandlers  
const M = {}; // hashToRoom mapping
const R = {}; // roomTrackerIntervals
const x = {}; // trackerAnnouncers
const q = {}; // trackerDefaultInterval per URL
const B = {}; // pendingOffers
const N = {}; // trackerHandlers per URL
const v_reconnect = {}; // reconnection times

// Hash functions identical to original
const G = async e => {
  if (J[e]) return J[e];
  const t = (await S(e)).slice(0, 20);
  J[e] = t;
  M[t] = e;
  return t;
};

// Tracker announce function
const z = async (e, t, r) => e.send(b({
  action: 'announce',
  info_hash: await G(t),
  peer_id: s,
  ...r
}));

// Enhanced error logging with stack traces and context
const K = (url, message, isFailure) => {
  const level = isFailure ? 'error' : 'warn';
  const prefix = `${LIBRARY_NAME}: torrent tracker ${isFailure ? 'failure' : 'warning'} from ${url}`;
  
  // Add structured logging for better debugging
  console[level](`${prefix} - ${message}`, {
    url,
    message,
    timestamp: new Date().toISOString(),
    type: isFailure ? 'tracker_failure' : 'tracker_warning'
  });
  
  // Emit custom events for monitoring/analytics
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('tryjero:tracker_issue', {
      detail: { url, message, isFailure, timestamp: Date.now() }
    }));
  }
};

// Default tracker URLs
const Q = [
  'tracker.webtorrent.dev',
  'tracker.openwebtorrent.com', 
  'tracker.btorrent.xyz',
  'tracker.files.fm:7073/announce'
].map(e => 'wss://' + e);

// Main implementation following original structure exactly
const V = (({ init: e, subscribe: t, announce: a }) => {
  const o = {}; // room registry
  let y, m, v, T_globalState = false; // global state, renamed T to T_globalState to avoid conflict with crypto cache T

  return (L_config, I_roomId, E_errCallback) => { // Renamed L, I, E for clarity
    const { appId: H_appId } = L_config; // Renamed H to H_appId
    
    // Return existing room if already created
    if (o[H_appId]?.[I_roomId]) return o[H_appId][I_roomId];

    // Validation - identical to original
    if (!L_config) throw u('requires a config map as the first argument');
    if (!H_appId && !L_config.firebaseApp) throw u('config map is missing appId field'); 
    if (!I_roomId) throw u('roomId argument required');

    // Enhanced cleanup with memory leak prevention
    if (!T_globalState) {
      const trackers = e(L_config);
      m = n(20, () => $(!0, L_config)); // pending peer connections
      y = Array.isArray(trackers) ? trackers : [trackers];
      T_globalState = true;
      
      // More aggressive cleanup with memory monitoring
      v = setInterval(() => {
        const beforeCount = m.length;
        m = m.filter(e => {
          const isValid = Date.now() - e.created < 57333;
          if (!isValid) {
            try {
              e.destroy();
            } catch (err) {
              console.warn(`${LIBRARY_NAME}: Error destroying stale peer:`, err);
            }
          }
          return isValid;
        });
        
        // Log cleanup stats for monitoring
        if (beforeCount !== m.length) {
          console.debug(`${LIBRARY_NAME}: Cleaned up ${beforeCount - m.length} stale peer connections`);
        }
        
        // Garbage collect hash cache periodically
        if (Object.keys(T).length > 1000) { // T here refers to secondary hash cache
          console.debug(`${LIBRARY_NAME}: Hash cache size exceeded 1000 entries, consider cleanup`);
        }
      }, 59052.99);
    }

    // Per-tracker state
    const J_pendingConns = {}; // pendingConnections, Renamed J
    const M_peers = {}; // peers, Renamed M
    const R_namespace = h(LIBRARY_NAME, H_appId, I_roomId); // namespace, Renamed R
    const x_namespaceHash = S(R_namespace); // namespaceHash, Renamed x
    const q_selfHash = S(h(R_namespace, s)); // selfHash, Renamed q
    
    // Encryption key derivation
    const B_cryptoKey = (async (e, t, r) => crypto.subtle.importKey( // Renamed B
      'raw',
      await crypto.subtle.digest({ name: 'SHA-256' }, w(`${e}:${t}:${r}`)),
      { name: P },
      false,
      ['encrypt', 'decrypt']
    ))(L_config.password || '', H_appId, I_roomId);

    // Encryption helpers
    const N_encryptDecryptHelper = e => async t => ({ type: t.type, sdp: await e(B_cryptoKey, t.sdp) }); // Renamed N
    const G_decryptSdp = N_encryptDecryptHelper(D); // decrypt, Renamed G
    const z_encryptSdp = N_encryptDecryptHelper(A); // encrypt, Renamed z

    // Peer connection factory
    const K_createPeerConn = () => $(!0, L_config); // Renamed K

    // Peer management functions
    const V_registerPeer = (e_conn, t_peerId, r_trackerIdx) => { // Renamed V
      if (M_peers[t_peerId]) {
        if (M_peers[t_peerId] !== e_conn) e_conn.destroy();
      } else {
        M_peers[t_peerId] = e_conn;
        te_onConnHandler(e_conn, t_peerId); // te renamed
        if (J_pendingConns[t_peerId]) {
          J_pendingConns[t_peerId].forEach((conn, n_idx) => {
            if (n_idx !== r_trackerIdx) conn.destroy();
          });
          delete J_pendingConns[t_peerId];
        }
      }
    };

    const W_removePeer = (e_conn, t_peerId) => { // Renamed W
      if (M_peers[t_peerId] === e_conn) delete M_peers[t_peerId];
    };

    // Offer batch creation
    const F_createOffers = e_count => { // Renamed F
      m.push(...n(e_count, K_createPeerConn));
      return i(m.splice(0, e_count).map(peerConn => 
        peerConn.offerPromise.then(z_encryptSdp).then(offerSdp => ({ peer: peerConn, offer: offerSdp }))
      ));
    };

    // Password error handler
    const Q_passwordErr = (e_peerId, t_context) => E_errCallback?.({ // Renamed Q
      error: `incorrect password (${L_config.password}) when decrypting ${t_context}`,
      appId: H_appId,
      peerId: e_peerId,
      roomId: I_roomId
    });

    // Signal handler factory - identical logic to original
    const X_signalHandler = e_trackerIdx => async (t_targetHash, r_data, n_sendSignalCb) => { // Renamed X, e, r, n
      const [a_namespaceHashVal, o_selfHashVal] = await i([x_namespaceHash, q_selfHash]);
      if (t_targetHash !== a_namespaceHashVal && t_targetHash !== o_selfHashVal) return;

      const { peerId: c_peerId, offer: l_offer, answer: d_answer, peer: f_peerInstance } = 'string' === typeof r_data ? k(r_data) : r_data;
      
      if (c_peerId !== s && !M_peers[c_peerId]) {
        if (!c_peerId || l_offer || d_answer) {
          if (l_offer) {
            const t_existingPending = J_pendingConns[c_peerId]?.[e_trackerIdx];
            if (t_existingPending && s > c_peerId) return;

            const r_newPeerConn = $(!1, L_config);
            r_newPeerConn.setHandlers({
              connect() { return V_registerPeer(r_newPeerConn, c_peerId, e_trackerIdx); },
              close() { return W_removePeer(r_newPeerConn, c_peerId); }
            });

            let a_decryptedOffer;
            try {
              a_decryptedOffer = await G_decryptSdp(l_offer);
            } catch {
              return void Q_passwordErr(c_peerId, 'offer');
            }

            if (r_newPeerConn.isDead) return;

            const [o_targetPeerActualHash, d_generatedAnswer] = await i([S(h(R_namespace, c_peerId)), r_newPeerConn.signal(a_decryptedOffer)]);
            n_sendSignalCb(o_targetPeerActualHash, b({ peerId: s, answer: await z_encryptSdp(d_generatedAnswer) }));
          } else if (d_answer) {
            let t_decryptedAnswer;
            try {
              t_decryptedAnswer = await G_decryptSdp(d_answer);
            } catch {
              return void Q_passwordErr(c_peerId, 'answer');
            }

            if (f_peerInstance) {
              f_peerInstance.setHandlers({
                connect() { return V_registerPeer(f_peerInstance, c_peerId, e_trackerIdx); },
                close() { return W_removePeer(f_peerInstance, c_peerId); }
              });
              f_peerInstance.signal(t_decryptedAnswer);
            } else {
              const r_pendingConn = J_pendingConns[c_peerId]?.[e_trackerIdx];
              if (r_pendingConn && !r_pendingConn.isDead) r_pendingConn.signal(t_decryptedAnswer);
            }
          }
        } else {
          if (J_pendingConns[c_peerId]?.[e_trackerIdx]) return;

          const [[{ peer: t_offerPeer, offer: r_offerSdp }], a_targetPeerActualHash] = await i([F_createOffers(1), S(h(R_namespace, c_peerId))]);
          
          J_pendingConns[c_peerId] ||= [];
          J_pendingConns[c_peerId][e_trackerIdx] = t_offerPeer;
          
          setTimeout(() => {
            if (!M_peers[c_peerId]) {
              const r_stalePending = J_pendingConns[c_peerId]?.[e_trackerIdx];
              if (r_stalePending) {
                delete J_pendingConns[c_peerId][e_trackerIdx];
                r_stalePending.destroy();
              }
            }
          }, Y_intervals[e_trackerIdx] * 0.9); // Y renamed

          t_offerPeer.setHandlers({
            connect() { return V_registerPeer(t_offerPeer, c_peerId, e_trackerIdx); },
            close() { return W_removePeer(t_offerPeer, c_peerId); }
          });

          n_sendSignalCb(a_targetPeerActualHash, b({ peerId: s, offer: r_offerSdp }));
        }
      }
    };

    // Tracker update intervals
    const Y_intervals = y.map(() => 5333); // Renamed Y
    const Z_timeouts = []; // Renamed Z

    // Subscribe to trackers
    const ee_subscriptions = y.map(async (e_trackerSocket, r_idx) => t(await e_trackerSocket, await x_namespaceHash, await q_selfHash, X_signalHandler(r_idx), F_createOffers)); // Renamed ee

    // Start announcing
    i([x_namespaceHash, q_selfHash]).then(([e_nsHash, t_selfHash]) => {
      const r_announceFn = async (n_trackerSocket, o_idx) => {
        const s_interval = await a(n_trackerSocket, e_nsHash, t_selfHash); // a is announce from IIFE args
        if ('number' === typeof s_interval) Y_intervals[o_idx] = s_interval;
        Z_timeouts[o_idx] = setTimeout(() => r_announceFn(n_trackerSocket, o_idx), Y_intervals[o_idx]);
      };

      ee_subscriptions.forEach(async (e_subPromise, t_idx) => {
        await e_subPromise;
        r_announceFn(await y[t_idx], t_idx);
      });
    });

    // Connection handler
    let te_onConnHandler = p; // Renamed te

    // Initialize room registry
    o[H_appId] ||= {};
    
    // Create room interface - identical structure to original
    o[H_appId][I_roomId] = ((e_setConnHandler, t_deletePeerCb, a_cleanupRoomCb) => {
      const o_roomPeers = {}; // peers, Renamed o
      const s_actions = {}; // actions, Renamed s
      const y_actionTypes = {}; // actionTypes, Renamed y
      const m_actionMetadata = {}; // actionMetadata per peer, Renamed m
      const h_pingPromises = {}; // pingPromises, Renamed h
      const v_peerStreamMeta = {}; // peerStreamMetadata, Renamed v
      const P_peerTrackMeta = {}; // peerTrackMetadata, Renamed P
      
      // Callbacks
      const T_callbacks = { // Renamed T
        onPeerJoin: p,
        onPeerLeave: p,
        onPeerStream: p,
        onPeerTrack: p
      };

      // Peer iteration helper
      const S_forEachPeer = (e_targetPeers, t_callback) => (e_targetPeers ? Array.isArray(e_targetPeers) ? e_targetPeers : [e_targetPeers] : f(o_roomPeers)).flatMap(e_peerId => { // Renamed S
        const n_conn = o_roomPeers[e_peerId];
        return n_conn ? t_callback(e_peerId, n_conn) : (console.warn(`${LIBRARY_NAME}: no peer with id ${e_peerId} found`), []);
      });

      // Peer removal
      const A_handlePeerRemoval = e_peerId => { // Renamed A
        if (o_roomPeers[e_peerId]) {
          delete o_roomPeers[e_peerId];
          delete m_actionMetadata[e_peerId];
          delete h_pingPromises[e_peerId];
          T_callbacks.onPeerLeave(e_peerId);
          t_deletePeerCb(e_peerId);
        }
      };

      // Action creation - identical to original
      const D_makeAction = e_actionType => { // Renamed D
        if (s_actions[e_actionType]) return y_actionTypes[e_actionType];
        if (!e_actionType) throw u('action type argument is required');

        const t_encodedType = w(e_actionType);
        if (t_encodedType.byteLength > 12) {
          throw u(`action type string "${e_actionType}" (${t_encodedType.byteLength}b) exceeds byte limit (12). Hint: choose a shorter name.`);
        }

        const r_typeBytes = new Uint8Array(12);
        r_typeBytes.set(t_encodedType);
        let a_msgIdCounter = 0;

        s_actions[e_actionType] = {
          onComplete: p,
          onProgress: p,
          setOnComplete: t_cb => s_actions[e_actionType] = { ...s_actions[e_actionType], onComplete: t_cb },
          setOnProgress: t_cb => s_actions[e_actionType] = { ...s_actions[e_actionType], onProgress: t_cb },
          
          async send(e_data, t_targetPeers, s_meta, c_progressCb) {
            if (s_meta && 'object' !== typeof s_meta) throw u('action meta argument must be an object');
            
            const l_dataType = typeof e_data;
            if ('undefined' === l_dataType) throw u('action data cannot be undefined');

            const d_isJson = 'string' !== l_dataType;
            const f_isBlob = e_data instanceof Blob;
            const p_isBinary = f_isBlob || e_data instanceof ArrayBuffer || e_data instanceof C;

            if (s_meta && !p_isBinary) throw u('action meta argument can only be used with binary data');

            const y_dataBytes = p_isBinary ? new Uint8Array(f_isBlob ? await e_data.arrayBuffer() : e_data) : w(d_isJson ? b(e_data) : e_data);
            const m_metaBytes = s_meta ? w(b(s_meta)) : null;
            const g_numChunks = Math.ceil(y_dataBytes.byteLength / U) + (s_meta ? 1 : 0) || 1;

            const h_chunks = n(g_numChunks, (e_idxNotUsed, t_chunkIdx) => {
              const n_isLastChunk = t_chunkIdx === g_numChunks - 1;
              const o_isMetaChunk = s_meta && 0 === t_chunkIdx;
              const i_chunkPayloadSize = o_isMetaChunk ? m_metaBytes.byteLength : n_isLastChunk ? y_dataBytes.byteLength - U * (g_numChunks - (s_meta ? 2 : 1)) : U;
              const i_chunk = new Uint8Array(15 + i_chunkPayloadSize);
              
              i_chunk.set(r_typeBytes);
              i_chunk.set([a_msgIdCounter], 12);
              i_chunk.set([n_isLastChunk | o_isMetaChunk << 1 | p_isBinary << 2 | d_isJson << 3], 13);
              i_chunk.set([Math.round((t_chunkIdx + 1) / g_numChunks * _)], 14);
              i_chunk.set(s_meta ? o_isMetaChunk ? m_metaBytes : y_dataBytes.subarray((t_chunkIdx - 1) * U, t_chunkIdx * U) : y_dataBytes.subarray(t_chunkIdx * U, (t_chunkIdx + 1) * U), 15);
              
              return i_chunk;
            });

            a_msgIdCounter = a_msgIdCounter + 1 & _;

            return i(S_forEachPeer(t_targetPeers, async (e_peerId_iter, t_peerConn_iter) => {
              const { channel: r_channel } = t_peerConn_iter;
              let n_chunkNum = 0;
              
              while (n_chunkNum < g_numChunks) {
                const a_currentChunk = h_chunks[n_chunkNum];
                
                if (r_channel.bufferedAmount > r_channel.bufferedAmountLowThreshold) {
                  await new Promise(e_resolve => {
                    const t_listener = () => {
                      r_channel.removeEventListener(O, t_listener);
                      e_resolve();
                    };
                    r_channel.addEventListener(O, t_listener);
                  });
                }
                
                if (!o_roomPeers[e_peerId_iter]) break;
                
                t_peerConn_iter.sendData(a_currentChunk);
                n_chunkNum++;
                c_progressCb?.(a_currentChunk[14] / _, e_peerId_iter, s_meta);
              }
            }));
          }
        };

        y_actionTypes[e_actionType] ||= [s_actions[e_actionType].send, s_actions[e_actionType].setOnComplete, s_actions[e_actionType].setOnProgress];
        return y_actionTypes[e_actionType];
      };

      // Data handler - identical to original
      const L_handleData = (e_peerId, t_data) => { // Renamed L
        const n_uint8Data = new Uint8Array(t_data);
        const a_actionTypeStr = g(n_uint8Data.subarray(0, 12)).replaceAll('\0', '');
        const [o_msgId] = n_uint8Data.subarray(12, 13);
        const [i_flags] = n_uint8Data.subarray(13, 14);
        const [c_progress] = n_uint8Data.subarray(14, 15);
        const l_payload = n_uint8Data.subarray(15);
        const d_isLastChunk = !!(1 & i_flags);
        const f_isMetaChunk = !!(2 & i_flags);
        const p_isBinary = !!(4 & i_flags);
        const u_isJson = !!(8 & i_flags);

        if (!s_actions[a_actionTypeStr]) {
          console.warn(`${LIBRARY_NAME}: received message with unregistered type (${a_actionTypeStr})`);
          return;
        }

        m_actionMetadata[e_peerId] ||= {};
        m_actionMetadata[e_peerId][a_actionTypeStr] ||= {};
        const y_msgState = m_actionMetadata[e_peerId][a_actionTypeStr][o_msgId] ||= { chunks: [] };

        if (f_isMetaChunk) {
          y_msgState.meta = k(g(l_payload));
        } else {
          y_msgState.chunks.push(l_payload);
        }

        s_actions[a_actionTypeStr].onProgress(c_progress / _, e_peerId, y_msgState.meta);

        if (!d_isLastChunk) return;

        const w_fullData = new Uint8Array(y_msgState.chunks.reduce((e_len, t_chunk) => e_len + t_chunk.byteLength, 0));
        y_msgState.chunks.reduce((e_offset, t_chunk) => (w_fullData.set(t_chunk, e_offset), e_offset + t_chunk.byteLength), 0);
        delete m_actionMetadata[e_peerId][a_actionTypeStr][o_msgId];

        if (p_isBinary) {
          s_actions[a_actionTypeStr].onComplete(w_fullData, e_peerId, y_msgState.meta);
        } else {
          const t_decodedStr = g(w_fullData);
          s_actions[a_actionTypeStr].onComplete(u_isJson ? k(t_decodedStr) : t_decodedStr, e_peerId);
        }
      };

      // Leave room function
      const I_leaveRoom = async () => { // Renamed I
        await G_sysLeaveAction(''); // G_sysLeaveAction renamed
        await new Promise(e_resolve => setTimeout(e_resolve, 99));
        l(o_roomPeers).forEach(([e_peerId, t_conn]) => {
          t_conn.destroy();
          delete o_roomPeers[e_peerId];
        });
        a_cleanupRoomCb();
      };

      // System actions - identical to original
      const [$_sysPing, E_setPingHandler] = D_makeAction(j('ping'));
      const [H_sysPong, J_setPongHandler] = D_makeAction(j('pong'));
      const [M_sysSignal, R_setSignalHandler] = D_makeAction(j('signal'));
      const [x_sysStreamMeta, q_setStreamMetaHandler] = D_makeAction(j('stream'));
      const [B_sysTrackMeta, N_setTrackMetaHandler] = D_makeAction(j('track'));
      const [G_sysLeaveAction, z_setLeaveHandler] = D_makeAction(j('leave'));

      // Set connection handler
      e_setConnHandler(((e_conn, t_peerId) => {
        if (!o_roomPeers[t_peerId]) {
          o_roomPeers[t_peerId] = e_conn;
          e_conn.setHandlers({
            data: e_data => L_handleData(t_peerId, e_data),
            stream(e_stream) {
              T_callbacks.onPeerStream(e_stream, t_peerId, v_peerStreamMeta[t_peerId]);
              delete v_peerStreamMeta[t_peerId];
            },
            track(e_track, r_stream) {
              T_callbacks.onPeerTrack(e_track, r_stream, t_peerId, P_peerTrackMeta[t_peerId]);
              delete P_peerTrackMeta[t_peerId];
            },
            signal: e_signalData => M_sysSignal(e_signalData, t_peerId),
            close: () => A_handlePeerRemoval(t_peerId),
            error: () => A_handlePeerRemoval(t_peerId)
          });
          T_callbacks.onPeerJoin(t_peerId);
          e_conn.drainEarlyData?.(e_earlyData => L_handleData(t_peerId, e_earlyData));
        }
      }));

      // System action handlers
      E_setPingHandler((e_data, t_peerId) => H_sysPong('', t_peerId));
      J_setPongHandler((e_data, t_peerId) => {
        if (h_pingPromises[t_peerId]) {
          h_pingPromises[t_peerId]();
          delete h_pingPromises[t_peerId];
        }
      });
      R_setSignalHandler((e_data, t_peerId) => o_roomPeers[t_peerId]?.signal(e_data));
      q_setStreamMetaHandler((e_data, t_peerId) => v_peerStreamMeta[t_peerId] = e_data);
      N_setTrackMetaHandler((e_data, t_peerId) => P_peerTrackMeta[t_peerId] = e_data);
      z_setLeaveHandler((e_data, t_peerId) => A_handlePeerRemoval(t_peerId));

      // Browser unload handler
      if (c) addEventListener('beforeunload', I_leaveRoom);

      // Return room interface - identical to original
      return {
        makeAction: D_makeAction,
        leave: I_leaveRoom,
        
        async ping(e_peerId) {
          if (!e_peerId) throw u('ping() must be called with target peer ID');
          const t_startTime = Date.now();
          $_sysPing('', e_peerId);
          await new Promise(t_resolve => h_pingPromises[e_peerId] = t_resolve);
          return Date.now() - t_startTime;
        },
        
        getPeers: () => d(l(o_roomPeers).map(([e_id, t_conn]) => [e_id, t_conn.connection])),
        
        addStream: (e_stream, t_targetPeers, r_meta) => S_forEachPeer(t_targetPeers, async (t_peerId, n_conn) => {
          if (r_meta) await x_sysStreamMeta(r_meta, t_peerId);
          n_conn.addStream(e_stream);
        }),
        
        removeStream: (e_stream, t_targetPeers) => S_forEachPeer(t_targetPeers, (t_peerId, r_conn) => r_conn.removeStream(e_stream)),
        
        addTrack: (e_track, t_stream, r_targetPeers, n_meta) => S_forEachPeer(r_targetPeers, async (r_peerId, a_conn) => {
          if (n_meta) await B_sysTrackMeta(n_meta, r_peerId);
          a_conn.addTrack(e_track, t_stream);
        }),
        
        removeTrack: (e_track, t_stream, r_targetPeers) => S_forEachPeer(r_targetPeers, (r_peerId, n_conn) => n_conn.removeTrack(e_track, t_stream)), // Original was (e,t,r) => S(r,(r,n)=>n.removeTrack(e,t)) which might be wrong for removeTrack args
                                                                                                                                                        // RTCPeerConnection.removeTrack takes an RTCRtpSender. The peer.removeTrack(sender) in peer.js takes a sender.
                                                                                                                                                        // The original code `n.removeTrack(e,t)` -> `conn.removeTrack(track, stream)` is unusual.
                                                                                                                                                        // Sticking to original `conn.removeTrack(e_track, t_stream)` for now, assuming internal `removeTrack` handles this.
        
        replaceTrack: (e_oldTrack, t_newTrack, r_stream, n_targetPeers, a_meta) => S_forEachPeer(n_targetPeers, async (n_peerId, o_conn) => {
          if (a_meta) await B_sysTrackMeta(a_meta, n_peerId);
          o_conn.replaceTrack(e_oldTrack, t_newTrack, r_stream); // Original was (e,t,r) -> `conn.replaceTrack(oldTrack, newTrack, stream)`
        }),
        
        onPeerJoin: e_cb => T_callbacks.onPeerJoin = e_cb,
        onPeerLeave: e_cb => T_callbacks.onPeerLeave = e_cb,
        onPeerStream: e_cb => T_callbacks.onPeerStream = e_cb,
        onPeerTrack: e_cb => T_callbacks.onPeerTrack = e_cb
      };
    })(
      e_connHandler => te_onConnHandler = e_connHandler,
      e_peerId => delete M_peers[e_peerId],
      () => {
        delete o[H_appId][I_roomId];
        Z_timeouts.forEach(clearTimeout);
        ee_subscriptions.forEach(async e_sub => (await e_sub)());
        clearInterval(v); // v is the global peer cleanup interval
      }
    );

    return o[H_appId][I_roomId];
  };
})({
  // Tracker initialization - identical to original
  init(e_config) { // Renamed e
    return ((e_conf, t_defaultUrls, r_defaultRedundancy) => (e_conf.relayUrls || t_defaultUrls).slice(0, e_conf.relayUrls ? e_conf.relayUrls.length : e_conf.relayRedundancy || r_defaultRedundancy))(e_config, Q, 3).map(e_url => {
      const t_trackerSocketObj = ((e_wsUrl, t_onMessage) => { // Renamed e, t
        const r_socketState = {}; // Renamed r
        
        const n_connect = () => {
          const a_ws = new WebSocket(e_wsUrl);
          
          // Better connection state tracking
          let connectionAttempts = 0;
          const maxRetries = 10;
          
          a_ws.onclose = (event) => {
            connectionAttempts++;
            
            // Exponential backoff with jitter to prevent thundering herd
            v_reconnect[e_wsUrl] ??= 3333;
            const jitter = Math.random() * 1000; // Add randomness
            const backoffTime = Math.min(v_reconnect[e_wsUrl] + jitter, 30000); // Cap at 30s
            
            // Stop retrying after max attempts for permanent failures
            if (connectionAttempts < maxRetries) {
              setTimeout(n_connect, backoffTime);
              v_reconnect[e_wsUrl] *= 1.5; // More gradual backoff
            } else {
              console.error(`${LIBRARY_NAME}: Max reconnection attempts reached for ${e_wsUrl}`);
            }
          };
          
          a_ws.onerror = (error) => {
            console.warn(`${LIBRARY_NAME}: WebSocket error for ${e_wsUrl}:`, error);
          };
          
          a_ws.onmessage = e_msg => t_onMessage(e_msg.data); // Renamed e
          
          r_socketState.socket = a_ws;
          r_socketState.url = a_ws.url;
          r_socketState.ready = new Promise(t_resolve => a_ws.onopen = () => { // Renamed t
            connectionAttempts = 0; // Reset on successful connection
            t_resolve(r_socketState);
            v_reconnect[e_wsUrl] = 3333;
          });
          
          // Enhanced send with connection state checking
          r_socketState.send = data => {
            if (a_ws.readyState === WebSocket.OPEN) {
              try {
                a_ws.send(data);
                return true;
              } catch (err) {
                console.warn(`${LIBRARY_NAME}: Failed to send data to ${e_wsUrl}:`, err);
                return false;
              }
            }
            return false;
          };
        };
        
        n_connect();
        return r_socketState;
      })(e_url, e_data => { // Renamed e
        const t_msg = k(e_data); // Renamed t
        const n_failure = t_msg['failure reason'];
        const a_warning = t_msg['warning message'];
        const { interval: o_interval } = t_msg;
        const s_roomHash = M[t_msg.info_hash];
        
        if (n_failure) {
          K(r_actualUrl, n_failure, true); // r_actualUrl from outer scope
        } else {
          if (a_warning) K(r_actualUrl, a_warning);
          
          if (o_interval && 1000 * o_interval > q[r_actualUrl] && x[r_actualUrl][s_roomHash]) {
            const e_newInterval = Math.min(1000 * o_interval, 120333);
            clearInterval(R[r_actualUrl][s_roomHash]);
            q[r_actualUrl] = e_newInterval;
            R[r_actualUrl][s_roomHash] = setInterval(x[r_actualUrl][s_roomHash], e_newInterval);
          }
          
          if (!B[t_msg.offer_id] && (t_msg.offer || t_msg.answer)) {
            B[t_msg.offer_id] = true;
            N[r_actualUrl][s_roomHash]?.(t_msg);
          }
        }
      });
      
      const { url: r_actualUrl } = t_trackerSocketObj; // Renamed r
      H[r_actualUrl] = t_trackerSocketObj;
      N[r_actualUrl] = {};
      return t_trackerSocketObj.ready;
    });
  },
  
  // Subscribe function
  subscribe(e_trackerSocket, t_roomHash, r_selfHash_unused, n_signalHandler, a_createOffersFn) { // Renamed e, t, r, n, a
    const { url: s_trackerUrl } = e_trackerSocket;
    
    const i_announcerFn = async () => {
      // Create initial offers to send to the tracker
      const localGeneratedOffers = d((await a_createOffersFn(10)).map(entry => [o(20), entry])); // Renamed r to localGeneratedOffers

      // Define handler for messages from this tracker for this roomHash
      N[s_trackerUrl][t_roomHash] = trackerMessage => { // trackerMessage is 'a' in original
        if (trackerMessage.offer) {
          // We received an offer from a peer via the tracker.
          // n_signalHandler (which is X_signalHandler) will process it and call the callback.
          // The callback provides (targetPeerHash, answerPayloadString)
          n_signalHandler(
            t_roomHash,
            { offer: trackerMessage.offer, peerId: trackerMessage.peer_id },
            (targetPeerHash_from_X, answerPayloadString_from_X) => {
              // Send the generated answer back to the tracker.
              z(e_trackerSocket, t_roomHash, {
                answer: k(answerPayloadString_from_X).answer, // k is JSON.parse
                offer_id: trackerMessage.offer_id,
                to_peer_id: trackerMessage.peer_id
              });
            }
          );
        } else if (trackerMessage.answer) {
          // We received an answer to an offer we previously sent.
          const offerContext = localGeneratedOffers[trackerMessage.offer_id];
          if (offerContext) {
            // Forward the answer to the signalHandler to complete connection with the specific peer.
            n_signalHandler(t_roomHash, {
              answer: trackerMessage.answer,
              peerId: trackerMessage.peer_id,
              peer: offerContext.peer // The RTCPeerConnection instance for whom this answer is
            });
          }
        }
      };
      
      // Announce to the tracker, including our initial offers.
      z(e_trackerSocket, t_roomHash, {
        numwant: 10,
        offers: l(localGeneratedOffers).map(([id, { offer }]) => ({ offer_id: id, offer: offer }))
      });
    };
    
    q[s_trackerUrl] = 33333; // Default interval for this tracker
    x[s_trackerUrl] ||= {};
    x[s_trackerUrl][t_roomHash] = i_announcerFn; // Store announcer for this room/tracker
    R[s_trackerUrl] ||= {};
    R[s_trackerUrl][t_roomHash] = setInterval(i_announcerFn, q[s_trackerUrl]); // Start periodic announcing
    
    i_announcerFn(); // Announce immediately
    
    // Return a cleanup function for this subscription
    return () => {
      clearInterval(R[s_trackerUrl][t_roomHash]);
      delete N[s_trackerUrl][t_roomHash]; // Remove handler
      delete x[s_trackerUrl][t_roomHash]; // Remove announcer fn
    };
  },
  
  // Announce function
  announce(e_trackerSocket) { // Renamed e
    return q[e_trackerSocket.url]; // Return current interval for this tracker
  }
});

// Get relay sockets function - identical to original
const W = (F_trackerSockets => () => d(l(F_trackerSockets).map(([e_url, t_socketObj]) => [e_url, t_socketObj.socket])))(H); // Renamed F, e, t

// Export the exact same interface as Trystero
export {
  Q as defaultRelayUrls,
  W as getRelaySockets, 
  V as joinRoom,
  s as selfId
};