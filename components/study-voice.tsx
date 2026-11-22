"use client";

import { useEffect, useRef, useState } from "react";
import {
  FlipHorizontal2,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import FocusAtmosphere from "./focus-atmosphere";

export type VoiceRoom = {
  id: string;
  title: string;
  background: "night" | "forest" | "dawn";
};
type Member = { id: string; name: string; mic: boolean; camera: boolean };
type Signal = {
  id: number;
  sender: string;
  description: RTCSessionDescriptionInit;
};
type Peer = { connection: RTCPeerConnection; stream: MediaStream };
type Kind = "audio" | "video";
type Seat = readonly [x: number, y: number];

// The first seat belongs to the local learner. The remaining seats are placed
// around it so the preview and connecting lines share the same coordinates.
const roomSeats: readonly (readonly Seat[])[] = [
  [[50, 48]],
  [
    [31, 54],
    [69, 46],
  ],
  [
    [50, 50],
    [19, 29],
    [81, 71],
  ],
  [
    [50, 50],
    [19, 26],
    [80, 27],
    [78, 75],
  ],
];

async function voiceRequest<T>(payload: object, keepalive = false): Promise<T> {
  const response = await fetch("/api/groups/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive,
    signal: keepalive ? undefined : AbortSignal.timeout(8000),
  });
  const json = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(json.error), { status: response.status });
  return json;
}

function gatherIce(connection: RTCPeerConnection) {
  if (connection.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timeout);
      connection.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => {
      if (connection.iceGatheringState === "complete") done();
    };
    const timeout = setTimeout(done, 5000);
    connection.addEventListener("icegatheringstatechange", check);
  });
}

function MediaTile({
  stream,
  muted,
  volume,
  visible,
  mirrored = false,
}: {
  stream?: MediaStream;
  muted: boolean;
  volume: number;
  visible: boolean;
  mirrored?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [needsPlay, setNeedsPlay] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video || !stream) return;
    let disposed = false;
    const play = () => {
      if (!stream.getTracks().length) return;
      video
        .play()
        .then(() => {
          if (!disposed) setNeedsPlay(false);
        })
        .catch(() => {
          if (!disposed) setNeedsPlay(true);
        });
    };
    video.srcObject = stream;
    stream.addEventListener("addtrack", play);
    play();
    return () => {
      disposed = true;
      stream.removeEventListener("addtrack", play);
      video.srcObject = null;
    };
  }, [stream]);
  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);
  return (
    <>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        data-mirrored={mirrored || undefined}
        className={visible ? "" : "voice-video-hidden"}
      />
      {needsPlay && !muted && (
        <button
          className="btn secondary voice-play"
          onClick={() => {
            void ref.current
              ?.play()
              .then(() => setNeedsPlay(false))
              .catch(() => {});
          }}
        >
          Enable playback
        </button>
      )}
    </>
  );
}

export default function StudyVoice({
  room,
  onLeave,
}: {
  room: VoiceRoom;
  onLeave: () => void;
}) {
  const sessionRef = useRef<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [joined, setJoined] = useState(false);
  const [mic, setMic] = useState(false);
  const [camera, setCamera] = useState(false);
  const [mirroredPreview, setMirroredPreview] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [error, setError] = useState("");
  const [deviceBusy, setDeviceBusy] = useState(false);
  const peers = useRef(new Map<string, Peer>());
  const tracks = useRef<Partial<Record<Kind, MediaStreamTrack>>>({});
  const deviceLock = useRef(false);

  useEffect(() => {
    let disposed = false;
    let connected = false;
    let nextPoll: ReturnType<typeof setTimeout>;
    let after = 0;
    let iceServers: RTCIceServer[] = [];
    let lastPoll = 0;
    const session = crypto.randomUUID();
    sessionRef.current = session;
    const peerMap = peers.current;
    const request = <T,>(action: string, extra: object = {}) =>
      voiceRequest<T>({ room: room.id, session, action, ...extra });
    const releaseSession = () => {
      if (!connected) return;
      connected = false;
      void voiceRequest(
        { room: room.id, session, action: "leave" },
        true,
      ).catch(() => {});
    };
    const leave = () => {
      clearTimeout(nextPoll);
      if (sessionRef.current !== session) return;
      sessionRef.current = null;
      for (const track of Object.values(tracks.current)) track.stop();
      tracks.current = {};
      for (const peer of peerMap.values()) peer.connection.close();
      peerMap.clear();
      releaseSession();
    };
    const disconnect = () => {
      leave();
      setJoined(false);
      setMembers([]);
      setMic(false);
      setCamera(false);
      setLocalStream(undefined);
    };
    const hide = () => {
      disconnect();
      setError(
        "The call ended when you left this page. Leave the room and join again.",
      );
    };
    window.addEventListener("pagehide", hide);
    const report = (reason: unknown) => {
      if (!disposed)
        setError(
          reason instanceof Error
            ? reason.message
            : "The call could not connect.",
        );
    };
    const attachTracks = async (connection: RTCPeerConnection) => {
      for (const transceiver of connection.getTransceivers()) {
        const kind = transceiver.receiver.track.kind as Kind;
        await transceiver.sender.replaceTrack(tracks.current[kind] || null);
      }
    };
    const sendDescription = async (
      id: string,
      connection: RTCPeerConnection,
      description: RTCSessionDescriptionInit,
    ) => {
      await connection.setLocalDescription(description);
      await gatherIce(connection);
      if (
        disposed ||
        connection.signalingState === "closed" ||
        !connection.localDescription
      )
        return;
      await request("signal", {
        target: id,
        description: connection.localDescription.toJSON(),
      });
    };
    const connectPeer = (id: string) => {
      const existing = peerMap.get(id);
      if (existing) return existing;
      const connection = new RTCPeerConnection({ iceServers });
      const stream = new MediaStream();
      const peer = { connection, stream };
      peerMap.set(id, peer);
      connection.ontrack = ({ track }) => stream.addTrack(track);
      connection.onconnectionstatechange = () => {
        if (disposed || peerMap.get(id) !== peer) return;
        setStatuses((previous) => ({
          ...previous,
          [id]: connection.connectionState,
        }));
      };
      // A stable ordering ensures only one side offers. Both tracks can then be
      // toggled independently without creating another offer.
      if (session < id) {
        connection.addTransceiver("audio", { direction: "sendrecv" });
        connection.addTransceiver("video", { direction: "sendrecv" });
        void (async () => {
          await attachTracks(connection);
          await sendDescription(id, connection, await connection.createOffer());
        })().catch(report);
      }
      return peer;
    };
    const receive = async (signal: Signal) => {
      const { connection } = connectPeer(signal.sender);
      if (signal.description.type === "offer" && signal.sender < session) {
        await connection.setRemoteDescription(signal.description);
        for (const transceiver of connection.getTransceivers())
          transceiver.direction = "sendrecv";
        await attachTracks(connection);
        await sendDescription(
          signal.sender,
          connection,
          await connection.createAnswer(),
        );
      } else if (
        signal.description.type === "answer" &&
        connection.signalingState === "have-local-offer"
      ) {
        await connection.setRemoteDescription(signal.description);
      }
    };
    const poll = async () => {
      if (disposed || sessionRef.current !== session) return;
      try {
        const result = await request<{ members: Member[]; signals: Signal[] }>(
          "poll",
          {
            after,
            mic: !!tracks.current.audio,
            camera: !!tracks.current.video,
          },
        );
        if (disposed || sessionRef.current !== session) return;
        const ids = new Set(result.members.map((member) => member.id));
        for (const [id, peer] of peerMap) {
          if (!ids.has(id)) {
            peerMap.delete(id);
            peer.connection.close();
            setStatuses((previous) => {
              const next = { ...previous };
              delete next[id];
              return next;
            });
          }
        }
        for (const member of result.members)
          if (member.id !== session) connectPeer(member.id);
        setMembers(result.members);
        for (const signal of result.signals) {
          after = Math.max(after, signal.id);
          if (ids.has(signal.sender)) void receive(signal).catch(report);
        }
        lastPoll = Date.now();
      } catch (reason) {
        report(reason);
        if (
          (reason as { status?: number }).status === 403 ||
          Date.now() - lastPoll > 30000
        ) {
          if (!disposed && sessionRef.current === session) disconnect();
          return;
        }
      }
      nextPoll = setTimeout(poll, 1200);
    };
    void (async () => {
      await Promise.resolve();
      if (disposed || sessionRef.current !== session) return;
      const result = await request<{ iceServers: RTCIceServer[] }>("join");
      connected = true;
      if (disposed || sessionRef.current !== session) {
        releaseSession();
        return;
      }
      iceServers = result.iceServers;
      setJoined(true);
      lastPoll = Date.now();
      void poll();
    })().catch(report);
    return () => {
      disposed = true;
      clearTimeout(nextPoll);
      window.removeEventListener("pagehide", hide);
      leave();
    };
  }, [room.id]);

  async function toggle(kind: Kind) {
    const session = sessionRef.current;
    if (!session || deviceLock.current) return;
    deviceLock.current = true;
    setDeviceBusy(true);
    setError("");
    try {
      const current = tracks.current[kind];
      if (current) {
        delete tracks.current[kind];
        current.stop();
      } else {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Open SkillSwap on HTTPS or localhost to use your camera or microphone.",
          );
        const media = await navigator.mediaDevices.getUserMedia(
          kind === "audio"
            ? {
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
              }
            : {
                video: {
                  width: { ideal: 640 },
                  height: { ideal: 360 },
                  frameRate: { ideal: 20, max: 24 },
                },
              },
        );
        if (sessionRef.current !== session) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        const track = media.getTracks()[0];
        tracks.current[kind] = track;
        track.onended = () => {
          if (tracks.current[kind] !== track) return;
          delete tracks.current[kind];
          if (kind === "audio") setMic(false);
          else {
            setCamera(false);
            setLocalStream(undefined);
          }
        };
      }
      const track = tracks.current[kind];
      if (kind === "audio") setMic(!!track);
      else {
        setCamera(!!track);
        setLocalStream(track ? new MediaStream([track]) : undefined);
      }
      await Promise.all(
        [...peers.current.values()].map(({ connection }) => {
          const sender = connection
            .getTransceivers()
            .find(
              (transceiver) => transceiver.receiver.track.kind === kind,
            )?.sender;
          return sender?.replaceTrack(track || null);
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof DOMException
          ? "Could not access that device. Check browser permissions and whether another app is using it."
          : reason instanceof Error
            ? reason.message
            : "The device could not be opened.",
      );
    } finally {
      deviceLock.current = false;
      setDeviceBusy(false);
    }
  }

  const remoteMembers = members.filter(
    (member) => member.id !== sessionRef.current,
  );
  const seats = roomSeats[remoteMembers.length];
  const [ownX, ownY] = seats?.[0] ?? roomSeats[0][0];

  return (
    <section className={`study-voice voice-${room.background}`}>
      <header className="voice-heading">
        <div>
          <span className="eyebrow">LIVE STUDY ROOM</span>
          <h2>{room.title}</h2>
          <p>
            {joined
              ? `${Math.max(1, members.length)} of 4 seats in use`
              : error
                ? "Call disconnected"
                : "Joining room…"}
          </p>
        </div>
        <button className="btn secondary voice-leave" onClick={onLeave}>
          <PhoneOff size={16} /> Leave room
        </button>
      </header>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div
        className="voice-stage"
        data-arranged={seats ? "true" : undefined}
        role="region"
        aria-label="Room participants"
      >
        {seats && remoteMembers.length > 0 && (
          <svg
            className="voice-links"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {remoteMembers.map((member, index) => {
              const [x, y] = seats[index + 1];
              return (
                <path
                  key={member.id}
                  d={`M ${ownX} ${ownY} C ${(ownX + x) / 2} ${ownY}, ${(ownX + x) / 2} ${y}, ${x} ${y}`}
                  data-connected={statuses[member.id] === "connected"}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
        )}
        <article
          className="voice-tile voice-tile-self"
          style={{ left: `${ownX}%`, top: `${ownY}%` }}
        >
          <MediaTile
            stream={localStream}
            visible={camera}
            muted
            volume={0}
            mirrored={mirroredPreview}
          />
          {!camera && <span className="voice-avatar">Y</span>}
          <div className="voice-tile-label">
            You {mic ? <Mic size={14} /> : <MicOff size={14} />}
          </div>
        </article>
        {remoteMembers.map((member, index) => {
          const status = statuses[member.id];
          const showingVideo = member.camera && status === "connected";
          const seat = seats?.[index + 1];
          return (
            <article
              className="voice-tile"
              key={member.id}
              style={
                seat ? { left: `${seat[0]}%`, top: `${seat[1]}%` } : undefined
              }
            >
              <MediaTile
                stream={peers.current.get(member.id)?.stream}
                visible={showingVideo}
                muted={false}
                volume={volume}
              />
              {!showingVideo && (
                <span className="voice-avatar">
                  {member.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="voice-tile-label">
                {member.name}{" "}
                {member.mic ? <Mic size={14} /> : <MicOff size={14} />}
              </div>
              {status !== "connected" && (
                <small className="voice-status">
                  {status === "failed"
                    ? "Connection failed. Try rejoining."
                    : "Connecting…"}
                </small>
              )}
            </article>
          );
        })}
        {joined && !remoteMembers.length && (
          <p className="voice-stage-note">Waiting for others to join</p>
        )}
      </div>
      <div className="voice-controls">
        <button
          className="btn secondary"
          disabled={!joined || deviceBusy}
          aria-pressed={mic}
          onClick={() => void toggle("audio")}
        >
          {mic ? <Mic size={17} /> : <MicOff size={17} />}{" "}
          {mic ? "Mute mic" : "Enable mic"}
        </button>
        <button
          className="btn secondary"
          disabled={!joined || deviceBusy}
          aria-pressed={camera}
          onClick={() => void toggle("video")}
        >
          {camera ? <Video size={17} /> : <VideoOff size={17} />}{" "}
          {camera ? "Turn camera off" : "Enable camera"}
        </button>
        {camera && (
          <button
            type="button"
            className="btn secondary"
            aria-pressed={mirroredPreview}
            onClick={() => setMirroredPreview((current) => !current)}
          >
            <FlipHorizontal2 size={17} /> Mirror preview
          </button>
        )}
        <label>
          Call volume{" "}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </label>
        <FocusAtmosphere active allowVideo={false} />
      </div>
    </section>
  );
}
