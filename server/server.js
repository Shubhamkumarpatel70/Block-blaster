const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const fs = require("fs").promises;
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.static(path.join(__dirname, "../public"))); // Serve frontend files

const SCORE_FILE = path.join(__dirname, "userdetailsscore.json");

// Ensure JSON file exists
async function ensureScoreFile() {
    try {
        await fs.access(SCORE_FILE);
    } catch (error) {
        await fs.writeFile(SCORE_FILE, JSON.stringify([]), "utf8");
    }
}

// Load leaderboard from file
async function loadLeaderboard() {
    await ensureScoreFile();
    try {
        const data = await fs.readFile(SCORE_FILE, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("❌ Error reading leaderboard file:", error);
        return [];
    }
}

// Save leaderboard to file
async function saveLeaderboard(leaderboard) {
    try {
        await fs.writeFile(SCORE_FILE, JSON.stringify(leaderboard, null, 2), "utf8");
    } catch (error) {
        console.error("❌ Error saving leaderboard:", error);
    }
}

// WebSocket Connection Handler
wss.on("connection", async (ws) => {
    console.log("✅ New player connected");

    let leaderboard = await loadLeaderboard();
    leaderboard = addPositions(leaderboard);

    // Send the current leaderboard to the new player
    ws.send(JSON.stringify({ type: "leaderboard", leaderboard }));

    // Handle messages from the player
    ws.on("message", async (message) => {
        try {
            let data = JSON.parse(message);

            if (data.type === "registerPlayer") {
                leaderboard = await registerPlayer(data.name, data.qid);
                ws.send(JSON.stringify({ type: "registered", success: true, leaderboard }));
            }

            if (data.type === "updateScore") {
                leaderboard = await updateLeaderboard(data.name, data.qid, data.score);
                broadcastLeaderboard(leaderboard);
            }
        } catch (error) {
            console.error("❌ Error processing message:", error);
        }
    });

    ws.on("close", () => {
        console.log("❌ Player disconnected");
    });

    ws.on("error", (error) => {
        console.error("⚠ WebSocket error:", error);
    });
});

// Register new player
async function registerPlayer(playerName, playerId) {
    let leaderboard = await loadLeaderboard();

    let player = leaderboard.find((p) => p.qid === playerId);

    if (!player) {
        leaderboard.push({ name: playerName, qid: playerId, score: 0 });
        leaderboard = addPositions(leaderboard);
        await saveLeaderboard(leaderboard);
    }

    return leaderboard;
}

// Update player score
async function updateLeaderboard(playerName, playerId, newScore) {
    let leaderboard = await loadLeaderboard();

    let player = leaderboard.find((p) => p.qid === playerId);

    if (player) {
        player.score = Math.max(player.score, newScore);
    } else {
        leaderboard.push({ name: playerName, qid: playerId, score: newScore });
    }

    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = addPositions(leaderboard);
    await saveLeaderboard(leaderboard);

    return leaderboard;
}

// Assign Positions
function addPositions(leaderboard) {
    return leaderboard.map((player, index) => ({
        ...player,
        position: index + 1
    }));
}

// Broadcast leaderboard to all players
function broadcastLeaderboard(leaderboard) {
    leaderboard = addPositions(leaderboard);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "leaderboard", leaderboard }));
        }
    });
}

// Serve dashboard.html
app.get("/dashboard.html", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/dashboard.html"));
});

// Serve index.html for root
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Start Server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🚀 WebSocket server running on http://localhost:${PORT}`);
});
