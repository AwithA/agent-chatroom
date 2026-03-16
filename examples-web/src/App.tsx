import { useState, useEffect, useRef } from "react";
import { ChatClient, MessageData, RoomInfo } from "@agent-chatroom/client-web";
import "./App.css";

function App() {
  const [wsUrl, setWsUrl] = useState("ws://localhost:3001");
  const [client, setClient] = useState<ChatClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!client) return;

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleMessage = (msg: MessageData) => {
      if (currentRoom && msg.roomId === currentRoom.roomId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    client.on("connect", handleConnect);
    client.on("disconnect", handleDisconnect);
    client.on("newMessage", handleMessage);

    return () => {
      client.off("connect", handleConnect);
      client.off("disconnect", handleDisconnect);
      client.off("newMessage", handleMessage);
    };
  }, [client, currentRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleConnect = async () => {
    try {
      const newClient = new ChatClient({ url: wsUrl });
      setClient(newClient);
      const uid = await newClient.connect();
      setUserId(uid);
      if (nickname) {
        await newClient.setNickname(nickname);
      }
      await loadRooms(newClient);
    } catch (error) {
      console.error("Connection failed:", error);
      alert("连接失败");
    }
  };

  const handleDisconnect = () => {
    if (client) {
      client.disconnect();
    }
    setClient(null);
    setUserId("");
    setRooms([]);
    setCurrentRoom(null);
    setMessages([]);
  };

  const loadRooms = async (clientInstance: ChatClient = client!) => {
    try {
      const result = await clientInstance.listRooms();
      const roomInfos = await Promise.all(
        result.rooms.map((r) => clientInstance.getRoomInfo(r.roomId)),
      );
      setRooms(roomInfos);
    } catch (error) {
      console.error("Failed to load rooms:", error);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim() || !client) return;
    try {
      await client.createRoom(newRoomName);
      setNewRoomName("");
      await loadRooms();
    } catch (error) {
      console.error("Failed to create room:", error);
      alert("创建房间失败");
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!client) return;
    try {
      await client.joinRoom(roomId);
      const roomInfo = await client.getRoomInfo(roomId);
      setCurrentRoom(roomInfo);
      const history = await client.getMessageHistory(roomId, 50);
      setMessages(history.messages);
    } catch (error) {
      console.error("Failed to join room:", error);
      alert("加入房间失败");
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentRoom || !client) return;
    try {
      await client.leaveRoom(currentRoom.roomId);
      setCurrentRoom(null);
      setMessages([]);
      await loadRooms();
    } catch (error) {
      console.error("Failed to leave room:", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoom || !inputMessage.trim() || !client) return;
    try {
      await client.sendMessage(currentRoom.roomId, inputMessage);
      setInputMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("发送消息失败");
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="connection-panel">
          <h3>连接设置</h3>
          {!connected ? (
            <>
              <input
                type="text"
                placeholder="WebSocket 地址"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
              />
              <input
                type="text"
                placeholder="昵称 (可选)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <button onClick={handleConnect}>连接</button>
            </>
          ) : (
            <>
              <p>服务器: {wsUrl}</p>
              <p>用户ID: {userId}</p>
              <button onClick={handleDisconnect}>断开连接</button>
            </>
          )}
        </div>

        {connected && (
          <>
            <div className="room-create">
              <h3>创建房间</h3>
              <input
                type="text"
                placeholder="房间名称"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
              />
              <button onClick={handleCreateRoom}>创建</button>
            </div>

            <div className="room-list">
              <h3>房间列表</h3>
              <button
                onClick={() => {
                  loadRooms();
                }}
                className="refresh-btn"
              >
                刷新
              </button>
              {rooms.map((room) => (
                <div
                  key={room.roomId}
                  className={`room-item ${currentRoom?.roomId === room.roomId ? "active" : ""}`}
                  onClick={() => handleJoinRoom(room.roomId)}
                >
                  <div className="room-name">{room.name}</div>
                  <div className="room-info">
                    {room.memberCount || room.memberIds.length} 人
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="main-content">
        {currentRoom ? (
          <>
            <div className="chat-header">
              <h2>{currentRoom.name}</h2>
              <button onClick={handleLeaveRoom}>离开房间</button>
            </div>
            <div className="messages">
              {messages.map((msg) => (
                <div
                  key={msg.messageId}
                  className={`message ${msg.senderId === userId ? "own" : ""} ${msg.type === "system" ? "system" : ""}`}
                >
                  <div className="message-sender">
                    {msg.senderNickname || msg.senderId}
                  </div>
                  <div className="message-content">{msg.content}</div>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className="message-input" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="输入消息..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
              />
              <button type="submit">发送</button>
            </form>
          </>
        ) : (
          <div className="empty-state">
            <p>{connected ? "选择一个房间开始聊天" : "请先连接到服务器"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
